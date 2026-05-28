import { gameReducer, initialState } from '../../index';
import type { GameAction, GameState, Card } from '../../index';

const tf = (key: string): string => key;

function buildTurnTransitionState(overrides: Partial<GameState> = {}): GameState {
  const topDiscard: Card = { id: 'd0', type: 'number', value: 5 };
  const drawCard: Card = { id: 'draw-1', type: 'number', value: 8 };
  const humanCard: Card = { id: 'h1', type: 'number', value: 3 };
  const botCard: Card = { id: 'b1', type: 'number', value: 4 };

  return {
    ...initialState,
    phase: 'turn-transition',
    currentPlayerIndex: 0,
    players: [
      {
        id: 0,
        name: 'Dana',
        hand: [humanCard],
        hasOneCardLeft: false,
        isBot: false,
      },
      {
        id: 1,
        name: 'Bot',
        hand: [botCard],
        hasOneCardLeft: false,
        isBot: true,
      },
    ],
    drawPile: [drawCard],
    discardPile: [topDiscard],
    hasPlayedCards: false,
    hasDrawnCard: false,
    ...overrides,
  };
}

describe('turn-transition reporting', () => {
  it('marks timeout auto-draw as a no-move timeout instead of a manual draw', () => {
    const state = buildTurnTransitionState();

    const next = gameReducer(
      state,
      { type: 'DRAW_CARD', reason: 'turn-timeout' } as GameAction,
      tf,
    );

    expect(next.currentPlayerIndex).toBe(1);
    expect(next.phase).toBe('turn-transition');
    expect(next.lastMoveMessage).toBe('toast.endTurnNoMove');
    expect(next.players[0].hand).toHaveLength(2);
  });

  it('uses a name-less no-move message in solo mode', () => {
    const state = buildTurnTransitionState({
      mode: 'solo',
      players: [
        {
          id: 0,
          name: 'Solo',
          hand: [{ id: 'h1', type: 'number', value: 3 }],
          hasOneCardLeft: false,
          isBot: false,
        },
      ],
    });

    const next = gameReducer(
      state,
      { type: 'DRAW_CARD', reason: 'turn-timeout' } as GameAction,
      tf,
    );

    expect(next.currentPlayerIndex).toBe(0);
    expect(next.phase).toBe('turn-transition');
    expect(next.lastMoveMessage).toBe('toast.endTurnNoMoveSolo');
    expect(next.players[0].hand).toHaveLength(2);
  });

  it('keeps manual draw reporting for an intentional draw action', () => {
    const state = buildTurnTransitionState();

    const next = gameReducer(
      state,
      { type: 'DRAW_CARD' } as GameAction,
      tf,
    );

    expect(next.currentPlayerIndex).toBe(1);
    expect(next.phase).toBe('turn-transition');
    expect(next.lastMoveMessage).toBe('toast.drawOne');
    expect(next.players[0].hand).toHaveLength(2);
  });

  it('still advances the turn when a solo forfeit draw finds no cards left', () => {
    const state = buildTurnTransitionState({
      mode: 'solo',
      phase: 'building',
      players: [
        {
          id: 0,
          name: 'Solo',
          hand: [{ id: 'h1', type: 'number', value: 3 }],
          hasOneCardLeft: false,
          isBot: false,
        },
      ],
      currentPlayerIndex: 0,
      drawPile: [],
      discardPile: [{ id: 'top-only', type: 'number', value: 5 }],
    });

    const next = gameReducer(
      state,
      { type: 'DRAW_CARD' } as GameAction,
      tf,
    );

    expect(next.currentPlayerIndex).toBe(0);
    expect(next.phase).toBe('turn-transition');
    expect(next.hasDrawnCard).toBe(false);
    expect(next.players[0].hand).toHaveLength(1);
    expect(next.lastMoveMessage).toBeNull();
  });
});
