import { resolveHandInitialCenterIdx } from './resolveHandInitialCenterIdx';

describe('resolveHandInitialCenterIdx', () => {
  const cards = [
    { id: 'card-1' },
    { id: 'card-2' },
    { id: 'card-3' },
  ];

  it('returns the centered card index when the id exists in the hand', () => {
    expect(resolveHandInitialCenterIdx(cards, 'card-2')).toBe(1);
  });

  it('falls back to index 0 when no center card id is provided', () => {
    expect(resolveHandInitialCenterIdx(cards, null)).toBe(0);
  });

  it('falls back to index 0 when the center card is not in the hand', () => {
    expect(resolveHandInitialCenterIdx(cards, 'missing-card')).toBe(0);
  });
});
