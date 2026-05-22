import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '../lib/supabase';

export type SocialAuthProvider = 'google' | 'apple';

export const SOCIAL_AUTH_SCHEME = 'salinda';
export const SOCIAL_AUTH_CALLBACK_PATH = 'auth/callback';

WebBrowser.maybeCompleteAuthSession();

export function buildSocialAuthRedirectUri(): string {
  if (Platform.OS === 'web') {
    return makeRedirectUri({ path: SOCIAL_AUTH_CALLBACK_PATH });
  }

  return makeRedirectUri({
    scheme: SOCIAL_AUTH_SCHEME,
    path: SOCIAL_AUTH_CALLBACK_PATH,
  });
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

export async function performSocialSignIn(provider: SocialAuthProvider): Promise<{ error: string | null }> {
  if (Platform.OS === 'web') {
    return { error: 'Social sign-in is not available in the web flow.' };
  }

  try {
    const redirectTo = buildSocialAuthRedirectUri();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
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
