import type { Card } from './types';

export type ComboEvaluationInput = {
  target: number;
  cards: Card[];
  maxWildValue?: number;
  requiredCardIds?: string[];
};

export type ComboEvaluationResult = {
  isComplete: boolean;
  target: number;
  total: number;
  fixedTotal: number;
  missingValue: number | null;
  resolvedCards: Card[];
  clearedCardIds: string[];
};

function clampWildCap(maxWildValue: number | undefined): number {
  return Math.max(0, Math.min(25, maxWildValue ?? 25));
}

function distributeWildValues(totalMissing: number, wildCount: number, cap: number): number[] | null {
  if (wildCount <= 0) return totalMissing === 0 ? [] : null;
  if (totalMissing < 0 || totalMissing > wildCount * cap || !Number.isInteger(totalMissing)) return null;

  const values: number[] = [];
  let remaining = totalMissing;
  for (let i = 0; i < wildCount; i++) {
    const value = Math.min(cap, remaining);
    values.push(value);
    remaining -= value;
  }
  return remaining === 0 ? values : null;
}

export function evaluateComboExercise({
  target,
  cards,
  maxWildValue,
  requiredCardIds,
}: ComboEvaluationInput): ComboEvaluationResult {
  const cap = clampWildCap(maxWildValue);
  const numberCards = cards.filter((card) => card.type === 'number');
  const fixedWildCards = cards.filter((card) => card.type === 'wild' && card.resolvedValue != null);
  const openWildCards = cards.filter((card) => card.type === 'wild' && card.resolvedValue == null);
  const fixedTotal =
    numberCards.reduce((sum, card) => sum + (card.value ?? 0), 0) +
    fixedWildCards.reduce((sum, card) => sum + (card.resolvedValue ?? 0), 0);
  const missing = target - fixedTotal;
  const wildValues = distributeWildValues(missing, openWildCards.length, cap);
  const requiredIds = new Set(requiredCardIds ?? []);
  const hasRequiredCards = requiredIds.size === 0 || [...requiredIds].every((id) => cards.some((card) => card.id === id));
  const isComplete = hasRequiredCards && wildValues !== null && fixedTotal + wildValues.reduce((sum, value) => sum + value, 0) === target;
  let openWildIndex = 0;

  const resolvedCards = cards.map((card) => {
    if (card.type !== 'wild' || card.resolvedValue != null || !wildValues) return card;
    const resolvedValue = wildValues[openWildIndex++] ?? 0;
    return { ...card, resolvedValue, resolvedTarget: target };
  });

  return {
    isComplete,
    target,
    total: isComplete ? target : fixedTotal,
    fixedTotal,
    missingValue: wildValues && openWildCards.length === 1 ? wildValues[0] : openWildCards.length > 0 ? missing : null,
    resolvedCards,
    clearedCardIds: isComplete ? resolvedCards.map((card) => card.id) : [],
  };
}
