import type { Card } from './types';
import { orderHandForFan, pickOverflowTimeoutHandCardId } from './overflowSwap';

function makeNumber(id: string, value: number): Card {
  return { id, type: 'number', value };
}

describe('overflow swap shared helpers', () => {
  it('orders hand cards the same way the fan is rendered', () => {
    const hand: Card[] = [
      { id: 'salinda', type: 'salinda' },
      { id: 'fraction', type: 'fraction', fraction: '1/3' },
      { id: 'wild', type: 'wild' },
      makeNumber('n-4', 4),
      { id: 'operation', type: 'operation', operation: '+' },
      makeNumber('n-1', 1),
    ];

    expect(orderHandForFan(hand).map((card) => card.id)).toEqual([
      'n-1',
      'n-4',
      'wild',
      'fraction',
      'operation',
      'salinda',
    ]);
  });

  it('picks the rightmost fan card for overflow timeout', () => {
    const hand: Card[] = [
      { id: 'operation', type: 'operation', operation: '+' },
      makeNumber('n-1', 1),
      makeNumber('n-2', 2),
      { id: 'fraction', type: 'fraction', fraction: '1/2' },
    ];

    expect(pickOverflowTimeoutHandCardId(hand)).toBe('operation');
  });
});
