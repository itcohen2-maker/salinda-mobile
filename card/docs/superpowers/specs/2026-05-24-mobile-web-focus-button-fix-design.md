# Mobile Web Focus Button Fix — Design Spec

**Date:** 2026-05-24  
**Status:** Approved

## Problem

The `MobileWebFocusButton` ("× יציאה" / fullscreen toggle) appears on all mobile web viewports:

- **iOS Safari:** Shows the button, but iOS does not support the Fullscreen API. Pressing it only toggles its own label — no actual fullscreen occurs. The button is useless and confusing.
- **Android Chrome:** Works correctly (fullscreen fires), but the button is centered at the top of the screen and physically overlaps the "שחק עכשיו" hero button.
- **Desktop web:** Works correctly via the `WebChromeActionButton` sidebar — not affected by this fix.

## Solution

Two targeted changes in `index.tsx`, no new files, no new components.

### Change 1 — Runtime Fullscreen API detection

Replace the hardcoded `false`:

```ts
// Before
const showMobileWebFocusControl = false; // removed: fullscreen not reliable on all mobile browsers

// After
const fullscreenApiSupported =
  Platform.OS === 'web' &&
  typeof document !== 'undefined' &&
  !!(
    document.documentElement.requestFullscreen ||
    (document.documentElement as any).webkitRequestFullscreen
  );
const showMobileWebFocusControl = mobileWebViewport && fullscreenApiSupported;
```

**Why:** iOS Safari exposes neither `requestFullscreen` nor `webkitRequestFullscreen` on `documentElement`, so the check resolves to `false` on iOS. Android Chrome exposes `requestFullscreen`, so it resolves to `true`. This is self-healing: if Apple ever enables the API, the button will reappear on iOS automatically — which is the correct behavior.

### Change 2 — Corner alignment instead of centered

The button container currently uses `alignItems: 'center'`, placing the button dead-center above the hero "שחק עכשיו" button. Move it to the trailing edge of the screen (top-left in RTL Hebrew, top-right in LTR English):

```tsx
// Before
alignItems: 'center',

// After
alignItems: isRTL ? 'flex-start' : 'flex-end',
paddingHorizontal: 12,
```

`isRTL` is already available at the `AppShell` level via `useLocale()`.

**Why:** A corner position doesn't compete with centered content. The button is small enough (116×40 px) that it fits cleanly in the top corner without interfering with the hero button or language toggles.

## Scope

| Platform | Before | After |
|---|---|---|
| iOS Safari | Shows button (broken) | Hidden |
| Android Chrome | Shows button, centered, overlaps hero | Shows button, corner-aligned, clear |
| Desktop web | Sidebar buttons (unaffected) | No change |
| Native Android app | `Platform.OS === 'android'` → never renders this component | No change |

## Files Changed

| File | Lines | Nature |
|---|---|---|
| `index.tsx` | ~3 lines around `showMobileWebFocusControl` | Replace `false` with runtime check |
| `index.tsx` | ~2 lines in the `MobileWebFocusButton` wrapper `View` style | `alignItems` + `paddingHorizontal` |

Total: ~5 lines changed. Zero new files. Zero new components.

## Non-Goals

- No changes to `MobileWebFocusButton` component itself
- No changes to `WebChromeActionButton` or desktop behavior
- No UserAgent sniffing
- No i18n changes
