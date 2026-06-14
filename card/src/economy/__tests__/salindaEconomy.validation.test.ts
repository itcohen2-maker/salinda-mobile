import {
  SALINDA_CATALOG,
  SALINDA_GAMEPLAY_REWARDS,
  applyPurchaseTransaction,
  applyRewardTransaction,
  createEconomyState,
  shouldAwardLocalStandardWinReward,
} from '../../../shared/salindaEconomy';
import { TABLE_SKINS } from '../../theme/tableSkins';
import { THEMES } from '../../theme/themes';

describe('Salinda economy validation suite', () => {
  it('executes the chronological shop and reward validation flow', () => {
    let state = createEconomyState(0);
    const logs: string[] = [];

    const commit = (tx: ReturnType<typeof applyRewardTransaction> | ReturnType<typeof applyPurchaseTransaction>) => {
      logs.push(tx.log);
      state = tx.state;
      expect(tx.entry.validationStatus).toBe('PASSED');
      expect(state.balance).toBeGreaterThanOrEqual(0);
    };

    const blockedBackground = applyPurchaseTransaction(state, {
      txId: 'TX_001',
      action: 'Purchase Background Design',
      itemId: 'background_design',
    });
    commit(blockedBackground);
    expect(blockedBackground.approved).toBe(false);
    expect(blockedBackground.reason).toBe('insufficient_funds');
    expect(state.balance).toBe(0);
    expect(state.inventory.royal).toBeUndefined();

    commit(applyRewardTransaction(state, {
      txId: 'TX_002',
      action: 'Earn 20 Gold Credits',
      reward: SALINDA_CATALOG.table_design.price,
    }));
    expect(state.balance).toBe(20);

    const tablePurchase = applyPurchaseTransaction(state, {
      txId: 'TX_003',
      action: 'Purchase Table Design',
      itemId: 'table_design',
    });
    commit(tablePurchase);
    expect(tablePurchase.approved).toBe(true);
    expect(state.balance).toBe(0);
    expect(state.inventory.poker_red).toEqual({ isUnlocked: true });

    commit(applyRewardTransaction(state, {
      txId: 'TX_004',
      action: 'Earn 25 Gold Credits',
      reward: SALINDA_CATALOG.background_design.price,
    }));
    expect(state.balance).toBe(25);

    const backgroundPurchase = applyPurchaseTransaction(state, {
      txId: 'TX_005',
      action: 'Purchase Background Design',
      itemId: 'background_design',
    });
    commit(backgroundPurchase);
    expect(backgroundPurchase.approved).toBe(true);
    expect(state.balance).toBe(0);
    expect(state.inventory.royal).toEqual({ isUnlocked: true });

    expect(logs[0]).toBe([
      '[TX_001] Action: Purchase Background Design',
      '  - Initial Balance: 0',
      '  - Cost/Reward: 25',
      '  - Final Expected Balance: 0',
      '  - Inventory Delta: {}',
      '  - Validation Status: [PASSED]',
    ].join('\n'));
    expect(logs[2]).toContain('  - Final Expected Balance: 0');
    expect(logs[2]).toContain('  - Inventory Delta: {"poker_red":{"isUnlocked":true}}');
    expect(logs[4]).toContain('  - Inventory Delta: {"royal":{"isUnlocked":true}}');

    // Required audit output: one exact verification log per transaction.
    console.log(logs.join('\n'));
  });

  it('awards the excellence-meter reward when the meter fills during gameplay', () => {
    const tx = applyRewardTransaction(createEconomyState(0), {
      txId: 'TX_EXCELLENCE',
      action: 'Excellence Meter Full',
      reward: SALINDA_GAMEPLAY_REWARDS.excellence_meter_full,
    });

    // Phase 1 rebalance: meter reward 1 → 15 (now actually felt).
    expect(tx.state.balance).toBe(SALINDA_GAMEPLAY_REWARDS.excellence_meter_full);
    expect(tx.entry.costOrReward).toBe(SALINDA_GAMEPLAY_REWARDS.excellence_meter_full);
    expect(SALINDA_GAMEPLAY_REWARDS.excellence_meter_full).toBe(15);
  });

  it('keeps catalog prices aligned with production catalog definitions', () => {
    expect(SALINDA_CATALOG.table_design.assetId).toBe('poker_red');
    expect(SALINDA_CATALOG.table_design.price).toBe(TABLE_SKINS.poker_red.price);
    expect(SALINDA_CATALOG.background_design.assetId).toBe('royal');
    expect(SALINDA_CATALOG.background_design.price).toBe(THEMES.royal.price);
    expect('salinda_card' in SALINDA_CATALOG).toBe(false);
    expect('wild_card' in SALINDA_CATALOG).toBe(false);
  });

  it('blocks purchases without allowing negative balances', () => {
    const tx = applyPurchaseTransaction(createEconomyState(0), {
      txId: 'TX_BLOCKED',
      action: 'Purchase Background Design',
      itemId: 'background_design',
    });

    expect(tx.approved).toBe(false);
    expect(tx.state.balance).toBe(0);
    expect(tx.state.balance).toBeGreaterThanOrEqual(0);
  });

  it('allows the gameplay win reward gate only once per local session key', () => {
    const sessionKey = 'solo-123';

    expect(shouldAwardLocalStandardWinReward({
      phase: 'game-over',
      mode: 'solo',
      isTutorial: false,
      winnerIsBot: false,
      rewardSessionKey: sessionKey,
      lastAwardedSessionKey: null,
    })).toBe(true);

    expect(shouldAwardLocalStandardWinReward({
      phase: 'game-over',
      mode: 'solo',
      isTutorial: false,
      winnerIsBot: false,
      rewardSessionKey: sessionKey,
      lastAwardedSessionKey: sessionKey,
    })).toBe(false);
  });
});
