import { gameReducer, initialState } from '../../index';
import type { Card, GameAction, GameState } from '../../index';

const tf = (key: string): string => key;

function makeNumber(id: string, value: number): Card {
  return { id, type: 'number', value };
}

function makeOperation(id: string, operation: '+' | '-' | 'x' | '÷'): Card {
  return { id, type: 'operation', operation };
}

function basePlayer(hand: Card[]): GameState['players'][number] {
  return {
    id: 0,
    name: 'Solo',
    hand,
    hasOneCardLeft: false,
    isBot: false,
    courageMeterStep: 0,
    courageMeterPercent: 0,
    courageRewardPulseId: 0,
    courageCoins: 0,
    lastCourageCoinsAwarded: false,
    courageDiscardSuccessStreak: 0,
  };
}

function makeSoloStats(overrides: Partial<NonNullable<GameState['soloSessionStats']>> = {}): NonNullable<GameState['soloSessionStats']> {
  return {
    startedAtMs: Date.now(),
    finishedAtMs: null,
    durationMs: null,
    drawCount: 0,
    swapCount: 0,
    fullEquationCount: 0,
    slindaFromBankCount: 0,
    wildFromBankCount: 0,
    ...overrides,
  };
}

function startSoloGame(): GameState {
  return gameReducer(
    initialState,
    {
      type: 'START_GAME',
      mode: 'solo',
      players: [{ name: 'Solo' }],
      difficulty: 'full',
      fractions: true,
      showPossibleResults: true,
      showSolveExercise: true,
      timerSetting: 'off',
      timerCustomSeconds: 60,
    } as GameAction,
    tf,
  );
}

describe('solo mode reducer', () => {
  it('initializes a single-player local game with solo session stats', () => {
    const next = startSoloGame();

    expect(next.mode).toBe('solo');
    expect(next.players).toHaveLength(1);
    expect(next.botConfig).toBeNull();
    expect(next.openingDrawId).toBeNull();
    expect(next.soloSessionStats).toEqual(
      expect.objectContaining({
        drawCount: 0,
        swapCount: 0,
        fullEquationCount: 0,
        slindaFromBankCount: 0,
        wildFromBankCount: 0,
        finishedAtMs: null,
        durationMs: null,
      }),
    );
  });

  it('resets solo stats on PLAY_AGAIN while keeping solo mode', () => {
    const started = startSoloGame();
    const ended: GameState = {
      ...started,
      phase: 'game-over',
      soloSessionStats: makeSoloStats({
        drawCount: 4,
        swapCount: 2,
        fullEquationCount: 3,
        slindaFromBankCount: 1,
        wildFromBankCount: 1,
        finishedAtMs: Date.now(),
        durationMs: 9_000,
      }),
    };

    const next = gameReducer(ended, { type: 'PLAY_AGAIN' } as GameAction, tf);

    expect(next.mode).toBe('solo');
    expect(next.players).toHaveLength(1);
    expect(next.openingDrawId).toBeNull();
    expect(next.soloSessionStats).toEqual(
      expect.objectContaining({
        drawCount: 0,
        swapCount: 0,
        fullEquationCount: 0,
        slindaFromBankCount: 0,
        wildFromBankCount: 0,
        finishedAtMs: null,
        durationMs: null,
      }),
    );
  });

  it('counts only manual card draws in solo mode', () => {
    const state: GameState = {
      ...initialState,
      mode: 'solo',
      phase: 'pre-roll',
      players: [basePlayer([makeNumber('hand-1', 4)])],
      currentPlayerIndex: 0,
      drawPile: [makeNumber('draw-1', 7)],
      discardPile: [makeNumber('discard-top', 3)],
      soloSessionStats: makeSoloStats(),
    };

    const next = gameReducer(state, { type: 'DRAW_CARD' } as GameAction, tf);

    expect(next.soloSessionStats?.drawCount).toBe(1);
  });

  it('does not count timeout draws in solo mode', () => {
    const state: GameState = {
      ...initialState,
      mode: 'solo',
      phase: 'pre-roll',
      players: [basePlayer([makeNumber('hand-1', 4)])],
      currentPlayerIndex: 0,
      drawPile: [makeNumber('draw-1', 7)],
      discardPile: [makeNumber('discard-top', 3)],
      soloSessionStats: makeSoloStats(),
    };

    const next = gameReducer(state, { type: 'DRAW_CARD', reason: 'turn-timeout' } as GameAction, tf);

    expect(next.soloSessionStats?.drawCount).toBe(0);
  });

  it('keeps hand capped at 9 cards when drawing', () => {
    const fullHand = Array.from({ length: 9 }, (_, idx) => makeNumber(`hand-${idx + 1}`, idx + 1));
    const state: GameState = {
      ...initialState,
      mode: 'solo',
      phase: 'pre-roll',
      players: [basePlayer(fullHand)],
      currentPlayerIndex: 0,
      drawPile: [makeNumber('draw-1', 7)],
      discardPile: [makeNumber('discard-top', 3)],
      soloSessionStats: makeSoloStats(),
    };

    const next = gameReducer(state, { type: 'DRAW_CARD' } as GameAction, tf);

    expect(next.players[0]?.hand).toHaveLength(9);
  });

  it('counts only manual overflow swaps in solo mode', () => {
    const hand = [
      makeOperation('op-1', '+'),
      makeNumber('n-1', 1),
      makeNumber('n-2', 2),
      makeNumber('n-3', 3),
      makeNumber('n-4', 4),
      makeNumber('n-5', 5),
      makeNumber('n-6', 6),
      makeNumber('n-7', 7),
      makeNumber('n-8', 8),
    ];
    const state: GameState = {
      ...initialState,
      mode: 'solo',
      phase: 'turn-transition',
      currentPlayerIndex: 0,
      players: [basePlayer(hand)],
      discardPile: [makeNumber('hidden', 13), makeNumber('top', 21)],
      overflowSwapPending: true,
      overflowSwapDeadlineAt: Date.now() + 10_000,
      overflowSwapCanUseUnderTop: true,
      soloSessionStats: makeSoloStats(),
    };

    const manualStaged = gameReducer(
      state,
      { type: 'RESOLVE_OVERFLOW_SWAP', handCardId: 'op-1' } as GameAction,
      tf,
    );
    const manualNext = gameReducer(
      manualStaged,
      { type: 'RESOLVE_OVERFLOW_SWAP', handCardId: 'op-1', pileChoice: 'top' } as GameAction,
      tf,
    );
    const autoStaged = gameReducer(
      state,
      { type: 'RESOLVE_OVERFLOW_SWAP' } as GameAction,
      tf,
    );
    const autoNext = gameReducer(
      autoStaged,
      { type: 'RESOLVE_OVERFLOW_SWAP' } as GameAction,
      tf,
    );

    expect(manualNext.soloSessionStats?.swapCount).toBe(1);
    expect(autoNext.soloSessionStats?.swapCount).toBe(0);
  });

  it('tracks only successful slinda and wild replacements from the bank in solo mode', () => {
    const hand = [
      makeNumber('n-1', 1),
      makeOperation('op-1', '+'),
      makeNumber('n-2', 2),
    ];
    const state: GameState = {
      ...initialState,
      mode: 'solo',
      phase: 'turn-transition',
      currentPlayerIndex: 0,
      players: [basePlayer(hand)],
      discardPile: [makeNumber('top', 9)],
      soloSessionStats: makeSoloStats(),
    };

    const afterSlindaMark = gameReducer(
      state,
      { type: 'MARK_SLINDA_ATTEMPT' } as GameAction,
      tf,
    );
    expect(afterSlindaMark.soloSessionStats?.slindaFromBankCount).toBe(0);

    const afterSlindaReplace = gameReducer(
      afterSlindaMark,
      { type: 'REPLACE_CARD_WITH_SLINDA', cardId: 'op-1' } as GameAction,
      tf,
    );
    expect(afterSlindaReplace.soloSessionStats?.slindaFromBankCount).toBe(1);
    expect(afterSlindaReplace.soloSessionStats?.wildFromBankCount).toBe(0);

    const afterWildMark = gameReducer(
      afterSlindaReplace,
      { type: 'MARK_WILD_ATTEMPT' } as GameAction,
      tf,
    );
    expect(afterWildMark.soloSessionStats?.wildFromBankCount).toBe(0);

    const afterWildReplace = gameReducer(
      afterWildMark,
      { type: 'REPLACE_CARD_WITH_WILD', cardId: 'n-1' } as GameAction,
      tf,
    );
    expect(afterWildReplace.soloSessionStats?.slindaFromBankCount).toBe(1);
    expect(afterWildReplace.soloSessionStats?.wildFromBankCount).toBe(1);
  });

  it('counts full-equation plays and finalizes the solo duration on win', () => {
    const staged = makeNumber('staged-5', 5);
    const slotA = makeOperation('op-plus', '+');
    const slotB = makeOperation('op-minus', '-');
    const state: GameState = {
      ...initialState,
      mode: 'solo',
      phase: 'solved',
      currentPlayerIndex: 0,
      players: [basePlayer([
        staged,
        slotA,
        slotB,
        makeNumber('extra-1', 1),
        makeNumber('extra-2', 2),
      ])],
      discardPile: [makeNumber('top', 9)],
      stagedCards: [staged],
      equationResult: 5,
      lastEquationDisplay: '2+2+1=5',
      equationHandSlots: [
        { card: slotA, salindaAs: null },
        { card: slotB, salindaAs: null },
      ],
      soloSessionStats: makeSoloStats({ startedAtMs: Date.now() - 4_500 }),
    };

    const next = gameReducer(state, { type: 'CONFIRM_STAGED' } as GameAction, tf);

    expect(next.soloSessionStats?.fullEquationCount).toBe(1);
    expect(next.phase).toBe('game-over');
    expect(next.soloSessionStats?.finishedAtMs).not.toBeNull();
    expect(next.soloSessionStats?.durationMs ?? 0).toBeGreaterThanOrEqual(4_000);
  });
});
