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
    expect(state.balance).toBe(10);

    commit(applyRewardTransaction(state, {
      txId: 'TX_002',
      action: 'Advanced Tutorial Completed',
      reward: SALINDA_TUTORIAL_REWARDS.advanced,
    }));
    expect(state.balance).toBe(30);

    const blockedTable = applyPurchaseTransaction(state, {
      txId: 'TX_003',
      action: 'Purchase Table Design',
      itemId: 'table_design',
    });
    commit(blockedTable);
    expect(blockedTable.approved).toBe(false);
    expect(blockedTable.reason).toBe('insufficient_funds');
    expect(state.balance).toBe(30);
    expect(state.inventory.poker_red).toBeUndefined();

    commit(applyRewardTransaction(state, {
      txId: 'TX_004',
      action: 'Standard Win',
      reward: SALINDA_GAMEPLAY_REWARDS.standard_win,
    }));
    expect(state.balance).toBe(40);

    const tablePurchase = applyPurchaseTransaction(state, {
      txId: 'TX_005',
      action: 'Purchase Table Design',
      itemId: 'table_design',
    });
    commit(tablePurchase);
    expect(tablePurchase.approved).toBe(true);
    expect(state.balance).toBe(0);
    expect(state.inventory.poker_red).toEqual({ isUnlocked: true });

    const blockedBackground = applyPurchaseTransaction(state, {
      txId: 'TX_006',
      action: 'Purchase Background Design',
      itemId: 'background_design',
    });
    commit(blockedBackground);
    expect(blockedBackground.approved).toBe(false);
    expect(blockedBackground.reason).toBe('insufficient_funds');
    expect(state.balance).toBe(0);

    for (let i = 0; i < 5; i += 1) {
      commit(applyRewardTransaction(state, {
        txId: `TX_${String(7 + i).padStart(3, '0')}`,
        action: 'Standard Win',
        reward: SALINDA_GAMEPLAY_REWARDS.standard_win,
      }));
    }
    expect(state.balance).toBe(50);

    const backgroundPurchase = applyPurchaseTransaction(state, {
      txId: 'TX_012',
      action: 'Purchase Background Design',
      itemId: 'background_design',
    });
    commit(backgroundPurchase);
    expect(backgroundPurchase.approved).toBe(true);
    expect(state.balance).toBe(0);
    expect(state.inventory.royal).toEqual({ isUnlocked: true });

    for (let i = 0; i < 15; i += 1) {
      commit(applyRewardTransaction(state, {
        txId: `TX_${String(13 + i).padStart(3, '0')}`,
        action: 'Standard Win',
        reward: SALINDA_GAMEPLAY_REWARDS.standard_win,
      }));
    }
    expect(state.balance).toBe(150);

    const salindaPurchase = applyPurchaseTransaction(state, {
      txId: 'TX_028',
      action: 'Purchase Salinda Card',
      itemId: 'salinda_card',
    });
    commit(salindaPurchase);
    expect(salindaPurchase.approved).toBe(true);
    expect(state.balance).toBe(0);
    expect(state.inventory.salinda_card).toEqual({ isUnlocked: true });

    for (let i = 0; i < 20; i += 1) {
      commit(applyRewardTransaction(state, {
        txId: `TX_${String(29 + i).padStart(3, '0')}`,
        action: 'Standard Win',
        reward: SALINDA_GAMEPLAY_REWARDS.standard_win,
      }));
    }
    expect(state.balance).toBe(200);

    const wildPurchase = applyPurchaseTransaction(state, {
      txId: 'TX_049',
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
      '  - Cost/Reward: 10',
      '  - Final Expected Balance: 10',
      '  - Inventory Delta: {}',
      '  - Validation Status: [PASSED]',
    ].join('\n'));
    expect(logs[2]).toContain('  - Final Expected Balance: 30');
    expect(logs[4]).toContain('  - Inventory Delta: {"poker_red":{"isUnlocked":true}}');
    expect(logs[48]).toContain('  - Inventory Delta: {"wild_card":{"isUnlocked":true}}');

    // Required audit output: one exact verification log per transaction.
    console.log(logs.join('\n'));
  });

it('awards 5 coins when the excellence meter fills during gameplay', () => {
    const tx = applyRewardTransaction(createEconomyState(0), {
      txId: 'TX_EXCELLENCE',
      action: 'Excellence Meter Full',
      reward: SALINDA_GAMEPLAY_REWARDS.excellence_meter_full,
    });

    expect(tx.state.balance).toBe(5);
    expect(tx.entry.costOrReward).toBe(5);
  });

  it('keeps catalog prices aligned with production catalog definitions', () => {
    expect(SALINDA_CATALOG.table_design.assetId).toBe('poker_red');
    expect(SALINDA_CATALOG.table_design.price).toBe(TABLE_SKINS.poker_red.price);
    expect(SALINDA_CATALOG.background_design.assetId).toBe('royal');
    expect(SALINDA_CATALOG.background_design.price).toBe(THEMES.royal.price);
    expect(SALINDA_CATALOG.salinda_card.price).toBe(150);
    expect(SALINDA_CATALOG.wild_card.price).toBe(200);
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
