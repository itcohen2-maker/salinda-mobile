import {
  SALINDA_CATALOG,
  SALINDA_GAMEPLAY_REWARDS,
  SALINDA_TUTORIAL_REWARDS,
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

    commit(applyRewardTransaction(state, {
      txId: 'TX_001',
      action: 'Basic Tutorial Completed',
      reward: SALINDA_TUTORIAL_REWARDS.basic,
    }));
    expect(state.balance).toBe(150);

    commit(applyRewardTransaction(state, {
      txId: 'TX_002',
      action: 'Advanced Tutorial Completed',
      reward: SALINDA_TUTORIAL_REWARDS.advanced,
    }));
    expect(state.balance).toBe(400);

    const tablePurchase = applyPurchaseTransaction(state, {
      txId: 'TX_003',
      action: 'Purchase Table Design',
      itemId: 'table_design',
    });
    commit(tablePurchase);
    expect(tablePurchase.approved).toBe(true);
    expect(state.balance).toBe(0);
    expect(state.inventory.poker_red).toEqual({ isUnlocked: true });

    const blockedBackground = applyPurchaseTransaction(state, {
      txId: 'TX_004',
      action: 'Purchase Background Design',
      itemId: 'background_design',
    });
    commit(blockedBackground);
    expect(blockedBackground.approved).toBe(false);
    expect(blockedBackground.reason).toBe('insufficient_funds');
    expect(state.balance).toBe(0);
    expect(state.inventory.royal).toBeUndefined();

    for (let i = 0; i < 5; i += 1) {
      commit(applyRewardTransaction(state, {
        txId: `TX_${String(5 + i).padStart(3, '0')}`,
        action: 'Standard Win',
        reward: SALINDA_GAMEPLAY_REWARDS.standard_win,
      }));
    }
    expect(state.balance).toBe(500);

    const backgroundPurchase = applyPurchaseTransaction(state, {
      txId: 'TX_010',
      action: 'Purchase Background Design',
      itemId: 'background_design',
    });
    commit(backgroundPurchase);
    expect(backgroundPurchase.approved).toBe(true);
    expect(state.balance).toBe(0);
    expect(state.inventory.royal).toEqual({ isUnlocked: true });

    for (let i = 0; i < 15; i += 1) {
      commit(applyRewardTransaction(state, {
        txId: `TX_${String(11 + i).padStart(3, '0')}`,
        action: 'Standard Win',
        reward: SALINDA_GAMEPLAY_REWARDS.standard_win,
      }));
    }
    expect(state.balance).toBe(1500);

    const salindaPurchase = applyPurchaseTransaction(state, {
      txId: 'TX_026',
      action: 'Purchase Salinda Card',
      itemId: 'salinda_card',
    });
    commit(salindaPurchase);
    expect(salindaPurchase.approved).toBe(true);
    expect(state.balance).toBe(0);
    expect(state.inventory.salinda_card).toEqual({ isUnlocked: true });

    for (let i = 0; i < 20; i += 1) {
      commit(applyRewardTransaction(state, {
        txId: `TX_${String(27 + i).padStart(3, '0')}`,
        action: 'Standard Win',
        reward: SALINDA_GAMEPLAY_REWARDS.standard_win,
      }));
    }
    expect(state.balance).toBe(2000);

    const wildPurchase = applyPurchaseTransaction(state, {
      txId: 'TX_047',
      action: 'Purchase Wild Card',
      itemId: 'wild_card',
    });
    commit(wildPurchase);
    expect(wildPurchase.approved).toBe(true);
    expect(state.balance).toBe(0);
    expect(state.inventory.wild_card).toEqual({ isUnlocked: true });

    expect(logs[0]).toBe([
      '[TX_001] Action: Basic Tutorial Completed',
      '  - Initial Balance: 0',
      '  - Cost/Reward: 150',
      '  - Final Expected Balance: 150',
      '  - Inventory Delta: {}',
      '  - Validation Status: [PASSED]',
    ].join('\n'));
    expect(logs[2]).toContain('  - Final Expected Balance: 0');
    expect(logs[2]).toContain('  - Inventory Delta: {"poker_red":{"isUnlocked":true}}');
    expect(logs[46]).toContain('  - Inventory Delta: {"wild_card":{"isUnlocked":true}}');

    // Required audit output: one exact verification log per transaction.
    console.log(logs.join('\n'));
  });

  it('awards 50 coins when the excellence meter fills during gameplay', () => {
    const tx = applyRewardTransaction(createEconomyState(0), {
      txId: 'TX_EXCELLENCE',
      action: 'Excellence Meter Full',
      reward: SALINDA_GAMEPLAY_REWARDS.excellence_meter_full,
    });

    expect(tx.state.balance).toBe(50);
    expect(tx.entry.costOrReward).toBe(50);
  });

  it('keeps catalog prices aligned with production catalog definitions', () => {
    expect(SALINDA_CATALOG.table_design.assetId).toBe('poker_red');
    expect(SALINDA_CATALOG.table_design.price).toBe(TABLE_SKINS.poker_red.price);
    expect(SALINDA_CATALOG.background_design.assetId).toBe('royal');
    expect(SALINDA_CATALOG.background_design.price).toBe(THEMES.royal.price);
    expect(SALINDA_CATALOG.salinda_card.price).toBe(1500);
    expect(SALINDA_CATALOG.wild_card.price).toBe(2000);
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
