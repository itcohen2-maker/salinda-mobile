import { getTutorialRewardOutcome } from '../tutorialRewards';

describe('getTutorialRewardOutcome', () => {
  it('awards coins when the learner met the requirements and is under the cap', () => {
    expect(getTutorialRewardOutcome({ skipCount: 2, earnedCount: 1 })).toBe('awarded');
  });

  it('blocks coins when the learner already reached the lifetime reward cap', () => {
    expect(getTutorialRewardOutcome({ skipCount: 0, earnedCount: 2 })).toBe('limit');
  });

  it('blocks coins when the learner skipped too many guided steps', () => {
    expect(getTutorialRewardOutcome({ skipCount: 3, earnedCount: 0 })).toBe('skipped');
  });

  it('keeps the cap reason when both cap and skip conditions apply', () => {
    expect(getTutorialRewardOutcome({ skipCount: 4, earnedCount: 2 })).toBe('limit');
  });
});
