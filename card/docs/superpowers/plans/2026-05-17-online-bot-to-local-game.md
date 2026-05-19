# Online Bot → Local Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a player clicks "Start vs bot" from an online table, skip the server-side bot game and launch the local bot game directly with the room's settings — identical behavior to starting a bot game from the main lobby.

**Architecture:** Add an `onStartLocalBotGame` prop to `LobbyScreen`. In `GameRouter` (index.tsx), pass a callback that calls `leaveRoom()`, switches `playMode` to `'local'`, and dispatches `START_GAME` with the room's configured settings.

**Tech Stack:** React Native, TypeScript, React hooks, Jest + React Native Testing Library

---

## Files

- Modify: `src/screens/OnlineTableScreens.tsx` — add `onStartLocalBotGame` prop, change bot button
- Modify: `src/screens/OnlineTableScreens.lobby.test.tsx` — update helper, add test
- Modify: `index.tsx:20017` — pass `onStartLocalBotGame` callback to `<LobbyScreen>`

---

### Task 1: Write the failing test

**Files:**
- Modify: `src/screens/OnlineTableScreens.lobby.test.tsx`

- [ ] **Step 1: Update `renderLobbyScreen` helper to accept and pass the new prop**

In `OnlineTableScreens.lobby.test.tsx`, replace the `renderLobbyScreen` function signature and `<LobbyScreen />` render:

```tsx
// Before:
function renderLobbyScreen(overrides: Record<string, unknown> = {}) {
  // ...
  return render(
    <SafeAreaProvider ...>
      <LocaleProvider>
        <LobbyScreen />
      </LocaleProvider>
    </SafeAreaProvider>,
  );
}

// After:
function renderLobbyScreen(
  overrides: Record<string, unknown> = {},
  onStartLocalBotGame: jest.Mock = jest.fn(),
) {
  // ...
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <LocaleProvider>
        <LobbyScreen onStartLocalBotGame={onStartLocalBotGame} />
      </LocaleProvider>
    </SafeAreaProvider>,
  );
}
```

- [ ] **Step 2: Add the failing test at the end of the describe block**

```tsx
it('calls onStartLocalBotGame with difficulty and settings when Start vs bot is pressed', () => {
  const onStartLocalBotGame = jest.fn();

  renderLobbyScreen(
    {
      players: [{ id: 'host', name: 'Host', isHost: true, isConnected: true, isBot: false }],
      tables: [{ ...baseTable, currentParticipants: 1 }],
      isHost: true,
    },
    onStartLocalBotGame,
  );

  fireEvent.press(screen.getByText('Start vs bot'));

  expect(onStartLocalBotGame).toHaveBeenCalledTimes(1);
  expect(onStartLocalBotGame).toHaveBeenCalledWith(
    'full',
    expect.objectContaining({ botDifficulty: 'medium' }),
  );
});
```

---

### Task 2: Run the test to verify it fails

**Files:** none

- [ ] **Step 1: Run the new test**

```bash
npx jest src/screens/OnlineTableScreens.lobby.test.tsx --testNamePattern="calls onStartLocalBotGame" --no-coverage
```

Expected: **FAIL** — `Property 'onStartLocalBotGame' does not exist` (TypeScript) or the button triggers `startBotGame` instead.

---

### Task 3: Implement the LobbyScreen changes

**Files:**
- Modify: `src/screens/OnlineTableScreens.tsx`

- [ ] **Step 1: Add `onStartLocalBotGame` to the `LobbyScreen` props**

Change the function signature (line ~616):

```tsx
// Before:
export function LobbyScreen({ onOpenCelebrationMockup: _onOpenCelebrationMockup }: { onOpenCelebrationMockup?: () => void } = {}) {

// After:
export function LobbyScreen({
  onOpenCelebrationMockup: _onOpenCelebrationMockup,
  onStartLocalBotGame,
}: {
  onOpenCelebrationMockup?: () => void;
  onStartLocalBotGame: (difficulty: 'easy' | 'full', settings: HostGameSettings) => void;
}) {
```

- [ ] **Step 2: Remove `startBotGame` from the `useMultiplayer()` destructuring in `LobbyScreen`**

In the destructuring block (~line 621–638):

```tsx
// Before:
const {
  roomCode,
  currentInviteCode,
  currentTableVisibility,
  players,
  tables,
  currentRoomTable,
  isHost,
  configureTable,
  startTableCountdown,
  leaveRoom,
  error,
  clearError,
  toast,
  clearToast,
  startBotGame,
  serverUrl,
} = useMultiplayer();

// After:
const {
  roomCode,
  currentInviteCode,
  currentTableVisibility,
  players,
  tables,
  currentRoomTable,
  isHost,
  configureTable,
  startTableCountdown,
  leaveRoom,
  error,
  clearError,
  toast,
  clearToast,
  serverUrl,
} = useMultiplayer();
```

- [ ] **Step 3: Remove the `startingBot` state**

Delete this line (~line 658):
```tsx
const [startingBot, setStartingBot] = useState(false);
```

- [ ] **Step 4: Replace the bot button `onPress` with a synchronous call**

Replace lines ~1147–1159:

```tsx
// Before:
<TouchableOpacity
  style={styles.secondaryPrimaryBtn}
  onPress={async () => {
    setStartingBot(true);
    try {
      await startBotGame(difficulty, buildGameSettings());
    } finally {
      setStartingBot(false);
    }
  }}
>
  {startingBot ? <ActivityIndicator color="#fff" /> : <Text style={styles.secondaryPrimaryBtnText}>{t('lobby.startBotGame')}</Text>}
</TouchableOpacity>

// After:
<TouchableOpacity
  style={styles.secondaryPrimaryBtn}
  onPress={() => onStartLocalBotGame(difficulty, buildGameSettings())}
>
  <Text style={styles.secondaryPrimaryBtnText}>{t('lobby.startBotGame')}</Text>
</TouchableOpacity>
```

- [ ] **Step 5: Remove the unused `ActivityIndicator` import if it's only used in the bot button**

Check the imports at the top of `OnlineTableScreens.tsx`. If `ActivityIndicator` is not used anywhere else, remove it from the React Native import line:

```tsx
// Before (example):
import { ActivityIndicator, Platform, ScrollView, ... } from 'react-native';

// After:
import { Platform, ScrollView, ... } from 'react-native';
```

---

### Task 4: Run all tests to verify they pass

**Files:** none

- [ ] **Step 1: Run the full test file**

```bash
npx jest src/screens/OnlineTableScreens.lobby.test.tsx --no-coverage
```

Expected: **All tests PASS** including the new one.

- [ ] **Step 2: Run the full test suite to check for regressions**

```bash
npx jest --no-coverage
```

Expected: same pass count as before (no regressions).

---

### Task 5: Commit the LobbyScreen changes

**Files:** none

- [ ] **Step 1: Stage and commit**

```bash
git add src/screens/OnlineTableScreens.tsx src/screens/OnlineTableScreens.lobby.test.tsx
git commit -m "feat: replace server bot with local bot game from online table lobby"
```

---

### Task 6: Wire up the callback in GameRouter (index.tsx)

**Files:**
- Modify: `index.tsx`

- [ ] **Step 1: Add the `handleStartLocalBotGame` callback inside `GameRouter`**

After the existing `openCelebrationMockupRoom` callback (~line 19535), add:

```tsx
const handleStartLocalBotGame = useCallback(
  (difficulty: 'easy' | 'full', settings: HostGameSettings) => {
    mp?.leaveRoom();
    setPlayMode('local');
    const botName = settings.botDisplayName || (locale === 'he' ? 'בוט' : 'Bot');
    const humanName = preferredName.trim() || (locale === 'he' ? 'שחקן' : 'Player');
    dispatch({
      type: 'START_GAME',
      mode: 'vs-bot',
      botDifficulty: settings.botDifficulty ?? 'medium',
      players: [
        { name: humanName, isBot: false },
        { name: botName, isBot: true },
      ],
      difficulty,
      fractions: settings.showFractions ?? true,
      fractionKinds: settings.fractionKinds && settings.fractionKinds.length > 0
        ? [...settings.fractionKinds]
        : [...ALL_FRACTION_KINDS],
      showPossibleResults: settings.showPossibleResults ?? true,
      showSolveExercise: settings.showSolveExercise ?? true,
      timerSetting: settings.timerSetting ?? 'off',
      timerCustomSeconds: settings.timerCustomSeconds ?? 60,
      difficultyStage: difficulty === 'easy' ? 'A' : 'H',
      enabledOperators: settings.enabledOperators && settings.enabledOperators.length > 0
        ? [...settings.enabledOperators]
        : (['+', '-', 'x', '÷'] as Operation[]),
      allowNegativeTargets: settings.allowNegativeTargets ?? false,
      mathRangeMax: settings.mathRangeMax ?? (difficulty === 'easy' ? 12 : 25),
      abVariant: difficulty === 'easy' ? 'control_0_12_plus' : 'variant_0_15_plus',
    });
  },
  [dispatch, locale, mp, preferredName, setPlayMode],
);
```

`HostGameSettings` is already imported from `shared/types` via the existing imports. `ALL_FRACTION_KINDS` and `Operation` are already in scope in `index.tsx`.

- [ ] **Step 2: Pass the callback to `<LobbyScreen>`**

Find the `LobbyScreen` render (~line 20017):

```tsx
// Before:
else if (!mp.serverState) screen = <LobbyScreen onOpenCelebrationMockup={openCelebrationMockupRoom} />;

// After:
else if (!mp.serverState) screen = (
  <LobbyScreen
    onOpenCelebrationMockup={openCelebrationMockupRoom}
    onStartLocalBotGame={handleStartLocalBotGame}
  />
);
```

---

### Task 7: TypeScript check + final test run

**Files:** none

- [ ] **Step 1: TypeScript compile check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

---

### Task 8: Commit the GameRouter wiring

**Files:** none

- [ ] **Step 1: Stage and commit**

```bash
git add index.tsx
git commit -m "feat: wire onStartLocalBotGame in GameRouter — online bot now uses local game engine"
```

---

## Manual Verification Checklist

After implementation:

1. Open the app → Online → create a table (any settings: easy difficulty, fractions ON, timer 60s)
2. Wait on the lobby screen — bot offer appears immediately
3. Press "Start vs bot"
4. **Verify:** Game starts directly without passing through the lobby screen
5. **Verify:** Bot's first move has the same pacing/delay as a bot game started from the main lobby
6. **Verify:** Difficulty, fractions, and timer match what was set in the online table config
7. **Verify:** After the game, "Play again" works normally
