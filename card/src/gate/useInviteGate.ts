import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export type InviteGateStatus = 'loading' | 'allowed' | 'denied';

export interface UseInviteGateResult {
  /** Overall gate decision used to show the game vs the black gate screen. */
  status: InviteGateStatus;
  /** Raw reason from the server: 'invited' | 'admin' | 'anonymous' | 'not_invited' | 'blocked' | 'no_email' | 'error'. */
  reason: string | null;
  /** Force an immediate re-check (e.g. right after a sign-in attempt). */
  recheck: () => void;
}

const DEFAULT_INTERVAL_SECONDS = 30;
const MIN_INTERVAL_SECONDS = 5;

interface GateRecheckConfig {
  intervalSeconds: number;
}

async function fetchRecheckConfig(): Promise<GateRecheckConfig> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'gate_recheck')
      .maybeSingle();
    if (error || !data?.value) return { intervalSeconds: DEFAULT_INTERVAL_SECONDS };
    const raw = Number((data.value as { intervalSeconds?: unknown }).intervalSeconds);
    const intervalSeconds = Number.isFinite(raw) && raw >= MIN_INTERVAL_SECONDS ? raw : DEFAULT_INTERVAL_SECONDS;
    return { intervalSeconds };
  } catch {
    return { intervalSeconds: DEFAULT_INTERVAL_SECONDS };
  }
}

/**
 * Closed invite gate. Calls the `check_invite_access` RPC (which returns ONLY
 * the caller's own status) on mount, on auth changes, when the app
 * foregrounds, and on a configurable interval. If a previously-allowed user is
 * revoked while connected, they are signed out so their open session can't keep
 * a socket alive — they land back on the black gate screen within one interval.
 *
 * Admins always pass (the RPC returns status 'admin'), so the operator can never
 * lock themselves out.
 */
export function useInviteGate(): UseInviteGateResult {
  const { user, loading: authLoading, signOut } = useAuth();
  const [status, setStatus] = useState<InviteGateStatus>('loading');
  const [reason, setReason] = useState<string | null>(null);
  const [intervalSeconds, setIntervalSeconds] = useState(DEFAULT_INTERVAL_SECONDS);
  const wasAllowedRef = useRef(false);

  const check = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('check_invite_access');
      if (error) {
        setStatus('denied');
        setReason('error');
        return;
      }
      const payload = (data ?? {}) as { allowed?: boolean; status?: string };
      setReason(typeof payload.status === 'string' ? payload.status : null);

      if (payload.allowed) {
        wasAllowedRef.current = true;
        setStatus('allowed');
        return;
      }

      setStatus('denied');
      // Revoked mid-session: drop the session so the socket dies and they
      // can't keep playing on a stale token.
      if (wasAllowedRef.current) {
        wasAllowedRef.current = false;
        void signOut();
      }
    } catch {
      setStatus('denied');
      setReason('error');
    }
  }, [signOut]);

  const recheck = useCallback(() => {
    void check();
  }, [check]);

  // Load the admin-configured poll interval once, and refresh it on each check
  // cycle so interval changes take effect without a reload.
  useEffect(() => {
    let cancelled = false;
    void fetchRecheckConfig().then((cfg) => {
      if (!cancelled) setIntervalSeconds(cfg.intervalSeconds);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Initial + auth-change check.
  useEffect(() => {
    if (authLoading) return;
    void check();
  }, [authLoading, user?.id, check]);

  // Periodic re-check (catches admin-side revocation on an open session).
  useEffect(() => {
    if (authLoading) return;
    const ms = Math.max(MIN_INTERVAL_SECONDS, intervalSeconds) * 1000;
    const id = setInterval(() => {
      void check();
      void fetchRecheckConfig().then((cfg) => setIntervalSeconds(cfg.intervalSeconds));
    }, ms);
    return () => clearInterval(id);
  }, [authLoading, intervalSeconds, check]);

  // Re-check when the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  return { status, reason, recheck };
}
