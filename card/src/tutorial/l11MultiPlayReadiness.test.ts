import type { Card } from '../../shared/types';
import { handHasNumberValues, isL11MultiPlayBoardReady } from './l11MultiPlayReadiness';

const numberCard = (id: string, value: number): Card => ({ id, type: 'number', value });
const wildCard = (id: string): Card => ({ id, type: 'wild' });

describe('L11 multi-play board readiness', () => {
  it('requires every needed number, including duplicate values', () => {
    expect(handHasNumberValues([numberCard('a', 4)], [4, 4])).toBe(false);
    expect(handHasNumberValues([numberCard('a', 4), numberCard('b', 4)], [4, 4])).toBe(true);
  });

  it('rejects stale solved states after the cards were already played', () => {
    expect(
      isL11MultiPlayBoardReady(
        {
          phase: 'solved',
          equationResult: 8,
          hasPlayedCards: true,
          currentPlayerIndex: 1,
          players: [{ hand: [] }, { hand: [numberCard('a', 3), numberCard('b', 5)] }],
        },
        8,
        [3, 5],
      ),
    ).toBe(false);
  });

  it('requires the learner turn and the exact target', () => {
    const players = [{ hand: [] }, { hand: [numberCard('a', 3), numberCard('b', 5)] }];

    expect(
      isL11MultiPlayBoardReady(
        { phase: 'solved', equationResult: 8, hasPlayedCards: false, currentPlayerIndex: 0, players },
        8,
        [3, 5],
      ),
    ).toBe(false);
    expect(
      isL11MultiPlayBoardReady(
        { phase: 'solved', equationResult: 7, hasPlayedCards: false, currentPlayerIndex: 1, players },
        8,
        [3, 5],
      ),
    ).toBe(false);
  });

  it('can require the bonus wild for the second L11 exercise', () => {
    const baseState = {
      phase: 'solved',
      equationResult: 8,
      hasPlayedCards: false,
      currentPlayerIndex: 1,
    };

    expect(
      isL11MultiPlayBoardReady(
        { ...baseState, players: [{ hand: [] }, { hand: [numberCard('a', 3), numberCard('b', 5)] }] },
        8,
        [3, 5],
        { requireWild: true },
      ),
    ).toBe(false);
    expect(
      isL11MultiPlayBoardReady(
        { ...baseState, players: [{ hand: [] }, { hand: [numberCard('a', 3), numberCard('b', 5), wildCard('w')] }] },
        8,
        [3, 5],
        { requireWild: true },
      ),
    ).toBe(true);
  });
});
