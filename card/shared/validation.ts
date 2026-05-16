// ============================================================
// shared/validation.ts - Input validation & sanitization
// Used by both server and client for consistent validation
// ============================================================

import type { AppLocale } from './i18n';
import type { Card, DiceResult, EquationCommitPayload, Operation } from './types';

/**
 * Sanitize a player name: trim, strip control chars and basic HTML,
 * enforce length 1-24. Returns null if invalid.
 */
export function sanitizePlayerName(raw: unknown, maxLen = 24): string | null {
  if (typeof raw !== 'string') return null;
  const stripped = raw
    .replace(/[\r\n\x00-\x1f\x7f]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z]+;/gi, '')
    .trim()
    .slice(0, maxLen);
  return stripped.length > 0 ? stripped : null;
}

/**
 * Validate a room code (4 digits).
 * Returns the code string or null if invalid.
 */
export function validateRoomCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return /^\d{4}$/.test(trimmed) ? trimmed : null;
}

/**
 * Validate a card ID (format: card-<digits> or c-<hex>).
 * Returns the ID or null if invalid.
 */
export function validateCardId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length > 40) return null;
  if (/^card-\d+$/.test(trimmed)) return trimmed;
  if (/^c-[0-9a-f]+$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Validate wildResolve: must be a non-negative integer within [0, maxRange].
 * Returns the number or null if invalid.
 */
export function validateWildResolve(raw: unknown, maxRange: number): number | null {
  if (raw === undefined || raw === null) return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < 0 || n > maxRange) return null;
  return n;
}

/**
 * Validate locale. Returns 'he' or 'en', defaulting to 'he'.
 */
export function validateLocale(raw: unknown): AppLocale {
  if (raw === 'en') return 'en';
  return 'he';
}

/**
 * Validate difficulty level.
 * Returns 'easy' | 'full' or null if invalid.
 */
export function validateDifficulty(raw: unknown): 'easy' | 'full' | null {
  if (raw === 'easy' || raw === 'full') return raw;
  return null;
}

/**
 * Validate an operation token.
 * Returns a canonical Operation or null if invalid.
 */
export function validateOperation(raw: unknown): Operation | null {
  if (typeof raw !== 'string') return null;
  switch (raw) {
    case '+':
    case '-':
    case 'x':
    case '÷':
      return raw;
    case '*':
    case '×':
      return 'x';
    case '/':
      return '÷';
    default:
      return null;
  }
}

/**
 * Sanitize equation display string: strip control chars, cap length.
 * Returns sanitized string (never null; defaults to empty).
 */
export function sanitizeEquationDisplay(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim()
    .slice(0, 200);
}

export type ParsedEquationDisplay = {
  numbers: number[];
  operators: Operation[];
  grouping: 'left' | 'right' | 'none';
  rhsResult: number | null;
};

export type EquationCommitValidationKey =
  | 'equation.invalidOpPosition'
  | 'equation.commitCardNotInHand'
  | 'equation.invalidCommitCard'
  | 'equation.chooseJokerOp'
  | 'equation.regularOpNoJoker'
  | 'equation.commitOpMismatch';

type EquationCommitCardLike = Pick<Card, 'id' | 'type' | 'operation'>;

function isDiceTuple(
  dice: DiceResult | readonly [number, number, number],
): dice is readonly [number, number, number] {
  return Array.isArray(dice);
}

function applyEquationOperation(a: number, op: Operation, b: number): number | null {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case 'x':
      return a * b;
    case '÷':
      return b !== 0 && a % b === 0 ? a / b : null;
    default:
      return null;
  }
}

function evalEquationThreeTerms(
  a: number,
  op1: Operation,
  b: number,
  op2: Operation,
  c: number,
): number | null {
  const op2High = op2 === 'x' || op2 === '÷';
  const op1High = op1 === 'x' || op1 === '÷';
  if (op2High && !op1High) {
    const right = applyEquationOperation(b, op2, c);
    if (right === null) return null;
    return applyEquationOperation(a, op1, right);
  }
  const left = applyEquationOperation(a, op1, b);
  if (left === null) return null;
  return applyEquationOperation(left, op2, c);
}

function normalizeEquationCompact(raw: string): string {
  return sanitizeEquationDisplay(raw)
    .replace(/\s+/g, '')
    .replace(/[×*]/g, 'x')
    .replace(/\//g, '÷');
}

function extractRhsResult(raw: string): number | null {
  const rhs = raw.split('=')[1];
  if (rhs == null) return null;
  const trimmed = rhs.trim();
  if (!trimmed || !/^-?\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function extractEquationOperators(equationDisplay: string): Operation[] {
  const lhs = sanitizeEquationDisplay(equationDisplay).split('=')[0] ?? '';
  return (lhs.match(/[+\-x÷*/×]/g) ?? [])
    .map((token) => validateOperation(token))
    .filter((token): token is Operation => token != null)
    .slice(0, 2);
}

export function parseEquationDisplay(equationDisplay: string): ParsedEquationDisplay | null {
  const clean = sanitizeEquationDisplay(equationDisplay);
  if (!clean) return null;

  const lhs = clean.split('=')[0]?.trim() ?? '';
  const numbersRaw = lhs.match(/\d+/g);
  if (!numbersRaw || numbersRaw.length < 2 || numbersRaw.length > 3) return null;
  const numbers = numbersRaw.map((value) => Number(value));
  const operators = extractEquationOperators(clean);
  if (operators.length !== numbers.length - 1) return null;

  const compact = normalizeEquationCompact(lhs);
  let grouping: 'left' | 'right' | 'none' = 'none';
  if (numbers.length === 3) {
    if (compact.startsWith('(')) grouping = 'left';
    else if (compact.includes('(')) grouping = 'right';
  }

  return {
    numbers,
    operators,
    grouping,
    rhsResult: extractRhsResult(clean),
  };
}

export function evaluateEquationDisplay(equationDisplay: string): number | null {
  const parsed = parseEquationDisplay(equationDisplay);
  if (!parsed) return null;

  if (parsed.numbers.length === 2) {
    return applyEquationOperation(parsed.numbers[0]!, parsed.operators[0]!, parsed.numbers[1]!);
  }

  const [a, b, c] = parsed.numbers;
  const [op1, op2] = parsed.operators;
  if (a == null || b == null || c == null || op1 == null || op2 == null) return null;

  if (parsed.grouping === 'left') {
    const inner = applyEquationOperation(a, op1, b);
    if (inner === null) return null;
    return applyEquationOperation(inner, op2, c);
  }
  if (parsed.grouping === 'right') {
    const inner = applyEquationOperation(b, op2, c);
    if (inner === null) return null;
    return applyEquationOperation(a, op1, inner);
  }
  return evalEquationThreeTerms(a, op1, b, op2, c);
}

export function equationMatchesDiceAndResult(
  equationDisplay: string,
  result: number,
  dice: DiceResult | readonly [number, number, number] | null | undefined,
): boolean {
  const parsed = parseEquationDisplay(equationDisplay);
  if (!parsed) return false;
  if (parsed.rhsResult !== null && parsed.rhsResult !== result) return false;

  const evaluated = evaluateEquationDisplay(equationDisplay);
  if (evaluated === null || evaluated !== result) return false;
  if (!dice) return false;

  let diceValues: number[];
  if (isDiceTuple(dice)) {
    diceValues = [...dice];
  } else {
    diceValues = [dice.die1, dice.die2, dice.die3];
  }
  const counts = new Map<number, number>();
  for (const value of diceValues) counts.set(value, (counts.get(value) ?? 0) + 1);
  for (const value of parsed.numbers) {
    const remaining = counts.get(value) ?? 0;
    if (remaining <= 0) return false;
    counts.set(value, remaining - 1);
  }
  return true;
}

export function validateEquationCommitsForDisplay(
  hand: readonly EquationCommitCardLike[],
  equationDisplay: string,
  commits: readonly EquationCommitPayload[],
): { ok: true } | { errorKey: EquationCommitValidationKey } {
  const operators = extractEquationOperators(equationDisplay);
  for (const commit of commits) {
    const expectedOp = operators[commit.position];
    if (!expectedOp) return { errorKey: 'equation.invalidOpPosition' };

    const card = hand.find((candidate) => candidate.id === commit.cardId);
    if (!card) return { errorKey: 'equation.commitCardNotInHand' };

    if (card.type === 'joker') {
      if (commit.jokerAs == null) return { errorKey: 'equation.chooseJokerOp' };
      if (commit.jokerAs !== expectedOp) return { errorKey: 'equation.commitOpMismatch' };
      continue;
    }

    if (card.type !== 'operation') return { errorKey: 'equation.invalidCommitCard' };
    if (commit.jokerAs != null) return { errorKey: 'equation.regularOpNoJoker' };
    if (card.operation !== expectedOp) return { errorKey: 'equation.commitOpMismatch' };
  }

  return { ok: true };
}

export function enumerateEquationCommitOptions(
  hand: readonly EquationCommitCardLike[],
  equationDisplay: string,
): EquationCommitPayload[][] {
  const operators = extractEquationOperators(equationDisplay);
  if (operators.length === 0) return [[]];

  const out: EquationCommitPayload[][] = [];
  const used = new Set<string>();
  const current: EquationCommitPayload[] = [];

  const visit = (position: number) => {
    if (position >= operators.length) {
      out.push([...current]);
      return;
    }

    visit(position + 1);

    const expectedOp = operators[position]!;
    for (const card of hand) {
      if (used.has(card.id)) continue;

      if (card.type === 'operation' && card.operation === expectedOp) {
        used.add(card.id);
        current.push({ cardId: card.id, position: position as 0 | 1, jokerAs: null });
        visit(position + 1);
        current.pop();
        used.delete(card.id);
        continue;
      }

      if (card.type === 'joker') {
        used.add(card.id);
        current.push({ cardId: card.id, position: position as 0 | 1, jokerAs: expectedOp });
        visit(position + 1);
        current.pop();
        used.delete(card.id);
      }
    }
  };

  visit(0);
  return out.sort((left, right) => right.length - left.length);
}

/**
 * Validate a UUID-formatted string.
 * Returns the UUID or null if invalid.
 */
export function validatePlayerId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Validate a bot difficulty level.
 * Returns 'easy' | 'medium' | 'hard' or null if invalid.
 */
export function validateBotDifficulty(raw: unknown): 'easy' | 'medium' | 'hard' | null {
  if (raw === 'easy' || raw === 'medium' || raw === 'hard') return raw;
  return null;
}
