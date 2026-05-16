# Launch Screen Verification

## Goal

Verify the difference between the native splash screen and the Expo update or development-client screen.

## What Each Screen Means

- `assets/splash-launch-logo.png` on a dark `#121118` background is the real app splash.
- `assets/icon.png` on a white background, often with `New update available, downloading...`, is not the app splash. It is an Expo native update or development-client layer.

## Automated Check

Run:

```bash
npx jest src/__tests__/launch-config.test.ts --runInBand
```

This validates:

- `app.json` points splash config to `assets/splash-launch-logo.png`
- `app.json` keeps `assets/icon.png` separate from the splash asset
- native splash background stays `#121118`
- startup OTA checks are disabled via `updates.checkAutomatically: ON_ERROR_RECOVERY`
- only the `development` EAS profile is marked as a development client

## Manual Device Check

Use a `preview` or `production` build. Do not use Expo Go and do not use a `developmentClient` build for this check.

1. Install a fresh `preview` or `production` build on the device.
2. Fully close the app.
3. Reopen it from a cold start.
4. Capture the very first launch frame.
5. Confirm the launch frame shows:

- dark background
- `splash-launch-logo.png`
- no white page
- no `New update available, downloading...` footer

## Expected Outcome

- `preview` or `production`: dark branded splash
- `development`: white update or dev-client layer may appear before JS starts, and that does not prove the splash is broken

## Important

Changes to `icon`, `adaptiveIcon`, `splash`, and `updates` are native build-time changes.
An already installed build will not pick them up through a JS refresh or OTA update.
You must create and install a new native build to see the difference.
