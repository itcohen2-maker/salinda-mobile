// ============================================================
// generateDiceSet — Gold Room "equation practice" dice source.
//
// Produces a fresh, RANDOM set of three dice (1..6) for every
// round, guarded by a Validator ("שומר סף") that guarantees the
// dice can form at least one legal equation under the allowed
// operators. This prevents the learner from ever hitting an
// impossible "wall" mid-practice. No hardcoded dice values.
//
// Base level uses '+' and '-' only — the lowest rung. The function
// is operator-aware so higher levels (×, ÷, target matching) can
// reuse it unchanged.
// ============================================================

import type { Operation } from '../types/game';
import { applyOperation } from '../utils/arithmetic';

export interface GenerateDiceOptions {
  /** Operators the learner is allowed to use. Default: ['+', '-']. */
  operators?: Operation[];
  /** When set, require at least one equation that evaluates to this value. */
  target?: number;
  /** Allow negative equation results to count as valid. Default: false. */
  allowNegative?: boolean;
  /** Random rolls to try before falling back to enumeration. Default: 50. */
  maxAttempts?: number;
  /** Injectable RNG returning [0, 1). Default: Math.random. */
  rng?: () => number;
}

interface ValidatorOptions {
  target?: number;
  allowNegative?: boolean;
}

type Dice = [number, number, number];

const DEFAULT_OPERATORS: Operation[] = ['+', '-'];

function permutations3([a, b, c]: Dice): Dice[] {
  return [
    [a, b, c], [a, c, b],
    [b, a, c], [b, c, a],
    [c, a, b], [c, b, a],
  ];
}

/** Is `result` acceptable given the target / sign constraints? */
function resultMatches(result: number | null, opts: ValidatorOptions): boolean {
  if (result === null || !Number.isInteger(result)) return false;
  if (!opts.allowNegative && result < 0) return false;
  if (opts.target !== undefined && result !== opts.target) return false;
  return true;
}

/**
 * True when the three dice can build at least one legal equation under the
 * given operators. Checks every permutation, both two-die equations (a op b)
 * and three-die equations under both associativities ((a op1 b) op2 c and
 * a op1 (b op2 c)) — mirroring what the equation Slots actually accept.
 */
export function hasValidEquation(
  dice: Dice,
  operators: Operation[],
  opts: ValidatorOptions,
): boolean {
  for (const [a, b, c] of permutations3(dice)) {
    for (const op1 of operators) {
      // Two-die equation: a op1 b
      if (resultMatches(applyOperation(a, op1, b), opts)) return true;
      for (const op2 of operators) {
        // (a op1 b) op2 c
        const left = applyOperation(a, op1, b);
        if (left !== null && resultMatches(applyOperation(left, op2, c), opts)) return true;
        // a op1 (b op2 c)
        const right = applyOperation(b, op2, c);
        if (right !== null && resultMatches(applyOperation(a, op1, right), opts)) return true;
      }
    }
  }
  return false;
}

function rollFace(rng: () => number): number {
  return Math.floor(rng() * 6) + 1;
}

/**
 * Returns three random dice (1..6) guaranteed to form at least one legal
 * equation under the allowed operators (and to reach `target` when given).
 *
 * Strategy: roll randomly up to `maxAttempts` and keep the first valid set.
 * If none pass (or maxAttempts is 0), fall back to enumerating all 216
 * combinations, filtering the valid ones, and picking one via the same rng —
 * so a valid set is always returned without any hardcoded values. Throws only
 * when no combination can satisfy the constraints at all.
 */
export function generateDiceSet(opts: GenerateDiceOptions = {}): Dice {
  const operators = opts.operators && opts.operators.length > 0 ? opts.operators : DEFAULT_OPERATORS;
  const rng = opts.rng ?? Math.random;
  const maxAttempts = opts.maxAttempts ?? 50;
  const validatorOpts: ValidatorOptions = { target: opts.target, allowNegative: opts.allowNegative };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const dice: Dice = [rollFace(rng), rollFace(rng), rollFace(rng)];
    if (hasValidEquation(dice, operators, validatorOpts)) return dice;
  }

  // Fallback: enumerate every combination and pick a valid one at random.
  const valid: Dice[] = [];
  for (let a = 1; a <= 6; a++)
    for (let b = 1; b <= 6; b++)
      for (let c = 1; c <= 6; c++) {
        const dice: Dice = [a, b, c];
        if (hasValidEquation(dice, operators, validatorOpts)) valid.push(dice);
      }

  if (valid.length === 0) {
    throw new Error(
      `generateDiceSet: no dice combination can satisfy the constraints ` +
        `(operators=${operators.join(',')}${opts.target !== undefined ? `, target=${opts.target}` : ''}).`,
    );
  }
  return valid[Math.floor(rng() * valid.length)];
}

/** Base-level practice seed: random dice solvable with '+' and '-'. */
export function generateTutorialSeed(): Dice {
  return generateDiceSet({ operators: DEFAULT_OPERATORS });
}
