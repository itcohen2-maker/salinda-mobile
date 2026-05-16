import type { Card, HostGameSettings, Player, ServerGameState } from '../../../shared/types';
import { drawCard, forceTurnTimeout, resolveOverflowSwap, withOnlineTurnDeadline } from '../gameEngine';

function makeNumber(id: string, value: number): Card {
  return { id, type: 'number', value };
}

function makeOperation(id: string, operation: NonNullable<Card['operation']>): Card {
  return { id, type: 'operation', operation };
}

function makePlayer(id: string, hand: Card[]): Player {
  return {
    id,
    name: id,
    hand,
    calledLolos: false,
    isConnected: true,
    isHost: true,
    isBot: false,
    afkWarnings: 0,
    isEliminated: false,
    isSpectator: false,
    locale: 'he',
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

function makeState(): ServerGameState {
  return {
    roomCode: 'ROOM',
    phase: 'turn-transition',
    players: [
      makePlayer('p1', [
        makeOperation('op-1', '+'),
        makeNumber('n-1', 1),
        makeNumber('n-2', 2),
        makeNumber('n-3', 3),
        makeNumber('n-4', 4),
        makeNumber('n-5', 5),
        makeNumber('n-6', 6),
        makeNumber('n-7', 7),
        makeNumber('n-8', 8),
      ]),
    ],
    currentPlayerIndex: 0,
    drawPile: [],
    discardPile: [makeNumber('hidden', 13), makeNumber('top', 21)],
    dice: null,
    diceRollSeq: 0,
    validTargets: [],
    equationResult: null,
    stagedCards: [],
    pendingFractionTarget: null,
    fractionPenalty: 0,
    fractionAttackResolved: false,
    hasPlayedCards: false,
    hasDrawnCard: false,
    lastCardValue: null,
    consecutiveIdenticalPlays: 0,
    courageMeterPercent: 0,
    courageMeterStep: 0,
    courageDiscardSuccessStreak: 0,
    courageRewardPulseId: 0,
    courageCoins: 0,
    lastCourageRewardReason: null,
    lastCourageCoinsAwarded: false,
    identicalCelebration: null,
    lastMoveMessage: null,
    lastDiscardCount: 0,
    lastEquationDisplay: null,
    difficulty: 'full',
    hostGameSettings,
    winner: null,
    message: '',
    openingDrawId: 'opening',
    turnDeadlineAt: null,
    overflowSwapPending: true,
    overflowSwapDeadlineAt: Date.now() + 10_000,
    overflowSwapCanUseUnderTop: true,
    overflowSwapStage: 'hand',
    overflowSwapSelectedPileChoice: null,
    overflowSwapSelectedHandCardId: null,
    slindaAttemptedThisTurn: false,
    wildAttemptedThisTurn: false,
    roundsPlayed: 0,
    equationCommits: [],
    botPendingStagedIds: null,
    tournamentTable: [{ playerIndex: 0, playerName: 'p1', wins: 0, losses: 0 }],
  };
}

describe('server overflow swap', () => {
  it('keeps hand capped at 9 cards when drawing', () => {
    const state: ServerGameState = {
      ...makeState(),
      phase: 'pre-roll',
      overflowSwapPending: false,
      overflowSwapStage: null,
      players: [
        makePlayer('p1', [
          makeNumber('n-1', 1),
          makeNumber('n-2', 2),
          makeNumber('n-3', 3),
          makeNumber('n-4', 4),
          makeNumber('n-5', 5),
          makeNumber('n-6', 6),
          makeNumber('n-7', 7),
          makeNumber('n-8', 8),
          makeNumber('n-9', 9),
        ]),
      ],
      drawPile: [makeNumber('draw-1', 10)],
    };

    const next = drawCard(state);
    expect('error' in next).toBe(false);
    if ('error' in next) return;
    expect(next.players[0]?.hand).toHaveLength(9);
  });

  it('resolves a top-card overflow swap and begins the turn', () => {
    const staged = resolveOverflowSwap(makeState(), 'op-1');
    expect('error' in staged).toBe(false);
    if ('error' in staged) return;
    expect(staged.overflowSwapStage).toBe('pile');

    const result = resolveOverflowSwap(staged, null, 'top');

    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.phase).toBe('pre-roll');
    expect(result.overflowSwapPending).toBe(false);
    expect(result.players[0].hand.some((card) => card.id === 'top')).toBe(true);
    expect(result.discardPile[result.discardPile.length - 1]).toEqual(makeOperation('op-1', '+'));
  });

  it('strips resolvedValue when a wild card enters the hand from the discard pile', () => {
    const wildOnPile: Card = { id: 'wild-top', type: 'wild', resolvedValue: 7 };
    const state = makeState();
    const stateWithWildTop = { ...state, discardPile: [makeNumber('hidden', 13), wildOnPile] };

    const staged = resolveOverflowSwap(stateWithWildTop, 'op-1');
    expect('error' in staged).toBe(false);
    if ('error' in staged) return;

    const result = resolveOverflowSwap(staged, null, 'top');
    expect('error' in result).toBe(false);
    if ('error' in result) return;

    const wildInHand = result.players[0].hand.find((c) => c.id === 'wild-top');
    expect(wildInHand).toBeDefined();
    expect(wildInHand?.resolvedValue).toBeUndefined();
  });

  it('auto-resolves overflow timeout in two sequential steps', () => {
    const afterHandTimeout = forceTurnTimeout(makeState());

    expect('error' in afterHandTimeout).toBe(false);
    if ('error' in afterHandTimeout) return;
    expect(afterHandTimeout.phase).toBe('turn-transition');
    expect(afterHandTimeout.overflowSwapStage).toBe('pile');
    expect(afterHandTimeout.overflowSwapSelectedHandCardId).toBe('op-1');

    const result = forceTurnTimeout(afterHandTimeout);

    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.phase).toBe('pre-roll');
    expect(result.overflowSwapPending).toBe(false);
    expect(result.players[0].hand.some((card) => card.id === 'top')).toBe(true);
    expect(result.discardPile[result.discardPile.length - 1]).toEqual(makeOperation('op-1', '+'));
    expect(result.lastMoveMessage).toEqual({
      key: 'toast.overflowSwapAutoResolved',
      params: { name: 'p1' },
    });
  });

  it('publishes a dedicated overflow deadline instead of the regular turn-transition timer', () => {
    const timed = withOnlineTurnDeadline(makeState());

    expect(timed.turnDeadlineAt).toBeNull();
    expect(timed.overflowSwapDeadlineAt).not.toBeNull();
    expect(timed.overflowSwapCanUseUnderTop).toBe(true);
  });
});
