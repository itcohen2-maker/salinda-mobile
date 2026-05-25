import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  consumeSocialAuthReturnTo,
  createSessionFromUrl,
  isSocialAuthCallbackUrl,
  performSocialSignIn,
  type SocialAuthProvider,
  type SocialSignInOptions,
} from '../auth/socialSignIn';
import { supabase } from '../lib/supabase';
import type { TableSkinId } from '../theme/tableSkins';
import {
  SALINDA_CATALOG,
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
  /** Purchase the Slinda card for 150 coins. Returns 'ok', 'already_owned', or 'insufficient_coins'. */
  purchaseSlinda: () => Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'error'>;
  /** Consume owned Slinda after activating it in-game. */
  consumeSlinda: () => Promise<'ok' | 'not_owned' | 'error'>;
  /** Purchase the Wild card for 200 coins. Returns 'ok', 'already_owned', or 'insufficient_coins'. */
  purchaseWild: () => Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'error'>;
  /** Consume owned Wild after activating it in-game. */
  consumeWild: () => Promise<'ok' | 'not_owned' | 'error'>;
  /** Purchase a theme for its configured store price. */
  purchaseTheme: (themeId: string) => Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'invalid_theme' | 'error'>;
  /** Purchase a table skin for its configured store price. */
  purchaseTableSkin: (skinId: TableSkinId) => Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'invalid_skin' | 'error'>;
  /** Set active card back, table theme, or table skin (must already be owned). */
  setActiveSkin: (kind: 'card_back' | 'table_theme' | 'table_skin', themeId: string) => Promise<'ok' | 'not_owned' | 'invalid' | 'error'>;
  /** Award coins to the current user wallet and refresh local profile cache. */
  awardCoins: (amount: number, source: SalindaCoinSource | string, idempotencyKey?: string | null) => Promise<'ok' | 'error'>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TUTORIAL_COINS_KEY = 'lulos_tutorial_coins_earned_count';
const TUTORIAL_COINS_SYNCED_KEY = 'lulos_tutorial_coins_synced';
const LOCAL_WILD_OWNED_KEY_PREFIX = 'lulos_local_wild_owned:';

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

  const user = session?.user ?? null;
  const isAuthenticated = !!session;
  const isAnonymous = isAnonymousAuthUser(user);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const [localWildOwnedRaw, profileResult] = await Promise.all([
        AsyncStorage.getItem(localWildOwnedKey(userId)),
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single(),
      ]);
      const { data, error } = profileResult;
      if (error) {
        console.warn('[auth] fetchProfile error:', error.message);
        setProfile(null);
      } else {
        const localWildOwned = localWildOwnedRaw === 'true';
        const rawProfile = data as PlayerProfile;
        const syncedCoins = await ensureMinimumProfileCoins(userId, rawProfile.total_coins);
        setProfile({
          ...rawProfile,
          total_coins: syncedCoins,
          wild_owned: (rawProfile as Partial<PlayerProfile>).wild_owned === true || localWildOwned,
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
        if (s) {
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
      }
    };

    void init();

    try {
      const { data } = supabase.auth.onAuthStateChange((_event, s) => {
        setSession(s ?? null);
        if (s?.user) {
          void fetchProfile(s.user.id);
        } else {
          setProfile(null);
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
    const purchaseViaProfileUpdate = async (): Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'error'> => {
      if (!user) return 'error';
      const currentCoins = profile?.total_coins ?? 0;
      if ((profile?.wild_owned ?? false) === true) return 'already_owned';
      if (currentCoins < SALINDA_CATALOG.wild_card.price) return 'insufficient_coins';
      try {
        const nextCoins = currentCoins - SALINDA_CATALOG.wild_card.price;
        const { data, error } = await supabase
          .from('profiles')
          .update({ total_coins: nextCoins })
          .eq('id', user.id)
          .eq('total_coins', currentCoins)
          .select('id, total_coins');
        if (error) return 'error';
        if (!data || data.length === 0) {
          await refreshProfile();
          return 'error';
        }
        await AsyncStorage.setItem(localWildOwnedKey(user.id), 'true');
        setProfile((prev) => (prev ? { ...prev, total_coins: nextCoins, wild_owned: true } : prev));
        await refreshProfile();
        return 'ok';
      } catch {
        return 'error';
      }
    };

    try {
      const { data, error } = await supabase.rpc('purchase_wild');
      if (error) {
        return await purchaseViaProfileUpdate();
      }
      const result = data as string;
      if (result === 'ok') {
        if (user) await AsyncStorage.removeItem(localWildOwnedKey(user.id));
        await refreshProfile();
      }
      return result as 'ok' | 'already_owned' | 'insufficient_coins';
    } catch {
      return await purchaseViaProfileUpdate();
    }
  }, [profile, refreshProfile, user]);

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

  const signOutFn = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const signOutToGuest = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) return { error: error.message };
      return await beginAnonymousSession();
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Could not switch to guest mode.',
      };
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
        awardCoins,
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
