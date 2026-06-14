export const SALINDA_TUTORIAL_REWARDS = {
  basic: 75,
  advanced: 125,
} as const;

// One-time Gold Room "collect coins" reward. Granted only after the three
// foundational training tasks (basics, equation practice, special cards) are
// complete; see the Gold Room hub.
export const SALINDA_GOLD_ROOM_REWARD = 300;

export const SALINDA_GAMEPLAY_REWARDS = {
  excellence_meter_full: 15,
  standard_win: 40,
  first_win_of_day: 100,
  game_participation: 10,
} as const;

// Session momentum: the reward grows by STEP per consecutive game played in a
// single app session, starting from the 2nd game, capped at CAP. (game 1 → 0,
// game 2 → 5, game 3 → 10, … capped at 30.) Resets when the app backgrounds.
export const SESSION_MOMENTUM_STEP = 5;
export const SESSION_MOMENTUM_CAP = 30;

export const SALINDA_CATALOG = {
  table_design: {
    itemId: 'table_design',
    assetId: 'poker_red',
    price: 20,
    inventoryKind: 'table_skin',
  },
  background_design: {
    itemId: 'background_design',
    assetId: 'royal',
    price: 25,
    inventoryKind: 'theme',
  },
} as const;

export const SALINDA_COIN_SOURCES = {
  game_courage: 'game_courage',
  game_standard_win: 'game_standard_win',
  excellence_meter_full: 'excellence_meter_full',
  first_win_of_day: 'first_win_of_day',
  tutorial_core: 'tutorial_core',
  tutorial_advanced: 'tutorial_advanced',
  tutorial_legacy: 'tutorial_legacy',
  gold_room_complete: 'gold_room_complete',
  game_participation: 'game_participation',
  session_momentum: 'session_momentum',
} as const;

export type SalindaCoinSource = typeof SALINDA_COIN_SOURCES[keyof typeof SALINDA_COIN_SOURCES];
export type SalindaCatalogItemId = keyof typeof SALINDA_CATALOG;
export type SalindaAssetId = typeof SALINDA_CATALOG[SalindaCatalogItemId]['assetId'];
export type SalindaGameplayRewardId = keyof typeof SALINDA_GAMEPLAY_REWARDS;
export type ValidationStatus = 'PASSED' | 'FAILED';

export type InventoryDelta = Partial<Record<SalindaAssetId, { isUnlocked: boolean }>>;

export interface EconomyState {
  balance: number;
  inventory: InventoryDelta;
}

export interface VerificationLogEntry {
  txId: string;
  action: string;
  initialBalance: number;
  costOrReward: number;
  finalExpectedBalance: number;
  inventoryDelta: InventoryDelta;
  validationStatus: ValidationStatus;
}

export interface EconomyTransactionResult {
  state: EconomyState;
  entry: VerificationLogEntry;
  log: string;
  approved: boolean;
  reason?: 'insufficient_funds';
}

export function normalizeCoinBalance(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function createEconomyState(balance = 0, inventory: InventoryDelta = {}): EconomyState {
  return {
    balance: normalizeCoinBalance(balance),
    inventory: { ...inventory },
  };
}

export function formatInventoryDelta(delta: InventoryDelta): string {
  return JSON.stringify(delta);
}

export function formatVerificationLog(entry: VerificationLogEntry): string {
  return [
    `[${entry.txId}] Action: ${entry.action}`,
    `  - Initial Balance: ${entry.initialBalance}`,
    `  - Cost/Reward: ${entry.costOrReward}`,
    `  - Final Expected Balance: ${entry.finalExpectedBalance}`,
    `  - Inventory Delta: ${formatInventoryDelta(entry.inventoryDelta)}`,
    `  - Validation Status: [${entry.validationStatus}]`,
  ].join('\n');
}

export function applyRewardTransaction(
  state: EconomyState,
  opts: {
    txId: string;
    action: string;
    reward: number;
  },
): EconomyTransactionResult {
  const initialBalance = normalizeCoinBalance(state.balance);
  const reward = normalizeCoinBalance(opts.reward);
  const nextState: EconomyState = {
    balance: initialBalance + reward,
    inventory: { ...state.inventory },
  };
  const entry: VerificationLogEntry = {
    txId: opts.txId,
    action: opts.action,
    initialBalance,
    costOrReward: reward,
    finalExpectedBalance: nextState.balance,
    inventoryDelta: {},
    validationStatus: 'PASSED',
  };
  return {
    state: nextState,
    entry,
    log: formatVerificationLog(entry),
    approved: true,
  };
}

export function applyPurchaseTransaction(
  state: EconomyState,
  opts: {
    txId: string;
    action: string;
    itemId: SalindaCatalogItemId;
  },
): EconomyTransactionResult {
  const item = SALINDA_CATALOG[opts.itemId];
  const initialBalance = normalizeCoinBalance(state.balance);
  const canAfford = initialBalance >= item.price;
  const inventoryDelta: InventoryDelta = canAfford
    ? { [item.assetId]: { isUnlocked: true } }
    : {};
  const nextState: EconomyState = canAfford
    ? {
        balance: normalizeCoinBalance(initialBalance - item.price),
        inventory: {
          ...state.inventory,
          ...inventoryDelta,
        },
      }
    : {
        balance: initialBalance,
        inventory: { ...state.inventory },
      };
  const entry: VerificationLogEntry = {
    txId: opts.txId,
    action: opts.action,
    initialBalance,
    costOrReward: item.price,
    finalExpectedBalance: nextState.balance,
    inventoryDelta,
    validationStatus: 'PASSED',
  };
  return {
    state: nextState,
    entry,
    log: formatVerificationLog(entry),
    approved: canAfford,
    reason: canAfford ? undefined : 'insufficient_funds',
  };
}

export function shouldAwardLocalStandardWinReward(opts: {
  phase: string;
  mode: string;
  isTutorial: boolean;
  winnerIsBot: boolean;
  rewardSessionKey: string | null;
  lastAwardedSessionKey: string | null;
}): boolean {
  return (
    opts.phase === 'game-over' &&
    (opts.mode === 'solo' || opts.mode === 'vs-bot') &&
    !opts.isTutorial &&
    !opts.winnerIsBot &&
    opts.rewardSessionKey !== null &&
    opts.rewardSessionKey !== opts.lastAwardedSessionKey
  );
}

/**
 * Coins awarded for the Nth consecutive game played in a single app session.
 * Game 1 → 0, then +SESSION_MOMENTUM_STEP per game, capped at SESSION_MOMENTUM_CAP.
 */
export function sessionMomentumReward(consecutiveGames: number): number {
  if (!Number.isFinite(consecutiveGames) || consecutiveGames <= 1) return 0;
  const steps = Math.floor(consecutiveGames) - 1;
  return Math.min(SESSION_MOMENTUM_CAP, steps * SESSION_MOMENTUM_STEP);
}

/**
 * Participation reward fires once per finished local game (win OR loss),
 * unlike the standard-win reward which requires a human win.
 */
export function shouldAwardParticipationReward(opts: {
  phase: string;
  mode: string;
  isTutorial: boolean;
  rewardSessionKey: string | null;
  lastAwardedSessionKey: string | null;
}): boolean {
  return (
    opts.phase === 'game-over' &&
    (opts.mode === 'solo' || opts.mode === 'vs-bot') &&
    !opts.isTutorial &&
    opts.rewardSessionKey !== null &&
    opts.rewardSessionKey !== opts.lastAwardedSessionKey
  );
}
