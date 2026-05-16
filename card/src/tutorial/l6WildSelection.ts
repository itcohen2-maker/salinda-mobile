import type { Card } from '../../shared/types';

export function isL6WildTutorialSelectionReady(
  stagedCards: Card[],
  equationResult: number | null | undefined,
  mathRangeMax: number = 25,
): boolean {
  if (equationResult == null) return false;

  const stagedNumbers = stagedCards.filter(
    (card): card is Card => card.type === 'number' || card.type === 'wild',
  );
  const hasWild = stagedNumbers.some((card) => card.type === 'wild');

  if (!hasWild) return false;
  if (stagedNumbers.length < 2) return false;

  const fixedSum = stagedNumbers
    .filter((c) => c.type === 'number')
    .reduce((acc, c) => acc + (c.value ?? 0), 0);

  const resolvedWilds = stagedNumbers.filter(
    (c) => c.type === 'wild' && c.resolvedValue != null,
  );
  const unresolvedWilds = stagedNumbers.filter(
    (c) => c.type === 'wild' && c.resolvedValue == null,
  );

  const resolvedWildSum = resolvedWilds.reduce((acc, c) => acc + (c.resolvedValue ?? 0), 0);

  if (unresolvedWilds.length === 0) {
    return fixedSum + resolvedWildSum === equationResult;
  }

  // Try all valid values for the single unresolved wild
  if (unresolvedWilds.length === 1) {
    const needed = equationResult - fixedSum - resolvedWildSum;
    return needed >= 0 && needed <= mathRangeMax;
  }

  return false;
}
