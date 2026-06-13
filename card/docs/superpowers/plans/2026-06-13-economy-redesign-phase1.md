# Economy Redesign — Phase 1 (Earning Loop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebalance all coin amounts and add the per-game earning loop (participation, first-win-of-day, session momentum) so playing another game is always rewarding — no new art, no leagues, no catalog.

**Architecture:** Numbers live in `shared/salindaEconomy.ts` (single source of truth); the meter (→15) and standard-win (→40) amounts auto-apply because the existing effects already read those constants. New earning types are added as (a) pure helpers in `shared`, (b) a DB migration extending the `coin_events.source` allowlist plus a server-date-idempotent `award_first_win_of_day` RPC, (c) a thin `useAuth` wrapper, and (d) new award effects in the `GameProvider` next to the existing win-reward effect.

**Tech Stack:** React Native / Expo, TypeScript, Jest, Supabase (Postgres + plpgsql RPC).

**Branch:** `economy-redesign-phase1` (spec committed there as `722821a`).

**Spec:** `docs/superpowers/specs/2026-06-13-economy-redesign-design.md` (§3.1, §4.1–4.2, §8 Phase 1).

---

## File Structure

- `shared/salindaEconomy.ts` — **modify**: rebalance constants, add 2 coin sources, add `game_participation` amount, add momentum constants + `sessionMomentumReward()` + `shouldAwardParticipationReward()`.
- `shared/__tests__/economyRewards.phase1.test.ts` — **create**: lock the rebalanced numbers + the two new pure helpers.
- `supabase/migrations/029_economy_rewards_v2.sql` — **create**: extend source allowlist; add `award_first_win_of_day` RPC.
- `src/hooks/useAuth.tsx` — **modify**: add `awardFirstWinOfDay(amount)` wrapper + expose it on the context value/type.
- `index.tsx` — **modify**: add participation + first-win-of-day + session-momentum award effects in `GameProvider`; add an `AppState` listener that resets the session momentum counter on background.

---

## Task 1: Rebalance economy constants + add new coin sources

**Files:**
- Modify: `shared/salindaEconomy.ts:1-15` (reward constants) and `:32-41` (`SALINDA_COIN_SOURCES`)
- Test: `shared/__tests__/economyRewards.phase1.test.ts`

- [ ] **Step 1: Write the failing test**

Create `shared/__tests__/economyRewards.phase1.test.ts`:

```ts
import {
  SALINDA_TUTORIAL_REWARDS,
  SALINDA_GOLD_ROOM_REWARD,
  SALINDA_GAMEPLAY_REWARDS,
  SALINDA_COIN_SOURCES,
} from '../salindaEconomy';

describe('Phase 1 rebalanced economy constants', () => {
  test('onboarding amounts are reduced to a head-start', () => {
    expect(SALINDA_TUTORIAL_REWARDS).toEqual({ basic: 75, advanced: 125 });
    expect(SALINDA_GOLD_ROOM_REWARD).toBe(300);
  });

  test('gameplay rewards are rebalanced and felt', () => {
    expect(SALINDA_GAMEPLAY_REWARDS.excellence_meter_full).toBe(15);
    expect(SALINDA_GAMEPLAY_REWARDS.standard_win).toBe(40);
    expect(SALINDA_GAMEPLAY_REWARDS.first_win_of_day).toBe(100);
    expect(SALINDA_GAMEPLAY_REWARDS.game_participation).toBe(10);
  });

  test('new coin sources exist for the per-game loop', () => {
    expect(SALINDA_COIN_SOURCES.game_participation).toBe('game_participation');
    expect(SALINDA_COIN_SOURCES.session_momentum).toBe('session_momentum');
    expect(SALINDA_COIN_SOURCES.first_win_of_day).toBe('first_win_of_day');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest shared/__tests__/economyRewards.phase1.test.ts`
Expected: FAIL (current values are basic:150, advanced:250, gold room 500, meter 1, standard_win 100; `game_participation`/`session_momentum` undefined).

- [ ] **Step 3: Apply the constant changes**

In `shared/salindaEconomy.ts`, replace lines 1-15 with:

```ts
export const SALINDA_TUTORIAL_REWARDS = {
  basic: 75,
  advanced: 125,
} as const;

// One-time Gold Room "collect coins" reward. Granted only after the three
// foundational training tasks (basics, equation practice, special cards) are
// complete; see the Gold Room hub.
export const SALINDA_GOLD_ROOM_REWARD = 300;

export const SALINDA_GAMEPLAY_REWARDS = {
  excellence_meter_full: 15,
  standard_win: 40,
  first_win_of_day: 100,
  game_participation: 10,
} as const;

// Session momentum: the reward grows by STEP per consecutive game played in a
// single app session, starting from the 2nd game, capped at CAP. (game 1 → 0,
// game 2 → 5, game 3 → 10, … capped at 30.) Resets when the app backgrounds.
export const SESSION_MOMENTUM_STEP = 5;
export const SESSION_MOMENTUM_CAP = 30;
```

Then add two entries to `SALINDA_COIN_SOURCES` (after `first_win_of_day`):

```ts
  game_participation: 'game_participation',
  session_momentum: 'session_momentum',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest shared/__tests__/economyRewards.phase1.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/salindaEconomy.ts shared/__tests__/economyRewards.phase1.test.ts
git commit -m "feat(economy): rebalance reward amounts + add per-game coin sources"
```

---

## Task 2: Pure helpers — momentum schedule + participation guard

**Files:**
- Modify: `shared/salindaEconomy.ts` (append helpers near `shouldAwardLocalStandardWinReward`, ~line 176)
- Test: `shared/__tests__/economyRewards.phase1.test.ts` (extend)

- [ ] **Step 1: Write the failing test (append to the Phase 1 test file)**

```ts
import {
  sessionMomentumReward,
  shouldAwardParticipationReward,
} from '../salindaEconomy';

describe('sessionMomentumReward', () => {
  test('first game in a session pays no momentum', () => {
    expect(sessionMomentumReward(1)).toBe(0);
  });
  test('grows by 5 per consecutive game', () => {
    expect(sessionMomentumReward(2)).toBe(5);
    expect(sessionMomentumReward(3)).toBe(10);
    expect(sessionMomentumReward(4)).toBe(15);
  });
  test('caps at 30', () => {
    expect(sessionMomentumReward(7)).toBe(30);
    expect(sessionMomentumReward(50)).toBe(30);
  });
  test('guards against bad input', () => {
    expect(sessionMomentumReward(0)).toBe(0);
    expect(sessionMomentumReward(-3)).toBe(0);
  });
});

describe('shouldAwardParticipationReward', () => {
  const base = {
    phase: 'game-over',
    mode: 'vs-bot',
    isTutorial: false,
    rewardSessionKey: 'game-1',
    lastAwardedSessionKey: null as string | null,
  };
  test('awards once per finished local game (win OR loss)', () => {
    expect(shouldAwardParticipationReward(base)).toBe(true);
  });
  test('does not award twice for the same game', () => {
    expect(shouldAwardParticipationReward({ ...base, lastAwardedSessionKey: 'game-1' })).toBe(false);
  });
  test('only solo / vs-bot, never tutorial, only at game-over, needs a key', () => {
    expect(shouldAwardParticipationReward({ ...base, isTutorial: true })).toBe(false);
    expect(shouldAwardParticipationReward({ ...base, phase: 'building' })).toBe(false);
    expect(shouldAwardParticipationReward({ ...base, mode: 'online' })).toBe(false);
    expect(shouldAwardParticipationReward({ ...base, rewardSessionKey: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest shared/__tests__/economyRewards.phase1.test.ts`
Expected: FAIL with "sessionMomentumReward is not a function" / "shouldAwardParticipationReward is not a function".

- [ ] **Step 3: Implement the helpers**

Append to `shared/salindaEconomy.ts` (after `shouldAwardLocalStandardWinReward`):

```ts
/**
 * Coins awarded for the Nth consecutive game played in a single app session.
 * Game 1 → 0, then +SESSION_MOMENTUM_STEP per game, capped at SESSION_MOMENTUM_CAP.
 */
export function sessionMomentumReward(consecutiveGames: number): number {
  if (!Number.isFinite(consecutiveGames) || consecutiveGames <= 1) return 0;
  const steps = Math.floor(consecutiveGames) - 1;
  return Math.min(SESSION_MOMENTUM_CAP, steps * SESSION_MOMENTUM_STEP);
}

/**
 * Participation reward fires once per finished local game (win OR loss),
 * unlike the standard-win reward which requires a human win.
 */
export function shouldAwardParticipationReward(opts: {
  phase: string;
  mode: string;
  isTutorial: boolean;
  rewardSessionKey: string | null;
  lastAwardedSessionKey: string | null;
}): boolean {
  return (
    opts.phase === 'game-over' &&
    (opts.mode === 'solo' || opts.mode === 'vs-bot') &&
    !opts.isTutorial &&
    opts.rewardSessionKey !== null &&
    opts.rewardSessionKey !== opts.lastAwardedSessionKey
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest shared/__tests__/economyRewards.phase1.test.ts`
Expected: PASS (all describes green).

- [ ] **Step 5: Commit**

```bash
git add shared/salindaEconomy.ts shared/__tests__/economyRewards.phase1.test.ts
git commit -m "feat(economy): add sessionMomentumReward + participation guard helpers"
```

---

## Task 3: DB migration 029 — sources allowlist + first-win-of-day RPC

**Files:**
- Create: `supabase/migrations/029_economy_rewards_v2.sql`

> No automated DB test harness exists in this repo; verification is SQL review + (optionally) applying to a local/staging Supabase. The unique index `idx_coin_events_player_source_key` (from 019) provides the daily idempotency.

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/029_economy_rewards_v2.sql`:

```sql
-- ============================================================
-- 029_economy_rewards_v2.sql
-- Economy redesign Phase 1: allow the new per-game reward sources
-- (participation, session momentum) and wire first-win-of-day with a
-- SERVER-side UTC date so timezone changes can't farm the daily bonus.
-- The coin_events.source CHECK is a closed allowlist (see 019/026).
-- ============================================================

alter table public.coin_events
  drop constraint if exists coin_events_source_check;

alter table public.coin_events
  add constraint coin_events_source_check
  check (source in (
    'game_courage',
    'game_standard_win',
    'game_perfect_win',
    'excellence_meter_full',
    'tutorial_core',
    'tutorial_advanced',
    'tutorial_legacy',
    'gold_room_complete',
    'game_participation',
    'first_win_of_day',
    'session_momentum'
  ));

-- First-win-of-day: idempotent per (player, UTC date). The idempotency key is
-- computed server-side from current_date, so the client cannot game it by
-- changing the device clock/timezone. Safe to call on every human win; only the
-- first call per UTC day inserts a row (enforced by the unique index from 019).
create or replace function public.award_first_win_of_day(
  p_amount integer
) returns void as $$
declare
  v_player_id uuid := auth.uid();
  v_key       text := 'first_win_of_day:' || to_char(current_date, 'YYYY-MM-DD');
begin
  if v_player_id is null then return; end if;
  if p_amount <= 0 then return; end if;

  if exists (
    select 1 from public.coin_events
    where player_id = v_player_id
      and source = 'first_win_of_day'
      and idempotency_key = v_key
  ) then return; end if;

  insert into public.coin_events (player_id, amount, source, match_id, idempotency_key)
  values (v_player_id, p_amount, 'first_win_of_day', null, v_key);

  update public.profiles
  set total_coins = greatest(0, total_coins + p_amount)
  where id = v_player_id;
exception
  when unique_violation then
    return;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.award_first_win_of_day(integer) to authenticated, anon;
```

- [ ] **Step 2: Verify SQL by review**

Re-read the file. Confirm: (a) all 11 sources listed incl. the 3 new ones; (b) `award_first_win_of_day` uses `current_date` (server UTC), source `'first_win_of_day'`, and a unique key per day; (c) grant matches existing `award_coins` grant style.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/029_economy_rewards_v2.sql
git commit -m "feat(db): allow per-game reward sources + server-date first-win RPC (029)"
```

> **Deploy note (do NOT run unprompted):** migration 029 must be applied to prod Supabase before the client awards these sources, else `award_coins` rejects them. Track alongside the existing "migration not yet applied to prod" notes.

---

## Task 4: useAuth — `awardFirstWinOfDay` wrapper

**Files:**
- Modify: `src/hooks/useAuth.tsx:599-618` (add wrapper after `awardCoins`), plus the context type and the provider value object where `awardCoins` is exposed.

- [ ] **Step 1: Add the wrapper after `awardCoins` (line 618)**

```ts
  const awardFirstWinOfDay = useCallback(async (
    amount: number,
  ): Promise<'ok' | 'error'> => {
    if (!Number.isFinite(amount) || amount <= 0) return 'error';
    try {
      const { error } = await supabase.rpc('award_first_win_of_day', { p_amount: amount });
      if (error) return 'error';
      // Optimistic: the RPC is a no-op after the first win of the day, so we
      // reconcile from the server instead of blindly adding to the balance.
      await refreshProfile();
      return 'ok';
    } catch {
      return 'error';
    }
  }, [refreshProfile]);
```

- [ ] **Step 2: Expose it on the context**

Find where `awardCoins` is added to the context type (the `AuthContextValue`/interface) and to the provider's value object (search `awardCoins,` in the value object). Add `awardFirstWinOfDay` in both places, mirroring `awardCoins`:

- In the type: `awardFirstWinOfDay: (amount: number) => Promise<'ok' | 'error'>;`
- In the value object: `awardFirstWinOfDay,`

Run: `grep -n "awardCoins" src/hooks/useAuth.tsx` to locate both sites; add the sibling line at each.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (no new errors referencing `awardFirstWinOfDay`).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAuth.tsx
git commit -m "feat(auth): add awardFirstWinOfDay wrapper for server-date daily bonus"
```

---

## Task 5: Wire the per-game earning loop in GameProvider

**Files:**
- Modify: `index.tsx` — add imports; add a session-momentum counter + `AppState` reset; add participation, first-win-of-day, and momentum award effects beside the existing win effect (`index.tsx:4520-4555`).

> The meter (15) and standard-win (40) amounts already update via Task 1 because their effects read `SALINDA_GAMEPLAY_REWARDS` (`index.tsx:4517`, `:4541`). No change needed for those amounts.

- [ ] **Step 1: Add imports**

Ensure these are imported in `index.tsx` (extend the existing `shared/salindaEconomy` import and the `react-native` import):

```ts
import {
  // ...existing imports from this module...
  SALINDA_GAMEPLAY_REWARDS,
  SALINDA_COIN_SOURCES,
  shouldAwardLocalStandardWinReward,
  shouldAwardParticipationReward,
  sessionMomentumReward,
} from './shared/salindaEconomy';
import { AppState } from 'react-native';
```

(Only add the names not already present — `SALINDA_GAMEPLAY_REWARDS`, `SALINDA_COIN_SOURCES`, `shouldAwardLocalStandardWinReward` already exist; add the two new helpers. `AppState` may already be imported.)

- [ ] **Step 2: Add session-momentum counter + AppState reset (inside GameProvider, near line 4506)**

After `const lastStandardWinAwardedSessionKeyRef = useRef<string | null>(null);`:

```ts
  const { awardFirstWinOfDay: _awardFirstWinOfDay } = useAuth();
  // Consecutive games finished in THIS app session. Resets when the app
  // backgrounds, so "more games per session" is what momentum rewards.
  const sessionGamesRef = useRef<number>(0);
  const lastParticipationSessionKeyRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string>(`s-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        sessionGamesRef.current = 0;
        sessionIdRef.current = `s-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      }
    });
    return () => sub.remove();
  }, []);
```

- [ ] **Step 3: Add the participation + momentum effect (after the standard-win effect, ~line 4555)**

```ts
  // Participation + session momentum: fire once per finished local game (win OR
  // loss). Participation is a flat reward "for showing up"; momentum grows with
  // each consecutive game this session — the core "one more game" driver.
  useEffect(() => {
    if (override) return;
    const rewardSessionKey =
      state.openingDrawId ??
      (state.soloSessionStats?.startedAtMs != null
        ? `solo-${state.soloSessionStats.startedAtMs}`
        : state.turnStartedAt != null
          ? `${state.mode}-${state.turnStartedAt}`
          : null);
    if (!shouldAwardParticipationReward({
      phase: state.phase,
      mode: state.mode,
      isTutorial: state.isTutorial,
      rewardSessionKey,
      lastAwardedSessionKey: lastParticipationSessionKeyRef.current,
    })) {
      return;
    }
    lastParticipationSessionKeyRef.current = rewardSessionKey;

    void _awardCoinsForMeter(
      SALINDA_GAMEPLAY_REWARDS.game_participation,
      SALINDA_COIN_SOURCES.game_participation,
      rewardSessionKey!,
    );

    sessionGamesRef.current += 1;
    const momentum = sessionMomentumReward(sessionGamesRef.current);
    if (momentum > 0) {
      void _awardCoinsForMeter(
        momentum,
        SALINDA_COIN_SOURCES.session_momentum,
        `momentum:${sessionIdRef.current}:${sessionGamesRef.current}`,
      );
    }
  }, [
    override,
    _awardCoinsForMeter,
    state.isTutorial,
    state.mode,
    state.openingDrawId,
    state.phase,
    state.soloSessionStats?.startedAtMs,
    state.turnStartedAt,
  ]);
```

- [ ] **Step 4: Add the first-win-of-day effect (right after Step 3's effect)**

```ts
  // First win of the day: a human win triggers the server-date-idempotent RPC.
  // Safe to fire on every win — the RPC is a no-op after the day's first.
  const lastFirstWinSessionKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (override) return;
    const rewardSessionKey =
      state.openingDrawId ??
      (state.soloSessionStats?.startedAtMs != null
        ? `solo-${state.soloSessionStats.startedAtMs}`
        : state.turnStartedAt != null
          ? `${state.mode}-${state.turnStartedAt}`
          : null);
    if (!shouldAwardLocalStandardWinReward({
      phase: state.phase,
      mode: state.mode,
      isTutorial: state.isTutorial,
      winnerIsBot: state.winner?.isBot === true,
      rewardSessionKey,
      lastAwardedSessionKey: lastFirstWinSessionKeyRef.current,
    })) {
      return;
    }
    lastFirstWinSessionKeyRef.current = rewardSessionKey;
    void _awardFirstWinOfDay(SALINDA_GAMEPLAY_REWARDS.first_win_of_day);
  }, [
    override,
    _awardFirstWinOfDay,
    state.isTutorial,
    state.mode,
    state.openingDrawId,
    state.phase,
    state.soloSessionStats?.startedAtMs,
    state.turnStartedAt,
    state.winner?.isBot,
  ]);
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS. (If `state.soloSessionStats` typing differs, mirror the exact expression already used in the standard-win effect at `index.tsx:4522-4528`.)

- [ ] **Step 6: Commit**

```bash
git add index.tsx
git commit -m "feat(game): per-game participation, session momentum, first-win-of-day rewards"
```

---

## Task 6: Verify (logic + on-device) and report

**Files:** none (verification only)

- [ ] **Step 1: Full unit + typecheck**

Run: `npx jest shared/__tests__/economyRewards.phase1.test.ts src/economy` and `npx tsc --noEmit -p tsconfig.json`
Expected: all PASS, no new type errors.

- [ ] **Step 2: On-device behavior check (web dev server already on :8081)**

Reuse the driver pattern from `$CLAUDE_JOB_DIR/tmp/_drive-vs-salinda.mjs` to play one full vs-Salinda game to `game-over` and confirm via the HUD coin badge that the balance increases by participation (+10) and (on a win) standard-win (+40); play a 2nd consecutive game and confirm momentum (+5) lands. Capture the coin badge before/after.

- [ ] **Step 3: Screenshot verification on all 3 surfaces (HARD RULE — see memory)**

Capture the lobby/shop coin balance and an in-game coin badge on **Android RTL (Pixel 7), iPhone (iPhone 13 safe-area), and mobile web (390×664)** — confirm no layout regression from any of the changes (these are logic-only, so the bar is "identical UI, higher numbers"). Save shots under `$CLAUDE_JOB_DIR/tmp`.

- [ ] **Step 4: Write the Final Deployment Report**

Summarize: amounts changed, new sources, the 029 migration (flag: NOT yet applied to prod), files touched, test results, and the 3-surface screenshots. State explicitly that Phase 2 (leagues) and Phase 3 (catalog/premium cosmetics) are not included.

- [ ] **Step 5: Do NOT merge/deploy unprompted.** Per project rules, wait for the user to request "פוש" / merge. Leave the branch ready.

---

## Self-Review notes (author)

- **Spec coverage (§3.1):** onboarding cut (T1), meter 15 / win 40 (auto via T1 constants), participation 10 (T2/T5), first-win 100 server-date (T3/T4/T5), session momentum +5..+30 reset-on-background (T1/T2/T5). New sources allowlisted (T3). ✓
- **Out of Phase 1 (correctly deferred):** leagues / `record_local_win` (Phase 2), unified `cosmetics_owned` + `purchase_cosmetic` + tier prices (Phase 3), dice skins (Phase 4). The §3.2 shop prices are unchanged in Phase 1 — existing 20/25 stay until Phase 3.
- **Type consistency:** `_awardCoinsForMeter` is the existing `awardCoins(amount, source, idempotencyKey?)`; `_awardFirstWinOfDay` is the new `awardFirstWinOfDay(amount)`. Helper names match between shared definitions and index.tsx call sites (`sessionMomentumReward`, `shouldAwardParticipationReward`).
- **Idempotency:** participation/win keyed on `rewardSessionKey`; momentum on `momentum:<sessionId>:<n>`; first-win on server `current_date`. All backed by `idx_coin_events_player_source_key`.
