# Economy Redesign — Earning, Tiered Sinks & Leagues

**Date:** 2026-06-13
**Status:** Design approved (numbers locked); pending spec review → implementation plan
**Goal driver chosen by product owner:** *more games per session* (session depth), not daily retention or monetization.

---

## 1. Problem

The current economy is inverted and offers no reason to keep playing:

- One-time onboarding pays **~900 coins** (Gold Room 500 + tutorial 150 + 250).
- The **entire shop costs 135 coins** (3 backgrounds @25 + 3 table skins @20).
- A new player finishes onboarding and can buy the whole shop **~6–7× over**.
- The excellence meter pays **1 coin** per full cycle — imperceptible.
- No aspirational sink, no progression, no in-session momentum.

## 2. Goals & Non-Goals

**Goals**
- Make a meaningful **per-game earning loop** so playing another game is always rewarding.
- Add **in-session momentum** that directly rewards playing consecutive games.
- Add **aspirational tiered sinks** (premium cosmetics) priced so the marquee item takes **~28 games** (balanced pacing, product-owner choice).
- Add a **League/Status progression** (Bronze→Master) for long-term goals at near-zero art cost.
- Invert the ratio: onboarding becomes a *head start* (~500), full shop becomes ~8,000.

**Non-Goals (this iteration)**
- Real-money monetization (deferred; design stays compatible).
- Dice-skin engine work (Phase 2 — see §8).
- Gameplay perks/power-ups (rejected: balance risk).
- Reworking the multiplayer server's match recording.

## 3. Locked Economy Numbers

### 3.1 Earning

| Source | Old | **New** | Frequency | Notes |
|---|---|---|---|---|
| Gold Room (tutorial complete) | 500 | **300** | once ever | welcome gift |
| Tutorial basic | 150 | **75** | once | |
| Tutorial advanced | 250 | **125** | once | |
| Excellence meter full | 1 | **15** | ~1–2 / game | now felt |
| Win vs Salinda | 100 | **40** | per win | |
| Game finished (even a loss) | 0 | **10** | per game | "one more" even when losing |
| First win of the day | 300 (defined, **not wired**) | **100** | once/day | bonus |
| **Session momentum** | — | **+5 cumulative** | per consecutive game in a session | game 2 → +5, game 3 → +10 … capped **+30**; resets when app is backgrounded/closed |

**Expected average:** ~65 coins for a winning game (40 win + 15 meter + 10 finish); **80–95** in a long session once momentum stacks.

### 3.2 Pricing (tiered cosmetic sinks)

| Tier | Price | Examples | ≈ games to afford |
|---|---|---|---|
| Common (entry) | **200** | basic card back, simple dice skin | ~3 |
| Rare | **500** | premium card back, designed dice skin | ~7 |
| Epic | **1000** | premium table environment | ~14 |
| Legendary / marquee | **2000** | animated table / dice, exclusive | ~28 |

Pacing assumes ~70 coins/game average. Marquee ≈ 28 games = **balanced** (product-owner choice).

### 3.3 Leagues (status — earned, not bought)

Tiers: **Bronze → Silver → Gold → Diamond → Master**, gated by **lifetime wins** (vs-bot/solo/online all count):

| League | Wins required |
|---|---|
| Bronze | 0 |
| Silver | 15 |
| Gold | 40 |
| Diamond | 80 |
| Master | 150 |

Each league grants: **a badge + a title**, and **unlocks the right to purchase that league's exclusive cosmetic** (extra sink + prestige). Leagues are **derived** from the win count (no separate stored league field needed); badges/titles render from the derived tier.

## 4. Architecture — Integration Points

All file:line references verified against current `main`.

### 4.1 Earning (client)
- **Excellence meter** — `index.tsx:4504–4518`, effect calling `awardCoins(EXCELLENCE_METER_FULL_REWARD_COINS, 'excellence_meter_full')`. Change: constant 1 → 15 (via `SALINDA_GAMEPLAY_REWARDS`).
- **Standard win** — `index.tsx:4520–4555`, guarded by `shouldAwardLocalStandardWinReward` (`shared/salindaEconomy.ts:176`). Change: amount 100 → 40.
- **Game-finished (participation) + first-win-of-day + session momentum** — NEW award sites near the win/`game-over` effect. Win detection is `checkWin()` `index.tsx:2194–2221` (sets `phase:'game-over'`). The `game-over` effect is the natural trigger.
- **Onboarding amounts** — `shared/salindaEconomy.ts` constants (`SALINDA_TUTORIAL_REWARDS`, `SALINDA_GOLD_ROOM_REWARD`). Award sites: `useAuth.tsx:155–180` (tutorial), `GoldRoomScreen.tsx:838` (gold room). Change: constants only.

### 4.2 Earning (backend)
- `award_coins(p_amount, p_source, p_idempotency_key)` RPC (migration 019; SECURITY DEFINER) writes to `coin_events` + bumps `profiles.total_coins`. Source is constrained by a **CHECK allowlist** (019, extended 026).
- **NEW migration** extends the allowlist with: `game_participation`, `first_win_of_day`, `session_momentum`. (`first_win_of_day` constant exists but was never wired — wire it now.)
- Idempotency keys: participation/win use the existing `rewardSessionKey`; first-win-of-day uses `first_win:<YYYY-MM-DD>`; momentum uses `momentum:<sessionId>:<gameIndex>`.

### 4.3 Sinks / Catalog (backend) — **structural change**
Current: `purchase_theme` (price 25) and `purchase_table_skin` (price 20) **hardcode** prices and item lists. This does not scale to tiers/many items.

**Proposed:** a **catalog-driven** model.
- NEW table `cosmetics` (`item_id` PK, `kind` ∈ {card_back, table_skin, table_env, dice_skin, badge}, `price int`, `league_required text null`, `is_active bool`).
- NEW generic RPC `purchase_cosmetic(p_item_id)` → reads price + league gate from `cosmetics`, validates funds + league, decrements coins, appends to the right `*_owned` array, logs a `coin_events` spend row.
- Migrate existing themes/table skins into `cosmetics` rows at the new tier prices; keep `purchase_theme`/`purchase_table_skin` as thin shims (or deprecate) to avoid breaking the current shop during rollout.
- Client `SALINDA_CATALOG` (`shared/salindaEconomy.ts`) becomes the source of truth for item→tier→price and is mirrored by the migration (single table, generated from the constant where practical).

### 4.4 Leagues (data + gating)
- **Lifetime wins for local games:** `profiles.wins` is only written by the multiplayer server; vs-bot/solo wins are not recorded. NEW RPC `record_local_win()` (SECURITY DEFINER, idempotent on `rewardSessionKey`) increments `profiles.wins` on a local `game-over` win. League is then derived from `wins` everywhere.
- **League derivation:** pure client util `leagueForWins(wins): LeagueTier` in `shared/salindaEconomy.ts` (thresholds from §3.3). Used to render badge/title and to compute the unlocked exclusive cosmetics.
- **Purchase gating:** `purchase_cosmetic` re-derives league from `profiles.wins` server-side and rejects locked exclusives (`'league_locked'`).
- **Profile fields:** add nothing for league (derived). Add `last_first_win_date date null` (or rely solely on the idempotency key) for the daily bonus — **decided: rely on idempotency key**, no new column.

### 4.5 Client profile type
- `PlayerProfile` (`useAuth.tsx:22–38`) already has `wins`. Add derived `league` in a selector/hook (not stored). New cosmetic kinds (`table_env`, `dice_skin`, `badge`) need `*_owned` storage — reuse `themes_owned`/`table_skins_owned` patterns or add `cosmetics_owned text[]` (preferred: one unified array going forward).

## 5. Data Flow (per game)

1. Player finishes a game → `checkWin()` sets `phase:'game-over'`, `winner`.
2. `game-over` effect fires (client):
   - `record_local_win()` if human won (→ updates `wins`, may change league).
   - `award_coins(40,'game_standard_win',sessionKey)` if won.
   - `award_coins(10,'game_participation',sessionKey)` always (win or loss).
   - `award_coins(100,'first_win_of_day','first_win:<date>')` if first win today (idempotent).
   - `award_coins(momentumAmount,'session_momentum','momentum:<sid>:<n>')` if 2nd+ consecutive game this session.
3. Excellence-meter fills during play → `award_coins(15,'excellence_meter_full',pulseKey)` (unchanged path, new amount).
4. `refreshProfile()` pulls new `total_coins` + `wins`; UI re-derives league/badge.

Session momentum counter is **client-only state** (resets on app background); the idempotency key prevents double-award on remount.

## 6. Error Handling
- All awards are idempotent (existing `coin_events` unique index on `(player_id, source, idempotency_key)`); safe to retry on transient failure.
- `purchase_cosmetic` is atomic in one RPC (funds + league check + decrement + grant), returns typed result: `'ok' | 'already_owned' | 'insufficient_coins' | 'league_locked' | 'invalid_item' | 'error'`.
- Client shows existing shop feedback strings; add `shop.leagueLocked` i18n (he/en).

## 7. Testing
- **Unit (shared):** `leagueForWins` thresholds; momentum schedule (+5..+30 cap); pricing/tier table integrity; reward-source allowlist matches DB migration.
- **Unit (economy):** extend `salindaEconomy.validation.test.ts` for `purchase_cosmetic` outcomes incl. `league_locked`.
- **Reducer:** `game-over` produces exactly one of each award per session key (idempotency); participation awarded on loss; momentum increments per consecutive game and resets.
- **Migration:** allowlist CHECK includes new sources; `cosmetics` seed rows match `SALINDA_CATALOG`; `record_local_win` idempotent.
- **Screenshot verify (HARD RULE):** shop tiers + league badge on all 3 surfaces (Android RTL, iPhone safe-area, mobile web), zero-regression, Final Deployment Report.

## 8. Phasing

1. **Phase 1 — numbers + earning loop (no new art):** rebalance all constants; wire participation, first-win-of-day, session momentum; new coin-source migration. Ship + verify. (Pure logic, immediate impact.)
2. **Phase 2 — leagues:** `record_local_win`, `leagueForWins`, badge/title UI, league-gated exclusives. Needs **5 badge assets** (512×512).
3. **Phase 3 — catalog + premium cosmetics:** `cosmetics` table + `purchase_cosmetic`, migrate shop to catalog, add card backs (800×1120) + table envs (1024×774) at tiers.
4. **Phase 4 — dice skins:** three.js face-texture skinning (256×256 ×6). Higher engineering effort; last.

## 9. Designer Wishlist (prioritized)

| # | Asset | Initial qty | Size / format | Notes |
|---|---|---|---|---|
| 1 | **League badges** | 5 | **512×512 PNG, transparent, 1:1** | Bronze/Silver/Gold/Diamond/Master; medal/shield style. Cheapest, most aspirational → first |
| 2 | **Card backs** | 3–4 | **800×1120 PNG, 5:7** | Matches existing card art (800×1024); consistent rounded corners |
| 3 | **Premium table environments** | 2–3 | **1024×774 PNG, transparent, ~4:3** | Same format as existing tables; e.g. glass, mahogany, neon/space |
| 4 | **Dice skins** | 3 | **6× face textures 256×256 PNG per skin** | three.js engine; Phase 4, higher effort |
| 5 | Salinda avatar (optional) | — | 512×512 PNG | future |

## 10. Decisions (locked 2026-06-13)
- **D1 — Cosmetics storage:** **Unified** `cosmetics_owned text[]`, with a migration backfill from `themes_owned`/`table_skins_owned`. New code reads/writes the unified array; legacy arrays kept read-only during transition.
- **D2 — Onboarding cut:** **Accepted.** The cut (500/150/250 → 300/75/125) affects only *new* awards; already-granted coins are idempotent and untouched. No retroactive clawback.
- **D3 — `first_win_of_day` reset boundary:** **Server (UTC).** Idempotency key uses server-side `current_date` inside the award path to prevent timezone gaming.
