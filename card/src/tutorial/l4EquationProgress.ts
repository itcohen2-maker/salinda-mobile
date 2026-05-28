export type L4EquationProgressMissing =
  | 'secondOperator'
  | 'thirdDieOrCancelSecondOperator'
  | null;

export type L4EquationProgress = {
  diceCount: number;
  opCount: number;
  hasResult: boolean;
  ok: boolean;
  missing: L4EquationProgressMissing;
};

export type L4Step3Phase =
  | 'intro'
  | 'build'
  | 'pickFirstDie'
  | 'pickSecondDie'
  | 'pickOperator'
  | 'pressConfirm'
  | 'missingSecondOperator'
  | 'missingThirdDieOrCancelOperator'
  | 'pickCard'
  | 'wrongCard'
  | 'pressPlay';

export function resolveL4Step3PhaseFromProgress(progress: L4EquationProgress): L4Step3Phase {
  if (progress.ok) return 'pressConfirm';
  if (progress.missing === 'secondOperator') return 'missingSecondOperator';
  if (progress.missing === 'thirdDieOrCancelSecondOperator') return 'missingThirdDieOrCancelOperator';
  if (progress.diceCount <= 0) return 'pickFirstDie';
  if (progress.diceCount === 1) return 'pickSecondDie';
  if (progress.opCount === 0) return 'pickOperator';
  if (progress.diceCount < 3) return 'pickSecondDie';
  return 'pickOperator';
}
