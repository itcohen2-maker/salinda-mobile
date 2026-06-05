import { evaluateComboExercise } from './comboEvaluation';
import type { Card } from './types';

describe('evaluateComboExercise', () => {
  it('solves a multi-card drop with two number cards', () => {
    const cards: Card[] = [
      { id: 'n16', type: 'number', value: 16 },
      { id: 'n4', type: 'number', value: 4 },
    ];

    const result = evaluateComboExercise({
      target: 20,
      cards,
      requiredCardIds: ['n16', 'n4'],
    });

    expect(result.isComplete).toBe(true);
    expect(result.total).toBe(20);
    expect(result.clearedCardIds).toEqual(['n16', 'n4']);
  });

  it('resolves a wild card to the missing combo value', () => {
    const cards: Card[] = [
      { id: 'n2', type: 'number', value: 2 },
      { id: 'n4', type: 'number', value: 4 },
      { id: 'n8', type: 'number', value: 8 },
      { id: 'wild', type: 'wild' },
    ];

    const result = evaluateComboExercise({
      target: 20,
      cards,
      requiredCardIds: ['n2', 'n4', 'n8', 'wild'],
    });

    expect(result.isComplete).toBe(true);
    expect(result.missingValue).toBe(6);
    expect(result.resolvedCards.find((card) => card.id === 'wild')).toMatchObject({
      type: 'wild',
      resolvedValue: 6,
      resolvedTarget: 20,
    });
    expect(result.clearedCardIds).toEqual(['n2', 'n4', 'n8', 'wild']);
  });

  it('rejects combos that are missing a required card', () => {
    const result = evaluateComboExercise({
      target: 20,
      cards: [{ id: 'n16', type: 'number', value: 16 }],
      requiredCardIds: ['n16', 'n4'],
    });

    expect(result.isComplete).toBe(false);
    expect(result.clearedCardIds).toEqual([]);
  });
});
