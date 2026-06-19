import {
  equationMatchesDiceAndResult,
  evaluateEquationDisplay,
  extractEquationOperators,
  parseEquationDisplay,
} from './validation';

describe('equation display validation', () => {
  it('evaluates explicit left parentheses without using natural precedence', () => {
    expect(evaluateEquationDisplay('(5 * 4) + 1 = 21')).toBe(21);
    expect(equationMatchesDiceAndResult('(5 * 4) + 1 = 21', 21, [5, 4, 1])).toBe(true);
  });

  it('returns safe fallbacks for malformed displays', () => {
    expect(parseEquationDisplay('(()')).toBeNull();
    expect(evaluateEquationDisplay('(()')).toBeNull();
    expect(equationMatchesDiceAndResult('(()', 21, [5, 4, 1])).toBe(false);
    expect(extractEquationOperators(null as unknown as string)).toEqual([]);
  });
});
