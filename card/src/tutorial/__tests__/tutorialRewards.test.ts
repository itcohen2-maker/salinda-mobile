import { getTutorialRewardOutcome } from '../tutorialRewards';

describe('getTutorialRewardOutcome', () => {
  it('awards coins when the learner met the requirements and is under the cap', () => {
    expect(getTutorialRewardOutcome({ skipCount: 2, alreadyEarned: false })).toBe('awarded');
  });

  it('blocks coins when the learner already earned this tutorial reward', () => {
    expect(getTutorialRewardOutcome({ skipCount: 0, alreadyEarned: true })).toBe('limit');
  });

  it('blocks coins when the learner skipped too many guided steps', () => {
    expect(getTutorialRewardOutcome({ skipCount: 3, alreadyEarned: false })).toBe('skipped');
  });

  it('keeps the already-earned reason when both earned and skip conditions apply', () => {
    expect(getTutorialRewardOutcome({ skipCount: 4, alreadyEarned: true })).toBe('limit');
  });
});
