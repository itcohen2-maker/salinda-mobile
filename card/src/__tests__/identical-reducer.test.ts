import { gameReducer, initialState } from '../../index';
import type { Card, GameAction, GameState } from '../../index';

const tf = (key: string): string => key;

function basePlayer(hand: Card[]): GameState['players'][number] {
  return {
    id: 0,
    name: 'P1',
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

function preRollState(topDiscard: Card, handCard: Card): GameState {
  return {
    ...initialState,
    phase: 'pre-roll',
    currentPlayerIndex: 0,
    players: [basePlayer([
      handCard,
      { id: 'extra-1', type: 'number', value: 9 },
      { id: 'extra-2', type: 'number', value: 11 },
      { id: 'extra-3', type: 'number', value: 13 },
    ])],
    discardPile: [topDiscard],
    notifications: [],
  };
}

describe('identical reducer rules', () => {
  it('allows a matching operation card as PLAY_IDENTICAL', () => {
    const topDiscard: Card = { id: 'top-plus', type: 'operation', operation: '+' };
    const handCard: Card = { id: 'hand-plus', type: 'operation', operation: '+' };
    const st = preRollState(topDiscard, handCard);

    const next = gameReducer(st, { type: 'PLAY_IDENTICAL', card: handCard } as GameAction, tf);

    expect(next.discardPile[next.discardPile.length - 1]).toEqual(handCard);
    expect(next.players[0].hand.some((card) => card.id === handCard.id)).toBe(false);
    expect(next.identicalAlert?.cardDisplay).toBe('+');
  });

  it('allows a joker on joker identical play', () => {
    const topDiscard: Card = { id: 'top-joker', type: 'joker' };
    const handCard: Card = { id: 'hand-joker', type: 'joker' };
    const st = preRollState(topDiscard, handCard);

    const next = gameReducer(st, { type: 'PLAY_IDENTICAL', card: handCard } as GameAction, tf);

    expect(next.discardPile[next.discardPile.length - 1]).toEqual(handCard);
    expect(next.players[0].hand.some((card) => card.id === handCard.id)).toBe(false);
    expect(next.identicalAlert?.cardDisplay).toBe('labels.joker');
  });
});
