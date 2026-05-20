# Sentry Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Sentry into the iOS/Android EAS production builds to capture unhandled errors and native crashes with readable stack traces.

**Architecture:** Install `@sentry/react-native`, register its Expo config plugin in `app.json` so EAS auto-configures native crash reporting and uploads source maps, then initialize Sentry at the top of `index.tsx` before any component code runs.

**Tech Stack:** `@sentry/react-native`, Expo config plugin, EAS secrets

---

## Pre-requisites (manual — do before running any tasks)

1. Go to [sentry.io](https://sentry.io) → create a free account
2. Create a new project → choose **React Native**
3. Copy your **DSN** (looks like `https://abc123@o123456.ingest.sentry.io/789`)
4. Go to **Settings → Auth Tokens** → create a token with scopes: `project:releases`, `org:read`, `project:write`
5. Note your **organization slug** and **project slug** (visible in the project URL: `sentry.io/organizations/<org-slug>/projects/<project-slug>/`)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | modify (via install) | add `@sentry/react-native` dependency |
| `app.json` | modify | add Sentry Expo config plugin with org + project slugs |
| `index.tsx` | modify (line 6) | add `Sentry.init({ dsn })` before all other imports |

---

## Task 1: Install `@sentry/react-native`

**Files:**
- Modify: `package.json` (via install command)

- [ ] **Step 1: Install the package**

Run from the project root:
```bash
npx expo install @sentry/react-native
```
Expected output: package added to `node_modules` and `package.json` dependencies.

- [ ] **Step 2: Verify install**

Run:
```bash
grep '"@sentry/react-native"' package.json
```
Expected: a line like `"@sentry/react-native": "~X.X.X"`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @sentry/react-native"
```

---

## Task 2: Add Sentry config plugin to `app.json`

**Files:**
- Modify: `app.json`

- [ ] **Step 1: Add the plugin entry**

In `app.json`, find the `"plugins"` array (currently ends after the `expo-av` entry) and add the Sentry plugin as the last entry. Replace `YOUR_ORG_SLUG` and `YOUR_PROJECT_SLUG` with your actual values from the pre-requisites:

```json
"plugins": [
  [
    "expo-splash-screen",
    {
      "backgroundColor": "#121118",
      "image": "./assets/splash-launch-logo.png",
      "imageWidth": 320
    }
  ],
  "expo-system-ui",
  "expo-localization",
  [
    "expo-av",
    {
      "microphonePermission": false
    }
  ],
  [
    "@sentry/react-native/expo",
    {
      "organization": "YOUR_ORG_SLUG",
      "project": "YOUR_PROJECT_SLUG"
    }
  ]
]
```

- [ ] **Step 2: Verify valid JSON**

Run:
```bash
node -e "require('./app.json'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add app.json
git commit -m "chore: add Sentry Expo config plugin"
```

---

## Task 3: Initialize Sentry in `index.tsx`

**Files:**
- Modify: `index.tsx` (insert before line 6)

- [ ] **Step 1: Add Sentry init**

Insert these two lines immediately before the first `import React` line (currently line 6). Replace the DSN string with your actual DSN from the pre-requisites:

```tsx
import * as Sentry from '@sentry/react-native';
Sentry.init({ dsn: 'https://YOUR_DSN@oYOUR_ORG.ingest.sentry.io/YOUR_PROJECT_ID' });
```

After the edit, lines 1–8 of `index.tsx` should look like:

```tsx
// ============================================================
// index.tsx — Lolos Card Game — FULL SINGLE FILE
// LinearGradient cards, 3D shadows, rotated deck, thick edges
// ============================================================

import * as Sentry from '@sentry/react-native';
Sentry.init({ dsn: 'https://YOUR_DSN@oYOUR_ORG.ingest.sentry.io/YOUR_PROJECT_ID' });

import React, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, useReducer, forwardRef, useImperativeHandle } from 'react';
```

- [ ] **Step 2: Verify the app still type-checks**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors (or same errors as before this change — don't introduce new ones).

- [ ] **Step 3: Commit**

```bash
git add index.tsx
git commit -m "feat: initialize Sentry in entry point"
```

---

## Task 4: Add EAS secret for source map upload

**Files:** none (EAS cloud config only)

- [ ] **Step 1: Create the EAS secret**

Run from the project root (replace `<your-auth-token>` with the token from pre-requisites):
```bash
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <your-auth-token>
```
Expected output: `✅ Created a new secret "SENTRY_AUTH_TOKEN" on project @<user>/salinda-game.`

- [ ] **Step 2: Verify the secret exists**

Run:
```bash
eas secret:list
```
Expected: `SENTRY_AUTH_TOKEN` appears in the list.

---

## Task 5: Trigger a build and verify Sentry receives events

- [ ] **Step 1: Trigger a preview or production EAS build**

```bash
eas build --platform android --profile preview
```
(Or `--profile production` for a store build. Use `--platform ios` for iOS.)

- [ ] **Step 2: Watch for source map upload in build logs**

In the EAS build log, look for lines like:
```
Uploading source maps to Sentry...
Successfully uploaded source maps
```
If you see these, source maps are wired up correctly.

- [ ] **Step 3: Verify Sentry receives a session**

Install the built APK/IPA on a device. Open the app, then go to your Sentry project dashboard → **Issues** or **Releases**. You should see a new release entry and session data within a few minutes.

- [ ] **Step 4: Optional — force a test error to confirm end-to-end**

Temporarily add this line anywhere in `index.tsx` after the Sentry init (remove it after confirming):
```tsx
setTimeout(() => { throw new Error('Sentry test error'); }, 3000);
```
Rebuild, install, open the app. Within a minute, a "Sentry test error" issue should appear in your Sentry dashboard with a readable stack trace. Remove the line and commit.
