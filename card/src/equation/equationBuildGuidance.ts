import type { L4EquationProgressMissing } from '../tutorial/l4EquationProgress';

// Real-game equation-builder guidance. Mirrors the two "missing" states the
// L4 tutorial already names, but is safe for the live game: a second operator
// supplied by a *played hand card* legitimately closes a 2-dice equation (the
// challenge card still counts), so it must NOT be flagged as missing.

export type EquationGuidanceMessageKey =
  | 'equation.missingSecondOperator'
  | 'equation.missingThirdDie';

export interface EquationMissingStateInput {
  /** How many dice are placed in the equation (0–3). */
  filledCount: number;
  /** Whether the third die slot is filled. */
  dice3Placed: boolean;
  /** Whether the first operator is set (local cycle OR hand card). */
  hasOp1: boolean;
  /** Whether the second operator is set (local cycle OR hand card). */
  hasOp2: boolean;
  /**
   * True when the second operator comes from a played hand card. A hand
   * operation/Salinda card validly finishes a 2-dice equation even without a
   * third die, so that combination is intentional — not a "missing" state.
   */
  op2FromHandCard: boolean;
}

/**
 * Returns which part of the equation is missing, or `null` when the build is
 * either valid or simply incomplete in a way that needs no guidance.
 *
 *  - `'secondOperator'`            → third die placed but no second sign
 *  - `'thirdDieOrCancelSecondOperator'` → second sign placed (via cycle) but no third die
 */
export function getEquationMissingState(
  input: EquationMissingStateInput,
): L4EquationProgressMissing {
  const { filledCount, dice3Placed, hasOp1, hasOp2, op2FromHandCard } = input;
  // Third die placed, first sign present, second sign absent → ask for a sign.
  if (filledCount === 3 && hasOp1 && !hasOp2) return 'secondOperator';
  // Second sign cycled in with only two dice and no hand card backing it →
  // the sign is superfluous: add a number or drop the sign.
  if (filledCount === 2 && hasOp1 && hasOp2 && !dice3Placed && !op2FromHandCard) {
    return 'thirdDieOrCancelSecondOperator';
  }
  return null;
}

/** Maps a missing state to the i18n key for the auto-dismiss guidance bubble. */
export function equationGuidanceMessageKey(
  missing: L4EquationProgressMissing,
): EquationGuidanceMessageKey | null {
  if (missing === 'secondOperator') return 'equation.missingSecondOperator';
  if (missing === 'thirdDieOrCancelSecondOperator') return 'equation.missingThirdDie';
  return null;
}
