# Sentry Integration Design

**Date:** 2026-05-20
**Scope:** Mobile only (iOS + Android EAS builds)

## Goal

Capture unhandled JS errors, unhandled promise rejections, and native crashes in production builds with readable stack traces, so production bugs (e.g. "can't create a room") can be diagnosed.

## Stack Context

- Expo ~54 / React Native 0.81.5
- Hermes JS engine on both iOS and Android
- EAS managed builds
- Entry point: `index.tsx`

## Changes Required

### 1. Sentry Account (manual, one-time)

1. Create account at sentry.io
2. Create a new project — choose **React Native**
3. Copy the **DSN** (used in `Sentry.init`)
4. Generate an **Auth Token** with `project:releases` and `org:read` scopes (used for source map upload)

### 2. Install Package

```
npx expo install @sentry/react-native
```

### 3. `app.json` — Add Config Plugin

Add to the `plugins` array:

```json
["@sentry/react-native/expo", {
  "organization": "your-org-slug",
  "project": "your-project-slug"
}]
```

This auto-configures native iOS/Android crash reporting during EAS build and triggers source map upload after each build using `SENTRY_AUTH_TOKEN`.

### 4. `index.tsx` — Initialize Sentry

Add at the very top of `index.tsx`, before any other imports or component code:

```ts
import * as Sentry from '@sentry/react-native';
Sentry.init({ dsn: 'https://xxx@oyyy.ingest.sentry.io/zzz' });
```

Replace the DSN string with the one from your Sentry project.

### 5. EAS Secret — Auth Token

Run once from the project root:

```
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <your-auth-token>
```

EAS reads this secret automatically during builds to upload source maps.

## What Gets Captured Automatically

- Unhandled JS exceptions
- Unhandled promise rejections
- Native iOS/Android crashes
- Source-mapped stack traces (readable, not minified)

## What Is Out of Scope

- Web platform (not targeted)
- Server-side error tracking
- Custom breadcrumbs or manual `captureException` calls (can be added later)
- Performance tracing / transactions

## Success Criteria

After the next EAS production build:
- Sentry dashboard shows the project receiving events
- A production crash or unhandled error produces a readable stack trace (not minified)
