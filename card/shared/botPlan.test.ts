import { botStepDelayRange } from './botPlan';

describe('botStepDelayRange calibration', () => {
  it('pity delay range is [2000, 3000]', () => {
    const range = botStepDelayRange('pity');
    expect(range.min).toBe(2000);
    expect(range.max).toBe(3000);
  });

  it('pity is slower than easy', () => {
    const pity = botStepDelayRange('pity');
    const easy = botStepDelayRange('easy');
    expect(pity.min).toBeGreaterThan(easy.max);
  });

  it('hard delay range is [900, 1200]', () => {
    const range = botStepDelayRange('hard');
    expect(range.min).toBe(900);
    expect(range.max).toBe(1200);
  });

  it('medium delay range is [1200, 1500]', () => {
    const range = botStepDelayRange('medium');
    expect(range.min).toBe(1200);
    expect(range.max).toBe(1500);
  });

  it('hard is faster than medium', () => {
    const hard = botStepDelayRange('hard');
    const medium = botStepDelayRange('medium');
    expect(hard.max).toBeLessThanOrEqual(medium.min);
  });
});
