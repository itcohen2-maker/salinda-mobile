// Client-side bot brain.
// Pure function: decideBotAction(state, difficulty, opts?) → BotAction | null.
// Port of server/src/socketHandlers.ts lines 313-458 retargeted to the
// local reducer's types and helpers.
//
// See spec §0.5.1, §0.6, server bot reference sections 1-5.

import type {
  GameState,
  Card,
  EquationCommitPayload,
} from '../../index';
import {
  validateFractionPlay,
  validateIdenticalPlay,
  validateStagedCards,
  fractionDenominator,
} from '../../shared/cardValidation';
import type { BotAction, BotDifficulty } from './types';
import { pickBotStagedPlan } from '../../shared/botPlan';
import { pickBotOverflowSwap } from '../../shared/overflowSwap';
import { equationMatchesDiceAndResult, extractEquationOperators } from '../../shared/validation';

export type DecideBotActionOptions = {
  /** Defaults to Math.random; tests may inject a sequence. */
  rng?: () => number;
};

function resolveBotRng(state: GameState, opts?: DecideBotActionOptions): () => number {
  if (opts?.rng) return opts.rng;
  const bc = state.botConfig;
  if (bc && typeof (bc as { rng?: () => number }).rng === 'function') {
    return (bc as { rng: () => number }).rng;
  }
  return Math.random;
}

/**
 * Brute-force subset enumerator + difficulty pick (shared with server).
 */
function buildBotStagedPlan(
  state: GameState,
  difficulty: BotDifficulty,
  rng: () => number,
): {
  target: number;
  equationDisplay: string;
  stagedCardIds: string[];
  equationCommits: EquationCommitPayload[];
} | null {
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const maxWild = state.mathRangeMax ?? 25;
  const viableTargets = state.validTargets.filter((target) =>
    equationMatchesDiceAndResult(target.equation, target.result, state.dice),
  );
  return pickBotStagedPlan(
    viableTargets,
    hand,
    maxWild,
    validateStagedCards,
    difficulty,
    { rng },
  );
}

/**
 * Defense priority: divisible number → wild (wildResolve=fractionPenalty)
 *                   → counter fraction → penalty.
 */
function handleBotDefense(
  state: GameState,
  difficulty: BotDifficulty,
  rng: () => number,
): BotAction {
  // Pity bot: always ignore defense — take the penalty.
  if (difficulty === 'pity') {
    return { kind: 'defendFractionPenalty' };
  }

  // Easy bot: 50% chance to ignore defense entirely (simulates inattentive beginner).
  if (difficulty === 'easy' && rng() < 0.5) {
    return { kind: 'defendFractionPenalty' };
  }

  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const penalty = state.fractionPenalty;

  const divisibleCard = hand.find(
    (card) =>
      card.type === 'number' &&
      (card.value ?? 0) > 0 &&
      (card.value ?? 0) % penalty === 0,
  );
  if (divisibleCard) {
    return { kind: 'defendFractionSolve', cardId: divisibleCard.id };
  }

  const wildCard = hand.find((card) => card.type === 'wild');
  if (wildCard) {
    return {
      kind: 'defendFractionSolve',
      cardId: wildCard.id,
      wildResolve: Math.max(penalty, 1),
    };
  }

  const counterFraction = hand.find((card) => card.type === 'fraction');
  if (counterFraction) {
    return { kind: 'playFractionBlock', cardId: counterFraction.id };
  }

  return { kind: 'defendFractionPenalty' };
}

/**
 * Pre-roll priority: identical-playable → attack fraction → rollDice.
 *
 * Medium/Hard preference layer: a wild is far more valuable as an equation
 * variable (via `validateStagedCards`, which accepts wilds as fill-ins) than
 * as a one-shot identical discard. When the only identical candidate is a
 * wild and the bot has enough other numeric material to build an equation
 * after rolling, prefer a non-wild identical if one exists, otherwise defer
 * the wild and fall through to the fraction-attack / rollDice branches so
 * the wild survives into the `building` phase. Easy keeps the eager
 * original behaviour.
 */
function handleBotPreRoll(
  state: GameState,
  difficulty: BotDifficulty,
  rng: () => number,
): BotAction {
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const topDiscard = state.discardPile[state.discardPile.length - 1];

  // Mirror the PLAY_IDENTICAL reducer guards (index.tsx): identical play is a
  // no-op after a fraction resolution or once two identicals have been chained.
  // Choosing it anyway makes the reducer no-op and the bot re-decide the same
  // rejected action forever → frozen turn. (The reducer also requires pre-roll
  // phase, but the BOT_STEP safety net covers the dormant roll-dice case, and
  // gating on phase here would change handleBotPreRoll's roll-dice behaviour.)
  const canPlayIdentical =
    !state.fractionAttackResolved &&
    (state.consecutiveIdenticalPlays ?? 0) < 2;
  const allIdenticalCandidates = canPlayIdentical
    ? hand.filter((card) => validateIdenticalPlay(card, topDiscard))
    : [];

  let identicalCard: Card | undefined = allIdenticalCandidates[0];

  // Medium/Hard (not easy, not pity): prefer non-wild identical; defer wild if
  // it can plausibly be used in an equation.
  if (difficulty !== 'easy' && difficulty !== 'pity' && identicalCard && identicalCard.type === 'wild') {
    const nonWildIdentical = allIdenticalCandidates.find(
      (card) => card.type !== 'wild',
    );
    if (nonWildIdentical) {
      identicalCard = nonWildIdentical;
    } else if (botCanPlausiblyUseWildInEquation(hand)) {
      identicalCard = undefined;
    }
  }

  // Medium: additional 50% probabilistic wild conservation gate.
  // Even if a wild identical was selected above, flip a coin — defer it.
  if (difficulty === 'medium' && identicalCard?.type === 'wild' && rng() < 0.5) {
    identicalCard = undefined;
  }

  if (identicalCard) {
    return { kind: 'playIdentical', cardId: identicalCard.id };
  }

  const attackFraction = hand.find(
    (card) => card.type === 'fraction' && validateFractionPlay(card, topDiscard),
  );
  if (attackFraction) {
    return { kind: 'playFractionAttack', cardId: attackFraction.id };
  }

  return { kind: 'rollDice' };
}

/**
 * Cheap heuristic: the bot has at least one wild plus at least one concrete
 * number card — enough material for the post-roll `validateStagedCards`
 * enumerator to have a realistic shot at slotting the wild into an equation
 * for some target produced by the upcoming dice.
 */
function botCanPlausiblyUseWildInEquation(hand: Card[]): boolean {
  const hasWild = hand.some((c) => c.type === 'wild');
  if (!hasWild) return false;
  const numberCount = hand.filter(
    (c) => c.type === 'number' && typeof c.value === 'number',
  ).length;
  return numberCount >= 1;
}

/**
 * Building: compute plan once (captured at decision time). If plan, return
 * confirmEquation with stagedCardIds; else drawCard.
 */
function handleBotBuilding(
  state: GameState,
  difficulty: BotDifficulty,
  rng: () => number,
): BotAction {
  const plan = buildBotStagedPlan(state, difficulty, rng);
  if (!plan) {
    return { kind: 'drawCard' };
  }
  return {
    kind: 'confirmEquation',
    target: plan.target,
    equationDisplay: plan.equationDisplay,
    equationCommits: plan.equationCommits,
    equationOps: extractEquationOperators(plan.equationDisplay),
    stagedCardIds: plan.stagedCardIds,
  };
}

/**
 * Main entry point. Switch on state.phase.
 */
export function decideBotAction(
  state: GameState,
  difficulty: BotDifficulty,
  opts?: DecideBotActionOptions,
): BotAction | null {
  const rng = resolveBotRng(state, opts);
  switch (state.phase) {
    case 'setup':
      return null;
    case 'turn-transition':
      if (state.overflowSwapPending) {
        const discardPile = state.discardPile ?? [];
        const topCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
        const underTopCard = discardPile.length > 1 ? discardPile[discardPile.length - 2] : null;
        const choice = pickBotOverflowSwap(
          state.players[state.currentPlayerIndex]?.hand ?? [],
          topCard,
          underTopCard,
        );
        if (choice) {
          return {
            kind: 'resolveOverflowSwap',
            cardId: choice.handCardId,
            pileChoice: choice.pileChoice,
          };
        }
      }
      return { kind: 'beginTurn' };
    case 'pre-roll':
    case 'roll-dice':
      if (state.pendingFractionTarget !== null) {
        return handleBotDefense(state, difficulty, rng);
      }
      return handleBotPreRoll(state, difficulty, rng);
    case 'building':
      return handleBotBuilding(state, difficulty, rng);
    case 'solved':
      return { kind: 'drawCard' };
    case 'game-over':
      return null;
    default:
      return null;
  }
}

// Silence unused-import warning for fractionDenominator. It's imported for
// future use in fraction-value computations but the current brain logic only
// relies on fractionPenalty from state, not computed denominators.
void fractionDenominator;
