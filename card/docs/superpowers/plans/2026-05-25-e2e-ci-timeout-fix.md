# E2E CI Timeout Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** E2E tests complete within the CI time limit by running only Mobile Chrome + Mobile Safari and reducing retries from 2 to 1.

**Architecture:** Two targeted changes — `playwright.config.ts` limits CI browser projects to the two required mobile targets and reduces retries; `.github/workflows/e2e.yml` raises the playwright job timeout from 30 to 60 minutes. The "Install Playwright browsers" step is also updated to install webkit instead of firefox.

**Tech Stack:** Playwright, GitHub Actions, Expo web (Metro bundler).

---

## Files

- Modify: `card/playwright.config.ts` — reduce CI browsers to mobile-chrome + mobile-safari, retries 1
- Modify: `.github/workflows/e2e.yml` (repo root) — timeout 60m, install webkit not firefox

---

### Task 1: Update playwright.config.ts

**Files:**
- Modify: `card/playwright.config.ts`

- [ ] **Step 1: Open the file**

Current content at lines 12 and 26-31:

```ts
retries: isCI ? 2 : 0,
...
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
],
```

- [ ] **Step 2: Change retries from 2 to 1 (line 12)**

```ts
retries: isCI ? 1 : 0,
```

- [ ] **Step 3: Replace the projects array (lines 26-31)**

```ts
projects: [
  ...(!isCI ? [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ] : []),
  { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
],
```

- [ ] **Step 4: Verify the full file looks correct**

The complete updated `card/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [['html', { open: 'never' }], ['junit', { outputFile: 'tests/results/junit.xml' }], ['github']]
    : [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-US',
  },
  projects: [
    ...(!isCI ? [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    ] : []),
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],
  webServer: process.env.SKIP_WEB_SERVER
    ? undefined
    : {
        command: 'npm run web',
        url: BASE_URL,
        reuseExistingServer: !isCI,
        timeout: 180_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
```

- [ ] **Step 5: Commit**

```bash
git add card/playwright.config.ts
git commit -m "test: CI runs mobile-chrome + mobile-safari only, retries 1"
```

---

### Task 2: Update e2e.yml

**Files:**
- Modify: `.github/workflows/e2e.yml` (at repo root — NOT inside card/)

- [ ] **Step 1: Change playwright job timeout from 30 to 60 minutes (line 14)**

Current:
```yaml
playwright:
  timeout-minutes: 30
```

Updated:
```yaml
playwright:
  timeout-minutes: 60
```

- [ ] **Step 2: Change browser install from chromium+firefox to chromium+webkit (line 32)**

Current:
```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium firefox
```

Updated:
```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium webkit
```

Note: `mobile-chrome` uses the Chromium engine; `mobile-safari` uses the WebKit engine. Firefox is no longer needed in CI.

- [ ] **Step 3: Verify the playwright job section looks correct**

```yaml
jobs:
  playwright:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    env:
      CI: 'true'
      BASE_URL: http://localhost:8081
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
          cache-dependency-path: card/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium webkit

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: card/playwright-report
          retention-days: 7

      - name: Upload JUnit results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: junit-results
          path: card/tests/results
          retention-days: 7
```

- [ ] **Step 4: Commit and push**

```bash
git add .github/workflows/e2e.yml
git commit -m "ci: increase playwright timeout to 60m, install webkit not firefox"
git push origin main
```

---

### Task 3: Verify CI passes

- [ ] **Step 1: Watch the GitHub Actions run**

Go to: https://github.com/itcohen2-maker/salinda-mobile/actions

A new E2E run should appear. Click it and watch both jobs:
- `playwright` — should complete within 60 minutes
- `ota-update` — should complete in ~3 minutes (independent)

- [ ] **Step 2: Confirm browser projects ran**

Click the `playwright` job → click "Run E2E tests" step. The output should show tests running under `mobile-chrome` and `mobile-safari` only — no `chromium` or `firefox` entries.

- [ ] **Step 3: Confirm no timeout**

The playwright job should show a green checkmark and a duration under 60 minutes. If tests fail (red) that is a separate issue from timeout — failures show actual test errors, not "exceeded maximum execution time".
