# Web Game Fixed-Canvas Layout — Design Spec

**Date:** 2026-05-19

## Summary

The web game renders buttons at wrong positions on all viewports: (1) `frameHeight` grew with the viewport causing gaps, (2) `goldActionButtonTop` was positioned *above* the hand fan instead of *within* it (like mobile). Fix: fixed 900px canvas + reposition gold button into the hand zone.

---

## Root Cause

In `src/theme/webLayout.ts`:
```typescript
const frameHeight = Math.max(viewportHeight, WEB_GAME_PLAYFIELD_MIN_HEIGHT); // grows!
const contentScale = clamp(viewportHeight / frameHeight, 0.5, 1);
```

For a 1080px viewport: `frameHeight = 1080`, `handTop = 1080 - 295 = 785`, but `goldActionButtonTop = clamp(520, 423, 713) = 520`. Gap between button and hand = **265px empty space**.

For a 768px frame: `handTop = 473`, `goldActionButtonMaxTop = 401`, `goldActionButtonMinTop = 423` → valid range is empty → button stuck at 423 (too close to table).

At **900px frame**: `handTop = 605`, `goldActionButtonTop = clamp(520, 423, 533) = 520` ✓ — correctly positioned between table and hand.

---

## Fix 1 — `src/theme/webLayout.ts`

### Change `WEB_GAME_PLAYFIELD_MIN_HEIGHT` to 900

```typescript
export const WEB_GAME_PLAYFIELD_MIN_HEIGHT = 900; // was 768
```

### Fix `frameHeight` to be constant

```typescript
// Before:
const frameHeight = Math.max(viewportHeight, WEB_GAME_PLAYFIELD_MIN_HEIGHT);

// After:
const frameHeight = WEB_GAME_PLAYFIELD_MIN_HEIGHT; // always 900, never grows
```

`contentScale` formula stays the same:
```typescript
const contentScale = clamp(viewportHeight / frameHeight, 0.5, 1);
// 600px → 0.67 (scale down)
// 900px → 1.0 (exact fit)
// 1080px → clamped to 1.0 (no upscaling)
```

### Fix goldActionButtonTop — move BELOW the hand zone

Mobile native formula: `goldActionButtonTop = Math.max(96, Math.min(680, SCREEN_H - 140))`
- iOS 844px: `844 - 140 = 704 → clamped to 680`
- Hand zone bottom: `844 - 195 = 649` → button at 680 is **31px BELOW** the hand zone ✓

For web 900px frame, same formula (no clamping needed within valid canvas):
```typescript
// Before (wrong — 520 was above hand zone which starts at 605):
const goldActionButtonTop = clamp(520, goldActionButtonMinTop, ...);

// After (matches mobile — below hand zone which ends at 745):
const goldActionButtonTop = frameHeight - 140; // = 900 - 140 = 760
```

Hand zone on web 900px: 605 → 745. Button at 760 is **15px below** the hand zone. ✓

Remove `goldActionButtonMinTop`, `goldActionButtonMaxTop` — no longer needed.

### Resulting positions at 900px frame

| Element | Value | Matches mobile? |
|---------|-------|----------------|
| `tableTop` | 185 | ✓ |
| `tableHeight` | 220 | ✓ |
| table bottom | 405 | ✓ |
| `timerTop` | 437 | ✓ |
| `handTop` (from top) | 605 | ✓ |
| hand zone bottom | 745 | ✓ |
| `goldActionButtonTop` | **760** (BELOW hand zone) | ✓ matches mobile: button below fan |
| `handZoneTop` (from bottom) | 295 | ✓ |

---

## Fix 2 — `src/components/layout/WebGameScreenFrame.tsx`

### Always use fixed-height rendering

**Before:** The scaling transform path was only used when `safeScale < 0.999`. At scale=1.0, a plain `gameColumn` (flex, no fixed height) was rendered — content expanded to fill the full viewport.

**After:** Remove the `safeScale < 0.999` guard. When `safeFrameHeight != null`, always render the fixed-height path:

```tsx
if (safeFrameHeight != null) {
  const visualHeight = safeFrameHeight * safeScale;
  return (
    <View style={[styles.outer, outerStyle]}>
      <View style={{ width: width * safeScale, height: visualHeight }}>
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
```

### Center the game frame vertically

`styles.outer` adds `justifyContent: 'center'` so the 900px game frame centers in viewports taller than 900px:

```typescript
outer: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center', // NEW — centers 900px frame in larger viewports
},
```

### Behavior per viewport

| Viewport height | contentScale | Visual result |
|----------------|-------------|---------------|
| 450px | 0.50 (clamped) | Game at 50% size |
| 600px | 0.67 | Game at 67% size |
| 768px | 0.85 | Game at 85% size |
| 900px | 1.00 | Game at 100%, fills viewport |
| 1080px | 1.00 (clamped) | Game at 100%, centered with 180px padding |
| 1440px | 1.00 (clamped) | Game at 100%, centered with 540px padding |

---

## Scope

**In scope:** Fix web game button positioning by using a fixed 900px canvas.

**Out of scope:** Changing any game element positions, native layout, tutorial layout, or RTL fixes.

**Files changed:**
- `src/theme/webLayout.ts` — 2 line changes
- `src/components/layout/WebGameScreenFrame.tsx` — remove scale guard, add justifyContent
