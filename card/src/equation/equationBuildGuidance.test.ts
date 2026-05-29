import {
  getEquationMissingState,
  equationGuidanceMessageKey,
  type EquationMissingStateInput,
} from './equationBuildGuidance';

const base: EquationMissingStateInput = {
  filledCount: 2,
  dice3Placed: false,
  hasOp1: true,
  hasOp2: false,
  op2FromHandCard: false,
};

describe('getEquationMissingState', () => {
  it('returns null for a valid 2-dice / 1-sign equation (5 + 2)', () => {
    expect(getEquationMissingState(base)).toBeNull();
  });

  it('returns null for a valid 3-dice / 2-sign equation (5 + 2 + 6)', () => {
    expect(
      getEquationMissingState({
        filledCount: 3,
        dice3Placed: true,
        hasOp1: true,
        hasOp2: true,
        op2FromHandCard: false,
      }),
    ).toBeNull();
  });

  it('flags a missing second sign when a third die is placed (5 + 2 ? 6)', () => {
    expect(
      getEquationMissingState({
        filledCount: 3,
        dice3Placed: true,
        hasOp1: true,
        hasOp2: false,
        op2FromHandCard: false,
      }),
    ).toBe('secondOperator');
  });

  it('flags a superfluous second sign without a third die (5 + 2 + ?)', () => {
    expect(
      getEquationMissingState({
        filledCount: 2,
        dice3Placed: false,
        hasOp1: true,
        hasOp2: true,
        op2FromHandCard: false,
      }),
    ).toBe('thirdDieOrCancelSecondOperator');
  });

  it('does NOT flag a 2-dice finish when the second sign is a played hand card', () => {
    expect(
      getEquationMissingState({
        filledCount: 2,
        dice3Placed: false,
        hasOp1: true,
        hasOp2: true,
        op2FromHandCard: true,
      }),
    ).toBeNull();
  });

  it('returns null while the build is still incomplete (no first sign yet)', () => {
    expect(
      getEquationMissingState({
        filledCount: 2,
        dice3Placed: false,
        hasOp1: false,
        hasOp2: false,
        op2FromHandCard: false,
      }),
    ).toBeNull();
  });
});

describe('equationGuidanceMessageKey', () => {
  it('maps the missing-second-sign state to its bubble key', () => {
    expect(equationGuidanceMessageKey('secondOperator')).toBe(
      'equation.missingSecondOperator',
    );
  });

  it('maps the superfluous-sign state to its bubble key', () => {
    expect(equationGuidanceMessageKey('thirdDieOrCancelSecondOperator')).toBe(
      'equation.missingThirdDie',
    );
  });

  it('returns null when nothing is missing', () => {
    expect(equationGuidanceMessageKey(null)).toBeNull();
  });
});
