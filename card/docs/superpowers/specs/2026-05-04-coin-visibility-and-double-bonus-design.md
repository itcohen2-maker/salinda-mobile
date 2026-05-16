# Coin Visibility & Double Bonus — Design Spec
Date: 2026-05-04

## Goal

Show players the coins they earned during a game across three surfaces, and celebrate the rare "double bonus" event when a player rolls a triple AND uses all three dice in the same equation.

---

## Bug Fixed (Already Done)

**Triple roll did not advance the excellence meter.**

Root cause: `ROLL_DICE` showed a toast for triples (`toast.tripleDice`) but never called `applyCourageStepReward`, despite:
- `courage.reason.tripleDice` i18n string existing
- Guidance message "🎲 שלישייה! בונוס למד ההצטיינות ⭐" being defined
- A code comment stating "triple roll or equation played" advances the meter

Fix applied: one line added to `ROLL_DICE` case in `gameReducer` (index.tsx:1787):
```ts
ns = applyCourageStepReward(ns, tf('courage.reason.tripleDice', { n: String(dice.die1) }));
```

---

## Feature 1: Coin Below Meter

**Where:** `ExcellenceMeter` component (components/ExcellenceMeter.tsx), visible only during the current player's turn.

**What:** A `SlindaCoin` (size=22) with a "×N" label below the meter, where N = `courageCoins` for the current player. Hidden when N = 0.

**Behavior:**
- Mounts/fades in the first time N > 0 in the session
- Triggers a short `pulseKey` animation on `SlindaCoin` each time N increments
- Coin + label fade out when the turn ends (not shown during other players' turns)

**Props needed:** `ExcellenceMeter` already receives player state; it needs `courageCoins: number` passed in.

---

## Feature 2: Coin Summary on Turn Transition

**Where:** `TurnTransition.tsx`, below the card count line.

**What:** A compact gold box showing:
```
🪙 ×N  ממשיכים לתרגל! 💪
```
Where N = coins earned by the player whose turn is starting.

**Condition:** Only shown when N > 0. Uses existing `messageBox` style with gold tones (`rgba(251,191,36,0.1)` border `#fbbf24`).

**Data source:** `state.players[state.currentPlayerIndex].courageCoins`

---

## Feature 3: Coins in GameOver Standings

**Where:** `GameOver.tsx`, inside the `standings` list, one row per player.

**What:** Each standing row gets a right-side coin count:
```
1. דניאל ★         🪙×3
2. שרה              🪙×1
3. יוסי             —
```
A `SlindaCoin` (size=16) + `×N` in gold, or a `—` in gray if N = 0.

**Data source:** `sortedPlayers[i].courageCoins`

---

## Feature 4: Double Bonus Toast

**Trigger:** Triple roll (`isTriple(dice)`) AND all three dice used in equation (`usedAllDice`) in the same turn. Both already advance the meter independently; this is the celebratory signal.

**Detection:** Add a boolean `rolledTripleThisTurn: boolean` to `GameState` (default `false`). Set to `true` in `ROLL_DICE` when triple detected. Clear to `false` in `BEGIN_TURN` and `NEXT_TURN`.

In `CONFIRM_STAGED`, when `usedAllDice && st.rolledTripleThisTurn`, set state message to:
```
tf('courage.reason.doubleBonus')
```

**i18n strings to add:**

| key | he | en |
|---|---|---|
| `courage.reason.doubleBonus` | `🎲⭐🎲 בונוס כפול! שלישייה + שלוש קוביות` | `🎲⭐🎲 Double bonus! Triple + all three dice` |

**Visual:** The existing `NotificationZone` / message bubble renders `state.message` in gold (`#FDE68A` on `rgba(234,179,8,0.1)` background, gold border) — this is the existing `messageBox` style already used for triples and other messages. No new component needed.

---

## State Changes

| Field | Type | Default | Set | Cleared |
|---|---|---|---|---|
| `rolledTripleThisTurn` | `boolean` | `false` | `ROLL_DICE` when triple | `BEGIN_TURN`, `NEXT_TURN` |

`courageCoins` already exists on `Player` and on global `GameState`. No new fields needed for features 1–3.

---

## Files to Change

| File | Change |
|---|---|
| `index.tsx` | Add `rolledTripleThisTurn` to `GameState` interface + initial state; set in `ROLL_DICE`; clear in `BEGIN_TURN`/`NEXT_TURN`; detect double bonus in `CONFIRM_STAGED` |
| `components/ExcellenceMeter.tsx` | Add `courageCoins` prop, render `SlindaCoin` + `×N` below meter |
| `src/components/screens/TurnTransition.tsx` | Add coin summary box when `courageCoins > 0` |
| `src/components/screens/GameOver.tsx` | Add coin column to standings rows |
| `shared/i18n/he.ts` | Add `courage.reason.doubleBonus` |
| `shared/i18n/en.ts` | Add `courage.reason.doubleBonus` |

---

## Out of Scope

- Multiplayer sync of `rolledTripleThisTurn` (server already tracks `courageCoins` via supabase; local flag is local only)
- Changing the full-screen `ExtractedMeterCelebration` overlay (unchanged)
- Bot player coin display (bots are excluded by `applyCourageStepReward` guard `cp.isBot`)
