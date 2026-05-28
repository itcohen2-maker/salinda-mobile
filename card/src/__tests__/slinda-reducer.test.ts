import { gameReducer, initialState } from '../../index';
import type { Card, GameAction, GameState } from '../../index';

const tf = (key: string): string => key;

function turnTransitionState(hand: Card[], overrides: Partial<GameState> = {}): GameState {
  return {
    ...initialState,
    phase: 'turn-transition',
    currentPlayerIndex: 0,
    players: [
      {
        id: 'p0',
        name: 'T',
        hand,
        hasOneCardLeft: false,
        isConnected: true,
        isHost: true,
        isBot: false,
        afkWarnings: 0,
        isEliminated: false,
        isSpectator: false,
        locale: 'he',
      },
    ],
    discardPile: [],
    hasPlayedCards: false,
    selectedCards: [],
    equationHandSlots: [null, null],
    equationHandPick: null,
    ...overrides,
  };
}

describe('slinda replacement reducer', () => {
  it('marks the slinda attempt and resets it on the next turn transition', () => {
    const numberCard: Card = { id: 'n1', type: 'number', value: 7 };
    const attempted = gameReducer(
      turnTransitionState([numberCard]),
      { type: 'MARK_SLINDA_ATTEMPT' } as GameAction,
      tf,
    );

    expect(attempted.slindaAttemptedThisTurn).toBe(true);

    const nextTurn = gameReducer(
      { ...attempted, hasPlayedCards: true },
      { type: 'END_TURN' } as GameAction,
      tf,
    );

    expect(nextTurn.phase).toBe('turn-transition');
    expect(nextTurn.slindaAttemptedThisTurn).toBe(false);
    expect(nextTurn.wildAttemptedThisTurn).toBe(false);
  });

  it('marks the wild attempt and resets it on the next turn transition', () => {
    const numberCard: Card = { id: 'n1', type: 'number', value: 7 };
    const attempted = gameReducer(
      turnTransitionState([numberCard]),
      { type: 'MARK_WILD_ATTEMPT' } as GameAction,
      tf,
    );

    expect(attempted.wildAttemptedThisTurn).toBe(true);
    expect(attempted.slindaAttemptedThisTurn).toBe(false);

    const nextTurn = gameReducer(
      { ...attempted, hasPlayedCards: true },
      { type: 'END_TURN' } as GameAction,
      tf,
    );

    expect(nextTurn.phase).toBe('turn-transition');
    expect(nextTurn.wildAttemptedThisTurn).toBe(false);
    expect(nextTurn.slindaAttemptedThisTurn).toBe(false);
  });

  it('replaces the selected hand card with slinda and moves the old card to discard without marking a turn play', () => {
    const numberCard: Card = { id: 'n1', type: 'number', value: 7 };
    const operationCard: Card = { id: 'o1', type: 'operation', operation: '+' };
    const extraNumberCard: Card = { id: 'n2', type: 'number', value: 3 };
    const extraFractionCard: Card = { id: 'f1', type: 'fraction', fraction: '1/2' };
    const st = turnTransitionState([numberCard, operationCard, extraNumberCard, extraFractionCard]);

    const next = gameReducer(
      st,
      { type: 'REPLACE_CARD_WITH_SLINDA', cardId: 'o1' } as GameAction,
      tf,
    );

    expect(next.players[0].hand).toHaveLength(4);
    expect(next.players[0].hand[0]).toEqual(numberCard);
    expect(next.players[0].hand[1].type).toBe('joker');
    expect(next.players[0].hand[1].id).not.toBe('o1');
    expect(next.players[0].hand[2]).toEqual(extraNumberCard);
    expect(next.players[0].hand[3]).toEqual(extraFractionCard);
    expect(next.discardPile[next.discardPile.length - 1]).toEqual(operationCard);
    expect(next.hasPlayedCards).toBe(false);
    expect(next.selectedCards).toEqual([]);
    expect(next.equationHandSlots).toEqual([null, null]);
    expect(next.equationHandPick).toBeNull();
    expect(next.slindaAttemptedThisTurn).toBe(true);
    expect(next.wildAttemptedThisTurn).toBe(false);
  });

  it('does not change hand size when slinda replaces an existing card', () => {
    const numberCard: Card = { id: 'n1', type: 'number', value: 7 };
    const operationCard: Card = { id: 'o1', type: 'operation', operation: '+' };
    const extraNumberCard: Card = { id: 'n2', type: 'number', value: 3 };
    const st = turnTransitionState([numberCard, operationCard, extraNumberCard]);

    const next = gameReducer(
      st,
      { type: 'REPLACE_CARD_WITH_SLINDA', cardId: 'o1' } as GameAction,
      tf,
    );

    expect(next.phase).toBe('turn-transition');
    expect(next.winner).toBeNull();
    expect(next.players[0].hand).toHaveLength(3);
    expect(next.discardPile[next.discardPile.length - 1]).toEqual(operationCard);
  });

  it('replaces the selected hand card with wild and moves the old card to discard without marking slinda usage', () => {
    const numberCard: Card = { id: 'n1', type: 'number', value: 7 };
    const operationCard: Card = { id: 'o1', type: 'operation', operation: '+' };
    const extraNumberCard: Card = { id: 'n2', type: 'number', value: 3 };
    const st = turnTransitionState([numberCard, operationCard, extraNumberCard]);

    const next = gameReducer(
      st,
      { type: 'REPLACE_CARD_WITH_WILD', cardId: 'o1' } as GameAction,
      tf,
    );

    expect(next.players[0].hand).toHaveLength(3);
    expect(next.players[0].hand[1].type).toBe('wild');
    expect(next.players[0].hand[1].id).not.toBe('o1');
    expect(next.discardPile[next.discardPile.length - 1]).toEqual(operationCard);
    expect(next.hasPlayedCards).toBe(false);
    expect(next.selectedCards).toEqual([]);
    expect(next.equationHandSlots).toEqual([null, null]);
    expect(next.equationHandPick).toBeNull();
    expect(next.wildAttemptedThisTurn).toBe(true);
    expect(next.slindaAttemptedThisTurn).toBe(false);
  });

  it('lets slinda and wild both be used in the same turn transition, each once', () => {
    const numberCard: Card = { id: 'n1', type: 'number', value: 7 };
    const operationCard: Card = { id: 'o1', type: 'operation', operation: '+' };
    const extraNumberCard: Card = { id: 'n2', type: 'number', value: 3 };
    const extraFractionCard: Card = { id: 'f1', type: 'fraction', fraction: '1/2' };
    const st = turnTransitionState([numberCard, operationCard, extraNumberCard, extraFractionCard]);

    const afterSlindaMark = gameReducer(
      st,
      { type: 'MARK_SLINDA_ATTEMPT' } as GameAction,
      tf,
    );
    const afterSlindaReplace = gameReducer(
      afterSlindaMark,
      { type: 'REPLACE_CARD_WITH_SLINDA', cardId: 'o1' } as GameAction,
      tf,
    );
    const wildTargetCardId = afterSlindaReplace.players[0].hand.find((card) => card.type === 'number' && card.id !== 'n1')?.id;

    expect(wildTargetCardId).toBeDefined();

    const afterWildMark = gameReducer(
      afterSlindaReplace,
      { type: 'MARK_WILD_ATTEMPT' } as GameAction,
      tf,
    );
    const afterWildReplace = gameReducer(
      afterWildMark,
      { type: 'REPLACE_CARD_WITH_WILD', cardId: wildTargetCardId! } as GameAction,
      tf,
    );

    expect(afterWildReplace.slindaAttemptedThisTurn).toBe(true);
    expect(afterWildReplace.wildAttemptedThisTurn).toBe(true);
    expect(afterWildReplace.players[0].hand.some((card) => card.type === 'joker')).toBe(true);
    expect(afterWildReplace.players[0].hand.some((card) => card.type === 'wild')).toBe(true);
  });

  it('is a no-op when the selected card is not in the current player hand', () => {
    const numberCard: Card = { id: 'n1', type: 'number', value: 4 };
    const st = turnTransitionState([numberCard]);

    const next = gameReducer(
      st,
      { type: 'REPLACE_CARD_WITH_SLINDA', cardId: 'missing' } as GameAction,
      tf,
    );

    expect(next).toEqual(st);
  });
});
