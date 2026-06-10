// card/src/bot/__tests__/bot-freeze-regression.test.ts
//
// Regression: the local "Salinda" bot froze the game when handleBotPreRoll
// chose `playIdentical` in a situation where the PLAY_IDENTICAL reducer
// rejects it (index.tsx): after a fraction resolution (fractionAttackResolved)
// or once two identicals have been chained (consecutiveIdenticalPlays >= 2).
// The rejected action is a no-op, so the bot re-decided it forever and the
// turn never ended. decideBotAction must NOT return playIdentical in those
// states — it must fall through to playFractionAttack / rollDice so the turn
// progresses.

import { decideBotAction } from '../botBrain';
import { makeFixtureState, makePlayer, makeCard, resetCardSeq } from '../fixtures';

beforeEach(() => {
  resetCardSeq();
});

describe('bot freeze regression — identical play blocked by reducer guards', () => {
  test('does NOT play identical when fractionAttackResolved is true (must roll)', () => {
    const discardCard = makeCard('number', 5);
    const identicalCard = makeCard('number', 5); // would match — but identical is blocked
    const botPlayer = makePlayer(0, 'Bot', [identicalCard]);

    const state = makeFixtureState({
      phase: 'pre-roll',
      players: [botPlayer],
      currentPlayerIndex: 0,
      discardPile: [discardCard],
      pendingFractionTarget: null,
      fractionAttackResolved: true,
    });

    const result = decideBotAction(state, 'hard');

    expect(result).not.toBeNull();
    expect(result?.kind).not.toBe('playIdentical');
    // No matching fraction in hand → falls through to rollDice (turn progresses).
    expect(result).toEqual({ kind: 'rollDice' });
  });

  test('does NOT play identical once two identicals are chained (consecutiveIdenticalPlays >= 2)', () => {
    const discardCard = makeCard('number', 7);
    const identicalCard = makeCard('number', 7); // would match — but chain limit reached
    const botPlayer = makePlayer(0, 'Bot', [identicalCard]);

    const state = makeFixtureState({
      phase: 'pre-roll',
      players: [botPlayer],
      currentPlayerIndex: 0,
      discardPile: [discardCard],
      pendingFractionTarget: null,
      consecutiveIdenticalPlays: 2,
    });

    const result = decideBotAction(state, 'hard');

    expect(result).not.toBeNull();
    expect(result?.kind).not.toBe('playIdentical');
    expect(result).toEqual({ kind: 'rollDice' });
  });

  test('when identical is blocked, still takes an accepted action (fraction attack) instead of freezing', () => {
    const discardCard = makeCard('number', 6);
    const identicalCard = makeCard('number', 6); // matches discard — but blocked
    const fractionCard = makeCard('fraction', undefined, '1/2'); // 6 divisible by 2 → valid attack
    const botPlayer = makePlayer(0, 'Bot', [identicalCard, fractionCard]);

    const state = makeFixtureState({
      phase: 'pre-roll',
      players: [botPlayer],
      currentPlayerIndex: 0,
      discardPile: [discardCard],
      pendingFractionTarget: null,
      fractionAttackResolved: true,
    });

    const result = decideBotAction(state, 'hard');

    expect(result?.kind).not.toBe('playIdentical');
    expect(result).toEqual({ kind: 'playFractionAttack', cardId: fractionCard.id });
  });

  test('control: still plays identical normally when no guard is active', () => {
    const discardCard = makeCard('number', 5);
    const identicalCard = makeCard('number', 5);
    const botPlayer = makePlayer(0, 'Bot', [identicalCard]);

    const state = makeFixtureState({
      phase: 'pre-roll',
      players: [botPlayer],
      currentPlayerIndex: 0,
      discardPile: [discardCard],
      pendingFractionTarget: null,
      fractionAttackResolved: false,
      consecutiveIdenticalPlays: 0,
    });

    const result = decideBotAction(state, 'hard');

    expect(result).toEqual({ kind: 'playIdentical', cardId: identicalCard.id });
  });
});
