# Economy Redesign — Phase 2 (Leagues / Status) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (or subagent-driven-development). TDD where a logic seam exists. Steps use `- [ ]` for tracking.

**Goal:** Add a derived League/Status progression (Bronze→Silver→Gold→Diamond→Champion) gated by lifetime wins, render the badge + title, and record local (vs-bot/solo) wins so the count actually grows. Near-zero art cost — the 5 badge PNGs are already in the repo.

**Spec:** `docs/superpowers/specs/2026-06-13-economy-redesign-design.md` §3.3, §4.4, §8 Phase 2.

**Branch:** continue on `economy-redesign-phase1` or branch `economy-redesign-phase2` off it.

---

## Pre-existing state (verified 2026-06-13, uncommitted WIP on this branch)
- ✅ Badge assets already placed: `assets/premium/badges/badge-{1-bronze,2-silver,3-gold,4-diamond,5-champion}.png`.
- ✅ `useAuth.tsx` already has unified-cosmetics scaffolding (`cosmetics_owned`, `purchaseCosmetic`, `setActiveCosmetic`) — that is **D1/Phase 3**, not Phase 2; leave it alone here.
- ⚠️ **Naming:** design §3.3 calls tier 5 "Master"; the asset is `badge-5-champion`. **Decision: use `champion` as the tier id**, display title "Champion" (matches art). Update §3.3 mention in code comments.
- ⚠️ `profiles.wins` is currently written **only** by the multiplayer server; local games don't increment it. Phase 2 adds `record_local_win()`.

---

## File Structure
- `shared/salindaEconomy.ts` — **modify**: add `LEAGUE_TIERS`, `LeagueTier` type, `leagueForWins(wins)`, `nextLeague(wins)`.
- `shared/__tests__/leagues.phase2.test.ts` — **create**: lock thresholds + boundary behavior.
- `supabase/migrations/030_record_local_win.sql` — **create**: idempotent `record_local_win()` RPC (SECURITY DEFINER) incrementing `profiles.wins`.
- `src/hooks/useAuth.tsx` — **modify**: add `recordLocalWin()` wrapper + expose on context type/value.
- `index.tsx` — **modify**: in GameProvider, call `recordLocalWin()` on a human local win (reuse the `shouldAwardLocalStandardWinReward` guard + a `lastLocalWinSessionKeyRef`).
- `src/economy/leagues.ts` (or co-locate) — **create**: `LEAGUE_BADGES` map tier→`require('../../assets/premium/badges/...')` + i18n title key.
- `components/LeagueBadge.tsx` — **create**: small badge + title pill; props `{ wins }`, derives tier.
- Lobby (`index.tsx` PlayModeChoiceScreen) — **modify**: render `<LeagueBadge wins={profile?.wins ?? 0} />` near the coin badge.
- `shared/i18n/he.ts` + `en.ts` — **modify**: `league.bronze/silver/gold/diamond/champion` titles + `league.title` label.

---

## Task 1: League derivation (pure logic, TDD)
- [ ] **Test** `shared/__tests__/leagues.phase2.test.ts`: thresholds Bronze 0 / Silver 15 / Gold 40 / Diamond 80 / Champion 150; `leagueForWins(0)='bronze'`, `(14)='bronze'`, `(15)='silver'`, `(149)='diamond'`, `(150)='champion'`, `(99999)='champion'`; guards (`-5`, `NaN` → 'bronze'). `nextLeague(15)` → `{ tier:'gold', winsNeeded:25 }`; `nextLeague(150)` → null.
- [ ] **Implement** in `shared/salindaEconomy.ts`:
```ts
export const LEAGUE_TIERS = [
  { tier: 'bronze',   minWins: 0 },
  { tier: 'silver',   minWins: 15 },
  { tier: 'gold',     minWins: 40 },
  { tier: 'diamond',  minWins: 80 },
  { tier: 'champion', minWins: 150 },
] as const;
export type LeagueTier = typeof LEAGUE_TIERS[number]['tier'];
export function leagueForWins(wins: number): LeagueTier {
  if (!Number.isFinite(wins) || wins <= 0) return 'bronze';
  let tier: LeagueTier = 'bronze';
  for (const t of LEAGUE_TIERS) if (wins >= t.minWins) tier = t.tier;
  return tier;
}
export function nextLeague(wins: number): { tier: LeagueTier; winsNeeded: number } | null {
  const safe = Number.isFinite(wins) && wins > 0 ? Math.floor(wins) : 0;
  for (const t of LEAGUE_TIERS) if (safe < t.minWins) return { tier: t.tier, winsNeeded: t.minWins - safe };
  return null;
}
```
- [ ] Run `npx jest shared/__tests__/leagues.phase2.test.ts` → PASS.

## Task 2: Migration 030 — `record_local_win()` (idempotent)
- [ ] Create `supabase/migrations/030_record_local_win.sql`. Mirror 029's idempotency style: a `local_win_events` guard OR reuse `coin_events` is wrong (that's coins) — instead add a small dedupe table OR an idempotency check on a new `win_events(player_id, session_key)` unique index.
```sql
create table if not exists public.win_events (
  player_id uuid not null references auth.users(id) on delete cascade,
  session_key text not null,
  created_at timestamptz not null default now(),
  primary key (player_id, session_key)
);
alter table public.win_events enable row level security;
create policy "win_events_owner_read" on public.win_events for select using (auth.uid() = player_id);

create or replace function public.record_local_win(p_session_key text)
returns void as $$
declare v_player_id uuid := auth.uid();
begin
  if v_player_id is null or p_session_key is null then return; end if;
  insert into public.win_events (player_id, session_key) values (v_player_id, p_session_key)
  on conflict do nothing;
  if found then
    update public.profiles set wins = coalesce(wins,0) + 1 where id = v_player_id;
  end if;
end;
$$ language plpgsql security definer set search_path = public;
grant execute on function public.record_local_win(text) to authenticated, anon;
```
- [ ] SQL review: idempotent per (player, session_key); only increments on first insert (`if found`).

## Task 3: `useAuth` — `recordLocalWin` wrapper
- [ ] Add `recordLocalWin(sessionKey: string): Promise<'ok'|'error'>` (rpc `record_local_win`, then `refreshProfile()` so `wins`/league update). Expose on `AuthContextValue` + value object (mirror `awardFirstWinOfDay`).
- [ ] `npx tsc --noEmit` → clean.

## Task 4: Wire `recordLocalWin` in GameProvider
- [ ] In `index.tsx`, add a `lastLocalWinSessionKeyRef` and an effect mirroring the first-win-of-day effect (same `shouldAwardLocalStandardWinReward` guard) that calls `void recordLocalWin(rewardSessionKey)` on a human local win. (One increment per session key.)
- [ ] `npx tsc --noEmit` → clean.

## Task 5: Badge map + `<LeagueBadge>` component
- [ ] `src/economy/leagues.ts`: `LEAGUE_BADGES: Record<LeagueTier, ImageSourcePropType>` → `require('../../assets/premium/badges/badge-1-bronze.png')` … `badge-5-champion.png`; `LEAGUE_TITLE_KEY: Record<LeagueTier,string>`.
- [ ] `components/LeagueBadge.tsx`: `{ wins, size? }` → derive tier via `leagueForWins`, render `<Image>` + title pill (`t(LEAGUE_TITLE_KEY[tier])`). Respect RTL (`writingDirection`, not `direction`). Keep it pure/presentational.

## Task 6: Render in lobby + i18n
- [ ] Add `league.*` keys to `he.ts`/`en.ts` (bronze/silver/gold/diamond/champion + "League" label).
- [ ] Render `<LeagueBadge wins={profile?.wins ?? 0} />` in the lobby header near the coin badge (PlayModeChoiceScreen in `index.tsx`). Don't disturb the existing coin-badge layout.

## Task 7: Verify (HARD RULE) + report
- [ ] Unit: leagues test + full `src/economy` green; `tsc` clean.
- [ ] **3-surface screenshots** (Android RTL Pixel 7, iPhone 13 safe-area, mobile web 390×664): badge renders, no overlap with coin badge, RTL flawless. Reuse `scripts/_verify-economy-phase1.mjs` pattern.
- [ ] Live: after migration 030 applied, a vs-bot win increments `wins`; crossing a threshold swaps the badge. (Blocked on 030 apply, like Phase 1's 029.)
- [ ] Final report; do NOT merge/deploy unprompted.

## Notes / risks
- League is **derived**, never stored — no profile column needed (design §4.4).
- `record_local_win` is separate from coin awards on purpose (different idempotency domain).
- Phase 2 does **not** wire league-gated cosmetic *purchasing* — that lands in Phase 3 (`purchase_cosmetic` re-derives league server-side). Phase 2 only shows status.
