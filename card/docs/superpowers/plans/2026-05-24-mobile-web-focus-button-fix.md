# Mobile Web Focus Button Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the fullscreen/focus button on iOS Safari (where it does nothing), and move it to a corner on Android Chrome so it no longer blocks the "שחק עכשיו" hero button.

**Architecture:** Two targeted edits in `AppShell` inside `index.tsx`. No new files, no new components. Change 1 replaces a hardcoded `false` with a runtime Fullscreen API check. Change 2 moves the button's container from centered to corner-aligned using `locale` (already available in AppShell).

**Tech Stack:** React Native Web, TypeScript, `Platform` from `react-native`

---

## Files

| File | Change |
|------|--------|
| `index.tsx:22692` | Replace `false` with `fullscreenApiSupported` runtime check |
| `index.tsx:22783-22791` | Change `alignItems: 'center'` → corner alignment + `paddingHorizontal` |

---

## Task 1: Runtime Fullscreen API detection + corner alignment

**Files:**
- Modify: `index.tsx:22692` and `index.tsx:22783-22791`

- [ ] **Step 1: Add `isRTL` and `fullscreenApiSupported` constants in AppShell**

  Open `index.tsx`. Inside `AppShell`, after line 22511 (`const { locale } = useLocale();`), add:

  ```typescript
  const isRTL = locale === 'he';
  const fullscreenApiSupported =
    Platform.OS === 'web' &&
    typeof document !== 'undefined' &&
    !!(
      document.documentElement.requestFullscreen ||
      (document.documentElement as any).webkitRequestFullscreen
    );
  ```

- [ ] **Step 2: Replace the hardcoded `false`**

  Find line 22692 (the `showMobileWebFocusControl` declaration). Replace:

  ```typescript
  const showMobileWebFocusControl = false; // removed: fullscreen not reliable on all mobile browsers
  ```

  With:

  ```typescript
  const showMobileWebFocusControl = mobileWebViewport && fullscreenApiSupported;
  ```

- [ ] **Step 3: Change the button container to corner alignment**

  Find the View at line ~22781 that wraps `MobileWebFocusButton`. Its current style block is:

  ```typescript
  style={{
    position: 'absolute',
    left: 0,
    right: 0,
    top: Math.max(10, (insets.top || 0) + 10),
    height: 44,
    zIndex: 31000,
    alignItems: 'center',
  }}
  ```

  Replace with:

  ```typescript
  style={{
    position: 'absolute',
    left: 0,
    right: 0,
    top: Math.max(10, (insets.top || 0) + 10),
    height: 44,
    zIndex: 31000,
    alignItems: isRTL ? 'flex-start' : 'flex-end',
    paddingHorizontal: 12,
  }}
  ```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

  ```
  npx tsc --noEmit --project tsconfig.json 2>&1 | grep -i "error"
  ```

  Expected: no output.

- [ ] **Step 5: Commit**

  ```bash
  git add index.tsx
  git commit -m "fix: hide mobile web focus button on iOS (Fullscreen API check), corner-align on Android"
  ```

---

## Self-Review

### Spec Coverage

| Spec requirement | Task |
|---|---|
| iOS Safari: button hidden | Task 1 — `fullscreenApiSupported` is `false` on iOS Safari (no `requestFullscreen` or `webkitRequestFullscreen` on `documentElement`) |
| Android Chrome: button visible, no overlap | Task 1 — `fullscreenApiSupported` is `true`, button moves to trailing corner |
| Desktop: no change | `mobileWebViewport` is `false` on desktop → `showMobileWebFocusControl` stays `false` for desktop (desktop uses `WebChromeActionButton` via `showWebChromeControls`) |
| No new components | Confirmed — edits only |

### Placeholder Scan

None found.

### Type Consistency

- `isRTL` is `boolean`, used in ternary — correct.
- `fullscreenApiSupported` is `boolean` — used with `mobileWebViewport` (also `boolean`) via `&&` — correct.
- `mobileWebViewport` is already defined earlier in `AppShell` — confirmed at line ~22687.
