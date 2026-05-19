# Web Game Fixed-Canvas Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix web game button positions by using a fixed 900px canvas: gold dice button appears below the hand fan (matching mobile), and the game never stretches beyond 900px height.

**Architecture:** Two surgical changes: (1) `getWebGameLayout` uses a fixed 900px `frameHeight` and places `goldActionButtonTop = frameHeight - 140 = 760` (below the hand zone, matching mobile formula `SCREEN_H - 140`); (2) `WebGameScreenFrame` always uses the fixed-height rendering path so the game renders inside a 900px frame regardless of viewport height.

**Tech Stack:** TypeScript, React Native Web, `src/theme/webLayout.ts`, `src/components/layout/WebGameScreenFrame.tsx`

---

## File Map

| File | Change |
|------|--------|
| `src/theme/webLayout.ts` | `WEB_GAME_PLAYFIELD_MIN_HEIGHT` → 900; `frameHeight` always fixed; `goldActionButtonTop = frameHeight - 140` |
| `src/theme/webLayout.test.ts` | Update all expected values to match new 900px canvas |
| `src/components/layout/WebGameScreenFrame.tsx` | Remove `safeScale < 0.999` guard; always fixed-height; `styles.outer` gets `justifyContent: 'center'` |

---

### Task 1: Update `webLayout.ts` — fixed canvas + gold button below fan

**Files:**
- Modify: `src/theme/webLayout.ts:37,57-86`
- Test: `src/theme/webLayout.test.ts`

- [ ] **Step 1: Update tests first (TDD — they should fail)**

Replace the entire `describe('getWebGameLayout', ...)` block in `src/theme/webLayout.test.ts` with:

```typescript
describe('getWebGameLayout', () => {
  it.each([
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 768, height: 1024 },
  ])('always returns fixed 900px canvas for viewport %o', (viewport) => {
    const layout = getWebGameLayout(viewport);

    // Canvas is always fixed at 900px — never grows with viewport
    expect(layout.frameHeight).toBe(900);
    // Scale is 1 for viewports >= 900px, <1 for smaller viewports
    expect(layout.contentScale).toBeCloseTo(Math.min(1, viewport.height / 900), 4);
    expect(layout.playfieldWidth).toBe(WEB_GAME_PLAYFIELD_MAX_WIDTH);
    expect(layout.tableHeight).toBe(220);
    expect(layout.tableTop).toBe(185);
    expect(layout.handBottom).toBe(155);
    expect(layout.fanCardHeight).toBe(140);
    expect(layout.fanViewportHeight).toBe(116);
    // Gold button is BELOW the hand zone (hand zone ends at 900-155=745)
    expect(layout.goldActionButtonTop).toBe(760); // = 900 - 140
    expect(layout.goldActionButtonTop).toBeGreaterThan(900 - 155); // below hand zone bottom
    expect(layout.timerTop).toBe(layout.tableTop + layout.tableHeight + 32);
  });

  it('shrinks the playfield on narrow web viewports without overflowing', () => {
    const layout = getWebGameLayout({ width: 360, height: 640 });

    expect(layout.viewportWidth).toBe(360);
    expect(layout.viewportHeight).toBe(640);
    expect(layout.frameHeight).toBe(900); // always 900
    expect(layout.contentScale).toBeCloseTo(640 / 900, 4);
    expect(layout.playfieldWidth).toBe(360);
    expect(layout.goldActionButtonTop).toBe(760);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd C:\Users\asus\bmad\card && npx jest --testPathPattern="webLayout" --watchAll=false 2>&1 | tail -10
```
Expected: several FAIL lines about `frameHeight` and `goldActionButtonTop`.

- [ ] **Step 3: Update `webLayout.ts`**

In `src/theme/webLayout.ts`, make these changes:

**Line 38 — raise min height to 900:**
```typescript
export const WEB_GAME_PLAYFIELD_MIN_HEIGHT = 900; // was 768
```

**Lines 57-86 — fix frameHeight and gold button:**

Replace from `const frameHeight = ...` through `);` (the whole `goldActionButtonTop` block) with:

```typescript
  // Canvas is always 900px tall — never grows with viewport.
  // Viewports < 900px: contentScale < 1 (game shrinks to fit).
  // Viewports ≥ 900px: contentScale = 1 (game renders at 900px, centered).
  const frameHeight = WEB_GAME_PLAYFIELD_MIN_HEIGHT;
  const contentScale = clamp(viewportHeight / frameHeight, 0.5, 1);
  const playfieldWidth = Math.min(WEB_GAME_PLAYFIELD_MAX_WIDTH, viewportWidth);
  const contentWidth = playfieldWidth;
  // Mobile-equivalent constants — web game column (≤412px) matches native mobile appearance.
  const tableHeight = 220;
  const tableTop = 185;
  const tableBottomPadding = 65;
  const handBottom = 155;
  const fanCardHeight = 140;
  const fanCardWidth = Math.round(fanCardHeight * 0.71);
  const fanViewportHeight = Math.ceil(fanCardHeight * 1.15 + 55 - 100);
  const handStripAboveFan = 24;
  const handStripHeight = fanViewportHeight + handStripAboveFan;
  const handZoneTop = handBottom + handStripHeight;
  const handTop = frameHeight - handZoneTop;
  const miniResultsBottom = handZoneTop - 10;
  const tableWidth = clamp(playfieldWidth - 24, 300, WEB_GAME_PLAYFIELD_MAX_WIDTH - 24);
  const resultsTop = 76;
  const resultsRight = 128;
  const parensTop = 156;
  const timerTop = tableTop + tableHeight + 32;
  // Gold button BELOW hand zone (hand zone bottom = frameHeight - handBottom = 745).
  // Matches mobile formula: SCREEN_H - 140 → 900 - 140 = 760.
  const goldActionButtonTop = frameHeight - 140;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd C:\Users\asus\bmad\card && npx jest --testPathPattern="webLayout" --watchAll=false 2>&1 | tail -10
```
Expected: all PASS.

- [ ] **Step 5: Also update the `getWebTurnTransitionReadyButtonTop` tests** (inputs change since goldActionButtonTop is now 760):

The existing tests in `src/theme/webLayout.test.ts` for `getWebTurnTransitionReadyButtonTop` use `423` and `520` as inputs — these were old `goldActionButtonTop` values. Update them to use realistic inputs:

```typescript
describe('getWebTurnTransitionReadyButtonTop', () => {
  it('keeps the ready button in the same vertical band as the gold action button', () => {
    // With new 900px canvas: goldActionButtonTop=760, handTop=605
    expect(getWebTurnTransitionReadyButtonTop(760, 605, 48)).toBe(555); // Math.min(760, 605-48-2)=555
    expect(getWebTurnTransitionReadyButtonTop(760, 700, 48)).toBe(650); // Math.min(760, 700-48-2)=650
  });

  it('falls back to 300 if handTop is very small', () => {
    expect(getWebTurnTransitionReadyButtonTop(760, 200, 48)).toBe(300);
  });
});
```

Run tests again:
```bash
cd C:\Users\asus\bmad\card && npx jest --testPathPattern="webLayout" --watchAll=false 2>&1 | tail -10
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
cd C:\Users\asus\bmad\card && git add src/theme/webLayout.ts src/theme/webLayout.test.ts
git commit -m "feat(web): fixed 900px canvas — goldActionButtonTop=760 below hand fan"
```

---

### Task 2: Update `WebGameScreenFrame` — always fixed-height, center vertically

**Files:**
- Modify: `src/components/layout/WebGameScreenFrame.tsx:42-104`

- [ ] **Step 1: Replace the web rendering logic**

In `src/components/layout/WebGameScreenFrame.tsx`, replace everything from line 42 to the end of the function (before the `const styles = ...`):

```typescript
  // Always render with a fixed-height frame when frameHeight is provided.
  // For viewports >= frameHeight: scale=1, game renders at frameHeight px, outer centers it vertically.
  // For viewports < frameHeight: scale<1, game shrinks to fit via CSS transform.
  if (safeFrameHeight != null) {
    const visualHeight = safeFrameHeight * safeScale;
    return (
      <View style={[styles.outer, outerStyle]}>
        <View
          testID={testID}
          style={[styles.scaledSlot, { width: width * safeScale, height: visualHeight }]}
        >
          <View
            style={[
              styles.scaledContent,
              innerStyle,
              {
                width,
                height: safeFrameHeight,
                transform: [{ scale: safeScale }],
              },
              { transformOrigin: 'top center' } as any,
            ]}
          >
            {children}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.outer, outerStyle]}>
      <View testID={testID} style={[styles.gameColumn, { width, maxWidth: '100%' as any }, innerStyle]}>
        {children}
      </View>
    </View>
  );
```

- [ ] **Step 2: Add `justifyContent: 'center'` to `styles.outer`**

In `const styles = StyleSheet.create({...})`, update `outer`:

```typescript
  outer: {
    flex: 1,
    width: '100%' as any,
    alignItems: 'center',
    justifyContent: 'center',   // NEW: centers 900px game in taller viewports
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd C:\Users\asus\bmad\card && npx tsc --noEmit 2>&1 | grep -i "WebGameScreen\|webLayout\|safeScale\|frameHeight" | head -10
```
Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
cd C:\Users\asus\bmad\card && npx jest --watchAll=false --passWithNoTests 2>&1 | tail -5
```
Expected: same pass/fail ratio as before (no new failures).

- [ ] **Step 5: Commit**

```bash
cd C:\Users\asus\bmad\card && git add src/components/layout/WebGameScreenFrame.tsx
git commit -m "feat(web): WebGameScreenFrame always renders at fixed frameHeight — centers in larger viewports"
```

---

### Task 3: Manual verification in browser

- [ ] **Step 1: Start web server**

```bash
cd C:\Users\asus\bmad\card && npx expo start --web
```

Open `http://localhost:8081` in a browser.

- [ ] **Step 2: Verify on a 900px-height window**
  - Start a game (vs bot or local)
  - The gold dice button should appear **below** the hand fan cards
  - The equation table should be in the upper portion of the screen
  - The hand fan should be near the bottom

- [ ] **Step 3: Verify on a larger window (resize to 1200px height)**
  - The game should still show at 900px height, centered vertically
  - There should be empty space above and below the game frame
  - Button positions should be identical to the 900px window

- [ ] **Step 4: Verify on a smaller window (600px height)**
  - The game should scale down (approximately 67% of original size)
  - All elements should be proportionally smaller
  - Gold button should still appear below the hand fan

- [ ] **Step 5: Push to GitHub**

```bash
cd C:\Users\asus\bmad\card && git push
```
