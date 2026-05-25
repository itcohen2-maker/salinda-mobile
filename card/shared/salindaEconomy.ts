export const SALINDA_TUTORIAL_REWARDS = {
  basic: 10,
  advanced: 20,
} as const;

export const SALINDA_GAMEPLAY_REWARDS = {
  excellence_meter_full: 5,
  standard_win: 10,
} as const;

export const SALINDA_CATALOG = {
  table_design: {
    itemId: 'table_design',
    assetId: 'poker_red',
    price: 40,
    inventoryKind: 'table_skin',
  },
  background_design: {
    itemId: 'background_design',
    assetId: 'royal',
    price: 50,
    inventoryKind: 'theme',
  },
  salinda_card: {
    itemId: 'salinda_card',
    assetId: 'salinda_card',
    price: 150,
    inventoryKind: 'special_card',
  },
  wild_card: {
    itemId: 'wild_card',
    assetId: 'wild_card',
    price: 200,
    inventoryKind: 'special_card',
  },
} as const;

export const SALINDA_COIN_SOURCES = {
  game_courage: 'game_courage',
  game_standard_win: 'game_standard_win',
  excellence_meter_full: 'excellence_meter_full',
  tutorial_core: 'tutorial_core',
  tutorial_advanced: 'tutorial_advanced',
  tutorial_legacy: 'tutorial_legacy',
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
