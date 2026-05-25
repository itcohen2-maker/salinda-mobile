# E2E CI Timeout Fix — Design Spec

**Date:** 2026-05-25  
**Status:** Approved

## Problem

E2E tests run in GitHub Actions and consistently hit the 30-minute job timeout. The tests have never completed successfully in CI. Root causes:

1. **Metro dev server startup** — `npm run web` starts the Expo Metro bundler, which takes 3-5 minutes before Playwright can connect
2. **4 browser projects** — Chromium, Firefox, Mobile Chrome, Mobile Safari all run in CI, quadrupling test time
3. **retries: 2 in CI** — each flaky test runs up to 3 times, further multiplying runtime

## Requirements

- Safari (WebKit / Mobile Safari) must run in CI — required platform for the app
- Android Chrome (Mobile Chrome) must run in CI — required platform for the app
- Desktop Chromium and Desktop Firefox are not required in CI

## Solution

Two targeted changes — one to the Playwright config, one to the CI workflow.

---

## Change 1: Playwright config — reduce CI browsers and retries

**File:** `card/playwright.config.ts`

In CI, run only the two required mobile browser projects:
- `mobile-chrome` (Pixel 7 — Android Chrome)
- `mobile-safari` (iPhone 14 — Safari/WebKit)

Remove `chromium` and `firefox` from CI runs (keep them for local development).

Reduce `retries` from `2` to `1` in CI. One retry is enough to filter flaky tests without tripling runtime.

### Updated projects config

```ts
projects: [
  // Local only — desktop browsers for quick iteration
  ...(!isCI ? [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ] : []),
  // CI + local — required mobile targets
  { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
],
```

### Updated retries

```ts
retries: isCI ? 1 : 0,
```

---

## Change 2: CI workflow — increase playwright job timeout

**File:** `.github/workflows/e2e.yml` (at repo root)

Increase `playwright` job `timeout-minutes` from `30` to `60`.

This gives the Metro bundler time to start and the reduced browser set time to complete.

---

## Expected Outcome

| Metric | Before | After |
|--------|--------|-------|
| Browser projects in CI | 4 | 2 |
| Max retries per test | 2 | 1 |
| Job timeout | 30 min | 60 min |
| Estimated CI runtime | >30 min (timeout) | ~20-25 min |

## Success Criteria

- `playwright` job completes without hitting timeout
- Both mobile-chrome and mobile-safari tests run and report results
- Failures show as actual test failures, not timeout cancellations
