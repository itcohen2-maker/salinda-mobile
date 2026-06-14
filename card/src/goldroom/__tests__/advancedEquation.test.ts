import {
  ADVANCED_MAX_RESULT,
  buildAdvancedHand,
  evaluateAdvanced,
  generateAdvancedEquation,
} from '../advancedEquation';

// Deterministic LCG so the property checks are reproducible.
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('advancedEquation math engine', () => {
  it('evaluates with standard operator precedence', () => {
    // × before +  → 8 + 9*1 would be 17, not 17... use clear cases:
    expect(evaluateAdvanced(2, '+', 3, 'x', 4)).toBe(14); // 2 + (3×4)
    expect(evaluateAdvanced(3, 'x', 4, '+', 2)).toBe(14); // (3×4) + 2
    expect(evaluateAdvanced(2, '-', 6, '÷', 3)).toBe(0); // 2 - (6÷3) = 0
    expect(evaluateAdvanced(6, '÷', 2, 'x', 3)).toBe(9); // left-to-right, same precedence
  });

  it('returns null for non-exact division', () => {
    expect(evaluateAdvanced(5, '÷', 2, '+', 1)).toBeNull();
    expect(evaluateAdvanced(1, '+', 5, '÷', 2)).toBeNull();
  });

  it('always produces a clean positive integer result <= 25 obeying precedence', () => {
    for (let seed = 1; seed <= 3000; seed++) {
      const eq = generateAdvancedEquation(makeRng(seed));
      const [a, b, c] = eq.operands;
      const [op1, op2] = eq.operators;

      expect(Number.isInteger(eq.result)).toBe(true);
      expect(eq.result).toBeGreaterThan(0);
      expect(eq.result).toBeLessThanOrEqual(ADVANCED_MAX_RESULT);
      // The stored result matches a precedence-correct re-evaluation.
      expect(evaluateAdvanced(a, op1, b, op2, c)).toBe(eq.result);
    }
  });

  it('builds a solvable 5-card hand: exactly one card equals the result', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const eq = generateAdvancedEquation(makeRng(seed));
      const hand = buildAdvancedHand(eq.result, makeRng(seed * 7 + 1));

      expect(hand).toHaveLength(5);
      const values = hand.map((c) => (c.type === 'number' ? c.value : null));
      // The target result is present...
      expect(values.filter((v) => v === eq.result)).toHaveLength(1);
      // ...and every card is a distinct number.
      expect(new Set(values).size).toBe(5);
    }
  });
});
