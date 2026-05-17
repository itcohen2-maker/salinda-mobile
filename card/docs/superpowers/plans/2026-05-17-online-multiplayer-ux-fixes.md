# Online Multiplayer UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six targeted UX fixes for online multiplayer: personal messages, quit modal, eliminated chip, coin sound, and vs-bot navigation.

**Architecture:** All client-side changes only — no server modifications. Fixes 1–3 touch `OnlineGameWrapper` / `useMultiplayer` / player chip rendering in `index.tsx`. Fix 5 adds a mount-time sound to `CoinAwardCelebrationCard`. Fix 6 replaces `handleStartLocalBotGame`'s immediate `START_GAME` dispatch with navigation to the local `StartScreen`.

**Tech Stack:** React Native / Expo, TypeScript, Socket.IO client (`src/hooks/useMultiplayer.tsx`), `index.tsx` (monolith game shell), `src/screens/OnlineTableScreens.tsx`

---

## File Map

| File | Change |
|------|--------|
| `src/hooks/useMultiplayer.tsx` | Add `eliminationNotice` state + `clearEliminationNotice`; swap `player_eliminated` from toast to state; expose in `MultiplayerContextValue` |
| `index.tsx` | Fix 1: `amILastPlayer` in `OnlineGameWrapper`; Fix 2: elimination modal overlay; Fix 3: chip color/text for eliminated players (2 places); Fix 6: simplify `handleStartLocalBotGame` |
| `src/components/CoinAwardCelebrationCard.tsx` | Fix 5: add `useEffect` to play coin sound on mount |
| `src/screens/OnlineTableScreens.tsx` | Fix 6: remove `difficulty`/`settings` args from `onStartLocalBotGame` prop |

---

### Task 1: Add `eliminationNotice` to `useMultiplayer` (Fix 2 — server side)

**Files:**
- Modify: `src/hooks/useMultiplayer.tsx:203-262` (interface)
- Modify: `src/hooks/useMultiplayer.tsx:550-553` (state declarations)
- Modify: `src/hooks/useMultiplayer.tsx:784-790` (socket handler)
- Modify: `src/hooks/useMultiplayer.tsx:1087-1134` (value object)

- [ ] **Step 1: Add `eliminationNotice` to the `MultiplayerContextValue` interface**

In `src/hooks/useMultiplayer.tsx`, find the interface at line ~203. After `clearReconnectNotice: () => void;` (line ~250) add:

```typescript
  eliminationNotice: string | null;
  clearEliminationNotice: () => void;
```

- [ ] **Step 2: Add the state variable**

After line ~553 (`const [reconnectNotice, setReconnectNotice] = useState<string | null>(null);`), add:

```typescript
  const [eliminationNotice, setEliminationNotice] = useState<string | null>(null);
```

- [ ] **Step 3: Replace the `player_eliminated` toast handler with a state setter**

Replace lines ~784-790:
```typescript
    socket.on('player_eliminated', ({ playerName }) => {
      setToast(
        localeRef.current === 'he'
          ? `${playerName} עזב/ה — המשחק ממשיך`
          : `${playerName} left — game continues`,
      );
    });
```
with:
```typescript
    socket.on('player_eliminated', ({ playerName }) => {
      setEliminationNotice(
        localeRef.current === 'he'
          ? `${playerName} עזב/ה — המשחק ממשיך`
          : `${playerName} left — game continues`,
      );
    });
```

- [ ] **Step 4: Expose in the value object**

In the `value` object (~line 1087), after `clearReconnectNotice: () => setReconnectNotice(null),` add:
```typescript
    eliminationNotice: eliminationNotice ?? null,
    clearEliminationNotice: () => setEliminationNotice(null),
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors related to `eliminationNotice`.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useMultiplayer.tsx
git commit -m "feat: add eliminationNotice state for player_eliminated modal"
```

---

### Task 2: Render elimination modal in `OnlineGameWrapper` (Fix 2 — UI)

**Files:**
- Modify: `index.tsx` — `OnlineGameWrapper` function (~line 18945)

- [ ] **Step 1: Add the modal overlay**

In `OnlineGameWrapper`, find the `return (` at line ~19087. The component returns a `<View style={{ flex: 1 }}>`. Add the elimination modal **after** `{eliminatedBanner}` (line ~19105):

```tsx
      {mp?.eliminationNotice ? (
        <TouchableOpacity
          onPress={() => mp.clearEliminationNotice()}
          style={[
            StyleSheet.absoluteFillObject,
            { zIndex: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
          ]}
        >
          <View
            style={{
              backgroundColor: '#1E293B',
              borderRadius: 16,
              padding: 24,
              maxWidth: 320,
              borderWidth: 1,
              borderColor: 'rgba(248,113,113,0.6)',
            }}
          >
            <Text style={{ color: '#FECACA', fontSize: 16, fontWeight: '800', textAlign: 'center' }}>
              {mp.eliminationNotice}
            </Text>
            <Text style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
              {locale === 'he' ? 'לחץ/י להמשיך' : 'Tap to continue'}
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}
```

Note: `locale` is already available in `OnlineGameWrapper` via `const { t, locale } = useLocale();` — verify it's destructured; if only `t` is destructured, add `locale`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add index.tsx
git commit -m "feat: show elimination modal when player leaves mid-game"
```

---

### Task 3: Fix personal message — only last player sees it (Fix 1)

**Files:**
- Modify: `index.tsx` — `OnlineGameWrapper` function (~line 18945)

- [ ] **Step 1: Compute `amILastPlayer` and gate `lastMoveMessage`**

In `OnlineGameWrapper`, after the existing line (~19009):
```typescript
  const lastPlayerIndex =
    (state.currentPlayerIndex - 1 + state.players.length) % Math.max(state.players.length, 1);
```
add:
```typescript
  const amILastPlayer = myPlayerIndex === lastPlayerIndex;
```

Then change the `PlayerWaitingScreen` prop at line ~19095:
```tsx
          lastMoveMessage={lastMoveForWaiting}
```
to:
```tsx
          lastMoveMessage={amILastPlayer ? lastMoveForWaiting : null}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add index.tsx
git commit -m "fix: show lastMoveMessage in PlayerWaitingScreen only for player who just played"
```

---

### Task 4: Red chip + "מחוץ למשחק" for eliminated players (Fix 3)

**Files:**
- Modify: `index.tsx` — player chip render blocks at lines ~13947 and ~14053

The player chips are rendered in **two** identical blocks (one for each RTL/LTR layout direction). Both must be updated identically.

- [ ] **Step 1: Update the first chip block (~line 13947)**

Find the block starting with `{!state.isTutorial && displayPlayers.map((p) => {` (~line 13947). Replace the `isCurrent`, `shortName`, `btnText`, `btn` and wrapper variables with:

```tsx
              {!state.isTutorial && displayPlayers.map((p) => {
                const isCurrent = cp?.id === p.id;
                const isEliminated = (p as any).isEliminated === true;
                const shortName = (p.name || 'שחקן').length > 5 ? (p.name || 'שחקן').slice(0, 4) + '…' : (p.name || 'שחקן');
                const chipColor = isEliminated ? 'red' : (isCurrent ? 'green' : 'blue');
                const btnText = isEliminated
                  ? `${shortName}\nמחוץ למשחק`
                  : isCurrent
                    ? `${shortName}\nיש לך ${p.hand?.length ?? 0} קלפים`
                    : `${shortName}\n${p.hand?.length ?? 0} קלפים`;
                const btn = (
                  <LulosButton
                    text={btnText}
                    color={chipColor}
                    width={turnPlayerChipWidth}
                    height={turnPlayerChipHeight}
                    fontSize={turnPlayerChipFontSize}
                    onPress={() => {
                      if (!p.isBot) return;
                      if (!isDefaultPlayerName(p.name)) return;
                      const idx = state.players.findIndex((x) => x.id === p.id);
                      if (idx < 0) return;
                      setEditingPlayerIndex(idx);
                      setNameModalOpen(true);
                    }}
                  />
                );
                if (isCurrent) {
                  return (
                    <View key={p.id} style={playerTurnChipActiveRing}>
                      {btn}
                    </View>
                  );
                }
                return (
                  <View key={p.id}>
                    {btn}
                  </View>
                );
              })}
```

(The `opacity: 0.34` wrapper is removed — eliminated players are already visually distinct via red color.)

- [ ] **Step 2: Update the second chip block (~line 14053)**

Find the identical second block starting with `{!state.isTutorial && displayPlayers.map((p) => {` (~line 14053). Apply the exact same replacement as Step 1.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add index.tsx
git commit -m "feat: show eliminated player chip in red with 'מחוץ למשחק' label"
```

---

### Task 5: Coin sound in `CoinAwardCelebrationCard` (Fix 5)

**Files:**
- Modify: `src/components/CoinAwardCelebrationCard.tsx`

- [ ] **Step 1: Add `useEffect` import and `playSfx` import**

At the top of `src/components/CoinAwardCelebrationCard.tsx`, the React import is already present. Add `useEffect` to the destructure:

```typescript
import React, { useEffect } from 'react';
```

Add the audio import after the existing imports:

```typescript
import { playSfx } from '../../src/audio/sfx';
```

- [ ] **Step 2: Add the sound effect on mount**

Inside `CoinAwardCelebrationCard`, immediately after the `const compact = ...` lines (before `const amountText`), add:

```typescript
  useEffect(() => {
    void playSfx('meterCelebrateCoins');
  }, []);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/CoinAwardCelebrationCard.tsx
git commit -m "feat: play coin sound when CoinAwardCelebrationCard mounts"
```

---

### Task 6: Verify "Play vs bot" uses online table settings (Fix 6 — no code change)

**Files:** none

Fix 6 is a design clarification. The existing `handleStartLocalBotGame` (`index.tsx:19703`)
already starts the local bot game immediately using the `difficulty` and `settings` passed
from `LobbyScreen` — exactly the table configuration the player set up. This is the correct
behavior. No code change is needed.

- [ ] **Step 1: Confirm existing behavior is correct**

Open a table online, configure difficulty + number range, press the "vs bot" button. The
local bot game should start immediately using those settings (no setup screen detour).

Expected: game starts directly with the configured difficulty and math range.

---

## Testing Checklist

After all tasks complete, manually verify:

- [ ] **Fix 1**: Start a 3-player online game. When player A plays a card, switch to "מסך שלי". Players B and C should see no "previous turn summary" message. Player A should see their own last-move message.
- [ ] **Fix 2**: In a 3-player online game, have player C close the app. Players A and B should see a red modal (not a toast) saying "שחקן C עזב/ה — המשחק ממשיך". Tapping the modal dismisses it.
- [ ] **Fix 3**: After player C leaves, their player chip in the HUD should be red with "C\nמחוץ למשחק". Active player chip stays green; others stay blue.
- [ ] **Fix 5**: Complete a game action that fills the excellence meter. The `CoinAwardCelebrationCard` should appear with a coin jingle sound.
- [ ] **Fix 6**: Open an online table, configure 0-12 range + easy difficulty, press "vs bot". Game should start immediately in vs-bot mode with 0-12 range — no setup screen shown.
