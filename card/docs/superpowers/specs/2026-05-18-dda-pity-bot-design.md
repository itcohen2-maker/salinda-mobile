# DDA, Pity Bot & Bot Calibration — Design Spec

**Date:** 2026-05-18
**Status:** Approved

---

## Goal

Add a hidden Dynamic Difficulty Adjustment (DDA) layer that prevents player churn from consecutive losses, guarantees a positive first-game experience, and fine-tunes the Easy/Medium/Hard bot behaviors to feel realistic and human.

---

## Scope

| Area | Files Affected |
|---|---|
| Database | `supabase/migrations/` (new migration) |
| Shared types | `shared/types.ts` |
| Shared bot plan | `shared/botPlan.ts` |
| Client bot brain | `src/bot/botBrain.ts` |
| Server DDA service | `server/src/ddaService.ts` (new) |
| Server disguise engine | `server/src/botDisguise.ts` (new) |
| Server room manager | `server/src/roomManager.ts` |
| Server socket handlers | `server/src/socketHandlers.ts` |
| Server Supabase admin | `server/src/supabaseAdmin.ts` |

Out of scope: matchmaking queue (system is room-based), cosmetic shop integration, rated-mode pity suppression.

---

## Architecture Overview

```
Bot game requested (local OR bot-offer in online room)
        │
        ▼
ddaService.resolveBotConfig(userId, requestedDifficulty)
        │
   [loss_streak >= 3]
   OR [is_first_game == true]?
        │
    yes─┤─no
        │   │
        ▼   ▼
      pity  requestedDifficulty
      +     (easy / medium / hard)
      disguisedProfile
        │
        ▼
addBotPlayer(room, locale, disguisedProfile?.displayName)
startRoomGame(io, room, resolvedDifficulty)
        │
        ▼
 [game-over] → ddaService.onMatchEnd(userId, didWin)
              → update loss_streak + is_first_game in Supabase
```

---

## 1. Database Schema

### Migration: `supabase/migrations/006_dda_fields.sql`

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS loss_streak int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_first_game bool NOT NULL DEFAULT true;
```

`loss_streak` — count of consecutive losses. Resets to 0 on any win.
`is_first_game` — true until the first completed/recorded match. Set to false after game-over regardless of result.

No RLS change needed — these columns are written server-side only (via service role key).

---

## 2. Shared Types

### `shared/types.ts` — BotDifficulty

```typescript
// Before
export type BotDifficulty = 'easy' | 'medium' | 'hard';

// After
export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'pity';
```

All existing `switch (difficulty)` blocks already have `default: never` exhaustiveness checks — add `'pity'` case to each.

---

## 3. DDA Service (new file)

### `server/src/ddaService.ts`

**Responsibilities:**
- Fetch `loss_streak` and `is_first_game` from Supabase for a given userId.
- Decide whether to override the requested difficulty with `'pity'`.
- Update the two DDA fields after a match ends.

**Interface:**

```typescript
export type ResolvedBotConfig = {
  difficulty: BotDifficulty;
  isPity: boolean;
};

/** Called before addBotPlayer. Returns the difficulty to actually use. */
export async function resolveBotConfig(
  userId: string | null,          // null = unauthenticated guest → use requestedDifficulty
  requestedDifficulty: BotDifficulty,
): Promise<ResolvedBotConfig>;

/** Called from maybeRecordMatch after game-over. */
export async function onMatchEnd(
  userId: string,
  didWin: boolean,
): Promise<void>;
```

**Logic — resolveBotConfig:**
```
if userId is null → return { difficulty: requestedDifficulty, isPity: false }

fetch profiles(loss_streak, is_first_game) where id = userId

if loss_streak >= 3 OR is_first_game == true:
  return { difficulty: 'pity', isPity: true }
else:
  return { difficulty: requestedDifficulty, isPity: false }
```

**Logic — onMatchEnd:**
```
if didWin:
  UPDATE profiles SET loss_streak = 0, is_first_game = false WHERE id = userId
else:
  UPDATE profiles SET loss_streak = loss_streak + 1, is_first_game = false WHERE id = userId
```

**Error handling:** If the Supabase fetch fails (network, timeout), log and fall back to `requestedDifficulty` — never block game start.

---

## 4. Bot Disguise Engine (new file)

### `server/src/botDisguise.ts`

Only used when `isPity == true` AND the context is an online room (not local-only).

**Interface:**

```typescript
export type DisguisedBotProfile = {
  displayName: string;   // e.g. "Alex_NJ", "ShadowK99"
  clanTag: string | null;
  fakePing: number;      // 45–85ms initial value
};

export function generateDisguisedProfile(): DisguisedBotProfile;
```

**Username generation:**
- Pool A (first names): `["Alex", "Sam", "Dana", "Jordan", "Riley", "Morgan", "Casey", "Taylor"]`
- Pool B (suffixes): two-digit numbers 10–99, or short tags like `"_NJ"`, `"_Pro"`, `"K"`, `"99"`, `"X"`
- Format: `${poolA[rand]}${poolB[rand]}` → `"Alex47"`, `"Sam_NJ"`, `"JordanK"`

**Clan tags:** randomly chosen from `[null, "[ALPHA]", "[PHX]", "[NOVA]", "[ACE]"]` — 40% chance of null (no tag).

**Fake ping:**
- Initial value: random integer in [45, 85]
- Each bot turn: jitter ±5ms, clamped to [30, 120], sent to client via existing game-state payload (new optional field `botPing?: number`)

**Caller — roomManager.ts:** `addBotPlayer()` receives an optional `disguisedDisplayName?: string`. When provided, it is used as `player.name` instead of `'בוט'` / `'Bot'`.

---

## 5. Bot Behavior — `'pity'` Difficulty

### `shared/botPlan.ts` — pickFromPlans

```typescript
case 'pity': {
  // 80% chance: pick the plan with the LOWEST score
  if (rng() < 0.8) {
    const tier = plans.filter((p) => p.score === minScore);
    return strip(tier[0]!);
  }
  // 20% chance: random plan (occasional accidental competence)
  return strip(plans[Math.floor(rng() * plans.length)]!);
}
```

### `shared/botPlan.ts` — botStepDelayRange

```typescript
case 'pity':
  return { min: 2000, max: 3000 };
```

### `src/bot/botBrain.ts` — handleBotDefense

Pity bot ignores defense 100% of the time:

```typescript
// At the top of handleBotDefense, before any card lookup:
if (difficulty === 'pity') {
  return { kind: 'defendFractionPenalty' };
}
```

Defense function signature changes from `(state: GameState)` to `(state: GameState, difficulty: BotDifficulty, rng: () => number)`.

### `src/bot/botBrain.ts` — Wild card in pre-roll

Pity bot eagerly spends Wilds (no conservation):

```typescript
// In handleBotPreRoll, the medium/hard wild-deferral block:
if (difficulty !== 'easy' && difficulty !== 'pity' && identicalCard?.type === 'wild') {
  // ... existing deferral logic
}
```

---

## 6. Bot Calibration Changes

### Easy

**Defense stage — 50% ignore:**

```typescript
// handleBotDefense, after the 'pity' early return:
if (difficulty === 'easy' && rng() < 0.5) {
  return { kind: 'defendFractionPenalty' };
}
```

Everything else (blunder rate 20%, delays 1470–1870ms) unchanged.

---

### Medium

**Delay:** `{ min: 1200, max: 1500 }` (was 1270–1600ms).

**Wild conservation — explicit 50% chance:**

Current logic defers Wild only when `botCanPlausiblyUseWildInEquation()`. New logic adds an additional probabilistic gate:

```typescript
// In handleBotPreRoll, medium/hard wild-deferral block:
if (difficulty === 'medium') {
  // 50% chance to conserve even when a non-wild identical is available
  if (rng() < 0.5 && identicalCard?.type === 'wild') {
    identicalCard = undefined; // defer wild, fall through to roll
  }
}
```

Everything else (25% random branch in plan selection) unchanged.

---

### Hard

**Delay:** `{ min: 900, max: 1200 }` (was 1200–1470ms).

**Smart scoring — Wild preservation:**

```typescript
// In collectPlans / score calculation:
const WILD_PENALTY = 3;

// A plan "closes the game" if committing it makes the bot reach win condition.
// For now: approximate with stagedCards.length + equationCommits.length >= 5 (high-value play).
const isHighValue = score >= 5;
const usesWild = stagedCards.some((c) => c.type === 'wild');

const adjustedScore = score - (usesWild && !isHighValue ? WILD_PENALTY : 0);
```

Hard bot picks max `adjustedScore` instead of max raw `score`. Wild-using moves are only preferred when they produce genuinely high-value equations.

**Defense:** unchanged — already 100% optimal.

---

## 7. Wire-up in Server

### `server/src/socketHandlers.ts` — start_bot_game handler

```typescript
socket.on('start_bot_game', async ({ difficulty, gameSettings }, ack) => {
  // ... existing validation ...

  const userId = room.players.find(p => p.supabaseUserId)?.supabaseUserId ?? null;
  const { difficulty: resolvedDifficulty, isPity } = await resolveBotConfig(userId, difficulty);

  const disguise = isPity ? generateDisguisedProfile() : null;
  addBotPlayer(room, loc, disguise?.displayName ?? gameSettings?.botDisplayName);

  startRoomGame(io, room, resolvedDifficulty, gameSettings);
  // ...
});
```

### `server/src/socketHandlers.ts` — continue_vs_bot handler

Same pattern: call `resolveBotConfig` before `addBotPlayer`.

### `server/src/socketHandlers.ts` — maybeRecordMatch

```typescript
// After existing rating update logic, for each participant:
await onMatchEnd(participant.playerId, isWinner);
```

---

## 8. Surrender Trigger (online pity bot only)

When `isPity == true` and the room has a human vs pity-bot game:

- After turn 4+ and the bot's score is trailing by ≥ 30% of the human's score, there is a **30% chance** the bot emits a disconnect event (treated as abandon) rather than taking its turn.
- Implemented in `scheduleBotAction` — check conditions before scheduling the next action.
- From the human player's perspective: opponent disconnected like a frustrated human would.
- The human's rating is updated as a win (not an abandon win) since the bot triggers it cleanly.

---

## 9. Testing

| Test | File |
|---|---|
| `resolveBotConfig` returns pity when loss_streak >= 3 | `server/src/__tests__/ddaService.test.ts` (new) |
| `resolveBotConfig` returns pity when is_first_game = true | same |
| `resolveBotConfig` returns requested difficulty for guests | same |
| `onMatchEnd` increments loss_streak on loss | same |
| `onMatchEnd` resets loss_streak on win | same |
| `pickFromPlans('pity')` picks lowest score 80% of the time | `shared/__tests__/botPlan.test.ts` |
| `handleBotDefense('easy')` ignores defense 50% of the time | `src/bot/__tests__/botBrain.test.ts` |
| `handleBotDefense('pity')` always ignores defense | same |
| Hard bot penalizes Wild-using plans with low score | `shared/__tests__/botPlan.test.ts` |
| `generateDisguisedProfile` returns valid structure | `server/src/__tests__/botDisguise.test.ts` (new) |

---

## 10. Constraints & Decisions

- **Guests (unauthenticated):** DDA is skipped — `resolveBotConfig` returns `requestedDifficulty` immediately. No Supabase fetch.
- **Pity resets after one pity game:** `is_first_game` is set to false after first match regardless. `loss_streak` resets to 0 after any win — so after one pity-assisted win, the player is out of pity mode.
- **loss_streak cap:** No cap. After 6+ consecutive losses the player still gets pity each time until they win.
- **Hard bot WILD_PENALTY = 3:** Chosen so that a 2-card wild equation (score 2, adjusted -1) loses to a 2-card non-wild equation (score 2). Adjust in one constant.
- **isHighValue threshold = 5:** Equations of 5+ cards are considered "game-closing" and Wild use is allowed. Revisit after playtesting.
- **No fake ping in local-only bot games:** `botPing` field is only populated when `isPity && isOnlineRoom`.
