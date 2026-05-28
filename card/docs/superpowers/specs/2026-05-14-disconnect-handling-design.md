# Disconnect Handling — Design Spec
Date: 2026-05-14

## Problem

When any player disconnects or voluntarily leaves during an active multiplayer game, the server immediately calls `closeActiveRoomAfterExit` which destroys the room for all remaining players. This means:

- In a 3-player game, 2 players lose their session because of a third party.
- In a 2-player game, the remaining player has no agency — the game just disappears.
- Existing grace-timer infrastructure in `roomManager.ts` (lines ~1751–1790) is never triggered during active games — it is dead code.

## Goals

1. 3-player game: game continues after one player exits.
2. 2-player game: remaining player immediately gets a choice — technical victory or replace with bot.
3. Penalty policy: rating impact only (no coin deduction for leave or disconnect).

## Out of scope

- Cleaning up dead grace-timer code (separate task).
- Punishment escalation / cooldowns.
- Spectator mode for reconnected-but-eliminated players (they go home).

---

## Server Design

### New function: `handleActiveGameExit`

Replaces both calls to `closeActiveRoomAfterExit` (in `leave_room` handler and `disconnect` handler).

```
handleActiveGameExit(io, room, leavingPlayerId, mode: 'leave' | 'disconnect')
  ↓
  mark player isConnected = false
  count remaining connected humans
  ├── 2+  → eliminatePlayer(state, leavingPlayerId)
  │         broadcastState + toast player_eliminated to room
  │         game continues
  └── 1   → emit opponent_disconnect_choice to the survivor
  └── 0   → destroyRoom (same as today)
```

**Penalty change:** Remove the `deductCoinsForPlayer` call that currently fires on voluntary leave (`mode === 'leave'`). Rating penalty in `recordMatch` is unchanged.

### New function: `eliminatePlayer(state, playerId)` in `gameEngine.ts`

- Sets `player.isEliminated = true` on the player in state.
- Shuffles the eliminated player's hand back into the draw pile.
- If it is currently the eliminated player's turn, advances to the next non-eliminated player.
- Checks win condition: if only one non-eliminated player remains → transitions state to `game-over`.
- Returns the updated state.

Note: `isEliminated` already exists on the `Player` type — no type changes needed.

### Reconnect after elimination (3P)

When an eliminated player's socket reconnects (`reconnect` handler):
- Server detects `player.isEliminated === true`.
- Emits `room_closed` with a new reason field: `reason: 'eliminated'`.
- Client routes player to home screen with message "אין אפשרות חזרה — נסה שולחן אחר".

### Reconnect before choice is made (2P)

If the disconnected player reconnects before the survivor has chosen:
- Normal `reconnect` flow applies — `isConnected` is restored.
- Server emits `opponent_reconnected` (or reuses `state_update`) to cancel the choice modal on the survivor's client.

---

## New Socket Events

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `player_eliminated` | server → all | `{ playerId, playerName }` | Broadcast that a player was removed; clients show toast |
| `opponent_disconnect_choice` | server → survivor | `{ playerId, playerName }` | Prompts survivor to choose how to proceed |
| `accept_technical_victory` | client → server | `{}` | Survivor accepts win; server runs `technicalVictory` |

Note: `replace_with_bot` already exists on the server — reused as-is.

---

## Client Design

### 3-player: `player_eliminated` event

Show a toast to all remaining players:
- He: `"[name] עזב — המשחק ממשיך"`
- En: `"[name] left — game continues"`

### 2-player: `opponent_disconnect_choice` event

Open a non-dismissible modal immediately on disconnect:

```
┌─────────────────────────────────────┐
│  [playerName] התנתק מהמשחק          │
│                                     │
│  [קבל ניצחון טכני]                   │
│  [המשך עם בוט]                       │
└─────────────────────────────────────┘
```

- "קבל ניצחון טכני" → emits `accept_technical_victory`
- "המשך עם בוט" → emits `replace_with_bot` (existing handler)
- Modal is dismissed if a `state_update` arrives indicating opponent reconnected.

### Reconnected-but-eliminated player

On receiving `room_closed` with `reason: 'eliminated'`:
- Navigate to home screen.
- Show toast: He: `"אין אפשרות חזרה — נסה שולחן אחר"` / En: `"No way back — try another table"`

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Two players disconnect simultaneously (3P) | Third player receives `opponent_disconnect_choice` (same as 2P flow) |
| Survivor also disconnects before choosing (2P) | `destroyRoom` — no one to notify |
| Eliminated player had one-card-left flag | `hasOneCardLeft` flag ignored, hand returned to deck as normal |
| Eliminated player's turn is active | `eliminatePlayer` advances turn to next non-eliminated player; toast shown |

---

## i18n Keys Required

| Key | He | En |
|-----|----|----|
| `mp.playerEliminated` | `"{{name}} עזב — המשחק ממשיך"` | `"{{name}} left — game continues"` |
| `mp.opponentDisconnectedChoiceTitle` | `"{{name}} התנתק מהמשחק"` | `"{{name}} disconnected"` |
| `mp.acceptTechnicalVictory` | `"קבל ניצחון טכני"` | `"Accept technical victory"` |
| `mp.eliminatedReconnect` | `"אין אפשרות חזרה — נסה שולחן אחר"` | `"No way back — try another table"` |
