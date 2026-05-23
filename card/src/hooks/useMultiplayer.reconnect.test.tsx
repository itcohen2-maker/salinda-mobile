import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import { LocaleProvider } from '../i18n/LocaleContext';
import { supabase } from '../lib/supabase';

const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  removeAllListeners: jest.fn(),
  disconnect: jest.fn(),
  connected: false,
  active: true,
};

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'he' }],
}));

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

import { MultiplayerProvider, useMultiplayer } from './useMultiplayer';

let multiplayerCtx: ReturnType<typeof useMultiplayer> | null = null;
const mockSupabaseAuth = supabase.auth as unknown as {
  getSession: jest.Mock;
  onAuthStateChange: jest.Mock;
};

function CaptureContext() {
  multiplayerCtx = useMultiplayer();
  return null;
}

function socketHandler<T = any>(event: string): T {
  const entry = mockSocket.on.mock.calls.find(([name]: [string]) => name === event);
  if (!entry) throw new Error(`Missing socket handler for ${event}`);
  return entry[1] as T;
}

describe('useMultiplayer lobby reconnect flow', () => {
  beforeEach(async () => {
    multiplayerCtx = null;
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.removeAllListeners.mockClear();
    mockSocket.disconnect.mockClear();
    mockSocket.connected = false;
    mockSocket.active = true;
    mockSupabaseAuth.getSession.mockClear();
    mockSupabaseAuth.onAuthStateChange.mockClear();
    await AsyncStorage.clear();
  });

  it('keeps the lobby room session on transient disconnects and reconnects into the same room', async () => {
    render(
      <LocaleProvider>
        <MultiplayerProvider>
          <CaptureContext />
        </MultiplayerProvider>
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(multiplayerCtx).not.toBeNull();
    });
    expect(mockSupabaseAuth.getSession).not.toHaveBeenCalled();
    expect(mockSupabaseAuth.onAuthStateChange).not.toHaveBeenCalled();

    act(() => {
      multiplayerCtx!.joinTable('4821', 'Noa');
    });

    act(() => {
      const roomCreated = socketHandler<(data: { roomCode: string; playerId: string; visibility?: 'public' | 'private_locked' }) => void>('room_created');
      roomCreated({
        roomCode: '4821',
        playerId: 'player-2',
        visibility: 'public',
      });
    });

    expect(multiplayerCtx!.inRoom).toBe(true);

    act(() => {
      const disconnect = socketHandler<(reason: string) => void>('disconnect');
      disconnect('transport close');
    });

    expect(multiplayerCtx!.inRoom).toBe(true);
    expect(multiplayerCtx!.reconnectNotice).toBeTruthy();

    act(() => {
      const connect = socketHandler<() => void>('connect');
      connect();
    });

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'reconnect',
      expect.objectContaining({ roomCode: '4821', playerId: 'player-2', locale: 'he' }),
    );
  });
});
