import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import { LocaleProvider } from '../i18n/LocaleContext';
import type { PlayerView } from '../../shared/types';

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

function CaptureContext() {
  multiplayerCtx = useMultiplayer();
  return null;
}

function socketHandler<T = any>(event: string): T {
  const entry = mockSocket.on.mock.calls.find(([name]: [string]) => name === event);
  if (!entry) throw new Error(`Missing socket handler for ${event}`);
  return entry[1] as T;
}

function makeActivePlayerView(): PlayerView {
  return {
    roomCode: '4821',
    phase: 'building',
    myHand: [{ id: 'n-4', type: 'number', value: 4 }],
    myPlayerId: 'player-1',
    opponents: [
      {
        id: 'player-2',
        name: 'Bob',
        cardCount: 3,
        isConnected: true,
        isHost: false,
        isBot: false,
        calledLolos: false,
        afkWarnings: 0,
        isEliminated: false,
        isSpectator: false,
      },
    ],
    currentPlayerIndex: 0,
    players: [
      {
        id: 'player-1',
        name: 'Alice',
        cardCount: 1,
        isConnected: true,
        isHost: true,
        isBot: false,
        calledLolos: false,
        afkWarnings: 0,
        isEliminated: false,
        isSpectator: false,
      },
      {
        id: 'player-2',
        name: 'Bob',
        cardCount: 3,
        isConnected: true,
        isHost: false,
        isBot: false,
        calledLolos: false,
        afkWarnings: 0,
        isEliminated: false,
        isSpectator: false,
      },
    ],
    pileTop: null,
    deckCount: 12,
    dice: { die1: 1, die2: 3, die3: 4 },
    diceRollSeq: 1,
    validTargets: [{ equation: '1 + 3 = 4', result: 4 }],
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
    lastCourageCoinsAwarded: false,
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
    overflowSwapStage: null,
    overflowSwapSelectedPileChoice: null,
    overflowSwapSelectedHandCardId: null,
    roundsPlayed: 0,
    equationCommits: [],
    tournamentTable: [],
  };
}

describe('useMultiplayer room close flow', () => {
  beforeEach(async () => {
    multiplayerCtx = null;
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.removeAllListeners.mockClear();
    mockSocket.disconnect.mockClear();
    mockSocket.connected = false;
    mockSocket.active = false;
    await AsyncStorage.clear();
  });

  it('filters non-waiting tables out of the lobby list immediately', async () => {
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
      multiplayerCtx!.createTable('Alice');
    });

    act(() => {
      const roomCreated = socketHandler<(data: { roomCode: string; playerId: string; visibility?: 'public' | 'private_locked' }) => void>('room_created');
      const tablesUpdated = socketHandler<(data: { tables: any[] }) => void>('tables_updated');
      roomCreated({
        roomCode: '4821',
        playerId: 'player-1',
        visibility: 'public',
      });
      tablesUpdated({
        tables: [
          {
            roomCode: '4821',
            hostName: 'Alice',
            visibility: 'public',
            status: 'waiting',
            currentParticipants: 2,
            maxParticipants: 4,
            countdownEndsAt: null,
            hasRandomJoiner: false,
            tableTheme: 'classic',
            configuredDifficulty: 'full',
            timerSetting: '60',
            timerCustomSeconds: 60,
          },
        ],
      });
    });

    expect(multiplayerCtx!.tables).toHaveLength(1);

    act(() => {
      const tableStatusChanged = socketHandler<
        (data: { roomCode: string; status: 'configuring' | 'waiting' | 'countdown' | 'full' | 'in_game'; countdownEndsAt: number | null }) => void
      >('table_status_changed');
      tableStatusChanged({
        roomCode: '4821',
        status: 'in_game',
        countdownEndsAt: null,
      });
    });

    expect(multiplayerCtx!.tables).toEqual([]);
  });

  it('removes the closed room from the local tables list immediately', async () => {
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
      multiplayerCtx!.createTable('Alice');
    });

    act(() => {
      const roomCreated = socketHandler<(data: { roomCode: string; playerId: string; visibility?: 'public' | 'private_locked' }) => void>('room_created');
      const tablesUpdated = socketHandler<(data: { tables: any[] }) => void>('tables_updated');
      roomCreated({
        roomCode: '4821',
        playerId: 'player-1',
        visibility: 'public',
      });
      tablesUpdated({
        tables: [
          {
            roomCode: '4821',
            hostName: 'Alice',
            visibility: 'public',
            status: 'waiting',
            currentParticipants: 2,
            maxParticipants: 4,
            countdownEndsAt: null,
            hasRandomJoiner: false,
            tableTheme: 'classic',
            configuredDifficulty: 'full',
            timerSetting: '60',
            timerCustomSeconds: 60,
          },
        ],
      });
    });

    expect(multiplayerCtx!.inRoom).toBe(true);
    expect(multiplayerCtx!.tables).toHaveLength(1);

    act(() => {
      const roomClosed = socketHandler<(data: { roomCode: string }) => void>('room_closed');
      roomClosed({ roomCode: '4821' });
    });

    expect(multiplayerCtx!.inRoom).toBe(false);
    expect(multiplayerCtx!.tables).toEqual([]);
    expect(mockSocket.emit).toHaveBeenCalledWith('list_tables');
  });

  it('clears an active online game override when room_closed arrives mid-game', async () => {
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
      multiplayerCtx!.createTable('Alice');
    });

    act(() => {
      const roomCreated = socketHandler<(data: { roomCode: string; playerId: string; visibility?: 'public' | 'private_locked' }) => void>('room_created');
      const gameStarted = socketHandler<(view: PlayerView) => void>('game_started');
      roomCreated({
        roomCode: '4821',
        playerId: 'player-1',
        visibility: 'public',
      });
      gameStarted(makeActivePlayerView());
    });

    expect(multiplayerCtx!.serverState?.phase).toBe('building');
    expect(multiplayerCtx!.gameOverride).not.toBeNull();

    act(() => {
      const roomClosed = socketHandler<(data: { roomCode: string }) => void>('room_closed');
      roomClosed({ roomCode: '4821' });
    });

    expect(multiplayerCtx!.serverState).toBeNull();
    expect(multiplayerCtx!.gameOverride).toBeNull();
    expect(multiplayerCtx!.inRoom).toBe(false);
  });
});
