import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import { LocaleProvider, useLocale } from '../i18n/LocaleContext';

const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  removeAllListeners: jest.fn(),
  disconnect: jest.fn(),
  connected: false,
  active: false,
};

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'he' }],
}));

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

import { MultiplayerProvider, useMultiplayer } from './useMultiplayer';

let multiplayerCtx: ReturnType<typeof useMultiplayer> | null = null;
let localeCtx: ReturnType<typeof useLocale> | null = null;

function CaptureContexts() {
  multiplayerCtx = useMultiplayer();
  localeCtx = useLocale();
  return null;
}

describe('useMultiplayer locale wiring', () => {
  beforeEach(async () => {
    multiplayerCtx = null;
    localeCtx = null;
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.removeAllListeners.mockClear();
    mockSocket.disconnect.mockClear();
    mockSocket.connected = false;
    mockSocket.active = false;
    await AsyncStorage.clear();
  });

  it('emits the selected locale when creating an online table', async () => {
    render(
      <LocaleProvider>
        <MultiplayerProvider>
          <CaptureContexts />
        </MultiplayerProvider>
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(multiplayerCtx).not.toBeNull();
      expect(localeCtx).not.toBeNull();
    });

    await act(async () => {
      await localeCtx!.setLocale('en');
    });

    act(() => {
      multiplayerCtx!.createTable('Alice');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'create_table',
      expect.objectContaining({ playerName: 'Alice', locale: 'en' }),
    );
  });
});
