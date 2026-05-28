export type TutorialRewardOutcome = 'awarded' | 'skipped' | 'limit';

type GetTutorialRewardOutcomeOptions = {
  skipCount: number;
  alreadyEarned?: boolean;
};

/**
 * Determines whether the learner should receive tutorial coins for the
 * current completion screen.
 */
export function getTutorialRewardOutcome({
  skipCount,
  alreadyEarned = false,
}: GetTutorialRewardOutcomeOptions): TutorialRewardOutcome {
  if (alreadyEarned) return 'limit';
  if (skipCount > 2) return 'skipped';
  return 'awarded';
}
