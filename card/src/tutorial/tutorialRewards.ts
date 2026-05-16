export type TutorialRewardOutcome = 'awarded' | 'skipped' | 'limit';

type GetTutorialRewardOutcomeOptions = {
  skipCount: number;
  earnedCount: number;
  maxEarnedCount?: number;
};

/**
 * Determines whether the learner should receive tutorial coins for the
 * current completion screen.
 */
export function getTutorialRewardOutcome({
  skipCount,
  earnedCount,
  maxEarnedCount = 2,
}: GetTutorialRewardOutcomeOptions): TutorialRewardOutcome {
  if (earnedCount >= maxEarnedCount) return 'limit';
  if (skipCount > 2) return 'skipped';
  return 'awarded';
}
