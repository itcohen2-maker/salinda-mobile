import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  AuthProvider,
  useAuth,
  type PlayerProfile,
} from './useAuth';
import { performSocialSignIn } from '../auth/socialSignIn';
import { supabase } from '../lib/supabase';

jest.mock('../auth/socialSignIn', () => ({
  createSessionFromUrl: jest.fn(),
  performSocialSignIn: jest.fn(),
  SOCIAL_AUTH_CALLBACK_PATH: 'auth/callback',
}));

const profilesById: Record<string, PlayerProfile> = {
  'user-1': {
    id: 'user-1',
    username: 'Lea',
    rating: 1200,
    wins: 0,
    losses: 0,
    abandons: 0,
    total_coins: 25,
    slinda_owned: false,
    wild_owned: false,
    themes_owned: [],
    table_skins_owned: [],
    active_card_back: 'default',
    active_table_theme: 'default',
    active_table_skin: null,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  'anon-1': {
    id: 'anon-1',
    username: 'Guest',
    rating: 1200,
    wins: 0,
    losses: 0,
    abandons: 0,
    total_coins: 0,
    slinda_owned: false,
    wild_owned: false,
    themes_owned: [],
    table_skins_owned: [],
    active_card_back: 'default',
    active_table_theme: 'default',
    active_table_skin: null,
    created_at: '2026-01-01T00:00:00.000Z',
  },
};

const mockSupabase = supabase as unknown as {
  auth: {
    getSession: jest.Mock;
    onAuthStateChange: jest.Mock;
    signInAnonymously: jest.Mock;
    signOut: jest.Mock;
  };
  from: jest.Mock;
};

function createProfileQuery() {
  let selectedUserId = '';
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn((field: string, value: string) => {
      if (field === 'id') selectedUserId = value;
      return query;
    }),
    single: jest.fn(async () => ({
      data: profilesById[selectedUserId],
      error: null,
    })),
  };
  return query;
}

describe('useAuth', () => {
  const signedInSession = {
    user: {
      id: 'user-1',
      email: 'lea@example.com',
      is_anonymous: false,
    },
  } as never;
  const guestSession = {
    user: {
      id: 'anon-1',
      is_anonymous: true,
    },
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockImplementation(() => createProfileQuery());
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: jest.fn(),
        },
      },
    });
    mockSupabase.auth.signOut.mockResolvedValue({ error: null });
    mockSupabase.auth.signInAnonymously.mockResolvedValue({
      data: { session: guestSession },
      error: null,
    });
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: signedInSession },
    });
    (performSocialSignIn as jest.Mock).mockResolvedValue({ error: null });
  });

  it('signs out and immediately restores a guest session', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.id).toBe('user-1');
    expect(result.current.isAnonymous).toBe(false);

    await act(async () => {
      expect(await result.current.signOutToGuest()).toEqual({ error: null });
    });

    await waitFor(() => expect(result.current.user?.id).toBe('anon-1'));
    expect(result.current.isAnonymous).toBe(true);
    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    expect(mockSupabase.auth.signInAnonymously).toHaveBeenCalled();
  });

  it('passes account-picker options into Google sign-in and refreshes the session', async () => {
    mockSupabase.auth.getSession
      .mockResolvedValueOnce({ data: { session: guestSession } })
      .mockResolvedValueOnce({ data: { session: signedInSession } });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.id).toBe('anon-1');

    await act(async () => {
      expect(await result.current.signInWithProvider('google', { forceAccountPicker: true })).toEqual({ error: null });
    });

    expect(performSocialSignIn).toHaveBeenCalledWith('google', { forceAccountPicker: true });
    await waitFor(() => expect(result.current.user?.id).toBe('user-1'));
    expect(result.current.isAnonymous).toBe(false);
  });
});
