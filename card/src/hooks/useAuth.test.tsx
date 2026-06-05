import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import {
  AuthProvider,
  isAnonymousAuthUser,
  isRegisteredAuthUser,
  useAuth,
  type PlayerProfile,
} from './useAuth';
import {
  consumeSocialAuthReturnTo,
  createSessionFromUrl,
  isSocialAuthCallbackUrl,
  performSocialSignIn,
} from '../auth/socialSignIn';
import { supabase } from '../lib/supabase';

jest.mock('../auth/socialSignIn', () => ({
  consumeSocialAuthReturnTo: jest.fn(),
  createSessionFromUrl: jest.fn(),
  isSocialAuthCallbackUrl: jest.fn(),
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
const platformRef = Platform as typeof Platform & { OS: string };
const originalPlatform = platformRef.OS;

describe('auth user classification', () => {
  it('treats provider-only anonymous sessions as guests', () => {
    const user = {
      id: 'anon-1',
      app_metadata: { provider: 'anonymous', providers: ['anonymous'] },
      identities: [{ provider: 'anonymous' }],
    } as never;

    expect(isAnonymousAuthUser(user)).toBe(true);
    expect(isRegisteredAuthUser(user)).toBe(false);
  });

  it('does not treat a bare no-email session as registered', () => {
    const user = {
      id: 'anon-legacy',
      app_metadata: {},
      identities: [],
    } as never;

    expect(isAnonymousAuthUser(user)).toBe(true);
    expect(isRegisteredAuthUser(user)).toBe(false);
  });

  it('treats email or social sessions as registered users', () => {
    expect(isRegisteredAuthUser({
      id: 'email-1',
      email: 'lea@example.com',
      app_metadata: { provider: 'email', providers: ['email'] },
    } as never)).toBe(true);

    expect(isRegisteredAuthUser({
      id: 'google-1',
      app_metadata: { provider: 'google', providers: ['google'] },
      identities: [{ provider: 'google' }],
    } as never)).toBe(true);
  });
});

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
    (consumeSocialAuthReturnTo as jest.Mock).mockReturnValue('/');
    (createSessionFromUrl as jest.Mock).mockResolvedValue(undefined);
    (isSocialAuthCallbackUrl as jest.Mock).mockReturnValue(false);
    (performSocialSignIn as jest.Mock).mockResolvedValue({ error: null });
  });

  afterAll(() => {
    platformRef.OS = originalPlatform;
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

  it('continues bootstrapping when the web OAuth callback exchange fails', async () => {
    platformRef.OS = 'web';
    (isSocialAuthCallbackUrl as jest.Mock).mockReturnValue(true);
    (createSessionFromUrl as jest.Mock).mockRejectedValue(new Error('bad callback'));
    (consumeSocialAuthReturnTo as jest.Mock).mockReturnValue('/?room=1234');

    const originalLocation = globalThis.window.location;
    const originalHistory = globalThis.window.history;
    const replaceState = jest.fn();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    Object.defineProperty(globalThis.window, 'location', {
      configurable: true,
      value: {
        href: 'https://app.local/auth/callback?code=bad',
        origin: 'https://app.local',
        pathname: '/auth/callback',
        search: '?code=bad',
        hash: '',
      },
    });
    Object.defineProperty(globalThis.window, 'history', {
      configurable: true,
      value: { replaceState },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    try {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(createSessionFromUrl).toHaveBeenCalledWith('https://app.local/auth/callback?code=bad');
      expect(mockSupabase.auth.getSession).toHaveBeenCalled();
      expect(result.current.user?.id).toBe('user-1');
      expect(replaceState).toHaveBeenCalledWith(null, '', 'https://app.local/?room=1234');
      expect(warnSpy).toHaveBeenCalledWith('[auth] OAuth callback failed:', expect.any(Error));
    } finally {
      warnSpy.mockRestore();
      Object.defineProperty(globalThis.window, 'location', {
        configurable: true,
        value: originalLocation,
      });
      Object.defineProperty(globalThis.window, 'history', {
        configurable: true,
        value: originalHistory,
      });
      platformRef.OS = originalPlatform;
    }
  });

  it('bridges web OAuth callbacks back to Expo Go when expo_return_to is present', async () => {
    platformRef.OS = 'web';
    (isSocialAuthCallbackUrl as jest.Mock).mockReturnValue(true);

    const originalLocation = globalThis.window.location;
    const replace = jest.fn();
    Object.defineProperty(globalThis.window, 'location', {
      configurable: true,
      value: {
        href: 'https://salinda-mobile.vercel.app/auth/callback?expo_return_to=exp%3A%2F%2F10.100.102.56%3A8082%2F--%2Fauth%2Fcallback&code=oauth-code',
        origin: 'https://salinda-mobile.vercel.app',
        pathname: '/auth/callback',
        search: '?expo_return_to=exp%3A%2F%2F10.100.102.56%3A8082%2F--%2Fauth%2Fcallback&code=oauth-code',
        hash: '',
        replace,
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    try {
      renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('exp://10.100.102.56:8082/--/auth/callback?code=oauth-code');
      });
      expect(createSessionFromUrl).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis.window, 'location', {
        configurable: true,
        value: originalLocation,
      });
      platformRef.OS = originalPlatform;
    }
  });
});
