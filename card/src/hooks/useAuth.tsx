import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import {
  consumeSocialAuthReturnTo,
  createSessionFromUrl,
  isSocialAuthCallbackUrl,
  SOCIAL_AUTH_CALLBACK_PATH,
  performSocialSignIn,
  type SocialAuthProvider,
  type SocialSignInOptions,
} from '../auth/socialSignIn';
import { supabase } from '../lib/supabase';
import type { TableSkinId } from '../theme/tableSkins';
import {
  SALINDA_TUTORIAL_REWARDS,
  type SalindaCoinSource,
} from '../../shared/salindaEconomy';

export interface PlayerProfile {
  id: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  abandons: number;
  total_coins: number;
  slinda_owned: boolean;
  wild_owned: boolean;
  themes_owned: string[];
  table_skins_owned: string[];
  active_card_back: string;
  active_table_theme: string;
  active_table_skin: string | null;
  /** Equipped dice skin id ('classic' = free procedural gold dice). */
  active_dice_skin: string;
  /** Equipped premium card-back id ('classic' = default). */
  active_card_back_image: string;
  /** Equipped premium table id ('classic' = default). */
  active_premium_table: string;
  /** Unified cosmetic ownership (catalog ids from public.cosmetic_inventory). */
  cosmetics_owned: string[];
  created_at: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: PlayerProfile | null;
  loading: boolean;
  /** True when the session belongs to an anonymous (not-yet-upgraded) user. */
  isAnonymous: boolean;
  /** True when the user is authenticated (session exists). */
  isAuthenticated: boolean;
  /**
   * Links email + password to the current anonymous account, preserving all
   * coins / rating. Falls back to a fresh sign-up if there is no session.
   */
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  /** Sign in with email + password (for users who already linked their account). */
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Sign in with Google or Apple. */
  signInWithProvider: (provider: SocialAuthProvider, options?: SocialSignInOptions) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  signOutToGuest: () => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  /** Legacy Slinda-card purchase hook. Consumable cards are no longer sold in the shop catalog. */
  purchaseSlinda: () => Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'error'>;
  /** Consume owned Slinda after activating it in-game. */
  consumeSlinda: () => Promise<'ok' | 'not_owned' | 'error'>;
  /** Legacy Wild-card purchase hook. Consumable cards are no longer sold in the shop catalog. */
  purchaseWild: () => Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'error'>;
  /** Consume owned Wild after activating it in-game. */
  consumeWild: () => Promise<'ok' | 'not_owned' | 'error'>;
  /** Purchase a theme for its configured store price. */
  purchaseTheme: (themeId: string) => Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'invalid_theme' | 'error'>;
  /** Purchase a table skin for its configured store price. */
  purchaseTableSkin: (skinId: TableSkinId) => Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'invalid_skin' | 'error'>;
  /** Set active card back, table theme, or table skin (must already be owned). */
  setActiveSkin: (kind: 'card_back' | 'table_theme' | 'table_skin', themeId: string) => Promise<'ok' | 'not_owned' | 'invalid' | 'error'>;
  /** Purchase any unified cosmetic (dice skin, card back, table) by its catalog id. Idempotent (D2). */
  purchaseCosmetic: (cosmeticId: string) => Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'invalid' | 'error'>;
  /** Equip any unified cosmetic by kind (must be owned, or the free 'classic'). */
  setActiveCosmetic: (kind: 'dice_skin' | 'card_back' | 'table', id: string) => Promise<'ok' | 'not_owned' | 'invalid' | 'error'>;
  /** Equip a dice skin (must be owned, or the free 'classic'). */
  setActiveDiceSkin: (skinId: string) => Promise<'ok' | 'not_owned' | 'error'>;
  /** Award coins to the current user wallet and refresh local profile cache. */
  awardCoins: (amount: number, source: SalindaCoinSource | string, idempotencyKey?: string | null) => Promise<'ok' | 'error'>;
  /** Server-date-idempotent daily bonus; no-op after the day's first win. */
  awardFirstWinOfDay: (amount: number) => Promise<'ok' | 'error'>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TUTORIAL_COINS_KEY = 'salinda_tutorial_coins_earned_count';
const TUTORIAL_COINS_SYNCED_KEY = 'salinda_tutorial_coins_synced';
const LOCAL_WILD_OWNED_KEY_PREFIX = 'salinda_local_wild_owned:';

function localWildOwnedKey(userId: string): string {
  return `${LOCAL_WILD_OWNED_KEY_PREFIX}${userId}`;
}

function normalizeProvider(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function isAnonymousAuthUser(user: User | null): boolean {
  if (!user) return false;
  if (user.is_anonymous === true) return true;

  const provider = normalizeProvider(user.app_metadata?.provider);
  if (provider === 'anonymous') return true;

  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers.map(normalizeProvider).filter(Boolean)
    : [];
  if (providers.length > 0 && providers.every((item) => item === 'anonymous')) {
    return true;
  }

  const identityProviders = Array.isArray(user.identities)
    ? user.identities.map((identity) => normalizeProvider(identity.provider)).filter(Boolean)
    : [];
  if (identityProviders.length > 0 && identityProviders.every((item) => item === 'anonymous')) {
    return true;
  }

  const hasContactIdentity = Boolean(user.email?.trim() || user.phone?.trim());
  const hasProviderIdentity = Boolean(provider || providers.length > 0 || identityProviders.length > 0);
  if (!hasContactIdentity && !hasProviderIdentity) return true;

  return false;
}

export function isRegisteredAuthUser(user: User | null): boolean {
  if (!user || isAnonymousAuthUser(user)) return false;

  if (user.email?.trim() || user.phone?.trim()) return true;

  const provider = normalizeProvider(user.app_metadata?.provider);
  if (provider && provider !== 'anonymous') return true;

  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers.map(normalizeProvider).filter(Boolean)
    : [];
  if (providers.some((item) => item !== 'anonymous')) return true;

  const identityProviders = Array.isArray(user.identities)
    ? user.identities.map((identity) => normalizeProvider(identity.provider)).filter(Boolean)
    : [];
  return identityProviders.some((item) => item !== 'anonymous');
}

function isSafeExpoOAuthReturnUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'exp:' && parsed.pathname.includes(SOCIAL_AUTH_CALLBACK_PATH);
  } catch {
    return false;
  }
}

export async function ensureMinimumProfileCoins(_userId: string, currentCoins: number): Promise<number> {
  const normalizedCoins = Number(currentCoins);
  if (!Number.isFinite(normalizedCoins)) return 0;
  return Math.max(0, Math.floor(normalizedCoins));
}

/** Migrate tutorial coins from AsyncStorage to Supabase. One-time, idempotent. */
export async function syncTutorialCoins(): Promise<void> {
  try {
    const [countStr, synced] = await Promise.all([
      AsyncStorage.getItem(TUTORIAL_COINS_KEY),
      AsyncStorage.getItem(TUTORIAL_COINS_SYNCED_KEY),
    ]);
    if (synced === 'true') return;

    const count = parseInt(countStr ?? '0', 10);
    if (isNaN(count) || count <= 0) return;

    if (count === 1) {
      await supabase.rpc('award_coins', { p_amount: SALINDA_TUTORIAL_REWARDS.basic, p_source: 'tutorial_core' });
    } else if (count === 2) {
      await supabase.rpc('award_coins', { p_amount: SALINDA_TUTORIAL_REWARDS.basic, p_source: 'tutorial_core' });
      await supabase.rpc('award_coins', { p_amount: SALINDA_TUTORIAL_REWARDS.advanced, p_source: 'tutorial_advanced' });
    } else {
      await supabase.rpc('award_coins', { p_amount: count * SALINDA_TUTORIAL_REWARDS.basic, p_source: 'tutorial_legacy' });
    }

    await AsyncStorage.setItem(TUTORIAL_COINS_SYNCED_KEY, 'true');
  } catch (err) {
    console.warn('[auth] syncTutorialCoins failed, retrying on next login:', err);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // True once the initial getSession()/anonymous-bootstrap has finished. During
  // init, a stale stored session makes supabase-js emit SIGNED_OUT *while*
  // getSession() runs — init's own fallback already recreates a guest session
  // there, so the SIGNED_OUT handler must NOT also recreate one (that would
  // create two anonymous users). After init, a genuine mid-session SIGNED_OUT
  // (e.g. a server-rejected refresh token) is the handler's job to recover from.
  const initializedRef = useRef(false);
  // Set while an explicit signOut()/signOutToGuest() is in flight so the
  // SIGNED_OUT handler doesn't fight them (signOutToGuest recreates its own
  // guest session; signOut deliberately leaves the user logged out).
  const intentionalSignOutRef = useRef(false);

  const user = session?.user ?? null;
  const isAuthenticated = !!session;
  const isAnonymous = isAnonymousAuthUser(user);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const [localWildOwnedRaw, profileResult, inventoryResult] = await Promise.all([
        AsyncStorage.getItem(localWildOwnedKey(userId)),
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single(),
        // Unified cosmetic ownership (D1). Tolerate absence (pre-migration) gracefully.
        supabase
          .from('cosmetic_inventory')
          .select('cosmetic_id')
          .eq('user_id', userId),
      ]);
      const { data, error } = profileResult;
      if (error) {
        console.warn('[auth] fetchProfile error:', error.message);
        setProfile(null);
      } else {
        const localWildOwned = localWildOwnedRaw === 'true';
        const rawProfile = data as PlayerProfile;
        const syncedCoins = await ensureMinimumProfileCoins(userId, rawProfile.total_coins);
        const cosmeticsOwned = Array.isArray(inventoryResult?.data)
          ? (inventoryResult.data as Array<{ cosmetic_id: string }>).map((r) => r.cosmetic_id)
          : [];
        setProfile({
          ...rawProfile,
          total_coins: syncedCoins,
          wild_owned: (rawProfile as Partial<PlayerProfile>).wild_owned === true || localWildOwned,
          active_dice_skin: (rawProfile as Partial<PlayerProfile>).active_dice_skin ?? 'classic',
          active_card_back_image: (rawProfile as Partial<PlayerProfile>).active_card_back_image ?? 'classic',
          active_premium_table: (rawProfile as Partial<PlayerProfile>).active_premium_table ?? 'classic',
          cosmetics_owned: cosmeticsOwned,
        });
        void syncTutorialCoins();
      }
    } catch (e) {
      console.warn('[auth] fetchProfile exception:', e);
      setProfile(null);
    }
  }, []);

  const applySession = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    if (nextSession?.user) {
      await fetchProfile(nextSession.user.id);
    } else {
      setProfile(null);
    }
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  const beginAnonymousSession = useCallback(async (): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) return { error: error.message };

      await applySession(data?.session ?? null);
      return { error: null };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Could not create a guest session.',
      };
    }
  }, [applySession]);

  const handleWebOAuthCallback = useCallback(async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const callbackUrl = window.location.href;
    if (!isSocialAuthCallbackUrl(callbackUrl)) return;

    try {
      const parsed = new URL(callbackUrl);
      const expoReturnTo = parsed.searchParams.get('expo_return_to');
      if (expoReturnTo && isSafeExpoOAuthReturnUrl(expoReturnTo)) {
        parsed.searchParams.delete('expo_return_to');
        const returnUrl = new URL(expoReturnTo);
        parsed.searchParams.forEach((value, key) => {
          returnUrl.searchParams.set(key, value);
        });
        if (parsed.hash) returnUrl.hash = parsed.hash;
        window.location.replace(returnUrl.toString());
        return;
      }

      await createSessionFromUrl(callbackUrl);
    } catch (error) {
      console.warn('[auth] OAuth callback failed:', error);
    } finally {
      const returnTo = consumeSocialAuthReturnTo();
      try {
        window.history?.replaceState?.(null, '', `${window.location.origin}${returnTo}`);
      } catch {
        // URL cleanup should never block session recovery.
      }
    }
  }, []);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const init = async () => {
      try {
        await handleWebOAuthCallback();

        const { data: sessionData } = await supabase.auth.getSession();
        const s = sessionData?.session ?? null;
        if (s && !isAnonymousAuthUser(s.user)) {
          // getSession() returns the stored session WITHOUT validating it. A
          // server-revoked / expired refresh token then loops the sign-in screen
          // (seen on iOS Safari: "Invalid Refresh Token: Refresh Token Not Found")
          // until the user manually clears site data. Validate against the server;
          // if the stored session is dead, clear local auth state so a fresh
          // sign-in works cleanly instead of getting stuck.
          const { error: validateError } = await supabase.auth.getUser();
          if (validateError) {
            console.warn('[auth] stored session invalid, clearing:', validateError.message);
            try { await supabase.auth.signOut({ scope: 'local' }); } catch (_) {}
            const result = await beginAnonymousSession();
            if (result.error) {
              console.warn('[auth] signInAnonymously failed:', result.error);
            }
          } else {
            await applySession(s);
          }
        } else if (s) {
          await applySession(s);
        } else {
          const result = await beginAnonymousSession();
          if (result.error) {
            console.warn('[auth] signInAnonymously failed:', result.error);
          }
        }
      } catch (e) {
        console.warn('[auth] getSession threw:', e);
      } finally {
        setLoading(false);
        initializedRef.current = true;
      }
    };

    void init();

    try {
      const { data } = supabase.auth.onAuthStateChange((event, s) => {
        setSession(s ?? null);
        if (s?.user) {
          void fetchProfile(s.user.id);
        } else {
          setProfile(null);
          // supabase-js has no TOKEN_REFRESH_FAILED event — a server-rejected
          // refresh token surfaces as SIGNED_OUT with no session. Re-establish a
          // guest session so the player is never stranded mid-game. Only after
          // init (init handles the launch case) and never during an explicit
          // sign-out. Deferred via setTimeout because calling an auth method
          // synchronously inside an onAuthStateChange callback can deadlock
          // supabase-js.
          if (
            event === 'SIGNED_OUT' &&
            initializedRef.current &&
            !intentionalSignOutRef.current
          ) {
            setTimeout(() => { void beginAnonymousSession(); }, 0);
          }
        }
      });
      subscription = data?.subscription ?? null;
    } catch (e) {
      console.warn('[auth] onAuthStateChange threw:', e);
    }

    return () => {
      try { subscription?.unsubscribe(); } catch (_) {}
    };
  }, [fetchProfile, handleWebOAuthCallback]);

  // Native deep-link OAuth finalizer. On Android the Chrome Custom Tab can cause
  // Expo Go (or a build) to be killed/relaunched during the Google round-trip, so
  // the openAuthSessionAsync() promise in performSocialSignIn() never resolves.
  // When the app re-opens via the `exp://.../auth/callback` (or `salinda://…`)
  // deep link — either as the initial URL on a cold start or a live `url` event —
  // finalize the session here so the user lands back IN the app, logged in,
  // instead of being stranded on the website / a "Something went wrong" screen.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let cancelled = false;
    const finalizeFromUrl = async (url: string | null | undefined) => {
      if (cancelled || !url || !isSocialAuthCallbackUrl(url)) return;
      try {
        await createSessionFromUrl(url);
        const { data } = await supabase.auth.getSession();
        if (!cancelled) await applySession(data?.session ?? null);
      } catch (e) {
        console.warn('[auth] deep-link OAuth finalize failed:', e);
      }
    };

    void Linking.getInitialURL().then(finalizeFromUrl);
    const sub = Linking.addEventListener('url', (event) => void finalizeFromUrl(event.url));

    return () => {
      cancelled = true;
      try { sub.remove(); } catch (_) {}
    };
  }, [applySession]);

  /**
   * Links email + password to the current anonymous session (preserving coins/rating).
   * If for some reason there is no session, falls back to a fresh sign-up.
   */
  const signUp = useCallback(async (email: string, password: string, username: string) => {
    if (isAnonymous) {
      // Link identity — keeps the same profile row
      const { error } = await supabase.auth.updateUser({ email, password });
      if (error) return { error: error.message };
      // Store username in metadata for reference (profile row already exists)
      await supabase.auth.updateUser({ data: { username } });
      await refreshProfile();
      return { error: null };
    }
    // Fresh sign-up (no existing session)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) return { error: error.message };
    return { error: null };
  }, [isAnonymous, refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signInWithProvider = useCallback(async (provider: SocialAuthProvider, options?: SocialSignInOptions) => {
    const result = await performSocialSignIn(provider, options);
    if (result.error) return result;

    try {
      const { data } = await supabase.auth.getSession();
      const nextSession = data?.session ?? null;
      await applySession(nextSession);
      return { error: null };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Could not finish sign-in.',
      };
    }
  }, [applySession]);

  const purchaseSlinda = useCallback(async (): Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'error'> => {
    try {
      const { data, error } = await supabase.rpc('purchase_slinda');
      if (error) return 'error';
      const result = data as string;
      if (result === 'ok') await refreshProfile();
      return result as 'ok' | 'already_owned' | 'insufficient_coins';
    } catch {
      return 'error';
    }
  }, [refreshProfile]);

  const consumeSlinda = useCallback(async (): Promise<'ok' | 'not_owned' | 'error'> => {
    const consumeViaProfileUpdate = async (): Promise<'ok' | 'not_owned' | 'error'> => {
      if (!user) return 'error';
      try {
        const { data, error } = await supabase
          .from('profiles')
          .update({ slinda_owned: false })
          .eq('id', user.id)
          .eq('slinda_owned', true)
          .select('id, slinda_owned');
        if (error) return 'error';
        if (!data || data.length === 0) {
          await refreshProfile();
          return 'not_owned';
        }
        setProfile((prev) => (prev ? { ...prev, slinda_owned: false } : prev));
        await refreshProfile();
        return 'ok';
      } catch {
        return 'error';
      }
    };

    try {
      const { data, error } = await supabase.rpc('consume_slinda');
      if (error) {
        return await consumeViaProfileUpdate();
      }
      const result = data as string;
      if (result === 'ok' || result === 'not_owned') {
        setProfile((prev) => (prev ? { ...prev, slinda_owned: false } : prev));
        await refreshProfile();
      }
      return result as 'ok' | 'not_owned';
    } catch {
      return await consumeViaProfileUpdate();
    }
  }, [refreshProfile, user]);

  const purchaseWild = useCallback(async (): Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'error'> => {
    return 'error';
  }, []);

  const consumeWild = useCallback(async (): Promise<'ok' | 'not_owned' | 'error'> => {
    // Local-storage fallback: purchase_wild fallback path stores ownership only in
    // AsyncStorage (not DB). When a DB call fails (Supabase returns { error }, not throws),
    // the catch block is unreachable — so we extract the check into a shared helper.
    const consumeViaLocalStorage = async (): Promise<'ok' | 'error'> => {
      if (!user) return 'error';
      try {
        const localOwned = await AsyncStorage.getItem(localWildOwnedKey(user.id));
        if (localOwned !== 'true') return 'error';
        await AsyncStorage.removeItem(localWildOwnedKey(user.id));
        setProfile((prev) => (prev ? { ...prev, wild_owned: false } : prev));
        return 'ok';
      } catch {
        return 'error';
      }
    };

    const consumeViaProfileUpdate = async (): Promise<'ok' | 'not_owned' | 'error'> => {
      if (!user) return 'error';
      try {
        const { data, error } = await supabase
          .from('profiles')
          .update({ wild_owned: false })
          .eq('id', user.id)
          .eq('wild_owned', true)
          .select('id, wild_owned');
        if (error) {
          // Supabase SDK returns { error } for API errors — it does not throw, so the
          // catch block below is unreachable for these cases. Fall through to local storage.
          return await consumeViaLocalStorage();
        }
        if (!data || data.length === 0) {
          await refreshProfile();
          return 'not_owned';
        }
        setProfile((prev) => (prev ? { ...prev, wild_owned: false } : prev));
        await refreshProfile();
        return 'ok';
      } catch {
        return await consumeViaLocalStorage();
      }
    };

    try {
      const { data, error } = await supabase.rpc('consume_wild');
      if (error) {
        return await consumeViaProfileUpdate();
      }
      const result = data as string;
      if (result === 'ok' || result === 'not_owned') {
        if (user) await AsyncStorage.removeItem(localWildOwnedKey(user.id));
        setProfile((prev) => (prev ? { ...prev, wild_owned: false } : prev));
        await refreshProfile();
      }
      return result as 'ok' | 'not_owned';
    } catch {
      return await consumeViaProfileUpdate();
    }
  }, [refreshProfile, user]);

  const purchaseTheme = useCallback(async (themeId: string): Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'invalid_theme' | 'error'> => {
    try {
      const { data, error } = await supabase.rpc('purchase_theme', { theme_id: themeId });
      if (error) return 'error';
      const result = data as string;
      if (result === 'ok') await refreshProfile();
      return result as 'ok' | 'already_owned' | 'insufficient_coins' | 'invalid_theme';
    } catch {
      return 'error';
    }
  }, [refreshProfile]);

  const purchaseTableSkin = useCallback(async (skinId: TableSkinId): Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'invalid_skin' | 'error'> => {
    try {
      const { data, error } = await supabase.rpc('purchase_table_skin', { skin_id: skinId });
      if (error) return 'error';
      const result = data as string;
      if (result === 'ok') await refreshProfile();
      return result as 'ok' | 'already_owned' | 'insufficient_coins' | 'invalid_skin';
    } catch {
      return 'error';
    }
  }, [refreshProfile]);

  const setActiveSkin = useCallback(async (kind: 'card_back' | 'table_theme' | 'table_skin', themeId: string): Promise<'ok' | 'not_owned' | 'invalid' | 'error'> => {
    try {
      const { data, error } = await supabase.rpc('set_active_skin', { kind, theme_id: themeId });
      if (error) return 'error';
      const result = data as string;
      if (result === 'ok') await refreshProfile();
      return result as 'ok' | 'not_owned' | 'invalid';
    } catch {
      return 'error';
    }
  }, [refreshProfile]);

  const purchaseCosmetic = useCallback(async (
    cosmeticId: string,
  ): Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'invalid' | 'error'> => {
    try {
      const { data, error } = await supabase.rpc('purchase_cosmetic', { p_cosmetic_id: cosmeticId });
      if (error) return 'error';
      const result = data as string;
      if (result === 'ok' || result === 'already_owned') await refreshProfile();
      return result as 'ok' | 'already_owned' | 'insufficient_coins' | 'invalid';
    } catch {
      return 'error';
    }
  }, [refreshProfile]);

  const setActiveCosmetic = useCallback(async (
    kind: 'dice_skin' | 'card_back' | 'table',
    id: string,
  ): Promise<'ok' | 'not_owned' | 'invalid' | 'error'> => {
    try {
      const { data, error } = await supabase.rpc('set_active_cosmetic', { p_kind: kind, p_id: id });
      if (error) return 'error';
      const result = data as string;
      if (result === 'ok') {
        const column =
          kind === 'dice_skin' ? 'active_dice_skin'
          : kind === 'card_back' ? 'active_card_back_image'
          : 'active_premium_table';
        setProfile((prev) => (prev ? { ...prev, [column]: id } : prev));
        await refreshProfile();
      }
      return result as 'ok' | 'not_owned' | 'invalid';
    } catch {
      return 'error';
    }
  }, [refreshProfile]);

  const setActiveDiceSkin = useCallback(async (
    skinId: string,
  ): Promise<'ok' | 'not_owned' | 'error'> => {
    const result = await setActiveCosmetic('dice_skin', skinId);
    return (result === 'invalid' ? 'error' : result) as 'ok' | 'not_owned' | 'error';
  }, [setActiveCosmetic]);

  const awardCoins = useCallback(async (
    amount: number,
    source: SalindaCoinSource | string,
    idempotencyKey?: string | null,
  ): Promise<'ok' | 'error'> => {
    if (!Number.isFinite(amount) || amount <= 0) return 'error';
    try {
      const rpcParams: Record<string, number | string | null> = {
        p_amount: amount,
        p_source: source,
      };
      if (idempotencyKey != null) rpcParams.p_idempotency_key = idempotencyKey;
      const { error } = await supabase.rpc('award_coins', rpcParams);
      if (error) return 'error';
      setProfile((prev) => (prev ? { ...prev, total_coins: (prev.total_coins ?? 0) + amount } : prev));
      return 'ok';
    } catch {
      return 'error';
    }
  }, []);

  const awardFirstWinOfDay = useCallback(async (
    amount: number,
  ): Promise<'ok' | 'error'> => {
    if (!Number.isFinite(amount) || amount <= 0) return 'error';
    try {
      const { error } = await supabase.rpc('award_first_win_of_day', { p_amount: amount });
      if (error) return 'error';
      // Optimistic: the RPC is a no-op after the first win of the day, so we
      // reconcile from the server instead of blindly adding to the balance.
      await refreshProfile();
      return 'ok';
    } catch {
      return 'error';
    }
  }, [refreshProfile]);

  const signOutFn = useCallback(async () => {
    intentionalSignOutRef.current = true;
    try {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
    } finally {
      intentionalSignOutRef.current = false;
    }
  }, []);

  const signOutToGuest = useCallback(async () => {
    intentionalSignOutRef.current = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) return { error: error.message };
      return await beginAnonymousSession();
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Could not switch to guest mode.',
      };
    } finally {
      intentionalSignOutRef.current = false;
    }
  }, [beginAnonymousSession]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        isAnonymous,
        isAuthenticated,
        signUp,
        signIn,
        signInWithProvider,
        signOut: signOutFn,
        signOutToGuest,
        refreshProfile,
        purchaseSlinda,
        consumeSlinda,
        purchaseWild,
        consumeWild,
        purchaseTheme,
        purchaseTableSkin,
        setActiveSkin,
        purchaseCosmetic,
        setActiveCosmetic,
        setActiveDiceSkin,
        awardCoins,
        awardFirstWinOfDay,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export function useAuthOptional(): AuthContextValue | null {
  return useContext(AuthContext);
}
