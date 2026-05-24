import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '../lib/supabase';

export type SocialAuthProvider = 'google' | 'apple';
export interface SocialSignInOptions {
  forceAccountPicker?: boolean;
}

export const SOCIAL_AUTH_SCHEME = process.env.EXPO_PUBLIC_AUTH_SCHEME ?? 'salinda';
export const SOCIAL_AUTH_CALLBACK_PATH = 'auth/callback';
export const SOCIAL_AUTH_NATIVE_REDIRECT_URI = `${SOCIAL_AUTH_SCHEME}://${SOCIAL_AUTH_CALLBACK_PATH}`;
export const SOCIAL_AUTH_RETURN_TO_STORAGE_KEY = 'salinda_social_auth_return_to';

WebBrowser.maybeCompleteAuthSession();

export function buildSocialAuthRedirectUri(): string {
  if (Platform.OS === 'web') {
    return makeRedirectUri({ path: SOCIAL_AUTH_CALLBACK_PATH });
  }

  // In development builds, makeRedirectUri() may resolve to the dev-client launcher URL.
  // Supabase must receive the exact native deep link URI that is allow-listed in Auth > Redirect URLs.
  return SOCIAL_AUTH_NATIVE_REDIRECT_URI;
}

function hasSocialAuthParams(url: string): boolean {
  try {
    const { params, errorCode } = QueryParams.getQueryParams(url);
    return Boolean(
      errorCode ||
      params.code ||
      params.access_token ||
      params.refresh_token ||
      params.error_code ||
      params.error_description
    );
  } catch {
    return false;
  }
}

export function isSocialAuthCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://phony.example');
    return (
      (parsed.pathname.includes(SOCIAL_AUTH_CALLBACK_PATH) && Boolean(parsed.search || parsed.hash)) ||
      hasSocialAuthParams(url)
    );
  } catch {
    return hasSocialAuthParams(url);
  }
}

function getCurrentWebReturnTo(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return '/';

  const pathname = window.location.pathname || '/';
  if (pathname.includes(SOCIAL_AUTH_CALLBACK_PATH)) return '/';

  return `${pathname}${window.location.search || ''}` || '/';
}

export function rememberSocialAuthReturnTo(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  try {
    window.sessionStorage?.setItem(SOCIAL_AUTH_RETURN_TO_STORAGE_KEY, getCurrentWebReturnTo());
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
}

export function consumeSocialAuthReturnTo(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return '/';

  try {
    const stored = window.sessionStorage?.getItem(SOCIAL_AUTH_RETURN_TO_STORAGE_KEY);
    window.sessionStorage?.removeItem(SOCIAL_AUTH_RETURN_TO_STORAGE_KEY);
    if (stored && stored.startsWith('/') && !stored.startsWith('//')) return stored;
  } catch {
    // Fall through to the default app entry.
  }

  return '/';
}

export async function createSessionFromUrl(url: string): Promise<void> {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const errorDescription = typeof params.error_description === 'string'
    ? params.error_description
    : typeof params.error === 'string'
      ? params.error
      : null;

  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const authCode = typeof params.code === 'string' ? params.code : null;
  if (authCode) {
    const { error } = await supabase.auth.exchangeCodeForSession(authCode);
    if (error) throw error;
    return;
  }

  const accessToken = typeof params.access_token === 'string' ? params.access_token : null;
  const refreshToken = typeof params.refresh_token === 'string' ? params.refresh_token : null;
  if (!accessToken || !refreshToken) {
    throw new Error('Missing auth session in redirect.');
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
}

export async function performSocialSignIn(
  provider: SocialAuthProvider,
  options: SocialSignInOptions = {},
): Promise<{ error: string | null }> {
  try {
    const redirectTo = buildSocialAuthRedirectUri();
    const queryParams = provider === 'google' && options.forceAccountPicker
      ? { prompt: 'select_account' }
      : undefined;

    if (Platform.OS === 'web') {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          ...(queryParams ? { queryParams } : {}),
        },
      });

      if (error) return { error: error.message };
      if (!data?.url) return { error: 'Could not start sign-in.' };
      if (typeof window !== 'undefined') {
        rememberSocialAuthReturnTo();
        window.location.assign(data.url);
      }
      return { error: null };
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        ...(queryParams ? { queryParams } : {}),
      },
    });

    if (error) return { error: error.message };
    if (!data?.url) return { error: 'Could not start sign-in.' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') {
      return {
        error: result.type === 'cancel'
          ? 'Sign-in canceled.'
          : 'Could not complete sign-in.',
      };
    }

    await createSessionFromUrl(result.url);
    return { error: null };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not complete sign-in.',
    };
  }
}
