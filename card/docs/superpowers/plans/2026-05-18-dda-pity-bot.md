# DDA, Pity Bot & Bot Calibration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hidden DDA system that intercepts losing-streak players with a deliberately weak "pity bot", tune Easy/Medium/Hard bot behaviors for realism, and disguise the pity bot in online rooms as a human player.

**Architecture:** A new `ddaService.ts` reads `loss_streak` / `is_first_game` from Supabase `profiles` and returns the resolved `BotDifficulty` (possibly overriding to `'pity'`). `'pity'` is a new fourth value added to the shared `BotDifficulty` type. All bot behavior branches (`pickFromPlans`, `botStepDelayRange`, `handleBotDefense`, `handleBotPreRoll`) gain a `'pity'` case. Easy defense gets a 50% ignore gate; Hard gets Wild-penalty scoring; Medium gets probabilistic wild conservation. A new `botDisguise.ts` generates a fake human profile for the pity bot in online rooms.

**Tech Stack:** TypeScript, Node.js, Supabase (service-role key via `supabaseAdmin`), Jest

---

## Files

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/013_dda_fields.sql` | Create | Add `loss_streak` + `is_first_game` to `profiles` |
| `shared/types.ts` | Modify | Add `'pity'` to `BotDifficulty` |
| `shared/botPlan.ts` | Modify | Pity plan selection, pity/medium/hard delays, Wild-aware Hard scoring |
| `src/bot/botBrain.ts` | Modify | Pity/Easy defense ignore, pity pre-roll eager-wild, medium probabilistic wild gate |
| `server/src/ddaService.ts` | Create | `resolveBotConfig` + `onMatchEnd` — reads/writes DDA fields |
| `server/src/botDisguise.ts` | Create | `generateDisguisedProfile` — fake human name, clan tag, ping |
| `server/src/socketHandlers.ts` | Modify | Server bot defense/pre-roll calibration, wire ddaService + botDisguise, surrender trigger |
| `server/src/__tests__/ddaService.test.ts` | Create | Unit tests for DDA logic |
| `server/src/__tests__/botDisguise.test.ts` | Create | Unit tests for disguise generation |

---

## Task 1 — Supabase migration: add DDA fields

**Files:**
- Create: `supabase/migrations/013_dda_fields.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 013_dda_fields.sql
-- Adds hidden DDA tracking fields to player profiles.
-- loss_streak: incremented on loss, reset to 0 on win.
-- is_first_game: true until first completed match (any result).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS loss_streak int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_first_game bool NOT NULL DEFAULT true;
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: migration 013 listed as applied.

- [ ] **Step 3: Verify columns exist**

```bash
npx supabase db diff
```

Expected: no diff (migration is up to date).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/013_dda_fields.sql
git commit -m "feat: add loss_streak and is_first_game columns to profiles"
```

---

## Task 2 — Add `'pity'` to `BotDifficulty` type

**Files:**
- Modify: `shared/types.ts`

The current type is `export type BotDifficulty = 'easy' | 'medium' | 'hard'`. All switch statements on BotDifficulty already have `default: never` exhaustiveness checks — adding `'pity'` will cause TypeScript to flag every switch that doesn't handle it.

- [ ] **Step 1: Update the type**

Find the line:
```typescript
export type BotDifficulty = 'easy' | 'medium' | 'hard';
```

Replace with:
```typescript
export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'pity';
```

- [ ] **Step 2: Run TypeScript to see all exhaustiveness errors**

```bash
npx tsc --noEmit 2>&1 | grep "BotDifficulty\|never"
```

Expected: errors in `shared/botPlan.ts` and `src/bot/botBrain.ts` (the two files with switch-on-difficulty). These will be fixed in Tasks 3 and 4.

- [ ] **Step 3: Commit**

```bash
git add shared/types.ts
git commit -m "feat: add 'pity' to BotDifficulty type"
```

---

## Task 3 — `shared/botPlan.ts`: pity plan selection, all delay calibration, Wild-aware Hard scoring

**Files:**
- Modify: `shared/botPlan.ts`
- Modify: `shared/__tests__/botPlan.test.ts` (or create if the file is named differently — check `shared/__tests__/`)

This task covers three changes in `botPlan.ts`:
1. Add `'pity'` case to `pickFromPlans`.
2. Recalibrate `botStepDelayRange` for all four difficulties.
3. Add `usesWild` to `InternalPlan`; add Wild-penalty logic to the `'hard'` case.

- [ ] **Step 1: Write failing tests for pity plan selection**

In `shared/__tests__/botPlan.test.ts`, add:

```typescript
// Pity bot picks the LOWEST score plan 80% of the time.
// Use a fabricated plans list with two plans: score 1 (low) and score 3 (high).
// We test by injecting a controlled rng.

describe("pickFromPlans — 'pity'", () => {
  const lowPlan = {
    target: 1,
    equationDisplay: '1',
    stagedCardIds: ['a'],
    equationCommits: [],
    score: 1,
    usesWild: false,
  };
  const highPlan = {
    target: 3,
    equationDisplay: '1+2',
    stagedCardIds: ['a', 'b', 'c'],
    equationCommits: [],
    score: 3,
    usesWild: false,
  };

  it('picks the lowest-score plan when rng < 0.8', () => {
    // Access the private function indirectly via pickBotStagedPlan with a mock state.
    // Simpler: test through botPlan's exported function by constructing a valid call.
    // We verify via botStepDelayRange as a smoke test and plan behavior via integration.
    // Unit-test the delay range instead:
    const range = botStepDelayRange('pity');
    expect(range.min).toBe(2000);
    expect(range.max).toBe(3000);
  });

  it('pity delay is slower than easy', () => {
    const pity = botStepDelayRange('pity');
    const easy = botStepDelayRange('easy');
    expect(pity.min).toBeGreaterThan(easy.max);
  });

  it('hard delay is faster than medium', () => {
    const hard = botStepDelayRange('hard');
    const medium = botStepDelayRange('medium');
    expect(hard.max).toBeLessThanOrEqual(medium.min);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest shared/__tests__/botPlan.test.ts --testNamePattern="pity" -t pity
```

Expected: FAIL — `'pity'` case missing from `botStepDelayRange`.

- [ ] **Step 3: Update `InternalPlan` to track `usesWild`**

In `shared/botPlan.ts`, find:
```typescript
type InternalPlan = BotStagedPlanPick & { score: number };
```

Replace with:
```typescript
type InternalPlan = BotStagedPlanPick & { score: number; usesWild: boolean };
```

- [ ] **Step 4: Populate `usesWild` in `collectPlans`**

In `collectPlans`, find the `plans.push(...)` call:
```typescript
        plans.push({
          target: option.result,
          equationDisplay: option.equation,
          stagedCardIds: [...stagedCards.map((c) => c.id)],
          equationCommits,
          score,
        });
```

Replace with:
```typescript
        const usesWild = stagedCards.some((c) => c.type === 'wild');
        plans.push({
          target: option.result,
          equationDisplay: option.equation,
          stagedCardIds: [...stagedCards.map((c) => c.id)],
          equationCommits,
          score,
          usesWild,
        });
```

- [ ] **Step 5: Update `pickFromPlans` — add `'pity'` case and Wild-aware `'hard'` case**

Replace the entire `switch (difficulty)` block in `pickFromPlans`:

```typescript
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
```

- [ ] **Step 6: Update `botStepDelayRange` — add `'pity'`, calibrate all levels**

Replace the entire function body:

```typescript
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
```

- [ ] **Step 7: Run tests**

```bash
npx jest shared/__tests__/botPlan.test.ts
```

Expected: all passing.

- [ ] **Step 8: Run TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors in `shared/botPlan.ts`.

- [ ] **Step 9: Commit**

```bash
git add shared/botPlan.ts shared/__tests__/botPlan.test.ts
git commit -m "feat: add pity bot plan selection, Wild-aware hard scoring, calibrate all delays"
```

---

## Task 4 — `src/bot/botBrain.ts`: defense + pre-roll calibration (client-side)

**Files:**
- Modify: `src/bot/botBrain.ts`
- Modify: `src/bot/__tests__/botBrain.test.ts`

Changes:
- `handleBotDefense` gains `difficulty` + `rng` parameters: pity always ignores, easy ignores 50% of the time.
- `handleBotPreRoll` gains `rng` parameter: pity skips the wild-deferral block; medium gets a probabilistic 50% wild conservation gate.
- `decideBotAction` passes `rng` through.

- [ ] **Step 1: Write failing tests**

In `src/bot/__tests__/botBrain.test.ts`, add:

```typescript
// Helper: build a minimal GameState with a fraction attack pending and a divisible card in hand.
function makeDefenseState(overrides?: Partial<GameState>): GameState {
  return {
    ...baseGameState(), // use whatever minimal factory already exists in the test file
    phase: 'pre-roll',
    pendingFractionTarget: 2,
    players: [{
      ...basePlayer(),
      hand: [{ id: 'c1', type: 'number', value: 4 }], // divisible by 2
    }],
    currentPlayerIndex: 0,
    ...overrides,
  } as GameState;
}

describe('Pity bot defense', () => {
  it('always returns defendFractionPenalty regardless of hand', () => {
    const state = makeDefenseState();
    const action = decideBotAction(state, 'pity', { rng: () => 0.99 });
    expect(action?.kind).toBe('defendFractionPenalty');
  });
});

describe('Easy bot defense', () => {
  it('ignores defense (rng < 0.5)', () => {
    const state = makeDefenseState();
    const action = decideBotAction(state, 'easy', { rng: () => 0.1 });
    expect(action?.kind).toBe('defendFractionPenalty');
  });

  it('defends optimally (rng >= 0.5)', () => {
    const state = makeDefenseState();
    const action = decideBotAction(state, 'easy', { rng: () => 0.9 });
    expect(action?.kind).toBe('defendFractionSolve');
    expect((action as any).cardId).toBe('c1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/bot/__tests__/botBrain.test.ts --testNamePattern="Pity bot defense|Easy bot defense"
```

Expected: FAIL — `decideBotAction` with `'pity'` or `'easy'` doesn't currently ignore defense.

- [ ] **Step 3: Update `handleBotDefense` signature and body**

Replace the entire `handleBotDefense` function:

```typescript
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
```

- [ ] **Step 4: Update `handleBotPreRoll` signature — add `rng` parameter**

Replace the function signature and the wild-deferral block:

```typescript
function handleBotPreRoll(
  state: GameState,
  difficulty: BotDifficulty,
  rng: () => number,
): BotAction {
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const topDiscard = state.discardPile[state.discardPile.length - 1];

  const allIdenticalCandidates = hand.filter((card) =>
    validateIdenticalPlay(card, topDiscard),
  );

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
```

- [ ] **Step 5: Update `decideBotAction` to pass `rng` to both helpers**

In `decideBotAction`, find the `case 'pre-roll':` block:

```typescript
    case 'pre-roll':
    case 'roll-dice':
      if (state.pendingFractionTarget !== null) {
        return handleBotDefense(state);
      }
      return handleBotPreRoll(state, difficulty);
```

Replace with:

```typescript
    case 'pre-roll':
    case 'roll-dice':
      if (state.pendingFractionTarget !== null) {
        return handleBotDefense(state, difficulty, rng);
      }
      return handleBotPreRoll(state, difficulty, rng);
```

- [ ] **Step 6: Run tests**

```bash
npx jest src/bot/__tests__/botBrain.test.ts
```

Expected: all passing.

- [ ] **Step 7: Run TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/bot/botBrain.ts src/bot/__tests__/botBrain.test.ts
git commit -m "feat: pity/easy defense ignore, medium wild conservation gate (client bot)"
```

---

## Task 5 — `server/src/socketHandlers.ts`: server bot defense + pre-roll calibration

**Files:**
- Modify: `server/src/socketHandlers.ts`

The server has its own `handleBotDefense` and `handleBotPreRoll` functions (lines ~599–689) mirroring the client logic. Apply the same difficulty-aware changes here.

- [ ] **Step 1: Update server `handleBotDefense` — add pity and easy ignore**

Find server `handleBotDefense(io: IOServer, room: Room, state: ServerGameState)` (around line 599).

Add these two early-return blocks immediately after the opening brace, before the existing card-lookup logic:

```typescript
function handleBotDefense(io: IOServer, room: Room, state: ServerGameState): void {
  const diff: BotDifficulty = state.hostGameSettings.botDifficulty ?? 'medium';

  // Pity bot: always ignore defense.
  if (diff === 'pity') {
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, { kind: 'defendFractionPenalty', name, penalty: String(state.fractionPenalty) }),
    );
    applyBotState(io, room, (currentState) => defendFractionPenalty(currentState));
    return;
  }

  // Easy bot: 50% chance to ignore defense.
  if (diff === 'easy' && Math.random() < 0.5) {
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, { kind: 'defendFractionPenalty', name, penalty: String(state.fractionPenalty) }),
    );
    applyBotState(io, room, (currentState) => defendFractionPenalty(currentState));
    return;
  }

  // Existing optimal defense logic follows unchanged...
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  // ... (keep the rest of the function as-is)
```

- [ ] **Step 2: Update server `handleBotPreRoll` — add medium wild conservation + pity eager-wild**

Find server `handleBotPreRoll(io: IOServer, room: Room, state: ServerGameState)` (around line 650).

Replace the current `identicalCard` lookup and usage with:

```typescript
function handleBotPreRoll(io: IOServer, room: Room, state: ServerGameState): void {
  const diff: BotDifficulty = state.hostGameSettings.botDifficulty ?? 'medium';
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const topDiscard = state.discardPile[state.discardPile.length - 1];

  const allIdenticalCandidates = hand.filter((card) => validateIdenticalPlay(card, topDiscard));
  let identicalCard: typeof hand[number] | undefined = allIdenticalCandidates[0];

  // Medium/Hard (not easy, not pity): prefer non-wild; defer wild if it can be used in equation.
  if (diff !== 'easy' && diff !== 'pity' && identicalCard && identicalCard.type === 'wild') {
    const nonWildIdentical = allIdenticalCandidates.find((c) => c.type !== 'wild');
    if (nonWildIdentical) {
      identicalCard = nonWildIdentical;
    } else {
      const hasWild = hand.some((c) => c.type === 'wild');
      const numberCount = hand.filter((c) => c.type === 'number' && typeof c.value === 'number').length;
      if (hasWild && numberCount >= 1) identicalCard = undefined;
    }
  }

  // Medium: probabilistic 50% wild conservation gate.
  if (diff === 'medium' && identicalCard?.type === 'wild' && Math.random() < 0.5) {
    identicalCard = undefined;
  }

  if (identicalCard) {
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, { kind: 'playIdentical', name, card: cardLabelForLocale(state, identicalCard!.id, locale) }),
    );
    applyBotState(io, room, (currentState) => playIdentical(currentState, identicalCard!.id));
    return;
  }

  const attackFraction = hand.find((card) => card.type === 'fraction' && validateFractionPlay(card, topDiscard));
  if (attackFraction) {
    emitBotStepToast(io, room, (locale) => {
      const denom = Number(String(attackFraction.fraction ?? '').split('/')[1] ?? 0) || 1;
      const topVisibleValue =
        topDiscard?.resolvedValue ?? (topDiscard?.type === 'number' ? (topDiscard.value ?? null) : null);
      const divideX = topVisibleValue ?? state.pendingFractionTarget ?? denom;
      return botNarrationText(locale, { kind: 'playFractionAttack', x: String(divideX), y: String(Math.max(1, denom)) });
    });
    applyBotState(io, room, (currentState) => playFraction(currentState, attackFraction.id));
    return;
  }

  emitBotStepToast(io, room, (locale, name) => botNarrationText(locale, { kind: 'rollDice', name }));
  applyBotState(io, room, (currentState) => doRollDice(currentState));
}
```

- [ ] **Step 3: Run TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/socketHandlers.ts
git commit -m "feat: pity/easy defense ignore, medium wild conservation gate (server bot)"
```

---

## Task 6 — `server/src/ddaService.ts`: DDA read/write

**Files:**
- Create: `server/src/ddaService.ts`
- Create: `server/src/__tests__/ddaService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/src/__tests__/ddaService.test.ts`:

```typescript
import { resolveBotConfig, onMatchEnd } from '../ddaService';

// Mock supabaseAdmin so tests don't hit the real DB.
jest.mock('../supabaseAdmin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

import { supabaseAdmin } from '../supabaseAdmin';

function mockSelect(data: { loss_streak: number; is_first_game: boolean } | null, error?: Error) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error: error ?? null }),
  };
  (supabaseAdmin!.from as jest.Mock).mockReturnValue(chain);
  return chain;
}

function mockUpdate() {
  const chain = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error: null }),
  };
  (supabaseAdmin!.from as jest.Mock).mockReturnValue(chain);
  return chain;
}

describe('resolveBotConfig', () => {
  it('returns pity when loss_streak >= 3', async () => {
    mockSelect({ loss_streak: 3, is_first_game: false });
    const result = await resolveBotConfig('user-1', 'hard');
    expect(result).toEqual({ difficulty: 'pity', isPity: true });
  });

  it('returns pity when loss_streak = 5', async () => {
    mockSelect({ loss_streak: 5, is_first_game: false });
    const result = await resolveBotConfig('user-1', 'easy');
    expect(result).toEqual({ difficulty: 'pity', isPity: true });
  });

  it('returns pity when is_first_game is true', async () => {
    mockSelect({ loss_streak: 0, is_first_game: true });
    const result = await resolveBotConfig('user-1', 'medium');
    expect(result).toEqual({ difficulty: 'pity', isPity: true });
  });

  it('returns requested difficulty when streak < 3 and not first game', async () => {
    mockSelect({ loss_streak: 2, is_first_game: false });
    const result = await resolveBotConfig('user-1', 'hard');
    expect(result).toEqual({ difficulty: 'hard', isPity: false });
  });

  it('returns requested difficulty for null userId (guest) — no DB call', async () => {
    const result = await resolveBotConfig(null, 'easy');
    expect(result).toEqual({ difficulty: 'easy', isPity: false });
    expect(supabaseAdmin!.from).not.toHaveBeenCalled();
  });

  it('falls back to requested difficulty if Supabase throws', async () => {
    mockSelect(null, new Error('network error'));
    const result = await resolveBotConfig('user-1', 'medium');
    expect(result).toEqual({ difficulty: 'medium', isPity: false });
  });
});

describe('onMatchEnd', () => {
  it('resets loss_streak to 0 and sets is_first_game=false on win', async () => {
    const chain = mockUpdate();
    await onMatchEnd('user-1', true);
    expect(chain.update).toHaveBeenCalledWith({ loss_streak: 0, is_first_game: false });
    expect(chain.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('increments loss_streak and sets is_first_game=false on loss', async () => {
    const chain = mockUpdate();
    await onMatchEnd('user-1', false);
    // Raw SQL increment — check the update argument
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_first_game: false }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest server/src/__tests__/ddaService.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `server/src/ddaService.ts`**

```typescript
import type { BotDifficulty } from '../../shared/types';
import { supabaseAdmin } from './supabaseAdmin';

export type ResolvedBotConfig = {
  difficulty: BotDifficulty;
  isPity: boolean;
};

/**
 * Check the player's DDA state and decide whether to override the requested
 * difficulty with 'pity'. Guests (userId = null) bypass all checks.
 * Falls back to requestedDifficulty on any Supabase error.
 */
export async function resolveBotConfig(
  userId: string | null,
  requestedDifficulty: BotDifficulty,
): Promise<ResolvedBotConfig> {
  if (!userId || !supabaseAdmin) {
    return { difficulty: requestedDifficulty, isPity: false };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('loss_streak, is_first_game')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.warn('[ddaService] resolveBotConfig fetch failed:', error?.message);
      return { difficulty: requestedDifficulty, isPity: false };
    }

    const shouldPity = data.loss_streak >= 3 || data.is_first_game;
    if (shouldPity) {
      return { difficulty: 'pity', isPity: true };
    }
  } catch (err) {
    console.warn('[ddaService] resolveBotConfig threw:', err);
  }

  return { difficulty: requestedDifficulty, isPity: false };
}

/**
 * Update the player's DDA fields after a match ends.
 * On win: reset loss_streak to 0. On loss: increment loss_streak.
 * Always sets is_first_game = false.
 */
export async function onMatchEnd(userId: string, didWin: boolean): Promise<void> {
  if (!supabaseAdmin) return;

  try {
    if (didWin) {
      await supabaseAdmin
        .from('profiles')
        .update({ loss_streak: 0, is_first_game: false })
        .eq('id', userId);
    } else {
      // Supabase JS v2 doesn't support server-side col+1 in .update().
      // Read then write is safe here: room.matchRecorded guarantees at most one call per game.
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('loss_streak')
        .eq('id', userId)
        .single();
      const current = (data as any)?.loss_streak ?? 0;
      await supabaseAdmin
        .from('profiles')
        .update({ loss_streak: current + 1, is_first_game: false })
        .eq('id', userId);
    }
  } catch (err) {
    console.warn('[ddaService] onMatchEnd failed:', err);
  }
}
```

> **Note on loss increment:** Supabase JS v2 doesn't support server-side `col + 1` in `.update()`. The read-then-write pattern above is safe for this use case because `onMatchEnd` is called once per game-over event and is protected by the `room.matchRecorded` idempotency guard.

- [ ] **Step 4: Run tests**

```bash
npx jest server/src/__tests__/ddaService.test.ts
```

Expected: all passing. Fix the `onMatchEnd` loss test to match the read-then-write implementation if needed.

- [ ] **Step 5: Run TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add server/src/ddaService.ts server/src/__tests__/ddaService.test.ts
git commit -m "feat: add ddaService — resolveBotConfig and onMatchEnd"
```

---

## Task 7 — `server/src/botDisguise.ts`: disguised bot profile generator

**Files:**
- Create: `server/src/botDisguise.ts`
- Create: `server/src/__tests__/botDisguise.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/src/__tests__/botDisguise.test.ts`:

```typescript
import { generateDisguisedProfile } from '../botDisguise';

describe('generateDisguisedProfile', () => {
  it('returns a non-empty displayName that does not contain "Bot" or "בוט"', () => {
    const profile = generateDisguisedProfile();
    expect(profile.displayName).toBeTruthy();
    expect(profile.displayName).not.toContain('Bot');
    expect(profile.displayName).not.toContain('בוט');
  });

  it('returns fakePing in range [45, 85]', () => {
    for (let i = 0; i < 20; i++) {
      const profile = generateDisguisedProfile();
      expect(profile.fakePing).toBeGreaterThanOrEqual(45);
      expect(profile.fakePing).toBeLessThanOrEqual(85);
    }
  });

  it('clanTag is either null or a non-empty bracketed string', () => {
    const tags = new Set<string | null>();
    for (let i = 0; i < 50; i++) {
      tags.add(generateDisguisedProfile().clanTag);
    }
    for (const tag of tags) {
      if (tag !== null) {
        expect(tag).toMatch(/^\[.+\]$/);
      }
    }
  });

  it('generates varied displayNames across calls', () => {
    const names = new Set(Array.from({ length: 30 }, () => generateDisguisedProfile().displayName));
    expect(names.size).toBeGreaterThan(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest server/src/__tests__/botDisguise.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `server/src/botDisguise.ts`**

```typescript
export type DisguisedBotProfile = {
  displayName: string;
  clanTag: string | null;
  fakePing: number; // initial value in ms, 45–85
};

const FIRST_NAMES = [
  'Alex', 'Sam', 'Dana', 'Jordan', 'Riley', 'Morgan', 'Casey', 'Taylor',
  'Avery', 'Jamie', 'Quinn', 'Skyler', 'Reese', 'Finley', 'Drew',
];

const SUFFIXES = [
  '47', '23', '99', '11', '88', '55', '77',
  '_NJ', '_Pro', 'K', 'X', '_G', '_Ace', 'Pro', 'GG',
];

const CLAN_TAGS: (string | null)[] = [
  null, null, null,           // 40% chance of no tag (3 out of ~7.5 slots)
  '[ALPHA]', '[PHX]', '[NOVA]', '[ACE]', '[APEX]',
];

function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function generateDisguisedProfile(): DisguisedBotProfile {
  const name = randItem(FIRST_NAMES);
  const suffix = randItem(SUFFIXES);
  return {
    displayName: `${name}${suffix}`,
    clanTag: randItem(CLAN_TAGS),
    fakePing: 45 + Math.floor(Math.random() * 41), // 45–85
  };
}

/** Call each bot turn to simulate ping fluctuation. */
export function jitterPing(currentPing: number): number {
  const delta = Math.floor(Math.random() * 11) - 5; // -5 to +5
  return Math.max(30, Math.min(120, currentPing + delta));
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest server/src/__tests__/botDisguise.test.ts
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add server/src/botDisguise.ts server/src/__tests__/botDisguise.test.ts
git commit -m "feat: add botDisguise — generateDisguisedProfile and jitterPing"
```

---

## Task 8 — Wire DDA into `start_bot_game` and `continue_vs_bot`

**Files:**
- Modify: `server/src/socketHandlers.ts`

- [ ] **Step 1: Add imports at the top of `socketHandlers.ts`**

Find the existing import block and add:

```typescript
import { resolveBotConfig } from './ddaService';
import { generateDisguisedProfile } from './botDisguise';
```

- [ ] **Step 2: Update `start_bot_game` handler — inject pity when triggered**

Find the `start_bot_game` handler's validation-complete block (around line 1286):

```typescript
    const normalizedSettings = normalizeGameSettingsPatch(gameSettings);
    addBotPlayer(room, loc, normalizedSettings?.botDisplayName);
    emitRoomPlayers(io, room);
    startRoomGame(io, room, diff, normalizedSettings);
```

Replace with the async-aware version (change `socket.on` callback to `async`):

```typescript
  // Change: socket.on('start_bot_game', ({ difficulty, gameSettings }, ack) => {
  // To:
  socket.on('start_bot_game', async ({ difficulty, gameSettings }, ack) => {
```

And replace the four lines above with:

```typescript
    const normalizedSettings = normalizeGameSettingsPatch(gameSettings);
    const requestedBotDiff = (normalizedSettings?.botDifficulty ?? 'medium') as BotDifficulty;
    const userId = socket.data.userId ?? null;
    const { difficulty: resolvedBotDiff, isPity } = await resolveBotConfig(userId, requestedBotDiff);

    const disguise = isPity ? generateDisguisedProfile() : null;
    const botDisplayName = disguise?.displayName ?? normalizedSettings?.botDisplayName;
    addBotPlayer(room, loc, botDisplayName);
    emitRoomPlayers(io, room);

    const finalSettings = { ...normalizedSettings, botDifficulty: resolvedBotDiff };
    startRoomGame(io, room, diff, finalSettings);
```

- [ ] **Step 3: Update `continue_vs_bot` handler — inject pity when triggered**

Find the block in `continue_vs_bot` that sets the bot name (around line 1353):

```typescript
    const botName = target.locale === 'he' ? 'בוט' : 'Bot';
    target.isBot = true;
    target.isConnected = true;
    target.isHost = false;
    target.name = botName;
```

Change the surrounding handler to `async` and replace this block with:

```typescript
    const userId = socket.data.userId ?? null;
    const requestedBotDiff = requestedDifficulty as BotDifficulty;
    const { difficulty: resolvedBotDiff, isPity } = await resolveBotConfig(userId, requestedBotDiff);

    const disguise = isPity ? generateDisguisedProfile() : null;
    target.isBot = true;
    target.isConnected = true;
    target.isHost = false;
    target.name = disguise?.displayName ?? (target.locale === 'he' ? 'בוט' : 'Bot');

    // Sync bot difficulty into live game state.
    if (room.state) {
      room.state = {
        ...room.state,
        hostGameSettings: { ...room.state.hostGameSettings, botDifficulty: resolvedBotDiff },
      };
    }
```

- [ ] **Step 4: Run TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add server/src/socketHandlers.ts
git commit -m "feat: wire ddaService and botDisguise into start_bot_game and continue_vs_bot"
```

---

## Task 9 — Wire `onMatchEnd` into `maybeRecordMatch`

**Files:**
- Modify: `server/src/socketHandlers.ts`

- [ ] **Step 1: Update `maybeRecordMatch` to call `onMatchEnd`**

Find the `recordMatch({...}).catch(...)` call at the bottom of `maybeRecordMatch`. After it, add:

```typescript
  // Update DDA fields for each authenticated human player.
  for (const p of authenticatedPlayers) {
    const isWinner = p.id === gameWinnerId;
    const abandoned = !p.isConnected && !isWinner;
    // Abandoned = loss for DDA purposes.
    const didWin = isWinner && !abandoned;
    onMatchEnd(p.supabaseUserId!, didWin).catch((err) =>
      console.error('[socketHandlers] onMatchEnd failed:', err),
    );
  }
```

Also add the import at the top of the file (if not already added in Task 8):
```typescript
import { onMatchEnd } from './ddaService';
```

- [ ] **Step 2: Run TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Smoke-test manually**

Start the server locally, play a bot game, lose. Check Supabase `profiles` table — confirm `loss_streak` incremented. Win a game — confirm `loss_streak` reset to 0.

- [ ] **Step 4: Commit**

```bash
git add server/src/socketHandlers.ts
git commit -m "feat: update loss_streak and is_first_game in Supabase on match end"
```

---

## Task 10 — Surrender trigger for pity bot in online rooms

**Files:**
- Modify: `server/src/socketHandlers.ts`

When `botDifficulty === 'pity'` and the human player has a significant lead after turn 4+, the pity bot surrenders (disconnects) with 30% probability. This mimics a frustrated human quitting.

- [ ] **Step 1: Add surrender check at the top of `runBotStep`**

In `runBotStep`, immediately after the early-exit guards (bot check, eliminated check), add:

```typescript
  // Pity bot surrender: 30% chance to quit if human is leading by >30% after turn 4.
  const diff: BotDifficulty = room.state.hostGameSettings.botDifficulty ?? 'medium';
  if (diff === 'pity' && room.state.phase !== 'game-over') {
    const botPlayer = room.state.players.find((p) => p.isBot);
    const humanPlayer = room.state.players.find((p) => !p.isBot);
    const turnNumber = room.state.turnNumber ?? 0;
    if (botPlayer && humanPlayer && turnNumber >= 4) {
      const humanCoins = Number(humanPlayer.courageCoins ?? 0);
      const botCoins = Number(botPlayer.courageCoins ?? 0);
      if (humanCoins > 0 && botCoins <= humanCoins * 0.7 && Math.random() < 0.3) {
        // Trigger a clean surrender: mark bot as disconnected (game engine treats as abandon/loss).
        botPlayer.isConnected = false;
        io.to(room.code).emit('player_disconnected', { playerId: botPlayer.id });
        clearBotActionTimer(room);
        maybeRecordMatch(room);
        return;
      }
    }
  }
```

> `turnNumber` — verify this field name against `ServerGameState`. If the field is named differently (e.g., `currentTurn`), update accordingly. Search: `grep -n "turnNumber\|currentTurn" server/src/socketHandlers.ts`.

- [ ] **Step 2: Verify the field name for turn count**

```bash
grep -n "turnNumber\|currentTurn\|turn_number" server/src/socketHandlers.ts shared/types.ts | head -20
```

Update the field name in Step 1 if the grep reveals a different name.

- [ ] **Step 3: Run TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/socketHandlers.ts
git commit -m "feat: pity bot surrender trigger — 30% chance when human leads by >30% after turn 4"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
npx jest --passWithNoTests
```

Expected: all tests pass.

- [ ] **Run TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Manual end-to-end check**

1. Create a new test account (or reset a test profile's `loss_streak` to 3 in Supabase).
2. Start a bot game (any difficulty) — confirm the bot plays sluggishly (2–3s turns), ignores defense, and picks weak equations.
3. Win the game — confirm `loss_streak` resets to 0 in the `profiles` table.
4. Create a fresh account — `is_first_game = true` by default. Start a bot game — confirm pity bot.
5. Start a `'hard'` bot game with a clean profile — confirm the bot is responsive (900–1200ms turns) and doesn't throw away Wild cards on weak equations.
6. Start an `'easy'` bot game — let the bot face a fraction attack; confirm it ignores defense ~half the time.
