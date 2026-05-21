import { supabase } from '../lib/supabase';
import { findAdminCoinGiftTarget, grantAdminCoins } from './grantCoins';

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

describe('admin coin gifting helpers', () => {
  const fromMock = supabase.from as jest.Mock;
  const rpcMock = supabase.rpc as jest.Mock;
  const maybeSingleMock = jest.fn();
  const eqMock = jest.fn();
  const selectMock = jest.fn();

  beforeEach(() => {
    maybeSingleMock.mockReset();
    eqMock.mockReset();
    selectMock.mockReset();
    fromMock.mockReset();
    rpcMock.mockReset();

    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
    selectMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ select: selectMock });
  });

  it('finds a target profile by exact username', async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: 'target-1', total_coins: 1200, username: 'itcohen' },
      error: null,
    });

    await expect(findAdminCoinGiftTarget('itcohen')).resolves.toEqual({
      id: 'target-1',
      totalCoins: 1200,
      username: 'itcohen',
    });
    expect(fromMock).toHaveBeenCalledWith('profiles');
  });

  it('returns target_not_found when the username does not exist', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    await expect(grantAdminCoins({
      amount: 250,
      reason: 'gift',
      username: 'missing-player',
    })).resolves.toEqual({ status: 'target_not_found' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('calls the secure RPC and returns the updated balance on success', async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: 'target-1', total_coins: 1200, username: 'player_123' },
      error: null,
    });
    rpcMock.mockResolvedValue({ data: 'ok', error: null });

    await expect(grantAdminCoins({
      amount: 300,
      reason: 'support gift',
      username: 'player_123',
    })).resolves.toEqual({
      nextBalance: 1500,
      status: 'ok',
      target: {
        id: 'target-1',
        totalCoins: 1200,
        username: 'player_123',
      },
    });
    expect(rpcMock).toHaveBeenCalledWith('admin_grant_coins', {
      p_amount: 300,
      p_reason: 'support gift',
      p_target_user_id: 'target-1',
    });
  });

  it('surfaces invalid_amount without querying Supabase', async () => {
    await expect(grantAdminCoins({
      amount: 0,
      reason: '',
      username: 'player_123',
    })).resolves.toEqual({ status: 'invalid_amount' });
    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
