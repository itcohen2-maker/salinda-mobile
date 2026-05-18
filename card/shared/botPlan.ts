/**
 * Shared bot plan enumeration + difficulty pick (local vs-bot + server bot).
 */

import type { BotDifficulty, Card, EquationCommitPayload } from './types';
import { enumerateEquationCommitOptions } from './validation';

export type { BotDifficulty };

export type BotStagedPlanPick = {
  target: number;
  equationDisplay: string;
  stagedCardIds: string[];
  equationCommits: EquationCommitPayload[];
};

export type BotTargetOption = {
  result: number;
  equation: string;
};

type InternalPlan = BotStagedPlanPick & { score: number; usesWild: boolean };

/** Optional RNG for tests / replay; defaults to Math.random. */
export type PickBotPlanOptions = {
  rng?: () => number;
};

const EASY_BLUNDER_CHANCE = 0.2;
const MEDIUM_RANDOM_BRANCH = 0.25;

function pickFromPlans(
  plans: InternalPlan[],
  difficulty: BotDifficulty,
  rng: () => number,
): BotStagedPlanPick | null {
  if (plans.length === 0) return null;
  const scores = plans.map((p) => p.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  const strip = (p: InternalPlan): BotStagedPlanPick => ({
    target: p.target,
    equationDisplay: p.equationDisplay,
    stagedCardIds: p.stagedCardIds,
    equationCommits: p.equationCommits,
  });

  switch (difficulty) {
    case 'hard': {
      // Wild-penalty: using a Wild in a low-value equation is wasteful.
      // Penalize Wild-using plans unless the equation is high-value (score >= 5).
      const WILD_PENALTY = 3;
      const HIGH_VALUE_THRESHOLD = 5;
      const adjusted = plans.map((p) => ({
        ...p,
        adjScore: p.score - (p.usesWild && p.score < HIGH_VALUE_THRESHOLD ? WILD_PENALTY : 0),
      }));
      const maxAdj = Math.max(...adjusted.map((p) => p.adjScore));
      const tier = adjusted.filter((p) => p.adjScore === maxAdj);
      return strip(tier[0]!);
    }
    case 'easy': {
      if (rng() < EASY_BLUNDER_CHANCE) {
        const suboptimal = plans.filter((p) => p.score < maxScore);
        if (suboptimal.length > 0) {
          return strip(suboptimal[Math.floor(rng() * suboptimal.length)]!);
        }
      }
      return strip(plans[Math.floor(rng() * plans.length)]!);
    }
    case 'medium': {
      if (rng() < MEDIUM_RANDOM_BRANCH) {
        return strip(plans[Math.floor(rng() * plans.length)]!);
      }
      const ideal = (minScore + maxScore) / 2;
      let best = plans[0]!;
      let bestDist = Math.abs(best.score - ideal);
      for (const p of plans) {
        const d = Math.abs(p.score - ideal);
        if (d < bestDist) {
          best = p;
          bestDist = d;
        }
      }
      return strip(best);
    }
    case 'pity': {
      // 80%: pick the plan with the LOWEST score (deliberate blunder).
      // 20%: pick randomly (occasional accidental competence).
      if (rng() < 0.8) {
        const tier = plans.filter((p) => p.score === minScore);
        return strip(tier[0]!);
      }
      return strip(plans[Math.floor(rng() * plans.length)]!);
    }
    default: {
      const _e: never = difficulty;
      void _e;
      return null;
    }
  }
}

function collectPlans(
  validTargets: readonly { result: number; equation: string }[],
  hand: Card[],
  maxWild: number,
  validateStagedCards: (
    staged: Card[],
    opCard: Card | null,
    target: number,
    maxWildArg: number,
  ) => boolean,
): InternalPlan[] {
  const plans: InternalPlan[] = [];
  for (const option of validTargets) {
    const commitOptions = enumerateEquationCommitOptions(hand, option.equation);
    for (const equationCommits of commitOptions) {
      const commitIds = new Set(equationCommits.map((commit) => commit.cardId));
      const candidates = hand.filter(
        (card) =>
          (card.type === 'number' || card.type === 'wild') &&
          !commitIds.has(card.id),
      );
      const totalMasks = 1 << candidates.length;
      for (let mask = 1; mask < totalMasks; mask++) {
        const stagedCards: Card[] = [];
        let wildCount = 0;
        for (let index = 0; index < candidates.length; index++) {
          if ((mask & (1 << index)) === 0) continue;
          const card = candidates[index]!;
          if (card.type === 'wild') wildCount++;
          stagedCards.push(card);
        }
        if (wildCount > 1) continue;
        if (stagedCards.length === 0) continue;
        // Multi-play: numbers/wilds only — opCard=null forces simple sum
        if (!validateStagedCards(stagedCards, null, option.result, maxWild)) continue;
        const score = stagedCards.length + equationCommits.length;
        const usesWild = stagedCards.some((c) => c.type === 'wild');
        plans.push({
          target: option.result,
          equationDisplay: option.equation,
          stagedCardIds: [...stagedCards.map((c) => c.id)],
          equationCommits,
          score,
          usesWild,
        });
      }
    }
  }
  return plans;
}

export function getSolvableTargetOptions(
  validTargets: readonly { result: number; equation: string }[],
  hand: Card[],
  maxWild: number,
  validateStagedCards: (
    staged: Card[],
    opCard: Card | null,
    target: number,
    maxWildArg: number,
  ) => boolean,
): BotTargetOption[] {
  const seen = new Set<string>();
  const options: BotTargetOption[] = [];
  for (const plan of collectPlans(validTargets, hand, maxWild, validateStagedCards)) {
    const key = `${plan.target}::${plan.equationDisplay}`;
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ result: plan.target, equation: plan.equationDisplay });
  }
  return options;
}

/**
 * Enumerate valid (number+wild) staging subsets per valid target and pick one plan by difficulty.
 */
export function pickBotStagedPlan(
  validTargets: readonly { result: number; equation: string }[],
  hand: Card[],
  maxWild: number,
  validateStagedCards: (
    staged: Card[],
    opCard: Card | null,
    target: number,
    maxWildArg: number,
  ) => boolean,
  difficulty: BotDifficulty,
  options?: PickBotPlanOptions,
): BotStagedPlanPick | null {
  const rng = options?.rng ?? Math.random;
  const plans = collectPlans(validTargets, hand, maxWild, validateStagedCards);
  return pickFromPlans(plans, difficulty, rng);
}

/**
 * Delay between bot micro-steps (ms): [min, max] inclusive jitter.
 * Longer delays on easier levels so players can read the exercise; Hard is still the fastest tier.
 */
export function botStepDelayRange(difficulty: BotDifficulty): { min: number; max: number } {
  switch (difficulty) {
    case 'easy':
      return { min: 1470, max: 1870 };
    case 'medium':
      return { min: 1200, max: 1500 };
    case 'hard':
      return { min: 900, max: 1200 };
    case 'pity':
      return { min: 2000, max: 3000 };
    default: {
      const _e: never = difficulty;
      void _e;
      return { min: 1870, max: 2800 };
    }
  }
}
