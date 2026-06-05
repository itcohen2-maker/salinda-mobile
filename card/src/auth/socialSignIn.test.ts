import { Platform } from 'react-native';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '../lib/supabase';
import { buildSocialAuthRedirectUri, isSocialAuthCallbackUrl, performSocialSignIn } from './socialSignIn';

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: jest.fn(),
      exchangeCodeForSession: jest.fn().mockResolvedValue({ error: null }),
      setSession: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(({ scheme, path }: { scheme?: string; path?: string }) =>
    scheme ? `${scheme}://${path}` : `https://app.local/${path ?? ''}`),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    executionEnvironment: 'bare',
  },
}));

jest.mock('expo-auth-session/build/QueryParams', () => ({
  getQueryParams: jest.fn(),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

const mockSupabaseAuth = supabase.auth as jest.Mocked<typeof supabase.auth>;
const mockGetQueryParams = QueryParams.getQueryParams as jest.MockedFunction<typeof QueryParams.getQueryParams>;
const mockMakeRedirectUri = makeRedirectUri as jest.MockedFunction<typeof makeRedirectUri>;
const mockOpenAuthSessionAsync = WebBrowser.openAuthSessionAsync as jest.MockedFunction<typeof WebBrowser.openAuthSessionAsync>;
const constantsRef = Constants as typeof Constants & { executionEnvironment: string };
const platformRef = Platform as typeof Platform & { OS: string };
const originalPlatform = platformRef.OS;
const originalAuthScheme = process.env.EXPO_PUBLIC_AUTH_SCHEME;

function restoreOriginalAuthScheme(): void {
  if (originalAuthScheme === undefined) {
    delete process.env.EXPO_PUBLIC_AUTH_SCHEME;
  } else {
    process.env.EXPO_PUBLIC_AUTH_SCHEME = originalAuthScheme;
  }
}

describe('performSocialSignIn', () => {
  beforeEach(() => {
    platformRef.OS = originalPlatform;
    constantsRef.executionEnvironment = 'bare';
    restoreOriginalAuthScheme();
    jest.clearAllMocks();
    mockMakeRedirectUri.mockImplementation(({ scheme, path }: { scheme?: string; path?: string }) =>
      scheme ? `${scheme}://${path}` : `https://app.local/${path ?? ''}`);
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://auth.example/start' },
      error: null,
    } as never);
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'salinda://auth/callback?code=oauth-code',
    } as never);
    mockGetQueryParams.mockReturnValue({
      params: { code: 'oauth-code' },
      errorCode: null,
    });
  });

  afterAll(() => {
    platformRef.OS = originalPlatform;
    restoreOriginalAuthScheme();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['android', 'ios'] as const)(
    'uses salinda-dev native redirect for %s dev-client when the auth scheme env is set',
    (platform) => {
      platformRef.OS = platform;
      constantsRef.executionEnvironment = 'bare';
      process.env.EXPO_PUBLIC_AUTH_SCHEME = 'salinda-dev';

      expect(buildSocialAuthRedirectUri()).toBe('salinda-dev://auth/callback');
    },
  );

  it('uses Expo Go redirect URI and rewrites loopback IP to localhost', () => {
    platformRef.OS = 'ios';
    constantsRef.executionEnvironment = 'storeClient';
    mockMakeRedirectUri.mockReturnValue('exp://127.0.0.1:8082/--/auth/callback');

    expect(buildSocialAuthRedirectUri()).toBe('exp://localhost:8082/--/auth/callback');
  });

  it('uses the allow-listed web callback when Expo Go is running on a raw LAN IP', () => {
    platformRef.OS = 'ios';
    constantsRef.executionEnvironment = 'storeClient';
    mockMakeRedirectUri.mockReturnValue('exp://10.100.102.56:8082/--/auth/callback');

    expect(buildSocialAuthRedirectUri()).toBe(
      'https://salinda-mobile.vercel.app/auth/callback?expo_return_to=exp%3A%2F%2F10.100.102.56%3A8082%2F--%2Fauth%2Fcallback',
    );
  });

  it('uses the web origin callback on web', () => {
    platformRef.OS = 'web';
    mockMakeRedirectUri.mockReturnValue('https://app.local/auth/callback');

    expect(buildSocialAuthRedirectUri()).toBe('https://app.local/auth/callback');
  });

  it('starts Google OAuth with the expected redirect URI', async () => {
    platformRef.OS = 'android';

    const result = await performSocialSignIn('google');

    expect(result).toEqual({ error: null });
    expect(mockSupabaseAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'salinda://auth/callback',
        skipBrowserRedirect: true,
      },
    });
    expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith(
      'https://auth.example/start',
      'salinda://auth/callback',
    );
    expect(mockSupabaseAuth.exchangeCodeForSession).toHaveBeenCalledWith('oauth-code');
  });

  it('stores the returned session tokens for Apple sign-in token redirects', async () => {
    platformRef.OS = 'ios';
    mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'apple', url: 'https://auth.example/apple' },
      error: null,
    } as never);
    mockGetQueryParams.mockReturnValue({
      params: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      },
      errorCode: null,
    });

    const result = await performSocialSignIn('apple');

    expect(result).toEqual({ error: null });
    expect(mockSupabaseAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: {
        redirectTo: 'salinda://auth/callback',
        skipBrowserRedirect: true,
      },
    });
    expect(mockSupabaseAuth.setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
  });

  it('forces the Google account picker when requested', async () => {
    platformRef.OS = 'android';

    const result = await performSocialSignIn('google', { forceAccountPicker: true });

    expect(result).toEqual({ error: null });
    expect(mockSupabaseAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'salinda://auth/callback',
        skipBrowserRedirect: true,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
  });

  it('starts Google OAuth with a web redirect on web', async () => {
    platformRef.OS = 'web';
    const originalLocation = globalThis.window?.location;
    const assign = jest.fn();
    Object.defineProperty(globalThis.window, 'location', {
      configurable: true,
      value: { assign },
    });

    const result = await performSocialSignIn('google');

    expect(result).toEqual({ error: null });
    expect(mockSupabaseAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'https://app.local/auth/callback',
        skipBrowserRedirect: true,
      },
    });
    expect(assign).toHaveBeenCalledWith('https://auth.example/start');
    expect(mockOpenAuthSessionAsync).not.toHaveBeenCalled();
    expect(mockSupabaseAuth.exchangeCodeForSession).not.toHaveBeenCalled();
    Object.defineProperty(globalThis.window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('returns a surfaced error when the browser flow is canceled', async () => {
    platformRef.OS = 'android';
    mockOpenAuthSessionAsync.mockResolvedValue({ type: 'cancel' } as never);

    const result = await performSocialSignIn('google');

    expect(result).toEqual({ error: 'Sign-in canceled.' });
    expect(mockSupabaseAuth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockSupabaseAuth.setSession).not.toHaveBeenCalled();
  });

  it('detects OAuth callback URLs without treating arbitrary error params as callbacks', () => {
    mockGetQueryParams.mockReturnValue({
      params: {},
      errorCode: null,
    });
    expect(isSocialAuthCallbackUrl('https://app.local/auth/callback?code=oauth-code')).toBe(true);

    mockGetQueryParams.mockReturnValue({
      params: { access_token: 'access-token' },
      errorCode: null,
    });
    expect(isSocialAuthCallbackUrl('https://app.local/#access_token=access-token')).toBe(true);

    mockGetQueryParams.mockReturnValue({
      params: { error: 'not-auth' },
      errorCode: null,
    });
    expect(isSocialAuthCallbackUrl('https://app.local/?error=not-auth')).toBe(false);
  });
});
