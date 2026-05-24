# Mobile OTA Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every push to `main` that passes E2E tests automatically delivers an OTA update to mobile users via EAS Update.

**Architecture:** Add an `ota-update` CI job to the existing `e2e.yml` workflow. The job runs only on push to `main` (not PRs), depends on the `playwright` job passing, and calls `eas update --channel production`. A one-time manual catch-up push brings mobile users up to date before automation begins.

**Tech Stack:** GitHub Actions, EAS CLI (`eas-cli`), Expo SDK 54, EAS Update channel `production`.

---

## Files

- Modify: `.github/workflows/e2e.yml` — add `ota-update` job after existing `playwright` job

---

### Task 1: Run one-time catch-up OTA update (local, manual)

This brings all mobile users up to date with the current `main` before automation takes over. Run this from your machine — it does not require any CI setup.

**Files:** none (command only)

- [ ] **Step 1: Verify EAS CLI is available**

```bash
npx eas-cli --version
```

Expected output: a version number like `10.x.x`. If it errors, run `npm install -g eas-cli` first.

- [ ] **Step 2: Verify you are logged into EAS**

```bash
npx eas-cli whoami
```

Expected: your Expo account username. If not logged in, run `npx eas-cli login` and authenticate.

- [ ] **Step 3: Push the catch-up OTA update**

Run from the repo root:

```bash
npx eas-cli update --channel production --message "Catch-up: all changes to date" --non-interactive
```

Expected output includes:
```
✔ Published!
  branch: main
  channel: production
  runtimeVersion: ...
```

This pushes the current JS bundle to all production mobile users. The feedback inbox screen and all other accumulated features will appear on next app launch.

---

### Task 2: Add EXPO_TOKEN secret to GitHub (manual, one-time)

The CI job needs an Expo access token to authenticate with EAS. This is a one-time manual step in two places: expo.dev and GitHub.

**Files:** none (UI steps only)

- [ ] **Step 1: Generate Expo access token**

1. Go to [expo.dev](https://expo.dev)
2. Click your avatar (top right) → **Account Settings**
3. Scroll to **Access Tokens** → click **Create Token**
4. Name it `github-actions-ota`
5. Copy the token value — you will not see it again

- [ ] **Step 2: Add token to GitHub repo secrets**

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `EXPO_TOKEN`
4. Value: paste the token from Step 1
5. Click **Add secret**

- [ ] **Step 3: Verify secret is listed**

In GitHub → Settings → Secrets → Actions, you should see `EXPO_TOKEN` listed (value is hidden). No further action needed.

---

### Task 3: Add ota-update job to CI workflow

Add the `ota-update` job to `.github/workflows/e2e.yml`. It depends on `playwright` passing and only runs on push to `main`.

**Files:**
- Modify: `.github/workflows/e2e.yml`

- [ ] **Step 1: Open `.github/workflows/e2e.yml`**

Current file ends at line 47. The full file is:

```yaml
name: E2E

on:
  push:
    branches: [main]
  pull_request:

jobs:
  playwright:
    timeout-minutes: 30
    runs-on: ubuntu-latest
    env:
      CI: 'true'
      BASE_URL: http://localhost:8081
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium firefox

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report
          retention-days: 7

      - name: Upload JUnit results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: junit-results
          path: tests/results
          retention-days: 7
```

- [ ] **Step 2: Append the `ota-update` job**

The complete updated file (replace the entire file):

```yaml
name: E2E

on:
  push:
    branches: [main]
  pull_request:

jobs:
  playwright:
    timeout-minutes: 30
    runs-on: ubuntu-latest
    env:
      CI: 'true'
      BASE_URL: http://localhost:8081
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium firefox

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report
          retention-days: 7

      - name: Upload JUnit results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: junit-results
          path: tests/results
          retention-days: 7

  ota-update:
    needs: playwright
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Push OTA update to mobile
        run: npx eas-cli update --channel production --message "Auto OTA ${{ github.sha }}" --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

- [ ] **Step 3: Validate YAML syntax**

```bash
npx js-yaml .github/workflows/e2e.yml
```

Expected: prints the parsed YAML object with no errors. If `js-yaml` is not installed, run `npx js-yaml --help` first (it auto-installs).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "ci: auto OTA update to mobile on every push to main"
```

---

### Task 4: Verify automation works end-to-end

Push to `main` and confirm the OTA job runs and publishes successfully.

**Files:** none

- [ ] **Step 1: Push the commit to main**

```bash
git push origin main
```

- [ ] **Step 2: Watch the GitHub Actions run**

Go to GitHub repo → **Actions** tab. You should see a new workflow run triggered. It will have two jobs:
- `playwright` — runs E2E tests (~5 min)
- `ota-update` — runs after playwright passes (~2 min)

- [ ] **Step 3: Confirm ota-update job succeeded**

Click the `ota-update` job. The "Push OTA update to mobile" step should show output like:

```
✔ Published!
  branch: main
  channel: production
```

If it shows `EXPO_TOKEN not set` or authentication errors, verify the secret was added correctly in Task 2.

- [ ] **Step 4: Confirm update reaches the app**

Open the Expo app on a physical device (or simulator) connected to the `production` channel. Force-close and reopen the app. The OTA update should apply on next launch.

To confirm the version: look for any UI change from a recent commit that you know was not in the previous OTA (e.g., any feedback screen update).
