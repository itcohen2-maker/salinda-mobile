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
    await AsyncStorage.setItem('lulos_tutorial_coins_earned_count', '1');
    await AsyncStorage.setItem('lulos_tutorial_coins_synced', 'true');
    await syncTutorialCoins();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('awards tutorial_core (10 coins) when count = 1', async () => {
    await AsyncStorage.setItem('lulos_tutorial_coins_earned_count', '1');
    await syncTutorialCoins();
    expect(mockRpc).toHaveBeenCalledWith('award_coins', { p_amount: 10, p_source: 'tutorial_core' });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const synced = await AsyncStorage.getItem('lulos_tutorial_coins_synced');
    expect(synced).toBe('true');
  });

  it('awards tutorial_core + tutorial_advanced when count = 2', async () => {
    await AsyncStorage.setItem('lulos_tutorial_coins_earned_count', '2');
    await syncTutorialCoins();
    expect(mockRpc).toHaveBeenCalledWith('award_coins', { p_amount: 10, p_source: 'tutorial_core' });
    expect(mockRpc).toHaveBeenCalledWith('award_coins', { p_amount: 20, p_source: 'tutorial_advanced' });
    expect(mockRpc).toHaveBeenCalledTimes(2);
    const synced = await AsyncStorage.getItem('lulos_tutorial_coins_synced');
    expect(synced).toBe('true');
  });

  it('uses tutorial_legacy fallback for unexpected count', async () => {
    await AsyncStorage.setItem('lulos_tutorial_coins_earned_count', '5');
    await syncTutorialCoins();
    expect(mockRpc).toHaveBeenCalledWith('award_coins', { p_amount: 50, p_source: 'tutorial_legacy' });
    const synced = await AsyncStorage.getItem('lulos_tutorial_coins_synced');
    expect(synced).toBe('true');
  });

  it('leaves synced flag unset if RPC fails so it retries on next login', async () => {
    await AsyncStorage.setItem('lulos_tutorial_coins_earned_count', '1');
    mockRpc.mockRejectedValueOnce(new Error('network error'));
    await syncTutorialCoins();
    const synced = await AsyncStorage.getItem('lulos_tutorial_coins_synced');
    expect(synced).toBeNull();
  });
});

describe('ensureMinimumProfileCoins', () => {
  it('tops up balances below 10000', async () => {
    const nextCoins = await ensureMinimumProfileCoins('u1', 125);

    expect(nextCoins).toBe(10000);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    const query = mockFrom.mock.results[0]?.value as {
      update: jest.Mock;
    };
    expect(query.update).toHaveBeenCalledWith({ total_coins: 10000 });
    const eqStage = query.update.mock.results[0]?.value as { eq: jest.Mock };
    expect(eqStage.eq).toHaveBeenCalledWith('id', 'u1');
    const ltStage = eqStage.eq.mock.results[0]?.value as { lt: jest.Mock };
    expect(ltStage.lt).toHaveBeenCalledWith('total_coins', 10000);
  });

  it('does not update balances already at or above 10000', async () => {
    const nextCoins = await ensureMinimumProfileCoins('u1', 12000);

    expect(nextCoins).toBe(12000);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('does not top up again after the wallet has already been seeded once', async () => {
    expect(await ensureMinimumProfileCoins('u1', 125)).toBe(10000);

    mockFrom.mockClear();

    const nextCoins = await ensureMinimumProfileCoins('u1', 9850);

    expect(nextCoins).toBe(9850);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('remembers profiles that already started above the threshold', async () => {
    expect(await ensureMinimumProfileCoins('u1', 12000)).toBe(12000);

    mockFrom.mockClear();

    const nextCoins = await ensureMinimumProfileCoins('u1', 9800);

    expect(nextCoins).toBe(9800);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('ignores the old 7000 seed marker and tops up to the new minimum', async () => {
    await AsyncStorage.setItem('lulos_local_min_profile_coins_seeded:7000:u1', 'true');

    const nextCoins = await ensureMinimumProfileCoins('u1', 7000);

    expect(nextCoins).toBe(10000);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
  });
});
