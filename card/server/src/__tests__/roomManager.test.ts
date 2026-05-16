jest.mock('uuid', () => ({
  v4: jest
    .fn()
    .mockReturnValueOnce('uuid-host-1')
    .mockReturnValueOnce('uuid-host-2')
    .mockReturnValueOnce('uuid-guest-2')
    .mockReturnValueOnce('uuid-host-3')
    .mockReturnValueOnce('uuid-guest-3'),
}));

import {
  configureRoomTable,
  createRoom,
  destroyRoom,
  getRoomBySocket,
  getRoomTables,
  joinRoom,
  promoteConnectedHumanHost,
  syncRoomTableStatus,
} from '../roomManager';

describe('roomManager', () => {
  it('keeps active tables visible in the lobby as in_game entries', () => {
    const { room } = createRoom('Host', 'socket-host', 'he');
    try {
      configureRoomTable(room, {
        visibility: 'public',
        maxParticipants: 4,
        difficulty: 'full',
      });
      room.state = { phase: 'building' } as any;
      syncRoomTableStatus(room);

      expect(getRoomTables()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            roomCode: room.code,
            status: 'in_game',
          }),
        ]),
      );
    } finally {
      destroyRoom(room.code);
    }
  });

  it('clears socket mappings for the whole room when the room is destroyed', () => {
    const { room } = createRoom('Host', 'socket-host-2', 'he');
    let destroyed = false;
    try {
      configureRoomTable(room, {
        visibility: 'public',
        maxParticipants: 4,
        difficulty: 'easy',
      });
      const joinResult = joinRoom(room.code, 'Guest', 'socket-guest-2', 'en');
      if ('error' in joinResult) throw new Error('guest should be able to join the configured room');

      expect(getRoomBySocket('socket-host-2')).not.toBeNull();
      expect(getRoomBySocket('socket-guest-2')).not.toBeNull();

      destroyRoom(room.code);
      destroyed = true;

      expect(getRoomBySocket('socket-host-2')).toBeNull();
      expect(getRoomBySocket('socket-guest-2')).toBeNull();
    } finally {
      if (!destroyed) destroyRoom(room.code);
    }
  });

  it('promotes the remaining connected human to host and mirrors the change into room.state', () => {
    const { room, playerId: hostId } = createRoom('Host', 'socket-host-3', 'he');
    let destroyed = false;
    try {
      configureRoomTable(room, {
        visibility: 'public',
        maxParticipants: 2,
        difficulty: 'full',
      });
      const joinResult = joinRoom(room.code, 'Guest', 'socket-guest-3', 'en');
      if ('error' in joinResult) throw new Error('guest should be able to join the configured room');

      const guestId = joinResult.playerId;
      room.state = {
        phase: 'building',
        players: room.players.map((player) => ({ ...player })),
      } as any;

      const host = room.players.find((player) => player.id === hostId);
      const guest = room.players.find((player) => player.id === guestId);
      if (!host || !guest) throw new Error('expected both host and guest players');

      host.isConnected = false;
      host.isHost = true;
      guest.isHost = false;

      const promoted = promoteConnectedHumanHost(room, guestId);

      expect(promoted?.id).toBe(guestId);
      expect(room.players.find((player) => player.id === guestId)?.isHost).toBe(true);
      expect(room.players.find((player) => player.id === hostId)?.isHost).toBe(false);
      expect(room.state?.players.find((player) => player.id === guestId)?.isHost).toBe(true);
      expect(room.state?.players.find((player) => player.id === hostId)?.isHost).toBe(false);

      destroyRoom(room.code);
      destroyed = true;
    } finally {
      if (!destroyed) destroyRoom(room.code);
    }
  });
});
