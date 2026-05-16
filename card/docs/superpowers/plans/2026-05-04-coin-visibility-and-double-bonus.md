# Coin Visibility & Double Bonus — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show players the coins they earned during a game on the meter, turn-transition screen, and game-over screen; celebrate the rare double-bonus event (triple roll + all-three-dice equation) on the turn-transition screen.

**Architecture:** All game logic lives in `gameReducer` (index.tsx). A new `rolledTripleThisTurn` boolean flag tracks whether a triple was rolled this turn and is cleared by `endTurnLogic`. UI components (`ExcellenceMeter`, `TurnTransition`, `GameOver`) receive `courageCoins` from the existing player state — no new state shape changes beyond the flag.

**Tech Stack:** React Native, TypeScript, Jest (reducer tests), Expo — run tests with `npx jest <path> --watchAll=false`

---

## Task 1: i18n strings + `rolledTripleThisTurn` flag + double-bonus logic

**Files:**
- Modify: `shared/i18n/he.ts` (after line 114)
- Modify: `shared/i18n/en.ts` (after line 103)
- Modify: `index.tsx` — GameState interface, initialState, ROLL_DICE, endTurnLogic, CONFIRM_STAGED
- Modify: `src/__tests__/courage-meter-reducer.test.ts`

---

- [ ] **Step 1: Add failing tests for triple-clears and double-bonus**

Append to `src/__tests__/courage-meter-reducer.test.ts`:

```typescript
// ── rolledTripleThisTurn ──────────────────────────────────────────────────

describe('rolledTripleThisTurn flag', () => {
  it('is set to true when ROLL_DICE produces a triple', () => {
    const st: GameState = {
      ...initialState,
      phase: 'pre-roll',
      players: [basePlayer([])],
      currentPlayerIndex: 0,
    };
    const next = gameReducer(st, { type: 'ROLL_DICE', values: { die1: 4, die2: 4, die3: 4 } }, tf);
    expect(next.rolledTripleThisTurn).toBe(true);
  });

  it('is false when ROLL_DICE produces a non-triple', () => {
    const st: GameState = {
      ...initialState,
      phase: 'pre-roll',
      players: [basePlayer([])],
      currentPlayerIndex: 0,
    };
    const next = gameReducer(st, { type: 'ROLL_DICE', values: { die1: 1, die2: 2, die3: 3 } }, tf);
    expect(next.rolledTripleThisTurn).toBe(false);
  });

  it('is cleared to false by endTurnLogic (via CONFIRM_STAGED path)', () => {
    const staged = { id: 'n5', type: 'number' as const, value: 5 };
    const st: GameState = {
      ...initialState,
      phase: 'solved',
      players: [basePlayer([staged])],
      currentPlayerIndex: 0,
      discardPile: [{ id: 'top3', type: 'number', value: 3 }],
      stagedCards: [staged],
      equationResult: 5,
      lastEquationDisplay: '5=5',
      rolledTripleThisTurn: true,
    };
    const next = gameReducer(st, { type: 'CONFIRM_STAGED' }, tf);
    expect(next.rolledTripleThisTurn).toBe(false);
  });
});

// ── double bonus ──────────────────────────────────────────────────────────

describe('double bonus (triple + all-three-dice)', () => {
  it('sets lastCourageRewardReason to doubleBonus when triple was rolled and all dice used', () => {
    const staged = { id: 'n5', type: 'number' as const, value: 5 };
    const st: GameState = {
      ...initialState,
      phase: 'solved',
      players: [basePlayer([staged])],
      currentPlayerIndex: 0,
      discardPile: [{ id: 'top3', type: 'number', value: 3 }],
      stagedCards: [staged],
      equationResult: 5,
      lastEquationDisplay: '2+2+1=5',   // two operators → usedAllDice
      rolledTripleThisTurn: true,
    };
    const next = gameReducer(st, { type: 'CONFIRM_STAGED' }, tf);
    expect(next.lastCourageRewardReason).toBe('courage.reason.doubleBonus');
  });

  it('does NOT set doubleBonus when triple was rolled but only one die was used', () => {
    const staged = { id: 'n5', type: 'number' as const, value: 5 };
    const st: GameState = {
      ...initialState,
      phase: 'solved',
      players: [basePlayer([staged])],
      currentPlayerIndex: 0,
      discardPile: [{ id: 'top3', type: 'number', value: 3 }],
      stagedCards: [staged],
      equationResult: 5,
      lastEquationDisplay: '5=5',   // zero operators → usedAllDice false
      rolledTripleThisTurn: true,
    };
    const next = gameReducer(st, { type: 'CONFIRM_STAGED' }, tf);
    expect(next.lastCourageRewardReason).not.toBe('courage.reason.doubleBonus');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```
npx jest src/__tests__/courage-meter-reducer.test.ts --watchAll=false
```

Expected: FAIL — `rolledTripleThisTurn` does not exist on type `GameState`, `ROLL_DICE` does not accept `values`.

- [ ] **Step 3: Add i18n strings**

In `shared/i18n/he.ts`, after the `courage.reason.consecutiveSuccess` line (currently line 114), add:

```typescript
  'courage.reason.doubleBonus': '🎲⭐🎲 בונוס כפול! שלישייה + שלוש קוביות במשוואה!',
```

In `shared/i18n/en.ts`, after the `courage.reason.consecutiveSuccess` line (currently line 102), add:

```typescript
  'courage.reason.doubleBonus': '🎲⭐🎲 Double bonus! Triple roll + all three dice in one equation!',
```

- [ ] **Step 4: Add `rolledTripleThisTurn` to GameState**

In `index.tsx`, find the block containing `lastCourageCoinsAwarded: boolean;` (around line 510) and add the new field immediately after:

```typescript
  /** Set to true in ROLL_DICE when isTriple; cleared by endTurnLogic. */
  rolledTripleThisTurn: boolean;
```

- [ ] **Step 5: Add `rolledTripleThisTurn` to `initialState`**

Find the `initialState` object (look for `courageMeterPercent: 0, courageMeterStep: 0` around line 1345) and add:

```typescript
rolledTripleThisTurn: false,
```

- [ ] **Step 6: Set flag in ROLL_DICE**

In `index.tsx`, the `ROLL_DICE` triple block currently reads (around line 1785):

```typescript
      if (isTriple(dice)) {
        ns = { ...ns, message: tf('toast.tripleDice', { n: String(dice.die1) }) };
        ns = applyCourageStepReward(ns, tf('courage.reason.tripleDice', { n: String(dice.die1) }));
      }
```

Replace with:

```typescript
      if (isTriple(dice)) {
        ns = { ...ns, message: tf('toast.tripleDice', { n: String(dice.die1) }), rolledTripleThisTurn: true };
        ns = applyCourageStepReward(ns, tf('courage.reason.tripleDice', { n: String(dice.die1) }));
      }
```

- [ ] **Step 7: Clear flag in `endTurnLogic`**

In `endTurnLogic` (around line 1596), the return object has many explicit fields. Add `rolledTripleThisTurn: false` to the return:

```typescript
  return {
    ...s,
    rolledTripleThisTurn: false,   // ← add this line
    notifications: nextNotifications,
    ...
```

- [ ] **Step 8: Detect double bonus in `CONFIRM_STAGED`**

In `index.tsx`, the `CONFIRM_STAGED` courage block currently reads (around line 1937):

```typescript
      // Condition 1: used all 3 dice (equation display has 2+ operators before '=')
      const eqBefore = (st.lastEquationDisplay ?? '').split('=')[0] ?? '';
      const usedAllDice = (eqBefore.match(/[+×÷-]/g) ?? []).length >= 2;
      if (usedAllDice) {
        stNs = applyCourageStepReward(stNs, tf('courage.reason.fullEquation'));
      }
```

Replace with:

```typescript
      // Condition 1: used all 3 dice (equation display has 2+ operators before '=')
      const eqBefore = (st.lastEquationDisplay ?? '').split('=')[0] ?? '';
      const usedAllDice = (eqBefore.match(/[+×÷-]/g) ?? []).length >= 2;
      if (usedAllDice) {
        stNs = applyCourageStepReward(stNs, tf('courage.reason.fullEquation'));
      }
      // Double bonus: triple roll AND all-three-dice equation in the same turn
      if (usedAllDice && st.rolledTripleThisTurn) {
        stNs = { ...stNs, lastCourageRewardReason: tf('courage.reason.doubleBonus') };
      }
```

- [ ] **Step 9: Run tests — verify they pass**

```
npx jest src/__tests__/courage-meter-reducer.test.ts --watchAll=false
```

Expected: all tests PASS including the new ones.

- [ ] **Step 10: Commit**

```bash
git add shared/i18n/he.ts shared/i18n/en.ts index.tsx src/__tests__/courage-meter-reducer.test.ts
git commit -m "feat: rolledTripleThisTurn flag + double-bonus courage reason"
```

---

## Task 2: Coin below ExcellenceMeter

**Files:**
- Modify: `components/ExcellenceMeter.tsx`
- Modify: `index.tsx` (two ExcellenceMeter call sites: lines 11528 and 13924)

---

- [ ] **Step 1: Add `courageCoins` prop to ExcellenceMeter**

In `components/ExcellenceMeter.tsx`, the `Props` type currently ends at `height?: number;`. Add `courageCoins`:

```typescript
type Props = {
  value: number;
  compact?: boolean;
  pulseKey?: number;
  isCelebrating?: boolean;
  onPress?: () => void;
  title?: string;
  height?: number;
  courageCoins?: number;
};
```

Update the function signature destructuring:

```typescript
export default function ExcellenceMeter({
  value,
  compact = false,
  pulseKey,
  isCelebrating = false,
  onPress,
  courageCoins,
}: Props) {
```

- [ ] **Step 2: Import SlindaCoin and Text into ExcellenceMeter**

At the top of `components/ExcellenceMeter.tsx`, add the imports:

```typescript
import { Text } from 'react-native';
import { SlindaCoin } from './SlindaCoin';
```

(`View` and `StyleSheet` are already imported.)

- [ ] **Step 3: Render coin below the meter**

In `ExcellenceMeter`, find the JSX return. The meter bar is wrapped in a `TouchableOpacity` or `View`. Wrap the whole thing in a column `View` and add the coin below:

Find the existing return (it starts with `<TouchableOpacity` or `<View` depending on `onPress`). The entire return should be wrapped so the coin sits below. The simplest change: add a `View` wrapper around whatever the existing root element is, and append the coin row below it.

The return should look like:

```typescript
  return (
    <View style={{ alignItems: 'center' }}>
      {/* existing meter JSX — leave untouched */}
      <TouchableOpacity ... >
        {/* ... all existing meter content ... */}
      </TouchableOpacity>

      {/* Coin below meter — only when coins earned */}
      {(courageCoins ?? 0) > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 2 }}>
          <SlindaCoin size={18} pulseKey={pulseKey} />
          <Text style={{ color: '#FCD34D', fontSize: 11, fontWeight: '700' }}>
            ×{courageCoins}
          </Text>
        </View>
      )}
    </View>
  );
```

> Note: read the actual current return block in ExcellenceMeter.tsx before editing — preserve it exactly and only wrap + append.

- [ ] **Step 4: Pass `courageCoins` at both call sites in index.tsx**

**Call site 1** (around line 11528):

```typescript
              <ExcellenceMeter
                value={meterPlayer.courageMeterPercent ?? 0}
                pulseKey={meterPlayer.courageRewardPulseId ?? 0}
                isCelebrating={state.lastCourageCoinsAwarded}
                courageCoins={meterPlayer.courageCoins ?? 0}
                compact
              />
```

**Call site 2** (around line 13924):

```typescript
                  <ExcellenceMeter
                    value={meterPlayer.courageMeterPercent ?? 0}
                    pulseKey={meterPlayer.courageRewardPulseId ?? 0}
                    isCelebrating={state.lastCourageCoinsAwarded}
                    courageCoins={meterPlayer.courageCoins ?? 0}
                    compact
                  />
```

- [ ] **Step 5: Visual check**

Run `npx expo start` and start a game. Roll dice, earn a coin via the excellence meter. Verify the SlindaCoin ×N appears below the meter on your turn and the count increments correctly.

- [ ] **Step 6: Commit**

```bash
git add components/ExcellenceMeter.tsx index.tsx
git commit -m "feat: show earned coins below ExcellenceMeter"
```

---

## Task 3: Coin summary on TurnTransition screen

**Files:**
- Modify: `src/components/screens/TurnTransition.tsx`

---

- [ ] **Step 1: Add coin summary box**

`TurnTransition.tsx` currently shows player name, card count, and an optional message box. The `currentPlayer` comes from `state.players[state.currentPlayerIndex]`.

Add the coin box after the `cardCount` Text and before the optional `messageBox`:

```typescript
      {(currentPlayer?.courageCoins ?? 0) > 0 && (
        <View style={styles.coinBox}>
          <Text style={styles.coinText}>
            🪙 ×{currentPlayer.courageCoins}{'  '}ממשיכים לתרגל! 💪
          </Text>
        </View>
      )}
```

Add the styles at the bottom of the `StyleSheet.create` call:

```typescript
  coinBox: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    padding: 10,
    marginTop: 14,
    width: '100%',
    alignItems: 'center',
  },
  coinText: {
    color: '#FDE68A',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
```

- [ ] **Step 2: Visual check**

In a game session, earn a coin via the excellence meter, then end your turn. On the TurnTransition screen verify the gold coin box appears with the correct count.

- [ ] **Step 3: Commit**

```bash
git add src/components/screens/TurnTransition.tsx
git commit -m "feat: show coin summary on TurnTransition screen"
```

---

## Task 4: Coin column in GameOver standings

**Files:**
- Modify: `src/components/screens/GameOver.tsx`

---

- [ ] **Step 1: Add coin display to standings rows**

In `GameOver.tsx`, the standings map is (around line 92):

```typescript
        {sortedPlayers.map((p, i) => (
          <View key={p.id} style={styles.standingRow}>
            <Text style={styles.standingName}>
              {i + 1}. {p.name}
              {p.hand.length === 0 ? ' ★' : ''}
            </Text>
            <Text style={styles.standingCards}>{t('game.cardsLeft', { n: String(p.hand.length) })}</Text>
          </View>
        ))}
```

Replace with:

```typescript
        {sortedPlayers.map((p, i) => (
          <View key={p.id} style={styles.standingRow}>
            <Text style={styles.standingName}>
              {i + 1}. {p.name}
              {p.hand.length === 0 ? ' ★' : ''}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {(p.courageCoins ?? 0) > 0 ? (
                <Text style={styles.coinBadge}>🪙×{p.courageCoins}</Text>
              ) : (
                <Text style={styles.standingCards}>—</Text>
              )}
              <Text style={styles.standingCards}>{t('game.cardsLeft', { n: String(p.hand.length) })}</Text>
            </View>
          </View>
        ))}
```

Add `coinBadge` to the `StyleSheet.create` call at the bottom:

```typescript
  coinBadge: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '700',
  },
```

- [ ] **Step 2: Visual check**

Finish a game where at least one player earned coins. Verify the GameOver screen shows `🪙×N` beside each player who earned coins and `—` for those who didn't.

- [ ] **Step 3: Commit**

```bash
git add src/components/screens/GameOver.tsx
git commit -m "feat: show coin earnings per player in GameOver standings"
```

---

## Self-Review

**Spec coverage:**
- ✅ Bug fix (triple → meter) — already done before plan, documented in spec
- ✅ Task 1: `rolledTripleThisTurn` flag + double-bonus reason
- ✅ Task 2: Coin below ExcellenceMeter
- ✅ Task 3: Coin on TurnTransition
- ✅ Task 4: Coin column on GameOver

**Placeholder scan:** No TBDs. All code blocks are complete.

**Type consistency:**
- `courageCoins` — used as `number` throughout; already `number` on `Player` type
- `rolledTripleThisTurn` — `boolean`, consistently named in interface, initialState, ROLL_DICE, endTurnLogic, CONFIRM_STAGED
- `SlindaCoin` is a named export (`export function SlindaCoin`) — import as `{ SlindaCoin }`
- `pulseKey` on SlindaCoin accepts `string | number | null`; passing `pulseKey` (which is `number`) from ExcellenceMeter is valid
