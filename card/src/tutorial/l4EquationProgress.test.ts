import { resolveL4Step3PhaseFromProgress } from './l4EquationProgress';

describe('resolveL4Step3PhaseFromProgress', () => {
  it('guides the first full-build flow through confirm before card picking', () => {
    expect(resolveL4Step3PhaseFromProgress({
      diceCount: 0,
      opCount: 0,
      hasResult: false,
      ok: false,
      missing: null,
    })).toBe('pickFirstDie');

    expect(resolveL4Step3PhaseFromProgress({
      diceCount: 1,
      opCount: 0,
      hasResult: false,
      ok: false,
      missing: null,
    })).toBe('pickSecondDie');

    expect(resolveL4Step3PhaseFromProgress({
      diceCount: 2,
      opCount: 0,
      hasResult: false,
      ok: false,
      missing: null,
    })).toBe('pickOperator');

    expect(resolveL4Step3PhaseFromProgress({
      diceCount: 2,
      opCount: 1,
      hasResult: true,
      ok: true,
      missing: null,
    })).toBe('pressConfirm');
  });
});
