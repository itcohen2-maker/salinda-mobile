import { gameReducer, initialState } from '../../index';
import type { GameAction, GameState } from '../../index';

const tf = (key: string): string => key;

function basePlayer(hand: GameState['players'][number]['hand']): GameState['players'][number] {
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

function preRollIdenticalState(overrides: Partial<GameState> = {}): GameState {
  const matchingCard = { id: 'n7', type: 'number' as const, value: 7 };
  const baseState: GameState = {
    ...initialState,
    phase: 'pre-roll',
    players: [basePlayer([matchingCard])],
    currentPlayerIndex: 0,
    discardPile: [{ id: 'top7', type: 'number', value: 7 }],
  };
  const next = { ...baseState, ...overrides };
  next.players = next.players.map((player, index) =>
    index === 0
      ? {
          ...player,
          courageMeterStep: next.courageMeterStep,
          courageMeterPercent: next.courageMeterPercent,
          courageRewardPulseId: next.courageRewardPulseId,
          courageCoins: next.courageCoins,
          courageDiscardSuccessStreak: next.courageDiscardSuccessStreak,
          lastCourageCoinsAwarded: next.lastCourageCoinsAwarded,
        }
      : player,
  );
  return next;
}

function solvedConfirmState(overrides: Partial<GameState> = {}): GameState {
  const staged = { id: 'n5', type: 'number' as const, value: 5 };
  const opA = { id: 'op-plus', type: 'operation' as const, operation: '+' as const };
  const opB = { id: 'op-minus', type: 'operation' as const, operation: '-' as const };
  const baseState: GameState = {
    ...initialState,
    phase: 'solved',
    players: [basePlayer([staged, opA, opB, { id: 'extra', type: 'number', value: 9 }])],
    currentPlayerIndex: 0,
    discardPile: [{ id: 'top3', type: 'number', value: 3 }],
    stagedCards: [staged],
    equationResult: 5,
    lastEquationDisplay: '1+2+2',
    equationHandSlots: [null, null],
    equationCommits: [
      { cardId: opA.id, position: 0, salindaAs: null },
      { cardId: opB.id, position: 1, salindaAs: null },
    ],
  };
  const next = { ...baseState, ...overrides };
  next.players = next.players.map((player, index) =>
    index === 0
      ? {
          ...player,
          courageMeterStep: next.courageMeterStep,
          courageMeterPercent: next.courageMeterPercent,
          courageRewardPulseId: next.courageRewardPulseId,
          courageCoins: next.courageCoins,
          courageDiscardSuccessStreak: next.courageDiscardSuccessStreak,
          lastCourageCoinsAwarded: next.lastCourageCoinsAwarded,
        }
      : player,
  );
  return next;
}

// ── rolledTripleThisTurn ──────────────────────────────────────────────────

describe('rolledTripleThisTurn flag', () => {
  it('is set to true when ROLL_DICE produces a triple', () => {
    const st: GameState = {
      ...initialState,
      phase: 'pre-roll',
      players: [basePlayer([])],
      currentPlayerIndex: 0,
    };
    const next = gameReducer(st, { type: 'ROLL_DICE', values: { die1: 4, die2: 4, die3: 4 } }, tf);
    expect(next.rolledTripleThisTurn).toBe(true);
  });

  it('is false when ROLL_DICE produces a non-triple', () => {
    const st: GameState = {
      ...initialState,
      phase: 'pre-roll',
      players: [basePlayer([])],
      currentPlayerIndex: 0,
    };
    const next = gameReducer(st, { type: 'ROLL_DICE', values: { die1: 1, die2: 2, die3: 3 } }, tf);
    expect(next.rolledTripleThisTurn).toBe(false);
  });

  it('is cleared to false by NEXT_TURN', () => {
    const st: GameState = {
      ...initialState,
      phase: 'turn-transition',
      players: [basePlayer([])],
      currentPlayerIndex: 0,
      rolledTripleThisTurn: true,
    };
    const next = gameReducer(st, { type: 'NEXT_TURN' }, tf);
    expect(next.rolledTripleThisTurn).toBe(false);
  });

  it('is cleared to false by endTurnLogic (via CONFIRM_STAGED path)', () => {
    const staged = { id: 'n5', type: 'number' as const, value: 5 };
    // Give the player enough cards so checkWin does not trigger (need > 2 remaining after play)
    const extras = [
      { id: 'ex1', type: 'number' as const, value: 1 },
      { id: 'ex2', type: 'number' as const, value: 2 },
      { id: 'ex3', type: 'number' as const, value: 3 },
    ];
    const st: GameState = {
      ...initialState,
      phase: 'solved',
      players: [basePlayer([staged, ...extras])],
      currentPlayerIndex: 0,
      discardPile: [{ id: 'top3', type: 'number', value: 3 }],
      stagedCards: [staged],
      equationResult: 5,
      lastEquationDisplay: '5=5',
      rolledTripleThisTurn: true,
    };
    const next = gameReducer(st, { type: 'CONFIRM_STAGED' }, tf);
    expect(next.rolledTripleThisTurn).toBe(false);
  });
});

// ── double bonus ──────────────────────────────────────────────────────────

describe('double bonus (triple + all-three-dice)', () => {
  it('sets lastCourageRewardReason to doubleBonus when triple was rolled and all dice used', () => {
    const staged = { id: 'n5', type: 'number' as const, value: 5 };
    const st: GameState = {
      ...initialState,
      phase: 'solved',
      players: [basePlayer([staged])],
      currentPlayerIndex: 0,
      discardPile: [{ id: 'top3', type: 'number', value: 3 }],
      stagedCards: [staged],
      equationResult: 5,
      lastEquationDisplay: '2+2+1=5',   // two operators → usedAllDice
      rolledTripleThisTurn: true,
    };
    const next = gameReducer(st, { type: 'CONFIRM_STAGED' }, tf);
    expect(next.lastCourageRewardReason).toBe('courage.reason.doubleBonus');
  });

  it('does NOT set doubleBonus when triple was rolled but only one die was used', () => {
    const staged = { id: 'n5', type: 'number' as const, value: 5 };
    const st: GameState = {
      ...initialState,
      phase: 'solved',
      players: [basePlayer([staged])],
      currentPlayerIndex: 0,
      discardPile: [{ id: 'top3', type: 'number', value: 3 }],
      stagedCards: [staged],
      equationResult: 5,
      lastEquationDisplay: '5=5',   // zero operators → usedAllDice false
      rolledTripleThisTurn: true,
    };
    const next = gameReducer(st, { type: 'CONFIRM_STAGED' }, tf);
    expect(next.lastCourageRewardReason).not.toBe('courage.reason.doubleBonus');
  });
});

describe('courage meter reducer rules', () => {
  it('progresses on PLAY_IDENTICAL', () => {
    const st = preRollIdenticalState({ courageMeterStep: 1, courageMeterPercent: 33, courageCoins: 0 });
    const next = gameReducer(st, { type: 'PLAY_IDENTICAL', card: st.players[0].hand[0] } as GameAction, tf);
    expect(next.courageMeterStep).toBe(2);
    expect(next.courageMeterPercent).toBe(66);
    expect(next.courageCoins).toBe(0);
  });

  it('advances only on successful CONFIRM_STAGED', () => {
    const s1 = solvedConfirmState({ courageMeterStep: 0, courageMeterPercent: 0, courageCoins: 0 });
    const n1 = gameReducer(s1, { type: 'CONFIRM_STAGED' } as GameAction, tf);
    expect(n1.courageMeterStep).toBe(1);
    expect(n1.courageMeterPercent).toBe(33);
    expect(n1.courageCoins).toBe(0);

    const s2 = solvedConfirmState({ courageMeterStep: 1, courageMeterPercent: 33, courageCoins: 0 });
    const n2 = gameReducer(s2, { type: 'CONFIRM_STAGED' } as GameAction, tf);
    expect(n2.courageMeterStep).toBe(2);
    expect(n2.courageMeterPercent).toBe(66);
  });

  it('auto-resets at full and grants 5 coins', () => {
    const st = solvedConfirmState({
      courageMeterStep: 2,
      courageMeterPercent: 66,
      courageCoins: 7,
      courageRewardPulseId: 4,
    });
    const next = gameReducer(st, { type: 'CONFIRM_STAGED' } as GameAction, tf);
    expect(next.courageMeterStep).toBe(0);
    expect(next.courageMeterPercent).toBe(0);
    expect(next.courageCoins).toBe(12);
    expect(next.turnCoinsEarned).toBe(5);
    expect(next.courageDiscardSuccessStreak).toBe(1);
    expect(next.courageRewardPulseId).toBe(5);
  });

  it('holds turn advancement until the meter animation completes', () => {
    const staged = { id: 'n5', type: 'number' as const, value: 5 };
    const opA = { id: 'op-plus', type: 'operation' as const, operation: '+' as const };
    const opB = { id: 'op-minus', type: 'operation' as const, operation: '-' as const };
    const st: GameState = {
      ...initialState,
      phase: 'solved',
      players: [
        {
          ...basePlayer([staged, opA, opB, { id: 'extra-1', type: 'number', value: 9 }, { id: 'extra-2', type: 'number', value: 8 }, { id: 'extra-3', type: 'number', value: 7 }]),
          courageMeterStep: 1,
          courageMeterPercent: 33,
        },
        { ...basePlayer([{ id: 'other', type: 'number', value: 4 }]), id: 1, name: 'P2' },
      ],
      currentPlayerIndex: 0,
      discardPile: [{ id: 'top3', type: 'number', value: 3 }],
      stagedCards: [staged],
      equationResult: 5,
      lastEquationDisplay: '1+2+2',
      equationHandSlots: [null, null],
      equationCommits: [
        { cardId: opA.id, position: 0, salindaAs: null },
        { cardId: opB.id, position: 1, salindaAs: null },
      ],
      hasPlayedCards: false,
    };

    const pending = gameReducer(st, { type: 'CONFIRM_STAGED' } as GameAction, tf);

    expect(pending.meterAnimationPending).toBe(true);
    expect(pending.phase).toBe('solved');
    expect(pending.currentPlayerIndex).toBe(0);
    expect(pending.pendingTurnState?.phase).toBe('turn-transition');
    expect(pending.pendingTurnState?.currentPlayerIndex).toBe(1);

    const settled = gameReducer(pending, { type: 'METER_ANIMATION_DONE' } as GameAction, tf);

    expect(settled.meterAnimationPending).toBe(false);
    expect(settled.pendingTurnState).toBeNull();
    expect(settled.phase).toBe('turn-transition');
    expect(settled.currentPlayerIndex).toBe(1);
  });

  it('clears turnCoinsEarned when the next turn begins', () => {
    const st: GameState = {
      ...initialState,
      phase: 'turn-transition',
      players: [basePlayer([])],
      currentPlayerIndex: 0,
      turnCoinsEarned: 1,
      lastCourageCoinsAwarded: true,
    };

    const next = gameReducer(st, { type: 'BEGIN_TURN' } as GameAction, tf);
    expect(next.turnCoinsEarned).toBe(0);
  });
});
