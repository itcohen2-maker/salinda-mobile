# Online Multiplayer UX Fixes — Design Spec

**Date:** 2026-05-17

## Summary

Six focused fixes to the online multiplayer experience:
1. Personal turn-end messages shown only to the player who played
2. One-time modal (not toast) when a player quits mid-game
3. Eliminated player chip turns red with "מחוץ למשחק" label
4. Excellence meter correctness verified (no code change needed)
5. Missing coin sound in `CoinAwardCelebrationCard`
6. "Play vs bot" from online lobby navigates to local game setup screen

---

## Fix 1 — Personal Message Only for the Last Player

### Problem

`PlayerWaitingScreen` (`index.tsx:18846`) renders `lastMoveMessage` for **all** players who switch to
"מסך שלי", including players who did not just play. Messages like
`"✅ PlayerA: 3+2 → הניח 5"` appear as if the viewing player played the card.

### Root Cause

`OnlineGameWrapper` (`index.tsx:18945`) passes `lastMoveForWaiting = state.lastMoveMessage` to
`PlayerWaitingScreen` unconditionally. The `lastMoveMessage` in `getPlayerView` (server
`gameEngine.ts:1300`) is the same for all players — it is not filtered by player identity.

### Fix

In `OnlineGameWrapper`, add:

```ts
const amILastPlayer = myPlayerIndex === lastPlayerIndex;
```

Change the `PlayerWaitingScreen` call:

```tsx
lastMoveMessage={amILastPlayer ? lastMoveForWaiting : null}
```

`PlayerWaitingScreen` already conditionally renders `lastMoveMessage` only when `!!lastMoveMessage`,
so no changes are needed inside the component.

**Files changed:** `index.tsx` (1 line change in `OnlineGameWrapper`)

---

## Fix 2 — One-Time Modal for Player Quit

### Problem

When `player_eliminated` is received (`useMultiplayer.tsx:784`), the client calls `setToast(...)`.
A toast auto-dismisses; the user may miss it entirely if they are not looking.

### Fix

Replace the toast with a dedicated `eliminationNotice` state in `useMultiplayer.tsx`:

```ts
// new state inside useMultiplayer
const [eliminationNotice, setEliminationNotice] = useState<string | null>(null);
const clearEliminationNotice = useCallback(() => setEliminationNotice(null), []);

// handler — replaces setToast(...)
socket.on('player_eliminated', ({ playerName }) => {
  const msg = localeRef.current === 'he'
    ? `${playerName} עזב/ה — המשחק ממשיך`
    : `${playerName} left — game continues`;
  setEliminationNotice(msg);
});
```

Expose `eliminationNotice` and `clearEliminationNotice` in the hook's return value.

In `OnlineGameWrapper` (`index.tsx:18945`), add a dismissable overlay:

```tsx
{mp?.eliminationNotice && (
  <TouchableOpacity
    onPress={() => mp.clearEliminationNotice()}
    style={{ ...StyleSheet.absoluteFillObject, zIndex: 200,
             justifyContent: 'center', alignItems: 'center',
             backgroundColor: 'rgba(0,0,0,0.55)' }}
  >
    <View style={{ backgroundColor: '#1E293B', borderRadius: 16, padding: 24,
                   maxWidth: 320, borderWidth: 1, borderColor: 'rgba(248,113,113,0.6)' }}>
      <Text style={{ color: '#FECACA', fontSize: 16, fontWeight: '800', textAlign: 'center' }}>
        {mp.eliminationNotice}
      </Text>
      <Text style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
        {locale === 'he' ? 'לחץ/י להמשיך' : 'Tap to continue'}
      </Text>
    </View>
  </TouchableOpacity>
)}
```

**Files changed:** `src/hooks/useMultiplayer.tsx`, `index.tsx`

---

## Fix 3 — Red Player Chip for Eliminated Players

### Problem

Player chips in the game HUD (rendered twice — RTL: `index.tsx:13947`, LTR: `index.tsx:14053`)
use `color={isCurrent ? 'green' : 'blue'}` for all players. A player who left the game
(`p.isEliminated === true`) looks identical to an active player. The `isEliminated` field
is already present in `PlayerView` from the server.

### Fix

In both chip render blocks, replace the color and text calculations:

```tsx
const isEliminated = (p as any).isEliminated === true;
const chipColor = isEliminated ? 'red' : (isCurrent ? 'green' : 'blue');
const btnText = isEliminated
  ? `${shortName}\nמחוץ למשחק`
  : isCurrent
    ? `${shortName}\nיש לך ${p.hand?.length ?? 0} קלפים`
    : `${shortName}\n${p.hand?.length ?? 0} קלפים`;
```

Also remove the `opacity: 0.34` wrapper for non-current players — it was cosmetic and
conflicts with the red-chip treatment making eliminated players look "dim-but-active".

**Files changed:** `index.tsx` (2 matching blocks)

---

## Fix 4 — Excellence Meter in vs-Bot Game (Verified, No Change)

Investigation confirmed the meter is **correct** in the local vs-bot engine (which now also
powers the online bot game after the recent router change):

- `applyCourageStepReward` updates both the player object (`p.courageMeterPercent`) and
  the state-level mirror field.
- `ExcellenceMeter` uses `meterPlayer = state.players.find(p => !p.isBot)` when it is
  the bot's turn, so the human's meter is always displayed.
- `BEGIN_TURN` resets `turnCoinsEarned` and `lastCourageCoinsAwarded` but never touches
  the player's stored meter step/percent.

No code change required.

---

## Fix 5 — Missing Coin Sound in CoinAwardCelebrationCard

### Problem

`CoinAwardCelebrationCard` (`src/components/CoinAwardCelebrationCard.tsx`) is a purely
visual component. It has no audio trigger. The intended coin sound
(`sfx_meter_coins_custom.mp3`) only plays via `ExcellenceMeter.tsx:183`
(`playMeterCelebrateSequence`), which runs on `pulseKey` change. Due to async sequencing
(intro plays first, coins play after intro finishes), the coins sound may not reach the
user by the time the celebration card is visible.

### Fix

Add a `useEffect` inside `CoinAwardCelebrationCard` that fires when the component mounts:

```ts
import { playSfx } from '../../src/audio/sfx';

useEffect(() => {
  void playSfx('meterCelebrateCoins');
}, []); // mount only
```

This plays the coin sound immediately when the card appears, independent of
`ExcellenceMeter`'s async sequence.

**Files changed:** `src/components/CoinAwardCelebrationCard.tsx`

---

---

## Fix 6 — "Play vs Bot" from Online Lobby Navigates to Local Setup Screen

### Problem

`handleStartLocalBotGame` (`index.tsx:19703`) immediately dispatches `START_GAME` when the
user clicks "play vs bot" from the online table lobby. The user has no chance to configure
number range, fractions, or advanced settings. The local game setup screen (`StartScreen`,
rendered at `index.tsx:20118` when `playMode === 'local' && state.phase === 'setup'`) already
has all the controls needed.

### Fix

Replace the immediate `START_GAME` dispatch with navigation to `StartScreen`:

```ts
const handleStartLocalBotGame = useCallback(() => {
  mp?.leaveRoom();
  dispatch({ type: 'RESET_GAME' });          // ensures state.phase === 'setup'
  setSelectedLocalGameMode('vs-bot');         // locks mode to vs-bot in StartScreen
  setPlayMode('local');                       // renders StartScreen via line 20118
}, [dispatch, mp, setPlayMode, setSelectedLocalGameMode]);
```

`StartScreen` is rendered with `forcedGameMode="vs-bot"` and `lockGameMode` (already the
pattern at line 20118), so the user sees the full settings screen and clicks "בואו נשחק"
to start.

The `onStartLocalBotGame` prop passed through `GameRouter` → `LobbyScreens` no longer
needs to carry `difficulty` or `settings` — the `StartScreen` collects them. Update the
prop signature accordingly.

**Files changed:** `index.tsx` (simplify `handleStartLocalBotGame`),
`src/screens/OnlineTableScreens.tsx` (update `onStartLocalBotGame` call-site — remove
difficulty/settings args if no longer needed)

---

## Scope

**In scope:** All six fixes above.

**Out of scope:** Localization of "מחוץ למשחק" to English (the chip is Hebrew-only UI,
consistent with the rest of the HUD); changes to the server; new socket events.
