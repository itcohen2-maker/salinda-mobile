# Disconnect Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a player exits an active multiplayer game, the remaining players continue playing (3P) or get an immediate choice of technical victory or bot replacement (2P), instead of the room being destroyed for everyone.

**Architecture:** Surgical replacement of `closeActiveRoomAfterExit` with a new `handleActiveGameExit` that branches on remaining-player count. A new `eliminatePlayer()` pure function in `gameEngine.ts` handles 3P elimination. A new `accept_technical_victory` socket event handles the survivor's choice in 2P.

**Tech Stack:** TypeScript, Socket.IO, React Native/Expo

---

## File Map

| File | Change |
|------|--------|
| `shared/types.ts` | Add `player_eliminated`, `opponent_disconnect_choice` to `ServerToClientEvents`; add `accept_technical_victory` to `ClientToServerEvents`; add `reason?` to `room_closed` |
| `shared/i18n/he.ts` | Add 4 new keys |
| `shared/i18n/en.ts` | Add 4 new keys |
| `server/src/gameEngine.ts` | Add `eliminatePlayer()` export |
| `server/src/__tests__/eliminatePlayer.test.ts` | New test file |
| `server/src/socketHandlers.ts` | Replace `closeActiveRoomAfterExit` with `handleActiveGameExit`; add `accept_technical_victory` handler; update reconnect handler; remove coin deduction on leave |
| `src/hooks/useMultiplayer.tsx` | Add `acceptTechnicalVictory()`; add `opponent_disconnect_choice` listener; add `player_eliminated` listener; make `DisconnectChoiceState.deadlineAt` optional |
| `index.tsx` | Update disconnect choice modal to show two-button choice without countdown |

---

### Task 1: Add new socket event types + i18n keys

**Files:**
- Modify: `shared/types.ts`
- Modify: `shared/i18n/he.ts`
- Modify: `shared/i18n/en.ts`

- [ ] **Step 1: Add events to shared/types.ts**

In `ServerToClientEvents` (around line 414), replace:
```typescript
  opponent_disconnect_grace: (data: { playerId: string; playerName: string; deadlineAt: number }) => void;
  opponent_reconnected: (data: { playerId: string; playerName: string }) => void;
  opponent_disconnect_expired: (data: { playerId: string; playerName: string }) => void;
```
with:
```typescript
  opponent_disconnect_grace: (data: { playerId: string; playerName: string; deadlineAt: number }) => void;
  opponent_reconnected: (data: { playerId: string; playerName: string }) => void;
  opponent_disconnect_expired: (data: { playerId: string; playerName: string }) => void;
  player_eliminated: (data: { playerId: string; playerName: string }) => void;
  opponent_disconnect_choice: (data: { playerId: string; playerName: string }) => void;
```

Change `room_closed` payload:
```typescript
  room_closed: (data: { roomCode: string; reason?: 'eliminated' }) => void;
```

In `ClientToServerEvents` (after `continue_vs_bot`, around line 392), add:
```typescript
  accept_technical_victory: () => void;
```

- [ ] **Step 2: Add i18n keys to shared/i18n/he.ts**

After `'mp.roomClosedPlayerDisconnected'` (line 262), add:
```typescript
  'mp.playerEliminated': '{{name}} עזב/ה — המשחק ממשיך',
  'mp.opponentDisconnectChoiceTitle': '{{name}} התנתק/ה מהמשחק',
  'mp.acceptTechnicalVictory': 'קבל ניצחון טכני',
  'mp.eliminatedReconnect': 'אין אפשרות חזרה — נסה שולחן אחר',
```

- [ ] **Step 3: Add i18n keys to shared/i18n/en.ts**

After `'mp.roomClosedPlayerDisconnected'` (line 258), add:
```typescript
  'mp.playerEliminated': '{{name}} left — game continues',
  'mp.opponentDisconnectChoiceTitle': '{{name}} disconnected',
  'mp.acceptTechnicalVictory': 'Accept technical victory',
  'mp.eliminatedReconnect': 'No way back — try another table',
```

- [ ] **Step 4: Commit**

```bash
git add shared/types.ts shared/i18n/he.ts shared/i18n/en.ts
git commit -m "feat: add disconnect-handling socket events and i18n keys"
```

---

### Task 2: Add eliminatePlayer() to gameEngine (TDD)

**Files:**
- Create: `server/src/__tests__/eliminatePlayer.test.ts`
- Modify: `server/src/gameEngine.ts`

- [ ] **Step 1: Write failing tests**

Create `server/src/__tests__/eliminatePlayer.test.ts`:

```typescript
import type { Card, HostGameSettings, Player, ServerGameState } from '../../../shared/types';
import { eliminatePlayer } from '../gameEngine';

function makeNumber(id: string, value: number): Card {
  return { id, type: 'number', value };
}

function makePlayer(id: string, hand: Card[], isHost = false): Player {
  return {
    id,
    name: id,
    hand,
    calledLolos: false,
    isConnected: true,
    isHost,
    isBot: false,
    afkWarnings: 0,
    isEliminated: false,
    isSpectator: false,
    locale: 'he',
  };
}

const hostGameSettings: HostGameSettings = {
  diceMode: '3',
  showFractions: true,
  showPossibleResults: true,
  showSolveExercise: true,
  timerSetting: 'off',
  timerCustomSeconds: 60,
};

function makeState3P(): ServerGameState {
  const p1 = makePlayer('p1', [makeNumber('a', 1), makeNumber('b', 2)], true);
  const p2 = makePlayer('p2', [makeNumber('c', 3), makeNumber('d', 4)]);
  const p3 = makePlayer('p3', [makeNumber('e', 5), makeNumber('f', 6)]);
  return {
    roomCode: 'ROOM',
    phase: 'pre-roll',
    players: [p1, p2, p3],
    currentPlayerIndex: 1, // p2's turn
    drawPile: [makeNumber('draw-1', 9)],
    discardPile: [makeNumber('top', 7)],
    dice: null,
    diceRollSeq: 0,
    validTargets: [],
    equationResult: null,
    stagedCards: [],
    pendingFractionTarget: null,
    fractionPenalty: 0,
    fractionAttackResolved: true,
    roundsPlayed: 0,
    hostGameSettings,
    turnDeadlineAt: null,
    lastMoveMessage: null,
    overflowSwapStage: null,
    overflowSwapDeadlineAt: null,
    overflowSwapCardIds: null,
    overflowSwapChosen: null,
    hasPlayedCards: false,
    courageDiscardSuccessStreak: 0,
    courageMeterStep: 0,
    courageMeterPercent: 0,
    courageRewardPulseId: 0,
    courageCoins: 0,
    turnCoinsEarned: 0,
    lastCourageCoinsAwarded: false,
    tournamentTable: [],
    message: null,
  };
}

describe('eliminatePlayer', () => {
  it('marks eliminated player as isEliminated and clears hand', () => {
    const st = makeState3P();
    const result = eliminatePlayer(st, 'p3');
    expect(result).not.toBeNull();
    const p3 = result!.players.find(p => p.id === 'p3')!;
    expect(p3.isEliminated).toBe(true);
    expect(p3.hand).toHaveLength(0);
  });

  it('returns eliminated hand cards to draw pile', () => {
    const st = makeState3P();
    const originalDrawCount = st.drawPile.length; // 1
    const p3HandCount = st.players[2].hand.length; // 2
    const result = eliminatePlayer(st, 'p3');
    expect(result!.drawPile.length).toBe(originalDrawCount + p3HandCount);
  });

  it('does not advance turn when eliminated player is not current', () => {
    const st = makeState3P(); // currentPlayerIndex = 1 (p2)
    const result = eliminatePlayer(st, 'p3'); // p3 is index 2
    expect(result!.currentPlayerIndex).toBe(1);
  });

  it('advances turn when eliminated player is current', () => {
    const st = { ...makeState3P(), currentPlayerIndex: 1 }; // p2 is current
    const result = eliminatePlayer(st, 'p2');
    // should advance past p2 to next active
    expect(result!.currentPlayerIndex).not.toBe(1);
    const currentPlayer = result!.players[result!.currentPlayerIndex];
    expect(currentPlayer.isEliminated).toBe(false);
  });

  it('returns game-over when only one active player remains after elimination', () => {
    const st = makeState3P();
    // Eliminate p2 first
    const after1 = eliminatePlayer(st, 'p2')!;
    // Then eliminate p3 — only p1 remains
    const after2 = eliminatePlayer(after1, 'p3');
    expect(after2!.phase).toBe('game-over');
    expect(after2!.winner?.id).toBe('p1');
  });

  it('returns null for unknown playerId', () => {
    const st = makeState3P();
    expect(eliminatePlayer(st, 'nobody')).toBeNull();
  });

  it('returns null if player is already eliminated', () => {
    const st = makeState3P();
    const after = eliminatePlayer(st, 'p3')!;
    expect(eliminatePlayer(after, 'p3')).toBeNull();
  });

  it('clears calledLolos flag on elimination', () => {
    const st = makeState3P();
    st.players[2].calledLolos = true;
    const result = eliminatePlayer(st, 'p3');
    expect(result!.players[2].calledLolos).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest server/src/__tests__/eliminatePlayer.test.ts --no-coverage
```
Expected: FAIL with "eliminatePlayer is not exported"

- [ ] **Step 3: Implement eliminatePlayer in gameEngine.ts**

Add after the `technicalVictory` function (around line 261):

```typescript
/**
 * Eliminate a player mid-game (disconnect / leave in 3P+).
 * Returns updated state, or null if playerId not found or already eliminated.
 */
export function eliminatePlayer(
  st: ServerGameState,
  playerId: string,
): ServerGameState | null {
  const playerIdx = st.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return null;
  const player = st.players[playerIdx];
  if (player.isEliminated) return null;

  // Return hand to draw pile (shuffled in)
  const newDrawPile = shuffle([...st.drawPile, ...player.hand]);
  const newPlayers = st.players.map((p, i) =>
    i === playerIdx
      ? { ...p, isEliminated: true, isSpectator: true, hand: [], calledLolos: false }
      : p,
  );

  let s: ServerGameState = { ...st, players: newPlayers, drawPile: newDrawPile };

  // Check if only one active player remains → game over
  const activePlayers = getActivePlayers(s.players);
  if (activePlayers.length <= 1) {
    const winner = activePlayers[0] ?? null;
    if (!winner) return { ...s, phase: 'game-over', winner: null };
    const wi = s.players.indexOf(winner);
    return {
      ...s,
      phase: 'game-over',
      winner,
      tournamentTable: bumpTournamentOnWin(s, wi),
    };
  }

  // If eliminated player held the turn, advance to next active player
  if (s.currentPlayerIndex === playerIdx) {
    const nextIdx = getNextActivePlayerIndex(s.players, playerIdx);
    s = { ...s, currentPlayerIndex: nextIdx, phase: 'turn-transition' };
  }

  return s;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest server/src/__tests__/eliminatePlayer.test.ts --no-coverage
```
Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/gameEngine.ts server/src/__tests__/eliminatePlayer.test.ts
git commit -m "feat: add eliminatePlayer() to gameEngine — handles 3P mid-game exit"
```

---

### Task 3: Replace closeActiveRoomAfterExit with handleActiveGameExit

**Files:**
- Modify: `server/src/socketHandlers.ts`

- [ ] **Step 1: Add eliminatePlayer import**

At the top of `socketHandlers.ts`, in the existing `gameEngine` import (around line 85–90), add `eliminatePlayer` to the destructured list:

```typescript
import {
  getPlayerView,
  forceTurnTimeout,
  resolveOverflowSwap,
  withOnlineTurnDeadline,
  technicalVictory,
  eliminatePlayer,
} from './gameEngine';
```

- [ ] **Step 2: Add handleActiveGameExit function**

Replace the existing `closeActiveRoomAfterExit` function (lines 303–345) with:

```typescript
async function handleActiveGameExit(
  io: IOServer,
  room: Room,
  leavingPlayerId: string,
  mode: 'leave' | 'disconnect',
): Promise<void> {
  if (!room.state || room.state.phase === 'game-over') return;

  const leavingPlayer = room.players.find((p) => p.id === leavingPlayerId);
  const leavingName = leavingPlayer?.name ?? 'Player';

  clearRoomTurnTimer(room);
  clearBotActionTimer(room);

  const remainingHumans = room.players.filter(
    (p) => !p.isBot && p.isConnected && p.id !== leavingPlayerId,
  );

  if (remainingHumans.length >= 2) {
    // 3-player+ game: eliminate the exiting player and continue
    const newState = eliminatePlayer(room.state, leavingPlayerId);
    if (!newState) return;
    room.state = newState;
    room.lastActivity = Date.now();

    for (const p of room.players) {
      if (p.id === leavingPlayerId || p.isBot || !p.isConnected) continue;
      emitToPlayer(io, room, p.id, (s) => {
        s.emit('player_eliminated', { playerId: leavingPlayerId, playerName: leavingName });
      });
    }

    broadcastState(io, room);

    if (newState.phase === 'game-over') {
      emitRoomToasts(io, room);
      maybeRecordMatch(room);
    } else {
      scheduleRoomTurnTimer(io, room);
      scheduleBotAction(io, room);
    }
  } else if (remainingHumans.length === 1) {
    // 2-player game: let survivor choose
    const survivor = remainingHumans[0];
    emitToPlayer(io, room, survivor.id, (s) => {
      s.emit('opponent_disconnect_choice', {
        playerId: leavingPlayerId,
        playerName: leavingName,
      });
    });
  } else {
    // Nobody left: tear down the room
    destroyRoom(room.code);
    emitTablesUpdated(io);
  }
}
```

- [ ] **Step 3: Update leave_room handler**

Replace the current `leave_room` handler block (lines 1116–1122) that calls `closeActiveRoomAfterExit`:

```typescript
  socket.on('leave_room', async () => {
    if (rateLimited()) return;
    const activeInfo = getRoomBySocket(socket.id);
    if (activeInfo?.room.state && activeInfo.room.state.phase !== 'game-over') {
      // Notify leaving player immediately before removing their socket
      socket.emit('room_closed', { roomCode: activeInfo.room.code });
      socket.leave(activeInfo.room.code);
      leaveRoom(socket.id);
      await handleActiveGameExit(io, activeInfo.room, activeInfo.playerId, 'leave');
      return;
    }
    const result = leaveRoom(socket.id);
    if (!result) return;
    const { room, playerId, playerName } = result;
    socket.leave(room.code);
    io.to(room.code).emit('player_left', { playerId, playerName });
    if (room.players.length > 0) {
      clearRoomDisconnectGrace(room);
      emitRoomPlayers(io, room);
      refreshLobbyStatus(io, room);
      handleWaitingRoomRosterChange(io, room);
    } else {
      emitTablesUpdated(io);
    }
  });
```

- [ ] **Step 4: Update disconnect handler**

Replace the active-game branch in the `disconnect` handler (lines 1739–1742):

```typescript
    const activeInfo = getRoomBySocket(socket.id);
    if (activeInfo?.room.state && activeInfo.room.state.phase !== 'game-over') {
      leaveRoom(socket.id);
      void handleActiveGameExit(io, activeInfo.room, activeInfo.playerId, 'disconnect');
      return;
    }
```

- [ ] **Step 5: Commit**

```bash
git add server/src/socketHandlers.ts
git commit -m "feat: replace closeActiveRoomAfterExit with handleActiveGameExit — 3P continues, 2P gets choice"
```

---

### Task 4: Add accept_technical_victory handler + update reconnect for eliminated players

**Files:**
- Modify: `server/src/socketHandlers.ts`

- [ ] **Step 1: Add accept_technical_victory socket handler**

Add this handler near the other game-action handlers (after the `continue_vs_bot` handler, around line 1260):

```typescript
  socket.on('accept_technical_victory', () => {
    if (rateLimited()) return;
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    if (!room.state || room.state.phase === 'game-over') return;

    // Find the disconnected opponent (not connected, not bot, not self)
    const disconnectedOpponent = room.players.find(
      (p) => p.id !== playerId && !p.isBot && !p.isConnected,
    );
    if (!disconnectedOpponent) return;

    clearRoomTurnTimer(room);
    clearBotActionTimer(room);

    const tvResult = technicalVictory(room.state, disconnectedOpponent.id);
    if (!tvResult) return;

    room.state = tvResult;
    room.lastActivity = Date.now();
    broadcastState(io, room);
    emitRoomToasts(io, room);
    maybeRecordMatch(room);
  });
```

- [ ] **Step 2: Update reconnect handler to detect eliminated players**

In the `reconnect` handler, after `const { room, player } = result;` (around line 1154), add the eliminated-player check before any state sync:

```typescript
    const { room, player } = result;
    if (socket.data.userId) player.supabaseUserId = socket.data.userId;
    socket.join(room.code);

    // Player was eliminated mid-game — send them home
    if (player.isEliminated) {
      socket.emit('room_closed', { roomCode: room.code, reason: 'eliminated' });
      socket.leave(room.code);
      return;
    }
```

- [ ] **Step 3: Commit**

```bash
git add server/src/socketHandlers.ts
git commit -m "feat: add accept_technical_victory handler; route eliminated reconnects to home"
```

---

### Task 5: Update useMultiplayer.tsx — new events and acceptTechnicalVictory

**Files:**
- Modify: `src/hooks/useMultiplayer.tsx`

- [ ] **Step 1: Make DisconnectChoiceState.deadlineAt optional**

Change the interface (around line 192):
```typescript
export interface DisconnectChoiceState {
  playerId: string;
  playerName: string;
  deadlineAt?: number; // optional — only set by legacy grace-timer path
}
```

- [ ] **Step 2: Add acceptTechnicalVictory to MultiplayerContextValue interface**

After `continueVsBot: () => Promise<boolean>;` (line 247), add:
```typescript
  acceptTechnicalVictory: () => void;
```

- [ ] **Step 3: Add opponent_disconnect_choice listener**

After the existing `opponent_disconnect_grace` listener (around line 746), add:

```typescript
    socket.on('opponent_disconnect_choice', ({ playerId: disconnectedId, playerName }) => {
      setDisconnectChoice({ playerId: disconnectedId, playerName });
    });
```

- [ ] **Step 4: Add player_eliminated listener**

After `opponent_disconnect_choice`, add:
```typescript
    socket.on('player_eliminated', ({ playerName }) => {
      setToast(
        localeRef.current === 'he'
          ? `${playerName} עזב/ה — המשחק ממשיך`
          : `${playerName} left — game continues`,
      );
    });
```

- [ ] **Step 5: Add acceptTechnicalVictory callback**

After `continueVsBot` (around line 1000), add:
```typescript
  const acceptTechnicalVictory = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    socket.emit('accept_technical_victory');
    setDisconnectChoice(null);
  }, []);
```

- [ ] **Step 6: Expose acceptTechnicalVictory in context value**

In the returned context object (around line 1119), add alongside `continueVsBot`:
```typescript
    continueVsBot,
    acceptTechnicalVictory,
```

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useMultiplayer.tsx
git commit -m "feat: add acceptTechnicalVictory and opponent_disconnect_choice handling to useMultiplayer"
```

---

### Task 6: Update disconnect choice modal in index.tsx

**Files:**
- Modify: `index.tsx`

The modal is around lines 18695–18755. The current logic shows a countdown when `deadlineAt` is set and `remainingMs > 0`.

- [ ] **Step 1: Locate and understand the current modal**

The current modal logic (around line 18695):
```typescript
const disconnectChoice = mp?.disconnectChoice ?? null;
const remainingMs = disconnectChoice ? disconnectChoice.deadlineAt - nowMs : 0;
const waitingReconnect = disconnectChoice != null && remainingMs > 0;
const countdownSec = waitingReconnect ? Math.ceil(remainingMs / 1000) : 0;
const disconnectChoiceModal = disconnectChoice ? (
  <AppModal visible onClose={...}>
    <View style={{ gap: 14 }}>
      <Text>
        {waitingReconnect
          ? `${disconnectChoice.playerName} מנותק כרגע. ממתינים לחזרה (${countdownSec} שניות).`
          : `${disconnectChoice.playerName} לא חזר בזמן. רוצים להמשיך מול בוט?`}
      </Text>
      <View style={{ flexDirection: 'row', ... }}>
        <LulosButton text={t('lobby.startBotGame')} onPress={() => void mp?.continueVsBot?.()} />
        <LulosButton text={t('lobby.leaveRoom')} onPress={() => ...} />
      </View>
    </View>
  </AppModal>
) : null;
```

- [ ] **Step 2: Replace the modal logic**

Replace the `disconnectChoiceModal` constant (from `const disconnectChoiceModal =` through the closing `) : null;`) with:

```typescript
const disconnectChoiceModal =
  disconnectChoice ? (
    <AppModal
      visible
      onClose={() => {
        // non-dismissible — user must pick an option
      }}
    >
      <View style={{ gap: 14 }}>
        <Text style={{ color: '#E5E7EB', fontSize: 15, fontWeight: '700', textAlign: 'center', lineHeight: 22 }}>
          {`${disconnectChoice.playerName} ${locale === 'he' ? 'התנתק/ה מהמשחק' : 'disconnected'}`}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          <LulosButton
            text={locale === 'he' ? 'קבל ניצחון טכני' : 'Accept technical victory'}
            color="green"
            width={160}
            height={44}
            onPress={() => {
              mp?.acceptTechnicalVictory?.();
            }}
          />
          <LulosButton
            text={t('lobby.startBotGame')}
            color="blue"
            width={160}
            height={44}
            onPress={() => {
              void mp?.continueVsBot?.();
            }}
          />
        </View>
      </View>
    </AppModal>
  ) : null;
```

- [ ] **Step 3: Remove now-unused countdown variables**

Remove the interval effect that ticks the countdown (around line 18600–18606 in index.tsx). There are OTHER `nowMs` declarations in the file (lines ~12239, ~12400) belonging to unrelated components — do NOT remove those. Only remove this block:
```typescript
const mpDisconnectChoice = mp?.disconnectChoice ?? null;
const [nowMs, setNowMs] = useState(() => Date.now());
useEffect(() => {
  if (!mpDisconnectChoice) return;
  const timer = setInterval(() => setNowMs(Date.now()), 1000);
  return () => clearInterval(timer);
}, [mpDisconnectChoice]);
```
And these derived variables right above the modal (around line 18695–18698):
```typescript
const remainingMs = disconnectChoice ? disconnectChoice.deadlineAt - nowMs : 0;
const waitingReconnect = disconnectChoice != null && remainingMs > 0;
const countdownSec = waitingReconnect ? Math.ceil(remainingMs / 1000) : 0;
```

- [ ] **Step 4: Handle eliminated reconnect in room_closed handler**

Find the `room_closed` listener in `index.tsx` (or in `useMultiplayer.tsx`) and check if it already handles `reason`. If using `useMultiplayer.tsx`, the `room_closed` listener (around line 732) currently does:
```typescript
socket.on('room_closed', ({ roomCode }) => {
  ...
  clearRoomSession();
  socket.emit('list_tables');
});
```

Update it to show a toast when reason is `'eliminated'`:
```typescript
socket.on('room_closed', ({ roomCode, reason }) => {
  if (reason === 'eliminated') {
    setToast(
      localeRef.current === 'he'
        ? 'אין אפשרות חזרה — נסה שולחן אחר'
        : 'No way back — try another table',
    );
  }
  clearRoomSession();
  socket.emit('list_tables');
});
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add index.tsx src/hooks/useMultiplayer.tsx
git commit -m "feat: update disconnect choice modal — immediate two-button choice, handle eliminated reconnect"
```

---

### Task 7: Run full test suite and verify

- [ ] **Step 1: Run all server tests**

```bash
npx jest server/ --no-coverage
```
Expected: all pass (including the new `eliminatePlayer` tests)

- [ ] **Step 2: Run all client tests**

```bash
npx jest src/ --no-coverage
```
Expected: all pass

- [ ] **Step 3: Manual smoke test**

Start the dev server and test:
1. Create a 3-player room → start game → disconnect one player → verify the other two can continue playing
2. Create a 2-player room → start game → disconnect one player → verify the modal appears with two buttons → tap "קבל ניצחון טכני" → verify game ends with technical victory
3. Create a 2-player room → start game → disconnect one player → verify modal → tap "המשך עם בוט" → verify bot takes over

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -p
git commit -m "fix: disconnect handling smoke test fixes"
```
