# Android Audio Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Android silence bug caused by a broken `initialized` flag and redundant `setAudioModeAsync` calls in `sfx.ts`.

**Architecture:** All changes are in `src/audio/sfx.ts`. The `initialized` flag is moved to after successful completion so failures allow retry. `ensureAudioMode()` is removed from individual play calls and called only once at init and on foreground recovery. `DoNotMix` is replaced with `DuckOthers` for permissive audio focus.

**Tech Stack:** expo-av (SDK 54), React Native AppState, Jest + jest-expo

---

## Files

- **Modify:** `src/audio/sfx.ts` — all four fixes
- **Create:** `src/audio/sfx.test.ts` — new test file covering the fixed behaviors

---

### Task 1: Write failing tests for Bug 1 — `initialized` retry on failure

**Files:**
- Create: `src/audio/sfx.test.ts`

- [ ] **Step 1: Create the test file**

```ts
// src/audio/sfx.test.ts
import { Audio, InterruptionModeAndroid } from 'expo-av';
import { AppState } from 'react-native';

// sfx.ts uses module-level state — reset between tests by re-importing
// We use jest.resetModules() so each test gets a fresh module instance.

describe('sfx — initializeSfx', () => {
  let sfx: typeof import('./sfx');
  let setAudioModeAsync: jest.Mock;
  let createAsync: jest.Mock;

  beforeEach(() => {
    jest.resetModules();

    setAudioModeAsync = jest.fn().mockResolvedValue(undefined);
    createAsync = jest.fn().mockResolvedValue({
      sound: {
        playAsync: jest.fn(),
        replayAsync: jest.fn(),
        stopAsync: jest.fn(),
        unloadAsync: jest.fn(),
        setVolumeAsync: jest.fn(),
        setOnPlaybackStatusUpdate: jest.fn(),
      },
    });

    jest.mock('expo-av', () => ({
      Audio: {
        Sound: { createAsync },
        setAudioModeAsync,
        setIsEnabledAsync: undefined,
        InterruptionModeIOS: { MixWithOthers: 'MixWithOthers' },
        InterruptionModeAndroid: { DuckOthers: 'DuckOthers' },
      },
    }));

    jest.mock('react-native', () => ({
      AppState: {
        addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
        currentState: 'active',
      },
      Platform: { OS: 'android' },
    }));

    sfx = require('./sfx');
  });

  afterEach(async () => {
    await sfx.disposeSfx();
  });

  it('retries initialization after a failure', async () => {
    setAudioModeAsync.mockRejectedValueOnce(new Error('audio focus denied'));

    await sfx.initializeSfx();  // first call — fails
    expect(setAudioModeAsync).toHaveBeenCalledTimes(1);

    await sfx.initializeSfx();  // second call — should retry, not be a no-op
    expect(setAudioModeAsync).toHaveBeenCalledTimes(2);
  });

  it('does not reinitialize after success', async () => {
    await sfx.initializeSfx();
    await sfx.initializeSfx();

    expect(setAudioModeAsync).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```
npx jest src/audio/sfx.test.ts --no-coverage
```

Expected: FAIL — `initializeSfx` sets `initialized = true` before awaiting, so the retry test finds `initialized` already `true` and exits early.

---

### Task 2: Write failing test for Bug 2 — no `setAudioModeAsync` inside `playSfx`

**Files:**
- Modify: `src/audio/sfx.test.ts`

- [ ] **Step 1: Add test inside the same `describe` block**

Add this test after the existing two tests in `src/audio/sfx.test.ts`:

```ts
  it('does not call setAudioModeAsync when playing a sound after init', async () => {
    await sfx.initializeSfx();
    setAudioModeAsync.mockClear();  // reset call count after init

    await sfx.playSfx('tap', { cooldownMs: 0 });

    expect(setAudioModeAsync).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test to confirm it fails**

```
npx jest src/audio/sfx.test.ts --no-coverage
```

Expected: FAIL — current `playSfx` calls `ensureAudioMode()` which calls `setAudioModeAsync`.

---

### Task 3: Write failing test for AppState recovery

**Files:**
- Modify: `src/audio/sfx.test.ts`

- [ ] **Step 1: Add AppState test in a new describe block**

Append after the existing describe block in `src/audio/sfx.test.ts`:

```ts
describe('sfx — AppState recovery', () => {
  let sfx: typeof import('./sfx');
  let setAudioModeAsync: jest.Mock;
  let addEventListenerMock: jest.Mock;
  let capturedHandler: ((state: string) => void) | null = null;

  beforeEach(() => {
    jest.resetModules();
    capturedHandler = null;

    setAudioModeAsync = jest.fn().mockResolvedValue(undefined);

    addEventListenerMock = jest.fn().mockImplementation((_event, handler) => {
      capturedHandler = handler;
      return { remove: jest.fn() };
    });

    jest.mock('expo-av', () => ({
      Audio: {
        Sound: {
          createAsync: jest.fn().mockResolvedValue({
            sound: {
              replayAsync: jest.fn(),
              stopAsync: jest.fn(),
              unloadAsync: jest.fn(),
              setVolumeAsync: jest.fn(),
              setOnPlaybackStatusUpdate: jest.fn(),
            },
          }),
        },
        setAudioModeAsync,
        setIsEnabledAsync: undefined,
        InterruptionModeIOS: { MixWithOthers: 'MixWithOthers' },
        InterruptionModeAndroid: { DuckOthers: 'DuckOthers' },
      },
    }));

    jest.mock('react-native', () => ({
      AppState: {
        addEventListener: addEventListenerMock,
        currentState: 'background',
      },
      Platform: { OS: 'android' },
    }));

    sfx = require('./sfx');
  });

  afterEach(async () => {
    await sfx.disposeSfx();
  });

  it('registers an AppState listener on init', async () => {
    await sfx.initializeSfx();
    expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('calls setAudioModeAsync again when app returns to foreground', async () => {
    await sfx.initializeSfx();
    setAudioModeAsync.mockClear();

    capturedHandler!('active');
    await Promise.resolve();  // flush microtasks

    expect(setAudioModeAsync).toHaveBeenCalledTimes(1);
  });

  it('removes the AppState listener on dispose', async () => {
    const removeMock = jest.fn();
    addEventListenerMock.mockReturnValue({ remove: removeMock });

    await sfx.initializeSfx();
    await sfx.disposeSfx();

    expect(removeMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx jest src/audio/sfx.test.ts --no-coverage
```

Expected: FAIL — no AppState listener exists yet, and `setAudioModeAsync` is still called inside `playSfx`.

---

### Task 4: Implement all fixes in `sfx.ts`

**Files:**
- Modify: `src/audio/sfx.ts`

- [ ] **Step 1: Add AppState import at the top**

At line 1, change:
```ts
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
```
to:
```ts
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
```

- [ ] **Step 2: Add subscription variable after `let initialized`**

After line `let initialized = false;`, add:
```ts
let appStateSubscription: NativeEventSubscription | null = null;
```

- [ ] **Step 3: Change `DoNotMix` → `DuckOthers` and `shouldDuckAndroid: true`**

In `ensureAudioMode()`, replace:
```ts
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    staysActiveInBackground: false,
    shouldDuckAndroid: false,
```
with:
```ts
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
```

- [ ] **Step 4: Fix `initializeSfx` — move `initialized = true` after success + add AppState listener**

Replace the entire `initializeSfx` function:
```ts
export async function initializeSfx(): Promise<void> {
  if (initialized) {
    return;
  }
  try {
    await ensureAudioMode();
    await Promise.all((Object.keys(SOURCES) as SfxKey[]).map((key) => ensureLoaded(key)));
    initialized = true;
    appStateSubscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        ensureAudioMode().catch(() => {});
      }
    });
  } catch (error) {
    if (__DEV__) {
      console.warn('[sfx] initialize failed', error);
    }
    // initialized stays false — next call will retry
  }
}
```

- [ ] **Step 5: Remove `ensureAudioMode()` from `playSfx`**

In `playSfx`, remove the line `await ensureAudioMode();` so it reads:
```ts
  try {
    const sound = await ensureLoaded(key);
    if (!sound) {
      return;
    }
    ...
```

- [ ] **Step 6: Remove `ensureAudioMode()` from `playMeterCelebrateSequence`**

In `playMeterCelebrateSequence`, remove the line `await ensureAudioMode();` so it reads:
```ts
  try {
    const sequenceKeys: SfxKey[] = ['meterCelebrateIntro', 'meterCelebrateCoins'];
    ...
```

- [ ] **Step 7: Clean up subscription in `disposeSfx`**

In `disposeSfx`, add cleanup before `initialized = false`:
```ts
  appStateSubscription?.remove();
  appStateSubscription = null;
  initialized = false;
```

Full updated `disposeSfx`:
```ts
export async function disposeSfx(): Promise<void> {
  await Promise.all(
    (Object.keys(REGISTRY) as SfxKey[]).map(async (key) => {
      const sound = REGISTRY[key].sound;
      REGISTRY[key].sound = null;
      REGISTRY[key].loading = false;
      REGISTRY[key].lastPlayedAt = 0;
      if (!sound) {
        return;
      }
      try {
        await sound.unloadAsync();
      } catch (err) {
        if (__DEV__) console.warn('[sfx] unload failed', key, err);
      }
    })
  );
  appStateSubscription?.remove();
  appStateSubscription = null;
  initialized = false;
}
```

---

### Task 5: Verify tests pass and commit

**Files:**
- `src/audio/sfx.ts`
- `src/audio/sfx.test.ts`

- [ ] **Step 1: Run the new tests**

```
npx jest src/audio/sfx.test.ts --no-coverage
```

Expected: all 6 tests PASS.

- [ ] **Step 2: Run the full test suite to check for regressions**

```
npx jest --no-coverage
```

Expected: no new failures.

- [ ] **Step 3: Commit**

```bash
git add src/audio/sfx.ts src/audio/sfx.test.ts
git commit -m "fix(android): sfx retry on init failure, remove setAudioModeAsync from playSfx, add AppState recovery"
```
