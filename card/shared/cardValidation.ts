// Pure validation helpers shared between the client game reducer (index.tsx)
// and the bot brain (src/bot/botBrain.ts). Extracted here to break the
// require cycle: index.tsx → botBrain.ts → index.tsx.
import type { Card, Operation, Fraction } from './types';

export function applyOperation(a: number, op: Operation | string, b: number): number | null {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case 'x': case '*': case '×': return a * b;
    case '÷': case '/': return b !== 0 && a % b === 0 ? a / b : null;
    default: return null;
  }
}

export function fractionDenominator(f: Fraction): number {
  switch (f) { case '1/2': return 2; case '1/3': return 3; case '1/4': return 4; case '1/5': return 5; }
}

export function getEffectiveNumber(card: Card | undefined): number | null {
  if (!card) return null;
  if (card.type === 'number') return card.value ?? null;
  if (card.type === 'wild') return card.resolvedValue ?? null;
  return null;
}

export function validateFractionPlay(card: Card, topDiscard: Card | undefined): boolean {
  if (!card.fraction || !topDiscard) return false;
  if (topDiscard.type !== 'number' && topDiscard.type !== 'wild') return false;
  const effective = getEffectiveNumber(topDiscard);
  if (effective === null) return false;
  const d = fractionDenominator(card.fraction as Fraction);
  return effective % d === 0 && effective > 0;
}

export function validateIdenticalPlay(card: Card, topDiscard: Card | undefined): boolean {
  if (!topDiscard) return false;
  if (card.type === 'wild') return topDiscard.type === 'number' || topDiscard.type === 'wild';
  if (card.type !== topDiscard.type) return false;
  switch (card.type) {
    case 'number': return card.value === topDiscard.value;
    case 'fraction': return card.fraction === topDiscard.fraction;
    case 'operation': return card.operation === topDiscard.operation;
    case 'joker': return topDiscard.type === 'joker';
    default: return false;
  }
}

export function getStagedPermutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  const result: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of getStagedPermutations(rest)) result.push([arr[i], ...perm]);
  }
  return result;
}

export function validateStagedCards(
  numberCards: Card[],
  opCard: Card | null,
  target: number,
  maxWild: number = 25,
): boolean {
  const cap = Math.max(0, Math.min(25, maxWild));
  const wildCount = numberCards.filter(c => c.type === 'wild').length;
  const numCards = numberCards.filter(c => c.type === 'number');
  const values = numCards.map(c => c.value ?? 0);
  if (wildCount > 1) return false;
  if (wildCount === 1) {
    if (!opCard) {
      const sum = values.reduce((s, v) => s + v, 0);
      const wildVal = target - sum;
      return wildVal >= 0 && wildVal <= cap && Number.isInteger(wildVal);
    }
    const op = opCard.operation!;
    for (let wildVal = 0; wildVal <= cap; wildVal++) {
      const allVals = [...values, wildVal];
      const perms = getStagedPermutations(allVals);
      for (const perm of perms) {
        for (let gapPos = 0; gapPos < perm.length - 1; gapPos++) {
          let result: number | null = perm[0];
          for (let i = 1; i < perm.length; i++) {
            const useOp = i - 1 === gapPos ? op : '+';
            result = applyOperation(result!, useOp as Operation, perm[i]);
            if (result === null) break;
          }
          if (result !== null && result === target) return true;
        }
      }
    }
    return false;
  }
  if (values.length === 0) return false;
  if (!opCard) return values.reduce((s, v) => s + v, 0) === target;
  const op = opCard.operation!;
  const perms = getStagedPermutations(values);
  for (const perm of perms) {
    for (let gapPos = 0; gapPos < perm.length - 1; gapPos++) {
      let result: number | null = perm[0];
      for (let i = 1; i < perm.length; i++) {
        const useOp = i - 1 === gapPos ? op : '+';
        result = applyOperation(result!, useOp as Operation, perm[i]);
        if (result === null) break;
      }
      if (result !== null && result === target) return true;
    }
  }
  return false;
}
