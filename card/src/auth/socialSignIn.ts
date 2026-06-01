import Constants from 'expo-constants';
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

/**
 * Returns the OAuth redirect URI for the current runtime.
 *
 * ┌─ Web ──────────── makeRedirectUri() → https origin (allow-listed in Supabase).
 * ├─ Expo Go ──────── makeRedirectUri() → exp://<host>:8081/--/auth/callback.
 * └─ Standalone/dev-client build ── salinda:// (prod) or salinda-dev:// (dev).
 *
 * ⚠️ Expo Go OAuth gotcha (debugged & confirmed 2026-05-30):
 *   1. Expo Go can NOT register custom schemes (salinda://) — only exp:// — so we
 *      must use makeRedirectUri() there.
 *   2. Supabase/GoTrue REJECTS any redirect whose host is a raw IP address
 *      (open-redirect protection). A plain `expo start` (LAN) yields
 *      exp://<LAN-IP>:8081/... → rejected → OAuth silently falls back to the Site
 *      URL, so you end up logged in on the WEBSITE instead of returning to the app.
 *
 *   To test Google/Apple sign-in IN EXPO GO you need a HOSTNAME (not an IP). Use one of:
 *     • adb reverse tcp:8081 tcp:8081  +  npx expo start --localhost
 *         → exp://localhost:8081/...  (re-run `adb reverse` after every USB reconnect)
 *     • npx expo start --tunnel        → exp://<id>.exp.direct/...  (needs @expo/ngrok)
 *     • a dev-client build (eas build --profile development) → salinda-dev:// — MOST ROBUST,
 *       behaves exactly like production, no --localhost/adb/tunnel dance.
 *   Supabase → Auth → URL Configuration → Redirect URLs must include `exp://**` for this path.
 *
 * Production/standalone builds use salinda:// (already allow-listed) and need NONE of the above.
 */
export function buildSocialAuthRedirectUri(): string {
  if (Platform.OS === 'web') {
    return makeRedirectUri({ path: SOCIAL_AUTH_CALLBACK_PATH });
  }

  // Expo Go (executionEnvironment 'storeClient') — see the IP-host caveat in the JSDoc above.
  if (Constants.executionEnvironment === 'storeClient') {
    const uri = makeRedirectUri({ path: SOCIAL_AUTH_CALLBACK_PATH });
    // GoTrue rejects redirects whose host is a raw IP (open-redirect protection).
    // A localhost/adb-reverse dev server resolves to exp://127.0.0.1:<port>/... —
    // rewrite the loopback IP to the `localhost` hostname so GoTrue accepts it and
    // returns into the app instead of falling back to the website Site URL.
    return uri.replace('://127.0.0.1', '://localhost');
  }

  // Standalone / dev-client build: use the native custom scheme that is allow-listed in Supabase.
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

// PKCE auth codes are single-use. Both performSocialSignIn() (via openAuthSessionAsync)
// and the native deep-link finalizer in useAuth can observe the same callback URL, so we
// remember consumed codes and no-op on the second attempt instead of throwing a spurious
// "code already used / invalid verifier" error after the user is already signed in.
const consumedAuthCodes = new Set<string>();

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
    if (consumedAuthCodes.has(authCode)) return; // already exchanged by the other handler
    consumedAuthCodes.add(authCode);
    const { error } = await supabase.auth.exchangeCodeForSession(authCode);
    if (error) {
      consumedAuthCodes.delete(authCode); // allow a genuine retry if the exchange itself failed
      throw error;
    }
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
