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

function makeActivePlayerView(overrides: Partial<PlayerView> = {}): PlayerView {
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
    ...overrides,
  };
}

describe('useMultiplayer disconnect choice flow', () => {
  beforeEach(async () => {
    multiplayerCtx = null;
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.removeAllListeners.mockClear();
    mockSocket.disconnect.mockClear();
    mockSocket.connected = false;
    mockSocket.active = true;
    await AsyncStorage.clear();
  });

  it('sends the selected bot difficulty when continuing after an opponent disconnects', async () => {
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

    mockSocket.connected = true;

    act(() => {
      multiplayerCtx!.createTable('Alice');
    });

    act(() => {
      const roomCreated = socketHandler<(data: { roomCode: string; playerId: string; visibility?: 'public' | 'private_locked' }) => void>('room_created');
      const gameStarted = socketHandler<(view: PlayerView) => void>('game_started');
      const disconnectChoice = socketHandler<(data: { playerId: string; playerName: string }) => void>('opponent_disconnect_choice');
      roomCreated({
        roomCode: '4821',
        playerId: 'player-1',
        visibility: 'public',
      });
      gameStarted(makeActivePlayerView());
      disconnectChoice({ playerId: 'player-2', playerName: 'Bob' });
    });

    expect(multiplayerCtx!.disconnectChoice?.playerId).toBe('player-2');

    act(() => {
      void multiplayerCtx!.continueVsBot('hard');
    });

    const continueCall = mockSocket.emit.mock.calls.find(([event]: [string]) => event === 'continue_vs_bot');
    expect(continueCall).toBeTruthy();
    expect(continueCall?.[1]).toEqual({ difficulty: 'hard' });
    expect(typeof continueCall?.[2]).toBe('function');

    act(() => {
      continueCall?.[2]({
        ok: true,
        playerView: makeActivePlayerView({
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
              name: 'Bot',
              cardCount: 3,
              isConnected: true,
              isHost: false,
              isBot: true,
              calledLolos: false,
              afkWarnings: 0,
              isEliminated: false,
              isSpectator: false,
            },
          ],
          opponents: [
            {
              id: 'player-2',
              name: 'Bot',
              cardCount: 3,
              isConnected: true,
              isHost: false,
              isBot: true,
              calledLolos: false,
              afkWarnings: 0,
              isEliminated: false,
              isSpectator: false,
            },
          ],
          gameSettings: {
            diceMode: '3',
            showFractions: true,
            showPossibleResults: true,
            showSolveExercise: true,
            timerSetting: 'off',
            timerCustomSeconds: 60,
            botDifficulty: 'hard',
          },
        }),
      });
    });

    await waitFor(() => {
      expect(multiplayerCtx!.serverState?.gameSettings?.botDifficulty).toBe('hard');
      expect(multiplayerCtx!.disconnectChoice).toBeNull();
    });
  });
});
