import type { Card, HostGameSettings, Player, ServerGameState } from '../../../shared/types';
import { beginTurn, getPlayerView, playIdentical } from '../gameEngine';

function makeNumber(id: string, value: number): Card {
  return { id, type: 'number', value };
}

function makePlayer(id: string, hand: Card[], overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    hand,
    hasOneCardLeft: false,
    isConnected: true,
    isHost: id === 'p1',
    isBot: false,
    afkWarnings: 0,
    isEliminated: false,
    isSpectator: false,
    locale: 'he',
    courageMeterPercent: 0,
    courageMeterStep: 0,
    courageDiscardSuccessStreak: 0,
    courageRewardPulseId: 0,
    courageCoins: 0,
    lastCourageCoinsAwarded: false,
    ...overrides,
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

function makeState(overrides: Partial<ServerGameState> = {}): ServerGameState {
  const p1Card = makeNumber('n7', 7);
  const p1 = makePlayer('p1', [p1Card, makeNumber('n8', 8), makeNumber('n9', 9), makeNumber('n10', 10)]);
  const p2 = makePlayer('p2', [makeNumber('n4', 4), makeNumber('n5', 5), makeNumber('n6', 6)]);
  return {
    roomCode: 'ROOM',
    phase: 'pre-roll',
    players: [p1, p2],
    currentPlayerIndex: 0,
    drawPile: [],
    discardPile: [makeNumber('top7', 7)],
    dice: null,
    diceRollSeq: 0,
    validTargets: [],
    equationResult: null,
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
    lastCourageRewardPlayerId: null,
    identicalCelebration: null,
    lastMoveMessage: null,
    lastDiscardCount: 0,
    lastEquationDisplay: null,
    difficulty: 'full',
    hostGameSettings,
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
    ...overrides,
    slindaAttemptedThisTurn: overrides.slindaAttemptedThisTurn ?? false,
    wildAttemptedThisTurn: overrides.wildAttemptedThisTurn ?? false,
    roundsPlayed: overrides.roundsPlayed ?? 0,
    equationCommits: overrides.equationCommits ?? [],
    tournamentTable: overrides.tournamentTable ?? [],
  };
}

describe('online courage meter', () => {
  it('rewards PLAY_IDENTICAL and persists the progress on the acting player', () => {
    const next = playIdentical(makeState(), 'n7');
    expect('error' in next).toBe(false);
    if ('error' in next) return;

    expect(next.phase).toBe('turn-transition');
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.players[0].courageMeterStep).toBe(1);
    expect(next.players[0].courageMeterPercent).toBe(33);
    expect(next.courageMeterStep).toBe(1);
    expect(next.courageMeterPercent).toBe(33);
  });

  it('awards exactly one coin when the meter fills in online play', () => {
    const next = playIdentical(
      makeState({
        courageMeterStep: 2,
        courageMeterPercent: 66,
        courageRewardPulseId: 4,
        courageCoins: 7,
        players: [
          makePlayer('p1', [makeNumber('n7', 7), makeNumber('n8', 8), makeNumber('n9', 9), makeNumber('n10', 10)], {
            courageMeterStep: 2,
            courageMeterPercent: 66,
            courageRewardPulseId: 4,
            courageCoins: 7,
          }),
          makePlayer('p2', [makeNumber('n4', 4), makeNumber('n5', 5), makeNumber('n6', 6)]),
        ],
      }),
      'n7',
    );
    expect('error' in next).toBe(false);
    if ('error' in next) return;

    expect(next.players[0].courageMeterStep).toBe(0);
    expect(next.players[0].courageMeterPercent).toBe(0);
    expect(next.players[0].courageCoins).toBe(8);
    expect(next.turnCoinsEarned).toBe(1);
    expect(next.lastCourageRewardPlayerId).toBe('p1');
  });

  it('loads the next player meter on BEGIN_TURN and filters reward events per viewer', () => {
    const turnTransition = makeState({
      phase: 'turn-transition',
      currentPlayerIndex: 1,
      players: [
        makePlayer('p1', [makeNumber('n1', 1)], {
          courageMeterStep: 2,
          courageMeterPercent: 66,
          courageRewardPulseId: 9,
          courageCoins: 3,
          lastCourageCoinsAwarded: true,
        }),
        makePlayer('p2', [makeNumber('n2', 2)], {
          courageMeterStep: 1,
          courageMeterPercent: 33,
          courageRewardPulseId: 2,
          courageCoins: 1,
        }),
      ],
      courageMeterStep: 2,
      courageMeterPercent: 66,
      courageRewardPulseId: 9,
      courageCoins: 3,
      turnCoinsEarned: 1,
      lastCourageCoinsAwarded: true,
      lastCourageRewardPlayerId: 'p1',
      message: '',
    });

    const p1View = getPlayerView(turnTransition, 'p1', 'he');
    const p2View = getPlayerView(turnTransition, 'p2', 'he');
    expect(p1View.courageMeterPercent).toBe(66);
    expect(p1View.turnCoinsEarned).toBe(1);
    expect(p1View.lastCourageCoinsAwarded).toBe(true);
    expect(p2View.courageMeterPercent).toBe(33);
    expect(p2View.turnCoinsEarned).toBe(0);
    expect(p2View.lastCourageCoinsAwarded).toBe(false);

    const afterBegin = beginTurn(turnTransition);
    expect(afterBegin.courageMeterStep).toBe(1);
    expect(afterBegin.courageMeterPercent).toBe(33);
    expect(afterBegin.courageCoins).toBe(1);
    expect(afterBegin.turnCoinsEarned).toBe(0);
    expect(afterBegin.lastCourageRewardPlayerId).toBeNull();
  });
});
