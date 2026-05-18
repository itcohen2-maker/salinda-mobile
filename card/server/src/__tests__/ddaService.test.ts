import { resolveBotConfig, onMatchEnd } from '../ddaService';

jest.mock('../supabaseAdmin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

import { supabaseAdmin } from '../supabaseAdmin';

function mockSelect(data: { loss_streak: number; is_first_game: boolean } | null, error?: Error) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error: error ?? null }),
  };
  (supabaseAdmin!.from as jest.Mock).mockReturnValue(chain);
  return chain;
}

function mockUpdate() {
  const chain = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error: null }),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { loss_streak: 1 }, error: null }),
  };
  (supabaseAdmin!.from as jest.Mock).mockReturnValue(chain);
  return chain;
}

describe('resolveBotConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns pity when loss_streak >= 3', async () => {
    mockSelect({ loss_streak: 3, is_first_game: false });
    const result = await resolveBotConfig('user-1', 'hard');
    expect(result).toEqual({ difficulty: 'pity', isPity: true });
  });

  it('returns pity when loss_streak = 5', async () => {
    mockSelect({ loss_streak: 5, is_first_game: false });
    const result = await resolveBotConfig('user-1', 'easy');
    expect(result).toEqual({ difficulty: 'pity', isPity: true });
  });

  it('returns pity when is_first_game is true', async () => {
    mockSelect({ loss_streak: 0, is_first_game: true });
    const result = await resolveBotConfig('user-1', 'medium');
    expect(result).toEqual({ difficulty: 'pity', isPity: true });
  });

  it('returns requested difficulty when streak < 3 and not first game', async () => {
    mockSelect({ loss_streak: 2, is_first_game: false });
    const result = await resolveBotConfig('user-1', 'hard');
    expect(result).toEqual({ difficulty: 'hard', isPity: false });
  });

  it('returns requested difficulty for null userId (guest) — no DB call', async () => {
    const result = await resolveBotConfig(null, 'easy');
    expect(result).toEqual({ difficulty: 'easy', isPity: false });
    expect(supabaseAdmin!.from).not.toHaveBeenCalled();
  });

  it('falls back to requested difficulty if Supabase returns error', async () => {
    mockSelect(null, new Error('network error'));
    const result = await resolveBotConfig('user-1', 'medium');
    expect(result).toEqual({ difficulty: 'medium', isPity: false });
  });
});

describe('onMatchEnd', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates with loss_streak=0 on win', async () => {
    const chain = mockUpdate();
    await onMatchEnd('user-1', true);
    expect(chain.update).toHaveBeenCalledWith({ loss_streak: 0, is_first_game: false });
  });

  it('increments loss_streak on loss (read then write)', async () => {
    // The loss branch does: SELECT loss_streak, then UPDATE loss_streak + 1
    // Both calls go through supabaseAdmin.from()
    const selectChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { loss_streak: 2 }, error: null }),
    };
    const updateChain = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };
    (supabaseAdmin!.from as jest.Mock)
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);

    await onMatchEnd('user-1', false);

    expect(updateChain.update).toHaveBeenCalledWith({ loss_streak: 3, is_first_game: false });
  });
});
