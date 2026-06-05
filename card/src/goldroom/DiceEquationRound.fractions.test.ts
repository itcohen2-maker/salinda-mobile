import { GOLD_ROOM_SALINDA_EXERCISE, buildFractionLessonStages, buildFractionRound } from './DiceEquationRound';

function denom(fraction: string): number {
  return Number(fraction.split('/')[1]);
}

describe('buildFractionRound', () => {
  it('only pairs fraction attack cards with divisible pile numbers', () => {
    for (let i = 0; i < 500; i += 1) {
      const round = buildFractionRound();

      expect(round.attackPile % denom(round.attackFraction)).toBe(0);
    }
  });

  it('only starts defense challenges on divisible pile numbers', () => {
    for (let i = 0; i < 500; i += 1) {
      const round = buildFractionRound();

      expect(round.defensePile % denom(round.defenseFraction)).toBe(0);
    }
  });
});

describe('buildFractionLessonStages', () => {
  it('builds the 3 attack + 3 defense progression with growing hands', () => {
    const stages = buildFractionLessonStages();

    expect(stages.map((stage) => stage.kind)).toEqual(['attack', 'attack', 'attack', 'defense', 'defense', 'defense']);
    expect(stages.map((stage) => stage.hand.length)).toEqual([1, 3, 5, 4, 7, 5]);
  });

  it('keeps answers in hand without auto-centering every advanced stage', () => {
    for (let i = 0; i < 100; i += 1) {
      const stages = buildFractionLessonStages();

      for (const stage of stages) {
        const validIds = stage.validAnswerIds ?? [stage.answerId];
        expect(stage.hand.some((card) => validIds.includes(card.id))).toBe(true);
      }

      expect(stages[0].hand[Math.floor(stages[0].hand.length / 2)].id).toBe(stages[0].answerId);
      expect(stages[1].hand[Math.floor(stages[1].hand.length / 2)].id).toBe(stages[1].answerId);
      expect(stages[2].hand[Math.floor(stages[2].hand.length / 2)].id).not.toBe(stages[2].answerId);
      expect(stages[5].hand[Math.floor(stages[5].hand.length / 2)].id).not.toBe(stages[5].answerId);
    }
  });

  it('pairs every staged fraction challenge with a legal pile number', () => {
    for (let i = 0; i < 100; i += 1) {
      const stages = buildFractionLessonStages();

      for (const stage of stages) {
        expect(stage.pile % denom(stage.fraction)).toBe(0);
      }
    }
  });
});

describe('Gold Room Salinda exercise', () => {
  it('uses subtraction that stays inside the non-negative game range', () => {
    expect(GOLD_ROOM_SALINDA_EXERCISE).toMatchObject({
      dice: [5, 2, 6],
      left: 5,
      right: 2,
      op: '-',
      result: 3,
    });
  });
});
