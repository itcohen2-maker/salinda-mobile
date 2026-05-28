import {
  initialState,
  shouldShowConfirmEquationButton,
  shouldShowDrawForfeitButton,
  shouldShowSolvedPromptInlineBackButton,
} from '../../index';
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

  it('keeps the draw button visible with a full hand so drawing can open overflow swap', () => {
    const state = makeState({
      mode: 'solo',
      players: [
        {
          id: 'p0',
          name: 'T',
          hand: Array.from({ length: 9 }, (_, i) => ({ id: `n-${i}`, type: 'number' as const, value: i })),
          hasOneCardLeft: false,
          isConnected: true,
          isHost: true,
          isBot: false,
          afkWarnings: 0,
          isEliminated: false,
          isSpectator: false,
          locale: 'he',
        },
      ],
      currentPlayerIndex: 0,
    });

    expect(shouldShowDrawForfeitButton(state, false)).toBe(true);
  });

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

describe('shouldShowConfirmEquationButton', () => {
  it('hides the confirm button before the equation is ready in a normal game', () => {
    const state = makeState({ mode: 'solo' });

    expect(
      shouldShowConfirmEquationButton(state, {
        canUseActiveTurnUi: true,
        confirmReady: false,
        manualTutorialConfirm: false,
      }),
    ).toBe(false);
  });

  it('shows the confirm button once the equation is ready in a normal game', () => {
    const state = makeState({ mode: 'solo' });

    expect(
      shouldShowConfirmEquationButton(state, {
        canUseActiveTurnUi: true,
        confirmReady: true,
        manualTutorialConfirm: false,
      }),
    ).toBe(true);
  });

  it('keeps the button hidden in tutorial until manual confirm is active and ready', () => {
    const state = makeState({ isTutorial: true });

    expect(
      shouldShowConfirmEquationButton(state, {
        canUseActiveTurnUi: true,
        confirmReady: true,
        manualTutorialConfirm: false,
      }),
    ).toBe(false);
  });
});

describe('shouldShowSolvedPromptInlineBackButton', () => {
  it('moves the back button inline with the pick-cards prompt in a normal solved turn', () => {
    expect(
      shouldShowSolvedPromptInlineBackButton({
        showSolvedPickCardsPrompt: true,
        isTutorial: false,
      }),
    ).toBe(true);
  });

  it('keeps the large overlay back button path for tutorial solved flows', () => {
    expect(
      shouldShowSolvedPromptInlineBackButton({
        showSolvedPickCardsPrompt: true,
        isTutorial: true,
      }),
    ).toBe(false);
  });

  it('does not render the inline back button when the solved prompt is absent', () => {
    expect(
      shouldShowSolvedPromptInlineBackButton({
        showSolvedPickCardsPrompt: false,
        isTutorial: false,
      }),
    ).toBe(false);
  });
});
