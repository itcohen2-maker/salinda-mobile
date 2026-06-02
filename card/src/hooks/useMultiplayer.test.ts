import type { PlayerView } from '../../shared/types';
import { __actionToSocketEvent, __playerViewToGameState } from './useMultiplayer';

function makePlayerView(overrides: Partial<PlayerView> = {}): PlayerView {
  return {
    roomCode: '1234',
    phase: 'turn-transition',
    myHand: [],
    myPlayerId: 'p1',
    opponents: [
      {
        id: 'p2',
        name: 'Bob',
        cardCount: 3,
        isConnected: true,
        isHost: false,
        isBot: false,
        hasOneCardLeft: false,
        afkWarnings: 0,
        isEliminated: false,
        isSpectator: false,
      },
    ],
    currentPlayerIndex: 0,
    players: [
      {
        id: 'p1',
        name: 'Alice',
        cardCount: 4,
        isConnected: true,
        isHost: true,
        isBot: false,
        hasOneCardLeft: false,
        afkWarnings: 0,
        isEliminated: false,
        isSpectator: false,
      },
      {
        id: 'p2',
        name: 'Bob',
        cardCount: 3,
        isConnected: false,
        isHost: false,
        isBot: false,
        hasOneCardLeft: false,
        afkWarnings: 0,
        isEliminated: false,
        isSpectator: false,
      },
    ],
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

describe('playerViewToGameState', () => {
  it('clamps an out-of-range current player index after a roster change', () => {
    const state = __playerViewToGameState(
      makePlayerView({
        currentPlayerIndex: 5,
      }),
    );

    expect(state.currentPlayerIndex).toBe(1);
    expect(state.players).toHaveLength(2);
  });

  it('maps overflow swap wire fields into local game state', () => {
    const state = __playerViewToGameState(
      makePlayerView({
        overflowSwapPending: true,
        overflowSwapDeadlineAt: 123456789,
        overflowSwapCanUseUnderTop: true,
      }),
    );

    expect(state.overflowSwapPending).toBe(true);
    expect(state.overflowSwapDeadlineAt).toBe(123456789);
    expect(state.overflowSwapCanUseUnderTop).toBe(true);
  });

  it('maps turn coin rewards into local game state', () => {
    const state = __playerViewToGameState(
      makePlayerView({
        turnCoinsEarned: 5,
        lastCourageCoinsAwarded: true,
      }),
    );

    expect(state.turnCoinsEarned).toBe(5);
    expect(state.lastCourageCoinsAwarded).toBe(true);
  });

  it('maps online meter fields onto the local player entry', () => {
    const state = __playerViewToGameState(
      makePlayerView({
        players: [
          {
            id: 'p1',
            name: 'Alice',
            cardCount: 4,
            isConnected: true,
            isHost: true,
            isBot: false,
            hasOneCardLeft: false,
            afkWarnings: 0,
            isEliminated: false,
            isSpectator: false,
            courageMeterPercent: 66,
            courageMeterStep: 2,
            courageRewardPulseId: 7,
            courageCoins: 3,
            lastCourageCoinsAwarded: true,
          },
          {
            id: 'p2',
            name: 'Bob',
            cardCount: 3,
            isConnected: false,
            isHost: false,
            isBot: false,
            hasOneCardLeft: false,
            afkWarnings: 0,
            isEliminated: false,
            isSpectator: false,
          },
        ],
      }),
    );

    expect(state.players[0].courageMeterPercent).toBe(66);
    expect(state.players[0].courageMeterStep).toBe(2);
    expect(state.players[0].courageRewardPulseId).toBe(7);
    expect(state.players[0].courageCoins).toBe(3);
    expect(state.players[0].lastCourageCoinsAwarded).toBe(true);
  });

  it('suppresses timeout and afk summary text from the online mockup bubble', () => {
    const state = __playerViewToGameState(
      makePlayerView({
        lastMoveMessage: 'Alice ran out of time',
        lastMoveMessageKey: 'toast.turnTimeoutEnded',
        lastDiscardCount: 0,
      }),
    );

    expect(state.lastMoveMessage).toBeNull();
  });

  it('keeps regular move summaries when a turn actually discarded cards', () => {
    const state = __playerViewToGameState(
      makePlayerView({
        lastMoveMessage: 'Alice played 12',
        lastMoveMessageKey: 'toast.equationPlayed',
        lastDiscardCount: 1,
      }),
    );

    expect(state.lastMoveMessage).toBe('Alice played 12');
  });

  it('preserves a 60-second online timer and its server deadline', () => {
    const state = __playerViewToGameState(
      makePlayerView({
        gameSettings: {
          diceMode: '3',
          showFractions: true,
          showPossibleResults: true,
          showSolveExercise: true,
          timerSetting: '60',
          timerCustomSeconds: 60,
        },
        turnDeadlineAt: 80_000,
      }),
    );

    expect(state.timerSetting).toBe('60');
    expect(state.turnDeadlineAt).toBe(80_000);
  });
});

describe('actionToSocketEvent', () => {
  it('sends both equationCommits and legacy equationCommit for a single committed operator', () => {
    const commit = { cardId: 'op-1', position: 0 as const, salindaAs: null };
    const event = __actionToSocketEvent({
      type: 'CONFIRM_EQUATION',
      result: 7,
      equationDisplay: '3 + 4 = 7',
      equationCommits: [commit],
    });

    expect(event).toEqual({
      event: 'confirm_equation',
      data: {
        result: 7,
        equationDisplay: '3 + 4 = 7',
        equationCommits: [commit],
        equationCommit: commit,
      },
    });
  });

  it('preserves legacy single-commit payloads when only equationCommit is provided', () => {
    const commit = { cardId: 'salinda-1', position: 1 as const, salindaAs: '+' };
    const event = __actionToSocketEvent({
      type: 'CONFIRM_EQUATION',
      result: 9,
      equationDisplay: '4 + 5 = 9',
      equationCommit: commit,
    });

    expect(event).toEqual({
      event: 'confirm_equation',
      data: {
        result: 9,
        equationDisplay: '4 + 5 = 9',
        equationCommits: [commit],
        equationCommit: commit,
      },
    });
  });
});
