import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../lib/supabase', () => {
  const rpc = jest.fn().mockResolvedValue({ error: null });
  const updateLt = jest.fn().mockResolvedValue({ error: null });
  const updateEq = jest.fn().mockReturnValue({ lt: updateLt });
  const update = jest.fn().mockReturnValue({ eq: updateEq });
  const single = jest.fn().mockResolvedValue({
    data: {
      id: 'u1',
      username: 'test',
      rating: 1000,
      wins: 0,
      losses: 0,
      abandons: 0,
      total_coins: 0,
      created_at: '',
    },
    error: null,
  });
  const selectEq = jest.fn().mockReturnValue({ single });
  const select = jest.fn().mockReturnValue({ eq: selectEq });
  const from = jest.fn().mockImplementation(() => ({
    select,
    update,
  }));

  return {
    supabase: {
      rpc,
      from,
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: jest.fn().mockReturnValue({
          data: { subscription: { unsubscribe: jest.fn() } },
        }),
      },
    },
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { ensureMinimumProfileCoins, syncTutorialCoins } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

const mockRpc = supabase.rpc as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

beforeEach(async () => {
  await AsyncStorage.clear();
  mockRpc.mockClear();
  mockRpc.mockResolvedValue({ error: null });
  mockFrom.mockClear();
});

describe('syncTutorialCoins', () => {
  it('does nothing when no tutorial coins in AsyncStorage', async () => {
    await syncTutorialCoins();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('does nothing when already synced', async () => {
    await AsyncStorage.setItem('salinda_tutorial_coins_earned_count', '1');
    await AsyncStorage.setItem('salinda_tutorial_coins_synced', 'true');
    await syncTutorialCoins();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('awards tutorial_core (150 coins) when count = 1', async () => {
    await AsyncStorage.setItem('salinda_tutorial_coins_earned_count', '1');
    await syncTutorialCoins();
    expect(mockRpc).toHaveBeenCalledWith('award_coins', { p_amount: 150, p_source: 'tutorial_core' });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const synced = await AsyncStorage.getItem('salinda_tutorial_coins_synced');
    expect(synced).toBe('true');
  });

  it('awards tutorial_core + tutorial_advanced when count = 2', async () => {
    await AsyncStorage.setItem('salinda_tutorial_coins_earned_count', '2');
    await syncTutorialCoins();
    expect(mockRpc).toHaveBeenCalledWith('award_coins', { p_amount: 150, p_source: 'tutorial_core' });
    expect(mockRpc).toHaveBeenCalledWith('award_coins', { p_amount: 250, p_source: 'tutorial_advanced' });
    expect(mockRpc).toHaveBeenCalledTimes(2);
    const synced = await AsyncStorage.getItem('salinda_tutorial_coins_synced');
    expect(synced).toBe('true');
  });

  it('uses tutorial_legacy fallback for unexpected count', async () => {
    await AsyncStorage.setItem('salinda_tutorial_coins_earned_count', '5');
    await syncTutorialCoins();
    expect(mockRpc).toHaveBeenCalledWith('award_coins', { p_amount: 750, p_source: 'tutorial_legacy' });
    const synced = await AsyncStorage.getItem('salinda_tutorial_coins_synced');
    expect(synced).toBe('true');
  });

  it('leaves synced flag unset if RPC fails so it retries on next login', async () => {
    await AsyncStorage.setItem('salinda_tutorial_coins_earned_count', '1');
    mockRpc.mockRejectedValueOnce(new Error('network error'));
    await syncTutorialCoins();
    const synced = await AsyncStorage.getItem('salinda_tutorial_coins_synced');
    expect(synced).toBeNull();
  });
});

describe('ensureMinimumProfileCoins', () => {
  it('keeps the stored wallet balance without auto-top-up', async () => {
    const nextCoins = await ensureMinimumProfileCoins('u1', 125);

    expect(nextCoins).toBe(125);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('normalizes negative and invalid values to zero', async () => {
    expect(await ensureMinimumProfileCoins('u1', -50)).toBe(0);
    expect(await ensureMinimumProfileCoins('u1', Number.NaN)).toBe(0);
    expect(await ensureMinimumProfileCoins('u1', Number.POSITIVE_INFINITY)).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rounds down fractional balances', async () => {
    const nextCoins = await ensureMinimumProfileCoins('u1', 12000.9);

    expect(nextCoins).toBe(12000);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
