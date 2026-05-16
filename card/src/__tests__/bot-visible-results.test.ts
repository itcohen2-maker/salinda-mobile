import { getSolvableTargetOptions } from '../../shared/botPlan';
import type { Card, EquationOption } from '../../shared/types';
import { validateStagedCards } from '../../index';

function numberCard(id: string, value: number): Card {
  return { id, type: 'number', value };
}

describe('getSolvableTargetOptions', () => {
  it('filters out validTargets that the current hand cannot actually complete', () => {
    const validTargets: EquationOption[] = [
      { equation: '3 + 4', result: 7 },
      { equation: '5 + 7', result: 12 },
      { equation: '4 - 3', result: 1 },
    ];
    const hand = [numberCard('n3', 3), numberCard('n4', 4)];

    expect(
      getSolvableTargetOptions(validTargets, hand, 25, validateStagedCards),
    ).toEqual([{ equation: '3 + 4', result: 7 }]);
  });

  it('keeps distinct equations when they resolve to the same result', () => {
    const validTargets: EquationOption[] = [
      { equation: '3 + 4', result: 7 },
      { equation: '8 - 1', result: 7 },
    ];
    const hand = [numberCard('n7', 7)];

    expect(
      getSolvableTargetOptions(validTargets, hand, 25, validateStagedCards),
    ).toEqual([
      { equation: '3 + 4', result: 7 },
      { equation: '8 - 1', result: 7 },
    ]);
  });
});
