import type { Card } from '../../shared/types';

type L11BoardReadyState = {
  phase?: string;
  equationResult?: number | null;
  hasPlayedCards?: boolean;
  currentPlayerIndex?: number;
  players?: Array<{ hand?: Card[] } | undefined> | null;
};

export function handHasNumberValues(hand: Card[] | undefined, requiredValues: number[]): boolean {
  if (!hand) return false;
  const counts = new Map<number, number>();
  for (const card of hand) {
    if (card.type !== 'number' || card.value == null) continue;
    counts.set(card.value, (counts.get(card.value) ?? 0) + 1);
  }
  for (const value of requiredValues) {
    const count = counts.get(value) ?? 0;
    if (count <= 0) return false;
    counts.set(value, count - 1);
  }
  return true;
}

export function isL11MultiPlayBoardReady(
  gameState: L11BoardReadyState | null | undefined,
  target: number,
  requiredValues: number[],
  options: { requireWild?: boolean } = {},
): boolean {
  const hand = gameState?.players?.[1]?.hand;
  return (
    gameState?.phase === 'solved' &&
    gameState?.equationResult === target &&
    gameState?.hasPlayedCards === false &&
    gameState?.currentPlayerIndex === 1 &&
    handHasNumberValues(hand, requiredValues) &&
    (!options.requireWild || hand?.some((card) => card.type === 'wild') === true)
  );
}
