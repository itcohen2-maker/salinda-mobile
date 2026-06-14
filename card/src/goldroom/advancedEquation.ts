// ── Dynamic math engine for the "advanced" 3-number specials step ──
//
// Generates a fully randomized `A op1 B op2 C = D` equation under four strict
// rules, then builds a solvable 5-card hand around the result:
//   1. Operands and operators are random (never hardcoded).
//   2. The result obeys standard operator precedence (× / ÷ before + / −).
//   3. The result is always a clean POSITIVE INTEGER (no negatives, no fractions
//      — every division must divide exactly).
//   4. The result is capped at <= 25 (re-roll until satisfied).
//
// Pure + deterministic given an injected `rng`, so it can be unit-tested without
// touching React or Math.random.
import type { Card, Operation } from '../../components/CardDesign';

export const ADVANCED_MAX_RESULT = 25;
const OPERATORS: readonly Operation[] = ['+', '-', 'x', '÷'];
const OPERAND_FACES = 6; // operands are dice faces: 1..6

export interface AdvancedEquation {
  operands: [number, number, number];
  operators: [Operation, Operation];
  result: number; // guaranteed integer, 0 < result <= ADVANCED_MAX_RESULT
}

type Rng = () => number;

function precedence(op: Operation): 1 | 2 {
  return op === 'x' || op === '÷' ? 2 : 1;
}

// Apply a single binary op. Division returns null unless it divides EXACTLY —
// that's how we guarantee "no fractions" without floating-point slop.
function applyOp(a: number, op: Operation, b: number): number | null {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case 'x':
      return a * b;
    case '÷':
      return b !== 0 && a % b === 0 ? a / b : null;
  }
}

// Evaluate `a op1 b op2 c` with standard precedence. Returns null if any
// division along the chosen evaluation order is non-exact.
export function evaluateAdvanced(
  a: number,
  op1: Operation,
  b: number,
  op2: Operation,
  c: number,
): number | null {
  // op1 first when it's equal-or-higher precedence (equal → left-to-right),
  // otherwise resolve the higher-precedence right pair (b op2 c) first.
  if (precedence(op1) >= precedence(op2)) {
    const left = applyOp(a, op1, b);
    if (left === null) return null;
    return applyOp(left, op2, c);
  }
  const right = applyOp(b, op2, c);
  if (right === null) return null;
  return applyOp(a, op1, right);
}

function pickOperator(rng: Rng): Operation {
  return OPERATORS[Math.floor(rng() * OPERATORS.length)];
}

function rollFace(rng: Rng): number {
  return 1 + Math.floor(rng() * OPERAND_FACES);
}

// Re-roll operands/operators until the precedence-correct result is a clean
// positive integer <= 25. Bounded loop with a guaranteed-valid fallback so it
// can never spin forever.
export function generateAdvancedEquation(rng: Rng = Math.random): AdvancedEquation {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const a = rollFace(rng);
    const b = rollFace(rng);
    const c = rollFace(rng);
    const op1 = pickOperator(rng);
    const op2 = pickOperator(rng);
    const result = evaluateAdvanced(a, op1, b, op2, c);
    if (
      result !== null &&
      Number.isInteger(result) &&
      result > 0 &&
      result <= ADVANCED_MAX_RESULT
    ) {
      return { operands: [a, b, c], operators: [op1, op2], result };
    }
  }
  // Unreachable in practice; a deterministic equation that meets every rule.
  return { operands: [2, 3, 1], operators: ['+', '+'], result: 6 };
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A 5-card number hand that is ALWAYS solvable: exactly one card equals the
// result, the other four are distinct decoys that never equal it. Shuffled so
// the answer isn't always in the same slot.
export function buildAdvancedHand(result: number, rng: Rng = Math.random): Card[] {
  const values = new Set<number>([result]);
  while (values.size < 5) {
    const decoy = 1 + Math.floor(rng() * ADVANCED_MAX_RESULT);
    if (decoy !== result) values.add(decoy);
  }
  return shuffle([...values], rng).map((value, idx) => ({
    id: `adv-hand-${value}-${idx}`,
    type: 'number',
    value,
  }));
}
