import { isL6WildTutorialSelectionReady } from '../l6WildSelection';

describe('isL6WildTutorialSelectionReady', () => {
  it('returns false until the full lesson-6 wild selection is staged', () => {
    expect(
      isL6WildTutorialSelectionReady(
        [
          { id: 'wild-1', type: 'wild' },
          { id: 'num-6', type: 'number', value: 6 },
          { id: 'op-minus', type: 'operation', operation: '-' },
        ],
        7,
        25,
      ),
    ).toBe(false);
  });

  it('returns false for a full-looking but invalid selection', () => {
    expect(
      isL6WildTutorialSelectionReady(
        [
          { id: 'wild-1', type: 'wild' },
          { id: 'num-11', type: 'number', value: 11 },
          { id: 'num-12', type: 'number', value: 12 },
          { id: 'op-times', type: 'operation', operation: 'x' },
        ],
        7,
        25,
      ),
    ).toBe(false);
  });

  it('returns true when staged number/wild cards sum to the target (wild uses resolvedValue)', () => {
    // wild.resolvedValue=1 + num(6) + num(0) = 7 = target
    expect(
      isL6WildTutorialSelectionReady(
        [
          { id: 'wild-1', type: 'wild', resolvedValue: 1 },
          { id: 'num-6', type: 'number', value: 6 },
          { id: 'num-0', type: 'number', value: 0 },
        ],
        7,
        25,
      ),
    ).toBe(true);
  });
});
