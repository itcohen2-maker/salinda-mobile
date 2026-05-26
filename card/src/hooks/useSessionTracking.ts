import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export type AppEventType =
  | 'app_open'
  | 'tutorial_lesson_complete'
  | 'tutorial_complete'
  | 'game_played'
  | 'feedback_submitted'
  | 'user_registered';

interface SessionTrackingContextValue {
  trackEvent: (type: AppEventType, data?: Record<string, unknown>) => void;
}

export const SessionTrackingContext = createContext<SessionTrackingContextValue>({
  trackEvent: () => {},
});

export function useTrackEvent(): (type: AppEventType, data?: Record<string, unknown>) => void {
  return useContext(SessionTrackingContext).trackEvent;
}

const SESSION_RESUME_WINDOW_MS = 60_000;
const PING_INTERVAL_MS = 30_000;

function resolveAppVersion(): string | null {
  const v = Constants.expoConfig?.version;
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

export function useSessionTrackingInternal(locale: string): SessionTrackingContextValue {
  const { user, isAnonymous } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const pendingRef = useRef<Array<{ type: AppEventType; data: Record<string, unknown> }>>([]);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevIsAnonymousRef = useRef<boolean | null>(null);
  const backgroundAtRef = useRef<number | null>(null);
  const isAnonymousAtStartRef = useRef(isAnonymous);

  const writeEvent = useCallback(
    (sessionId: string, userId: string, type: AppEventType, data: Record<string, unknown>) => {
      void supabase.from('app_events').insert({
        session_id: sessionId,
        user_id: userId,
        event_type: type,
        event_data: data,
      });
    },
    [],
  );

  const trackEvent = useCallback(
    (type: AppEventType, data: Record<string, unknown> = {}) => {
      const sid = sessionIdRef.current;
      const uid = user?.id;
      if (!sid || !uid) {
        pendingRef.current.push({ type, data });
        return;
      }
      writeEvent(sid, uid, type, data);
    },
    [user?.id, writeEvent],
  );

  // Start session whenever user.id becomes available
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    isAnonymousAtStartRef.current = isAnonymous;
    let cancelled = false;

    const startSession = async () => {
      const { data, error } = await supabase
        .from('app_sessions')
        .insert({
          user_id: userId,
          is_anonymous: isAnonymousAtStartRef.current,
          platform: Platform.OS,
          locale,
          app_version: resolveAppVersion(),
        })
        .select('id')
        .single();

      if (cancelled || error || !data?.id) return;

      sessionIdRef.current = data.id;

      const pending = pendingRef.current.splice(0);
      for (const e of pending) {
        writeEvent(data.id, userId, e.type, e.data);
      }

      writeEvent(data.id, userId, 'app_open', {
        is_returning: prevIsAnonymousRef.current !== null,
      });

      pingRef.current = setInterval(() => {
        if (!sessionIdRef.current) return;
        void supabase
          .from('app_sessions')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', sessionIdRef.current);
      }, PING_INTERVAL_MS);
    };

    void startSession();

    return () => {
      cancelled = true;
      if (pingRef.current) {
        clearInterval(pingRef.current);
        pingRef.current = null;
      }
      if (sessionIdRef.current) {
        void supabase
          .from('app_sessions')
          .update({
            session_end: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          })
          .eq('id', sessionIdRef.current);
        sessionIdRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Mobile: track background/foreground transitions
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundAtRef.current = Date.now();
        if (sessionIdRef.current) {
          void supabase
            .from('app_sessions')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', sessionIdRef.current);
        }
      } else if (nextState === 'active') {
        const bgAt = backgroundAtRef.current;
        backgroundAtRef.current = null;
        if (bgAt !== null && Date.now() - bgAt > SESSION_RESUME_WINDOW_MS) {
          if (sessionIdRef.current) {
            void supabase
              .from('app_sessions')
              .update({ session_end: new Date().toISOString() })
              .eq('id', sessionIdRef.current);
            sessionIdRef.current = null;
          }
          if (pingRef.current) {
            clearInterval(pingRef.current);
            pingRef.current = null;
          }
        }
      }
    });

    return () => sub.remove();
  }, []);

  // Web: track tab visibility changes
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const handle = () => {
      if (document.hidden && sessionIdRef.current) {
        void supabase
          .from('app_sessions')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', sessionIdRef.current);
      }
    };

    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, []);

  // Detect user_registered: isAnonymous transitions true → false
  useEffect(() => {
    if (prevIsAnonymousRef.current === true && !isAnonymous) {
      trackEvent('user_registered');
    }
    prevIsAnonymousRef.current = isAnonymous;
  }, [isAnonymous, trackEvent]);

  return { trackEvent };
}
