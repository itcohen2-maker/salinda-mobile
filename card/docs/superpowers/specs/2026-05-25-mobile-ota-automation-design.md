# Mobile OTA Automation — Design Spec

**Date:** 2026-05-25  
**Status:** Approved

## Problem

The web app (Vercel) deploys automatically on every push to `main`. The mobile app (Expo/EAS) has received only one manual OTA update and is significantly behind — missing features like the feedback inbox screen and all subsequent work. There is no process to prevent this drift from recurring.

## Root Cause

No CI/CD step pushes `eas update` after deployments. Vercel receives all commits automatically; mobile receives nothing unless a developer manually runs `eas update`.

## Solution

Two parts: a one-time catch-up push, then permanent automation in CI.

---

## Part 1: Immediate Catch-Up (one-time, run locally)

Push the current `main` bundle to all production mobile users:

```bash
npx eas-cli update --channel production --message "Catch-up: all changes to date"
```

This delivers every feature that has shipped to web but not yet reached mobile — including the feedback inbox screen, economy screens, tutorial improvements, and all other changes accumulated since the last manual OTA.

---

## Part 2: CI/CD Automation

### Approach

Add an `ota-update` job to `.github/workflows/e2e.yml` that runs `eas update --channel production` automatically after E2E tests pass, on every push to `main` only (not PRs).

### Workflow change

New job added to the existing `e2e.yml`:

```yaml
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
    - run: npm ci
    - run: npx eas-cli update --channel production --message "Auto OTA ${{ github.sha }}" --non-interactive
      env:
        EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

### One-time secret setup (manual, done once)

1. Go to [expo.dev](https://expo.dev) → Account Settings → Access Tokens
2. Create a new token
3. Add it to GitHub repo → Settings → Secrets → `EXPO_TOKEN`

### Result

Every commit to `main` that passes E2E tests is automatically delivered to mobile users within minutes — identical behavior to Vercel.

---

## Part 3: OTA Boundaries — When a Full Rebuild Is Required

OTA updates push only the JS bundle. A full EAS Build + store submission is required for:

| Change type | OTA sufficient? |
|-------------|----------------|
| React Native code, screens, logic, UI | Yes |
| i18n strings, copy changes | Yes |
| Images/assets already bundled | Yes |
| New package with native code (e.g. `expo-camera`) | No — rebuild required |
| Changes to `app.json` or `app.config.js` | No — rebuild required |
| Expo SDK upgrade | No — rebuild required |
| New Android/iOS permissions | No — rebuild required |

**Rule of thumb:** if `npm install` adds a package that contains native code (has an `android/` or `ios/` folder in the package), a full rebuild is needed. Everything else can be OTA'd.

---

## Success Criteria

- Mobile users receive updates within ~5 minutes of a push to `main` passing CI
- No manual steps required after the one-time secret setup
- Developers know when a change requires a full rebuild vs. OTA
