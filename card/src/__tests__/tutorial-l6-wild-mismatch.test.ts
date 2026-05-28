import { gameReducer, initialState } from '../../index';
import type { Card, GameAction, GameState } from '../../index';
import { tutorialBus } from '../tutorial/tutorialBus';

const tf = (key: string): string => key;

function makeNumber(id: string, value: number): Card {
  return { id, type: 'number', value };
}

function makeOperation(id: string, operation: '+' | '-' | 'x' | 'ֳ·'): Card {
  return { id, type: 'operation', operation };
}

function makeWild(id: string): Card {
  return { id, type: 'wild' };
}

function basePlayer(hand: Card[]): GameState['players'][number] {
  return {
    id: 0,
    name: 'Tutor',
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

describe('tutorial lesson 6 wild mismatch', () => {
  beforeEach(() => {
    tutorialBus._reset();
  });

  afterEach(() => {
    tutorialBus._reset();
  });

  it('shows the tutorial mismatch copy and keeps the staged cards selected', () => {
    tutorialBus.setL6WildStepMode(true);

    const wild = makeWild('wild-1');
    const eleven = makeNumber('num-11', 11);
    const twelve = makeNumber('num-12', 12);
    const wrongOp = makeOperation('op-x', 'x');
    const stagedCards = [wild, eleven, twelve, wrongOp];

    const state: GameState = {
      ...initialState,
      isTutorial: true,
      phase: 'solved',
      currentPlayerIndex: 0,
      players: [basePlayer(stagedCards)],
      equationResult: 7,
      stagedCards,
      message: '',
    };

    const next = gameReducer(state, { type: 'CONFIRM_STAGED' } as GameAction, tf);

    expect(next.message).toBe('tutorial.l6c.mismatch');
    expect(next.stagedCards).toEqual(stagedCards);
    expect(next.phase).toBe('solved');
    expect(next.hasPlayedCards).toBe(false);
  });
});
