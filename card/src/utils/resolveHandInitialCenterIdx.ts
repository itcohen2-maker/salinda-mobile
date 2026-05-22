export function resolveHandInitialCenterIdx<T extends { id: string }>(
  cards: readonly T[],
  centerCardId: string | null,
): number {
  if (!centerCardId) return 0;
  const targetIdx = cards.findIndex((card) => card.id === centerCardId);
  return targetIdx >= 0 ? targetIdx : 0;
}
