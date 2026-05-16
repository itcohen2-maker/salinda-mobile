import { initialState, shouldShowDrawForfeitButton } from '../../index';
import type { GameState } from '../../index';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...initialState,
    phase: 'building',
    players: [],
    hasPlayedCards: false,
    hasDrawnCard: false,
    pendingFractionTarget: null,
    isTutorial: false,
    overflowSwapPending: false,
    ...overrides,
  };
}

describe('shouldShowDrawForfeitButton', () => {
  it.each(['solo', 'pass-and-play', 'vs-bot'] as const)(
    'shows the draw button in %s during a normal building turn',
    (mode) => {
      const state = makeState({ mode });

      expect(shouldShowDrawForfeitButton(state, false)).toBe(true);
    },
  );

  it('hides the draw button after a draw already started an overflow swap', () => {
    const state = makeState({
      mode: 'solo',
      hasDrawnCard: true,
      overflowSwapPending: true,
    });

    expect(shouldShowDrawForfeitButton(state, false)).toBe(false);
  });

  it('hides the fallback draw button during a forced overflow swap in pre-roll', () => {
    const state = makeState({
      phase: 'pre-roll',
      overflowSwapPending: true,
    });

    expect(shouldShowDrawForfeitButton(state, false)).toBe(false);
  });
});
