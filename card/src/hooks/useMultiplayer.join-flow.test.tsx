import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import type { PlayerView } from '../../shared/types';
import { LocaleProvider } from '../i18n/LocaleContext';

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

jest.mock('../audio/sfx', () => ({
  playSfx: jest.fn(() => Promise.resolve()),
}));

import { playSfx } from '../audio/sfx';
import { MultiplayerProvider, useMultiplayer } from './useMultiplayer';

let multiplayerCtx: ReturnType<typeof useMultiplayer> | null = null;
const playSfxMock = playSfx as jest.MockedFunction<typeof playSfx>;

function CaptureContext() {
  multiplayerCtx = useMultiplayer();
  return null;
}

function socketHandler<T = any>(event: string): T {
  const entry = mockSocket.on.mock.calls.find(([name]: [string]) => name === event);
  if (!entry) throw new Error(`Missing socket handler for ${event}`);
  return entry[1] as T;
}

function makePlayerView(overrides: Partial<PlayerView> = {}): PlayerView {
  return {
    roomCode: '4821',
    phase: 'turn-transition',
    myHand: [],
    myPlayerId: 'host-1',
    opponents: [],
    currentPlayerIndex: 0,
    players: [],
    pileTop: null,
    deckCount: 12,
    dice: null,
    diceRollSeq: 0,
    validTargets: [],
    equationResult: null,
    lastEquationDisplay: null,
    stagedCards: [],
    pendingFractionTarget: null,
    fractionPenalty: 0,
    fractionAttackResolved: true,
    hasPlayedCards: false,
    hasDrawnCard: false,
    lastCardValue: null,
    consecutiveIdenticalPlays: 0,
    courageMeterPercent: 0,
    courageMeterStep: 0,
    courageDiscardSuccessStreak: 0,
    courageRewardPulseId: 0,
    courageCoins: 0,
    turnCoinsEarned: 0,
    lastCourageRewardReason: null,
    identicalCelebration: null,
    lastMoveMessage: null,
    lastDiscardCount: 0,
    difficulty: 'full',
    gameSettings: {
      diceMode: '3',
      showFractions: true,
      showPossibleResults: true,
      showSolveExercise: true,
      timerSetting: 'off',
      timerCustomSeconds: 60,
    },
    winner: null,
    message: '',
    openingDrawId: 'open-1',
    turnDeadlineAt: null,
    overflowSwapPending: false,
    overflowSwapDeadlineAt: null,
    overflowSwapCanUseUnderTop: false,
    roundsPlayed: 0,
    equationCommits: [],
    tournamentTable: [],
    ...overrides,
  };
}

describe('useMultiplayer join flow', () => {
  beforeEach(async () => {
    multiplayerCtx = null;
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.removeAllListeners.mockClear();
    mockSocket.disconnect.mockClear();
    playSfxMock.mockClear();
    mockSocket.connected = false;
    mockSocket.active = true;
    await AsyncStorage.clear();
  });

  it('drops host mode before joining an existing table', async () => {
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

    act(() => {
      multiplayerCtx!.createTable('Dana');
    });
    expect(multiplayerCtx!.isHost).toBe(true);

    act(() => {
      multiplayerCtx!.joinTable('4821', 'Noa');
    });
    expect(multiplayerCtx!.isHost).toBe(false);

    act(() => {
      const roomCreated = socketHandler<(data: { roomCode: string; playerId: string; visibility?: 'public' | 'private_locked' }) => void>('room_created');
      roomCreated({
        roomCode: '4821',
        playerId: 'player-joiner',
        visibility: 'public',
      });
    });

    expect(multiplayerCtx!.inRoom).toBe(true);
    expect(multiplayerCtx!.isHost).toBe(false);
  });

  it('plays a soft join sound only for the host when a new human player joins', async () => {
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

    act(() => {
      multiplayerCtx!.createTable('Dana');
    });

    act(() => {
      const roomCreated = socketHandler<(data: { roomCode: string; playerId: string; visibility?: 'public' | 'private_locked' }) => void>('room_created');
      roomCreated({
        roomCode: '4821',
        playerId: 'host-1',
        visibility: 'public',
      });
    });

    act(() => {
      const playerJoined = socketHandler<(data: {
        players: { id: string; name: string; isHost: boolean; isConnected: boolean; isBot: boolean }[];
      }) => void>('player_joined');
      playerJoined({
        players: [
          { id: 'host-1', name: 'Dana', isHost: true, isConnected: true, isBot: false },
        ],
      });
    });

    expect(playSfxMock).not.toHaveBeenCalled();

    act(() => {
      const playerJoined = socketHandler<(data: {
        players: { id: string; name: string; isHost: boolean; isConnected: boolean; isBot: boolean }[];
      }) => void>('player_joined');
      playerJoined({
        players: [
          { id: 'host-1', name: 'Dana', isHost: true, isConnected: true, isBot: false },
          { id: 'guest-1', name: 'Noa', isHost: false, isConnected: true, isBot: false },
        ],
      });
    });

    expect(playSfxMock).toHaveBeenCalledWith('success', { cooldownMs: 400, volumeOverride: 0.26 });
  });

  it('does not play the join sound for non-host players already waiting in the room', async () => {
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

    act(() => {
      multiplayerCtx!.joinTable('4821', 'Noa');
    });

    act(() => {
      const roomCreated = socketHandler<(data: { roomCode: string; playerId: string; visibility?: 'public' | 'private_locked' }) => void>('room_created');
      roomCreated({
        roomCode: '4821',
        playerId: 'guest-1',
        visibility: 'public',
      });
    });

    act(() => {
      const playerJoined = socketHandler<(data: {
        players: { id: string; name: string; isHost: boolean; isConnected: boolean; isBot: boolean }[];
      }) => void>('player_joined');
      playerJoined({
        players: [
          { id: 'host-1', name: 'Dana', isHost: true, isConnected: true, isBot: false },
          { id: 'guest-1', name: 'Noa', isHost: false, isConnected: true, isBot: false },
        ],
      });
    });

    playSfxMock.mockClear();

    act(() => {
      const playerJoined = socketHandler<(data: {
        players: { id: string; name: string; isHost: boolean; isConnected: boolean; isBot: boolean }[];
      }) => void>('player_joined');
      playerJoined({
        players: [
          { id: 'host-1', name: 'Dana', isHost: true, isConnected: true, isBot: false },
          { id: 'guest-1', name: 'Noa', isHost: false, isConnected: true, isBot: false },
          { id: 'guest-2', name: 'Maya', isHost: false, isConnected: true, isBot: false },
        ],
      });
    });

    expect(playSfxMock).not.toHaveBeenCalled();
  });

  it('plays the game-start sound when the multiplayer game begins', async () => {
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

    act(() => {
      multiplayerCtx!.createTable('Dana');
    });

    act(() => {
      const gameStarted = socketHandler<(view: PlayerView) => void>('game_started');
      gameStarted(
        makePlayerView({
          myPlayerId: 'guest-1',
          players: [
            { id: 'host-1', name: 'Dana', cardCount: 4, isConnected: true, isHost: true, isBot: false, hasOneCardLeft: false, afkWarnings: 0, isEliminated: false, isSpectator: false },
            { id: 'guest-1', name: 'Noa', cardCount: 4, isConnected: true, isHost: false, isBot: false, hasOneCardLeft: false, afkWarnings: 0, isEliminated: false, isSpectator: false },
          ],
        }),
      );
    });

    expect(playSfxMock).toHaveBeenCalledWith('start', { cooldownMs: 900, volumeOverride: 0.4 });
  });
});
