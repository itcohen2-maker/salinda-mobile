import { gameReducer, initialState } from '../../index';
import type { Card, GameAction, GameState } from '../../index';

const tf = (key: string): string => key;

function makeNumber(id: string, value: number): Card {
  return { id, type: 'number', value };
}

function makeOperation(id: string, operation: '+' | '-' | 'x' | '÷'): Card {
  return { id, type: 'operation', operation: operation === '÷' ? 'ֳ·' : operation };
}

function makeOverflowHand(): Card[] {
  return [
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
}

function makeTurnTransitionState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...initialState,
    phase: 'turn-transition',
    currentPlayerIndex: 0,
    players: [
      {
        id: 'p0',
        name: 'T',
        hand: makeOverflowHand(),
        calledLolos: false,
        isConnected: true,
        isHost: true,
        isBot: false,
        afkWarnings: 0,
        isEliminated: false,
        isSpectator: false,
        locale: 'he',
      },
    ],
    discardPile: [makeNumber('d-bottom', 8), makeNumber('d-top', 11)],
    overflowSwapPending: true,
    overflowSwapDeadlineAt: Date.now() + 10_000,
    overflowSwapCanUseUnderTop: true,
    overflowSwapStage: 'hand',
    overflowSwapSelectedPileChoice: null,
    overflowSwapSelectedHandCardId: null,
    ...overrides,
  };
}

describe('overflow swap reducer', () => {
  it('enters forced overflow swap when the next player reaches turn-transition with 9 cards', () => {
    const state: GameState = {
      ...initialState,
      phase: 'pre-roll',
      currentPlayerIndex: 0,
      hasPlayedCards: true,
      players: [
        {
          id: 'p0',
          name: 'A',
          hand: [makeNumber('a-1', 1)],
          calledLolos: false,
          isConnected: true,
          isHost: true,
          isBot: false,
          afkWarnings: 0,
          isEliminated: false,
          isSpectator: false,
          locale: 'he',
        },
        {
          id: 'p1',
          name: 'B',
          hand: makeOverflowHand(),
          calledLolos: false,
          isConnected: true,
          isHost: false,
          isBot: false,
          afkWarnings: 0,
          isEliminated: false,
          isSpectator: false,
          locale: 'he',
        },
      ],
      discardPile: [makeNumber('stack-1', 5), makeNumber('stack-2', 7)],
    };

    const next = gameReducer(state, { type: 'END_TURN' } as GameAction, tf);

    expect(next.phase).toBe('turn-transition');
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.overflowSwapPending).toBe(true);
    expect(next.overflowSwapDeadlineAt).not.toBeNull();
    expect(next.overflowSwapCanUseUnderTop).toBe(true);
  });

  it('routes a full-hand manual draw through turn-transition so the swap UI can appear, then ends the turn', () => {
    const state: GameState = {
      ...initialState,
      mode: 'vs-bot',
      phase: 'building',
      currentPlayerIndex: 0,
      players: [
        {
          id: 0,
          name: 'Human',
          hand: makeOverflowHand(),
          calledLolos: false,
          isConnected: true,
          isHost: true,
          isBot: false,
          afkWarnings: 0,
          isEliminated: false,
          isSpectator: false,
          locale: 'he',
        },
        {
          id: 1,
          name: 'Bot',
          hand: [makeNumber('bot-1', 4)],
          calledLolos: false,
          isConnected: true,
          isHost: false,
          isBot: true,
          afkWarnings: 0,
          isEliminated: false,
          isSpectator: false,
          locale: 'he',
        },
      ],
      botConfig: { difficulty: 'hard', playerIds: [1] },
      drawPile: [makeNumber('draw-1', 10)],
      discardPile: [makeNumber('d-bottom', 8), makeNumber('d-top', 11)],
    };

    const pendingSwap = gameReducer(
      state,
      { type: 'DRAW_CARD' } as GameAction,
      tf,
    );

    expect(pendingSwap.phase).toBe('turn-transition');
    expect(pendingSwap.currentPlayerIndex).toBe(0);
    expect(pendingSwap.hasDrawnCard).toBe(true);
    expect(pendingSwap.overflowSwapPending).toBe(true);

    const staged = gameReducer(
      pendingSwap,
      { type: 'RESOLVE_OVERFLOW_SWAP', handCardId: 'op-1' } as GameAction,
      tf,
    );
    expect(staged.overflowSwapStage).toBe('pile');

    const resolved = gameReducer(
      staged,
      { type: 'RESOLVE_OVERFLOW_SWAP', pileChoice: 'top' } as GameAction,
      tf,
    );

    expect(resolved.overflowSwapPending).toBe(false);
    expect(resolved.currentPlayerIndex).toBe(1);
    expect(resolved.phase).toBe('turn-transition');
  });

  it('swaps with the visible top card and auto-begins the turn', () => {
    const state = makeTurnTransitionState();

    const staged = gameReducer(
      state,
      { type: 'RESOLVE_OVERFLOW_SWAP', handCardId: 'op-1' } as GameAction,
      tf,
    );
    expect(staged.overflowSwapStage).toBe('pile');
    const next = gameReducer(
      staged,
      { type: 'RESOLVE_OVERFLOW_SWAP', pileChoice: 'top' } as GameAction,
      tf,
    );

    expect(next.phase).toBe('pre-roll');
    expect(next.overflowSwapPending).toBe(false);
    expect(next.players[0].hand.some((card) => card.id === 'd-top')).toBe(true);
    expect(next.discardPile[next.discardPile.length - 1]).toEqual(makeOperation('op-1', '+'));
  });

  it('swaps with the hidden under-top card while keeping the visible top card in place', () => {
    const topCard = makeNumber('visible-top', 21);
    const hiddenCard = makeNumber('hidden-under-top', 13);
    const state = makeTurnTransitionState({
      discardPile: [hiddenCard, topCard],
    });

    const staged = gameReducer(
      state,
      { type: 'RESOLVE_OVERFLOW_SWAP', handCardId: 'op-1' } as GameAction,
      tf,
    );
    expect(staged.overflowSwapStage).toBe('pile');
    const next = gameReducer(
      staged,
      { type: 'RESOLVE_OVERFLOW_SWAP', pileChoice: 'underTop' } as GameAction,
      tf,
    );

    expect(next.phase).toBe('pre-roll');
    expect(next.players[0].hand.some((card) => card.id === 'hidden-under-top')).toBe(true);
    expect(next.discardPile[next.discardPile.length - 1]).toEqual(topCard);
    expect(next.discardPile[next.discardPile.length - 2]).toEqual(makeOperation('op-1', '+'));
  });

  it('auto-resolves timeout in two stages (hand then pile)', () => {
    const state = makeTurnTransitionState();
    const topCard = state.discardPile[state.discardPile.length - 1];

    const afterHandTimeout = gameReducer(
      state,
      { type: 'RESOLVE_OVERFLOW_SWAP' } as GameAction,
      tf,
    );
    expect(afterHandTimeout.phase).toBe('turn-transition');
    expect(afterHandTimeout.overflowSwapStage).toBe('pile');
    expect(afterHandTimeout.overflowSwapSelectedHandCardId).toBe('op-1');

    const next = gameReducer(
      afterHandTimeout,
      { type: 'RESOLVE_OVERFLOW_SWAP' } as GameAction,
      tf,
    );

    expect(next.phase).toBe('pre-roll');
    expect(next.players[0].hand.some((card) => card.id === topCard.id)).toBe(true);
    expect(next.discardPile[next.discardPile.length - 1]).toEqual(makeOperation('op-1', '+'));
    expect(next.lastMoveMessage).toBeNull();
  });

  it('blocks the hidden under-top choice when the discard pile has only one card', () => {
    const singleDiscardState = makeTurnTransitionState({
      discardPile: [makeNumber('lonely-top', 12)],
      overflowSwapCanUseUnderTop: false,
    });
    const staged = gameReducer(
      singleDiscardState,
      { type: 'RESOLVE_OVERFLOW_SWAP', handCardId: 'op-1' } as GameAction,
      tf,
    );

    const next = gameReducer(
      staged,
      { type: 'RESOLVE_OVERFLOW_SWAP', pileChoice: 'underTop' } as GameAction,
      tf,
    );

    expect(next).toEqual(staged);
  });

  it('strips resolvedValue when a wild card enters the hand from the discard pile', () => {
    const wildOnPile: Card = { id: 'wild-top', type: 'wild', resolvedValue: 7 };
    const state = makeTurnTransitionState({ discardPile: [makeNumber('d-bottom', 8), wildOnPile] });

    const staged = gameReducer(
      state,
      { type: 'RESOLVE_OVERFLOW_SWAP', handCardId: 'op-1' } as GameAction,
      tf,
    );
    const next = gameReducer(
      staged,
      { type: 'RESOLVE_OVERFLOW_SWAP', pileChoice: 'top' } as GameAction,
      tf,
    );

    const wildInHand = next.players[0].hand.find((c) => c.id === 'wild-top');
    expect(wildInHand).toBeDefined();
    expect(wildInHand?.resolvedValue).toBeUndefined();
  });
});
