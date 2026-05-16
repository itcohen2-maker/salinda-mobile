import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { TableSkinId } from '../theme/tableSkins';

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
  signOut: () => Promise<void>;
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
  awardCoins: (amount: number, source: string) => Promise<'ok' | 'error'>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TUTORIAL_COINS_KEY = 'lulos_tutorial_coins_earned_count';
const TUTORIAL_COINS_SYNCED_KEY = 'lulos_tutorial_coins_synced';
const LOCAL_WILD_OWNED_KEY_PREFIX = 'lulos_local_wild_owned:';
const MIN_PROFILE_COINS = 10000;
const LOCAL_MIN_PROFILE_COINS_SEEDED_KEY_PREFIX = `lulos_local_min_profile_coins_seeded:${MIN_PROFILE_COINS}:`;

function localWildOwnedKey(userId: string): string {
  return `${LOCAL_WILD_OWNED_KEY_PREFIX}${userId}`;
}

function localMinProfileCoinsSeededKey(userId: string): string {
  return `${LOCAL_MIN_PROFILE_COINS_SEEDED_KEY_PREFIX}${userId}`;
}

export async function ensureMinimumProfileCoins(userId: string, currentCoins: number): Promise<number> {
  const safeCoins = Math.max(0, Math.floor(Number(currentCoins) || 0));
  const seededKey = localMinProfileCoinsSeededKey(userId);

  try {
    const alreadySeeded = await AsyncStorage.getItem(seededKey);
    if (alreadySeeded === 'true') {
      return safeCoins;
    }

    if (safeCoins >= MIN_PROFILE_COINS) {
      await AsyncStorage.setItem(seededKey, 'true');
      return safeCoins;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ total_coins: MIN_PROFILE_COINS })
      .eq('id', userId)
      .lt('total_coins', MIN_PROFILE_COINS);

    if (error) {
      console.warn('[auth] ensureMinimumProfileCoins error:', error.message);
      return safeCoins;
    }

    await AsyncStorage.setItem(seededKey, 'true');
    return MIN_PROFILE_COINS;
  } catch (err) {
    console.warn('[auth] ensureMinimumProfileCoins exception:', err);
    return safeCoins;
  }
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
      await supabase.rpc('award_coins', { p_amount: 10, p_source: 'tutorial_core' });
    } else if (count === 2) {
      await supabase.rpc('award_coins', { p_amount: 10, p_source: 'tutorial_core' });
      await supabase.rpc('award_coins', { p_amount: 20, p_source: 'tutorial_advanced' });
    } else {
      await supabase.rpc('award_coins', { p_amount: count * 10, p_source: 'tutorial_legacy' });
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
  const isAnonymous = user?.is_anonymous === true;

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

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const init = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const s = sessionData?.session ?? null;
        if (s) {
          setSession(s);
          void fetchProfile(s.user.id);
        } else {
          try {
            const { data, error } = await supabase.auth.signInAnonymously();
            if (error) {
              console.warn('[auth] signInAnonymously failed:', error.message);
            } else if (data?.session) {
              setSession(data.session);
              void fetchProfile(data.session.user.id);
            }
          } catch (e) {
            console.warn('[auth] signInAnonymously threw:', e);
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
  }, [fetchProfile]);

  /**
   * Links email + password to the current anonymous session (preserving coins/rating).
   * If for some reason there is no session, falls back to a fresh sign-up.
   */
  const signUp = useCallback(async (email: string, password: string, username: string) => {
    if (user?.is_anonymous) {
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
  }, [user, refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

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
      if (currentCoins < 200) return 'insufficient_coins';
      try {
        const nextCoins = currentCoins - 200;
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

  const awardCoins = useCallback(async (amount: number, source: string): Promise<'ok' | 'error'> => {
    if (!Number.isFinite(amount) || amount <= 0) return 'error';
    try {
      const { error } = await supabase.rpc('award_coins', { p_amount: amount, p_source: source });
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
        signOut: signOutFn,
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
