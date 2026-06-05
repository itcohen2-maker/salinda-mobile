# Gold Room "Discard Helper" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a faithful, lean copy of the live game's "איך להיפטר מקלף?" green→red mini-cards helper into the Gold Room practice (`DiceEquationRound`, `mode='practice'`).

**Architecture:** A self-contained presentational component `DiscardHelper` rendered between the table and the fan. Green button → on press becomes a red equation-display surface; mini-cards (static, lean copies using `getNumColors`) appear; tapping one shows its equation in the red surface. An orange placeholder is reserved beside it. No live-game changes, no engine logic.

**Tech Stack:** React Native, expo-linear-gradient, existing `goldRoomCopy` + `components/CardDesign` exports.

---

## File Structure

- `src/goldroom/goldRoomCopy.ts` — add 4 copy keys (he+en).
- `src/goldroom/DiscardHelper.tsx` — **new** self-contained component + `DiscardOption` type + seed data export.
- `src/goldroom/DiscardHelper.test.tsx` — **new** unit tests.
- `src/goldroom/DiceEquationRound.tsx` — wire the helper into the practice render between table and fan.

---

### Task 1: Add copy strings

**Files:**
- Modify: `src/goldroom/goldRoomCopy.ts`

- [ ] **Step 1:** In the `he` block, after `signSelectPlace` (line ~121), add:

```ts
    // ── Discard helper (green→red "how to get rid of a card") ──
    discardHelperOpen: 'איך להיפטר מקלף?',
    discardHelperTapHint: 'לחץ על מיני קלף כדי לראות את התרגיל',
    swapBracketsPlaceholder: 'שינוי מיקום הסוגריים',
    discardHelperA11y: 'איך להיפטר מקלף — הצג תוצאות אפשריות',
```

- [ ] **Step 2:** In the `en` block, after `signSelectPlace` (line ~239), add:

```ts
    // ── Discard helper (green→red "how to get rid of a card") ──
    discardHelperOpen: 'How to\ndiscard a card?',
    discardHelperTapHint: 'Tap a mini-card to see the equation',
    swapBracketsPlaceholder: 'Move the brackets',
    discardHelperA11y: 'How to discard a card — show possible results',
```

- [ ] **Step 3:** Run typecheck: `npx tsc --noEmit` → Expected: no new errors.

- [ ] **Step 4:** Commit `git add src/goldroom/goldRoomCopy.ts && git commit -m "feat(goldroom): add discard-helper copy strings"`

---

### Task 2: Create the DiscardHelper component

**Files:**
- Create: `src/goldroom/DiscardHelper.tsx`
- Test: `src/goldroom/DiscardHelper.test.tsx`

- [ ] **Step 1: Write the failing test** `src/goldroom/DiscardHelper.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DiscardHelper, type DiscardOption } from './DiscardHelper';

const OPTIONS: DiscardOption[] = [
  { value: 6, equation: '2 + 4 = 6' },
  { value: 9, equation: '4 + 5 = 9' },
];

describe('DiscardHelper', () => {
  it('starts with the green button showing the option count, no mini-cards', () => {
    const { getByTestId, queryByTestId } = render(<DiscardHelper options={OPTIONS} />);
    expect(getByTestId('discard-helper-green')).toBeTruthy();
    expect(getByTestId('discard-helper-badge').props.children).toBe(2);
    expect(queryByTestId('discard-helper-mini-row')).toBeNull();
  });

  it('pressing green swaps to red + reveals mini-cards with the tap hint', () => {
    const { getByTestId, queryByTestId } = render(<DiscardHelper options={OPTIONS} />);
    fireEvent.press(getByTestId('discard-helper-green'));
    expect(queryByTestId('discard-helper-green')).toBeNull();
    expect(getByTestId('discard-helper-red')).toBeTruthy();
    expect(getByTestId('discard-helper-mini-row')).toBeTruthy();
    expect(getByTestId('discard-helper-red-text').props.children).toContain('מיני קלף');
  });

  it('tapping a mini-card shows its equation in the red surface', () => {
    const { getByTestId } = render(<DiscardHelper options={OPTIONS} />);
    fireEvent.press(getByTestId('discard-helper-green'));
    fireEvent.press(getByTestId('discard-helper-mini-9'));
    expect(getByTestId('discard-helper-red-text').props.children).toBe('4 + 5 = 9');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails** `npx jest src/goldroom/DiscardHelper.test.tsx` → Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/goldroom/DiscardHelper.tsx`:

```tsx
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getNumColors } from '../../components/CardDesign';
import { useGoldRoomCopy } from './goldRoomCopy';

export interface DiscardOption {
  value: number; // the hand-card value this solution discards
  equation: string; // e.g. "4 + 5 = 9"
}

const MINI_W = 36;
const MINI_H = 48;
const MINI_R = 8;

// A lean, STATIC copy of the live game's mini-result card: a small white card
// with a value-coloured border + bold value. No entrance animation (by design).
function GoldMiniCard({ value, onPress, testID }: { value: number; onPress?: () => void; testID?: string }) {
  const cl = getNumColors(value);
  const content = (
    <View style={[styles.miniCard, { borderColor: cl.border }]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.9)', 'rgba(248,248,248,0.85)', 'rgba(240,240,240,0.9)']}
        locations={[0, 0.6, 1]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text allowFontScaling={false} style={[styles.miniTxt, { color: cl.face }]}>{value}</Text>
    </View>
  );
  return onPress ? (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.8}>{content}</TouchableOpacity>
  ) : content;
}

export function DiscardHelper({ options }: { options: DiscardOption[] }) {
  const copy = useGoldRoomCopy();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const selectedOption = selected != null ? options.find((o) => o.value === selected) ?? null : null;
  const redText = selectedOption ? selectedOption.equation : copy.discardHelperTapHint;

  const handleOpen = useCallback(() => setOpen(true), []);

  return (
    <View style={styles.wrap}>
      <View style={styles.buttonRow}>
        {!open ? (
          <TouchableOpacity
            testID="discard-helper-green"
            activeOpacity={0.85}
            onPress={handleOpen}
            accessibilityRole="button"
            accessibilityLabel={copy.discardHelperA11y}
          >
            <LinearGradient
              colors={['#2D6B48', '#245C3C', '#1C4C30', '#143824']}
              start={{ x: 0.3, y: 0.2 }}
              end={{ x: 0.7, y: 0.9 }}
              style={[styles.actionBtn, styles.greenBtn]}
            >
              <Text allowFontScaling={false} style={styles.greenTxt}>{copy.discardHelperOpen}</Text>
            </LinearGradient>
            {options.length > 0 ? (
              <View style={styles.badge}>
                <Text testID="discard-helper-badge" style={styles.badgeTxt}>{options.length}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ) : (
          <View testID="discard-helper-red" style={[styles.actionBtn, styles.redBtn]}>
            <Text testID="discard-helper-red-text" allowFontScaling={false} style={styles.redTxt}>{redText}</Text>
          </View>
        )}

        {/* Orange placeholder — reserved for the future "swap brackets" button. */}
        <View testID="discard-helper-orange" style={[styles.actionBtn, styles.orangeBtn]} pointerEvents="none">
          <Text allowFontScaling={false} style={styles.orangeTxt}>{copy.swapBracketsPlaceholder}</Text>
        </View>
      </View>

      {open ? (
        <View testID="discard-helper-mini-row" style={styles.miniRow}>
          {options.map((o, i) => (
            <GoldMiniCard key={`${o.value}-${i}`} value={o.value} testID={`discard-helper-mini-${o.value}`} onPress={() => setSelected(o.value)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  actionBtn: {
    minHeight: 52, maxWidth: 150, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  greenBtn: { borderColor: '#F5D45A' },
  greenTxt: { color: '#F0E8B0', fontSize: 13, fontWeight: '900', textAlign: 'center', lineHeight: 16 },
  redBtn: { backgroundColor: '#7A1F1F', borderColor: '#F5D45A' },
  redTxt: { color: '#FCE8C8', fontSize: 13, fontWeight: '900', textAlign: 'center', lineHeight: 16, writingDirection: 'ltr' },
  orangeBtn: { backgroundColor: '#D97706', borderColor: '#F5D45A', opacity: 0.85 },
  orangeTxt: { color: '#FFF7E6', fontSize: 12, fontWeight: '800', textAlign: 'center', lineHeight: 15 },
  badge: {
    position: 'absolute', top: -6, right: -6, backgroundColor: '#FFD700', borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: '#1a1a2e',
  },
  badgeTxt: { color: '#1a1a2e', fontSize: 11, fontWeight: '900' },
  miniRow: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  miniCard: {
    width: MINI_W, height: MINI_H, borderRadius: MINI_R, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center',
  },
  miniTxt: { fontSize: 18, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
});
```

- [ ] **Step 4: Run tests** `npx jest src/goldroom/DiscardHelper.test.tsx` → Expected: PASS (3 tests).

- [ ] **Step 5: Commit** `git add src/goldroom/DiscardHelper.tsx src/goldroom/DiscardHelper.test.tsx && git commit -m "feat(goldroom): add DiscardHelper component"`

---

### Task 3: Wire into the practice render

**Files:**
- Modify: `src/goldroom/DiceEquationRound.tsx`

- [ ] **Step 1:** Add import near the other goldroom imports (top of file, after the `GoldButton` import):

```ts
import { DiscardHelper, type DiscardOption } from './DiscardHelper';
```

- [ ] **Step 2:** After the `PRACTICE_CONFIG` definition (ends ~line 1071), add seed data:

```ts
// Seeded "possible result" mini-cards per practice step (illustrative, easily editable).
const DISCARD_OPTIONS: Record<PracticeStepId, DiscardOption[]> = {
  plus: [
    { value: 6, equation: '2 + 4 = 6' },
    { value: 9, equation: '4 + 5 = 9' },
    { value: 11, equation: '2 + 4 + 5 = 11' },
  ],
  minus: [
    { value: 3, equation: '5 - 2 = 3' },
    { value: 4, equation: '5 - 2 + 1 = 4' },
  ],
};
```

- [ ] **Step 3:** In the practice render, insert the helper between the table `playArea` and the fan. Find (≈line 1437–1439):

```tsx
      </View>

      {/* The hand fan — the TARGET cards. */}
      <Animated.View style={[styles.fanWrap, { opacity: fanOpacity }]} pointerEvents={interactive ? 'box-none' : 'none'}>
```

Replace with:

```tsx
      </View>

      {/* Discard helper — green→red "how to get rid of a card" + mini-cards,
       *  sitting in the gap between the table and the fan. */}
      <DiscardHelper options={DISCARD_OPTIONS[step]} />

      {/* The hand fan — the TARGET cards. */}
      <Animated.View style={[styles.fanWrap, { opacity: fanOpacity }]} pointerEvents={interactive ? 'box-none' : 'none'}>
```

- [ ] **Step 4:** Typecheck: `npx tsc --noEmit` → Expected: no new errors.

- [ ] **Step 5:** Run the goldroom suite: `npx jest src/goldroom` → Expected: PASS.

- [ ] **Step 6: Commit** `git add src/goldroom/DiceEquationRound.tsx && git commit -m "feat(goldroom): wire DiscardHelper into practice"`

---

## Self-Review notes
- Spec coverage: green→red ✓ (Task 2), mini-cards between table and fan ✓ (Task 3 placement), no animation ✓ (static GoldMiniCard), orange placeholder ✓, tap shows equation/card stays ✓ (no discard side-effect), practice mode ✓, no live-game change ✓.
- Known deviation: button row + mini row are grouped between table and fan (not button-at-top). Easily moved later per user's "always changeable" note.
