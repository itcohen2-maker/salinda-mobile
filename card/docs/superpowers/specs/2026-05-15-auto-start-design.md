# Auto-Start on Full Room — Design Spec

**Date:** 2026-05-15

## Summary

When an online room reaches its configured maximum participants, the game starts automatically and immediately. Rooms configured for 3–4 players also expose a manual "Start Game" button to the host, allowing the game to begin with fewer than the maximum.

---

## Rules

| Max participants | Auto-start trigger | Host can start manually with |
|---|---|---|
| 2 | 2nd human joins | — (auto-start only) |
| 3 | 3rd human joins | 2+ players |
| 4 | 4th human joins | 2+ players |

---

## Server Changes (`server/src/socketHandlers.ts`)

Single change in the `join_table` handler, after a player joins successfully and `emitRoomPlayers` has been called:

```
if (humanPlayers.length >= room.maxParticipants && !room.state) {
  startTableCountdown(io, room);
}
```

`startTableCountdown` already calls `startRoomGame` immediately (no delay). The `!room.state` guard prevents double-start if the room is already in-game.

No other server files change.

---

## Client Changes (`src/screens/OnlineTableScreens.tsx`)

The "Start Game" button is currently shown when `isHost && humanPlayers >= 2`. This condition is correct for rooms with maxParticipants 3 and 4.

**No client change is needed** — the existing button logic already satisfies the requirement.

The only UX note: for a 2-player room, the game auto-starts before the host ever sees the button, so the button is effectively unreachable. This is correct behavior.

---

## Edge Cases

- **Race condition (two players join simultaneously):** The server processes socket events serially; the second `join_table` will see `humanPlayers.length === maxParticipants` and trigger auto-start. No race condition.
- **Host leaves before room fills:** Normal flow — room falls below max, no auto-start.
- **Room already started:** `!room.state` guard prevents re-triggering.
- **Private room (invite code):** Same logic applies; `maxParticipants` is still the threshold.

---

## Scope

- **In scope:** Auto-start on full room; host manual start for 3–4 player rooms with fewer players.
- **Out of scope:** Countdown timer before start, bot slots counting toward max, spectator slots.
