# Android Audio Fix — Design Spec
Date: 2026-05-19

## Problem

On Android, sounds are silent immediately on app entry ("like mute"). The issue is reproducible and breaks easily. Two root causes identified in `src/audio/sfx.ts`.

## Root Causes

### Bug 1: `initialized` flag set before async work completes

```ts
initialized = true;  // synchronous — before await
try {
  await ensureAudioMode();  // may fail on Android (audio focus timing)
  await Promise.all(...);
} catch {
  // initialized stays true — no retry ever happens
}
```

If `ensureAudioMode()` throws on first launch (common on Android due to audio focus not being ready), sounds never load and `initializeSfx()` never retries. Result: silence from the moment the app opens.

### Bug 2: `ensureAudioMode()` called inside every `playSfx()`

`setAudioModeAsync()` is invoked on every single sound play. When multiple sounds trigger concurrently (e.g. at game start), multiple parallel calls to `setAudioModeAsync` race each other and corrupt the Android audio session.

## Fix Design

**Scope: `src/audio/sfx.ts` only. No API changes.**

### Change 1 — Fix retry on initialization failure

Move `initialized = true` to after successful completion. If init fails, `initialized` stays `false` so the next call retries.

```ts
export async function initializeSfx(): Promise<void> {
  if (initialized) return;
  try {
    await ensureAudioMode();
    await Promise.all(...);
    initialized = true;  // only set on success
  } catch (error) {
    // initialized stays false → next call will retry
  }
}
```

### Change 2 — Remove `ensureAudioMode()` from `playSfx()` and `playMeterCelebrateSequence()`

Audio mode is established once during `initializeSfx()`. Individual play calls must not re-configure the audio session.

### Change 3 — Switch `DoNotMix` → `DuckOthers`

`DoNotMix` requires exclusive Android audio focus. If the system doesn't grant it (another app playing audio, app just started), sounds are silently skipped. `DuckOthers` is permissive — Android lowers other audio and plays ours without requiring exclusivity.

```ts
interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
shouldDuckAndroid: true,
```

### Change 4 — AppState listener for foreground recovery

When the app returns from background, the audio session may have been released. Add an `AppState` listener inside `initializeSfx` that calls `ensureAudioMode()` on `active` transitions.

```ts
AppState.addEventListener('change', (next) => {
  if (next === 'active') ensureAudioMode().catch(() => {});
});
```

Clean up the listener in `disposeSfx()`.

## Files Changed

- `src/audio/sfx.ts` — all four changes above

## Out of Scope

- No changes to `playbackStatus.ts`, `preferences.ts`, or any screen files
- No volume or mute logic changes
- No iOS changes (iOS path unaffected)
