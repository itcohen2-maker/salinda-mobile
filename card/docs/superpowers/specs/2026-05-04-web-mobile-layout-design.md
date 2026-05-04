# Web Mobile Layout — Design Spec

**Date:** 2026-05-04  
**Status:** Approved

## Problem

On web, the app stretches to fill the entire browser width. The game content is already internally capped at 412px (`WEB_GAME_PLAYFIELD_MAX_WIDTH`), but screen containers use `flex: 1` and `width: '100%'`, causing backgrounds and layouts to span the full browser window. On wide monitors this looks broken.

## Goal

Display the game in a narrow, centered mobile-style column — proportional to browser height, 412px wide max — with optional ad slots in the surrounding space.

## Design

### Layout Structure (web only)

```
┌─────────────────────────────────────────────────────┐  browser
│  [dark bg]  │       412px game column       │ [ad]  │
│             │                               │       │
│             │                               │       │
│             └───────────────────────────────┘       │
│         [728×90 leaderboard banner — optional]      │
└─────────────────────────────────────────────────────┘
```

- **Outer container**: `flex:1, alignItems:'center', backgroundColor:'#0a1628'` — fills browser, centers child
- **Inner game column**: `flex:1, width:'100%', maxWidth: WEB_GAME_PLAYFIELD_MAX_WIDTH (412)` — caps at 412px, full height
- **Right ad slot**: absolute positioned to the right of the game column, width 160px, visible when `viewportWidth >= 768`
- **Bottom leaderboard**: below the game column, width 728px, visible when `viewportWidth >= 768`

### `getWebGameLayout` fix

Currently `viewportWidth` in the returned object equals the full browser width (e.g. 1920). This breaks offset calculations such as `lobbyLeftPad = (viewportWidth - playfieldWidth) / 2 + 16`, which would be 770px on a 1920px browser — pushing content outside the 412px container.

**Fix:** Cap `viewportWidth` to `WEB_GAME_PLAYFIELD_MAX_WIDTH` in `getWebGameLayout`:

```typescript
const viewportWidth = Math.min(
  WEB_GAME_PLAYFIELD_MAX_WIDTH,
  Math.max(320, Math.round(viewport.width || 0))
);
```

After this change `playfieldWidth === viewportWidth` always, and all offset calculations based on `viewportWidth` will produce correct results within the container.

### `AdSlot` Component

New component `src/components/AdSlot.tsx`:
- Props: `slot: 'skyscraper' | 'leaderboard'`, `visible?: boolean`
- Renders a `<div>` (web only) sized appropriately (160×600 or 728×90)
- Contains a placeholder `<ins class="adsbygoogle">` element ready for Google AdSense
- On non-web platforms: renders `null`

### Files Changed

| File | Change |
|------|--------|
| `src/theme/webLayout.ts` | Cap `viewportWidth` to `WEB_GAME_PLAYFIELD_MAX_WIDTH` |
| `src/theme/webLayout.test.ts` | Update test expectations for capped `viewportWidth` |
| `index.tsx` — `AppShell` | Add centering wrapper + `AdSlot` components (web only) |
| `src/components/AdSlot.tsx` | New component (create) |

### Responsive Behavior

| Browser width | Game column | Right ad | Bottom banner |
|---|---|---|---|
| < 412px | full width | hidden | hidden |
| 412px – 767px | 412px centered | hidden | hidden |
| ≥ 768px | 412px centered | visible (160px) | visible (728px) |

### Test Updates

`webLayout.test.ts` wide-viewport cases currently expect `playfieldWidth === WEB_GAME_PLAYFIELD_MAX_WIDTH`. After the fix, `viewportWidth` will also equal `WEB_GAME_PLAYFIELD_MAX_WIDTH` for wide inputs. The narrow-viewport test (360px) is unaffected.

## Out of Scope

- Actual AdSense account integration (slots are placeholders)
- Left-side ad (only right + bottom)
- Phone frame / rounded border UI (plain dark background on sides)
