import {
  generateDiceSet,
  generateTutorialSeed,
  hasValidEquation,
} from './generateDiceSet';

// A deterministic RNG that walks a fixed list of [0,1) values and then
// loops. Lets us force specific dice rolls without touching Math.random.
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

// rng → die = floor(rng()*6)+1, so 0→1, 0.99→6.
const FACE = { 1: 0, 2: 1 / 6, 3: 2 / 6, 4: 3 / 6, 5: 4 / 6, 6: 5 / 6 } as const;

describe('hasValidEquation', () => {
  it('accepts a trivially-solvable set under + and -', () => {
    expect(hasValidEquation([2, 3, 4], ['+', '-'], {})).toBe(true);
  });

  it('honors a reachable target', () => {
    // 2 + 3 = 5 (two-dice equation) → reachable
    expect(hasValidEquation([2, 3, 4], ['+', '-'], { target: 5 })).toBe(true);
  });

  it('rejects an unreachable target', () => {
    expect(hasValidEquation([1, 1, 1], ['+', '-'], { target: 99 })).toBe(false);
  });

  it('honors the allowNegative flag for a reachable negative target', () => {
    // 2 - 5 = -3 is reachable from [1,2,5]; only allowed when allowNegative.
    expect(hasValidEquation([1, 2, 5], ['-'], { target: -3 })).toBe(false);
    expect(hasValidEquation([1, 2, 5], ['-'], { target: -3, allowNegative: true })).toBe(true);
  });
});

describe('generateDiceSet', () => {
  it('always returns three faces in 1..6', () => {
    for (let i = 0; i < 200; i++) {
      const dice = generateDiceSet();
      expect(dice).toHaveLength(3);
      for (const d of dice) {
        expect(Number.isInteger(d)).toBe(true);
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(6);
      }
    }
  });

  it('every output passes the validator under default operators', () => {
    for (let i = 0; i < 200; i++) {
      const dice = generateDiceSet();
      expect(hasValidEquation(dice, ['+', '-'], {})).toBe(true);
    }
  });

  it('uses the injected rng to roll faces', () => {
    const dice = generateDiceSet({ rng: seqRng([FACE[2], FACE[3], FACE[4]]) });
    expect(dice).toEqual([2, 3, 4]);
  });

  it('returns a set that can reach a requested target', () => {
    for (let i = 0; i < 50; i++) {
      const dice = generateDiceSet({ target: 7 });
      expect(hasValidEquation(dice, ['+', '-'], { target: 7 })).toBe(true);
    }
  });

  it('falls back to enumeration when attempts are exhausted (maxAttempts=0)', () => {
    // maxAttempts=0 skips the random loop entirely → must still return a valid set.
    const dice = generateDiceSet({ maxAttempts: 0, target: 7, rng: seqRng([0]) });
    expect(hasValidEquation(dice, ['+', '-'], { target: 7 })).toBe(true);
  });

  it('throws a clear error when no combination can satisfy the constraints', () => {
    expect(() => generateDiceSet({ maxAttempts: 0, target: 1000 })).toThrow();
  });
});

describe('generateTutorialSeed', () => {
  it('returns a base-level (+/-) valid set', () => {
    for (let i = 0; i < 100; i++) {
      const dice = generateTutorialSeed();
      expect(hasValidEquation(dice, ['+', '-'], {})).toBe(true);
    }
  });
});
