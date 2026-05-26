# Visitor Analytics & Anonymous Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track every visitor session (anonymous and registered) across all platforms, emit key game events, fix the feedback inbox reviewed/archived bug, allow anonymous feedback, add an in-app analytics screen for admins, and automate mobile OTA updates on every push.

**Architecture:** A new `useSessionTracking` hook (called in `AppShell`) creates a Supabase `app_sessions` row on each app open and exposes a `trackEvent` function via React context. Events write to `app_events`. The admin analytics screen follows the `FeedbackInboxScreen` pattern. Anonymous auth already works — every user already gets a Supabase anonymous session on first open via the existing `useAuth` provider.

**Tech Stack:** Supabase (RLS, REST), React Native / Expo, `AppState` (mobile), `visibilitychange` (web), EAS Update (OTA), Jest + @testing-library/react-native.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/022_app_sessions.sql` | Create | sessions table + RLS |
| `supabase/migrations/023_app_events.sql` | Create | events table + RLS |
| `src/hooks/useSessionTracking.ts` | Create | session lifecycle + trackEvent context |
| `src/hooks/useSessionTracking.test.ts` | Create | unit tests |
| `src/screens/AnalyticsScreen.tsx` | Create | admin analytics dashboard |
| `src/screens/AnalyticsScreen.test.tsx` | Create | screen tests |
| `index.tsx` | Modify | wire hook, game_played event, add analytics screen + nav |
| `src/tutorial/InteractiveTutorialScreen.tsx` | Modify | emit tutorial events |
| `.git/hooks/pre-push` | Modify | add EAS Update step |

---

## Task 1: Fix feedback inbox reviewed/archived bug

The `UPDATE` and `DELETE` RLS policies for `feedback_submissions` were written in migrations 020/021 but never applied to the production Supabase instance.

**Files:** Supabase SQL editor (no code changes)

- [ ] **Step 1: Open Supabase dashboard**

Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) → project `isqxuchcmmabjosxjawt` → SQL Editor.

- [ ] **Step 2: Apply migration 020**

Run the exact contents of `supabase/migrations/020_feedback_admin_write.sql`:

```sql
create policy "Admins update feedback submissions"
  on public.feedback_submissions
  for update
  to authenticated
  using (
    exists (
      select 1 from public.admin_users
      where user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.admin_users
      where user_id = auth.uid()
    )
  );

grant update (status) on public.feedback_submissions to authenticated;
```

- [ ] **Step 3: Apply migration 021**

Run the exact contents of `supabase/migrations/021_feedback_admin_delete.sql`:

```sql
create policy "Admins delete archived feedback submissions"
  on public.feedback_submissions
  for delete
  to authenticated
  using (
    status in ('reviewed', 'archived')
    and exists (
      select 1 from public.admin_users
      where user_id = auth.uid()
    )
  );

grant delete on public.feedback_submissions to authenticated;
```

- [ ] **Step 4: Verify fix**

Open the app, go to Feedback Inbox. Mark a "new" item as reviewed. Switch to the "נסקר" tab — the item should appear. Switch to "ארכיון" tab, archive an item — it should appear there.

---

## Task 2: Migration — app_sessions table

**Files:**
- Create: `supabase/migrations/022_app_sessions.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/022_app_sessions.sql
-- One row per app session (open → background/close).

create table if not exists public.app_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  is_anonymous  boolean not null,
  platform      text not null,
  locale        text not null,
  app_version   text,
  session_start timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  session_end   timestamptz,
  event_count   int not null default 0
);

alter table public.app_sessions enable row level security;

create policy "Users insert own sessions"
  on public.app_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own sessions"
  on public.app_sessions
  for update
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins read all sessions"
  on public.app_sessions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_users
      where user_id = auth.uid()
    )
  );

grant select, insert, update on public.app_sessions to authenticated;

create index if not exists idx_app_sessions_user_id
  on public.app_sessions (user_id);
create index if not exists idx_app_sessions_session_start
  on public.app_sessions (session_start desc);
```

- [ ] **Step 2: Apply to Supabase**

In the Supabase SQL editor, run the full contents of the file.
Expected: "Success. No rows returned."

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/022_app_sessions.sql
git commit -m "feat(analytics): add app_sessions table with RLS"
```

---

## Task 3: Migration — app_events table

**Files:**
- Create: `supabase/migrations/023_app_events.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/023_app_events.sql
-- One row per tracked user action within a session.

create table if not exists public.app_events (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.app_sessions(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  event_type   text not null,
  event_data   jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

alter table public.app_events enable row level security;

create policy "Users insert own events"
  on public.app_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Admins read all events"
  on public.app_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_users
      where user_id = auth.uid()
    )
  );

grant select, insert on public.app_events to authenticated;

create index if not exists idx_app_events_session_id
  on public.app_events (session_id);
create index if not exists idx_app_events_user_id
  on public.app_events (user_id);
create index if not exists idx_app_events_created_at
  on public.app_events (created_at desc);
create index if not exists idx_app_events_type
  on public.app_events (event_type);
```

- [ ] **Step 2: Apply to Supabase**

In the Supabase SQL editor, run the full contents of the file.
Expected: "Success. No rows returned."

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/023_app_events.sql
git commit -m "feat(analytics): add app_events table with RLS"
```

---

## Task 4: useSessionTracking hook

**Files:**
- Create: `src/hooks/useSessionTracking.ts`
- Create: `src/hooks/useSessionTracking.test.ts`

- [ ] **Step 1: Write the failing test**

`src/hooks/useSessionTracking.test.ts`:

```ts
import { renderHook, act, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import {
  useSessionTrackingInternal,
  SessionTrackingContext,
  useTrackEvent,
  type AppEventType,
} from './useSessionTracking';
import { AuthProvider } from './useAuth';

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signInAnonymously: jest.fn(),
    },
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

function makeInsertChain(returnId: string | null = 'session-1') {
  const single = jest.fn().mockResolvedValue({
    data: returnId ? { id: returnId } : null,
    error: null,
  });
  const select = jest.fn().mockReturnValue({ single });
  const insert = jest.fn().mockReturnValue({ select });
  const update = jest.fn().mockReturnValue({
    eq: jest.fn().mockResolvedValue({ error: null }),
  });
  const eventInsert = jest.fn().mockResolvedValue({ error: null });
  return { insert, select, single, update, eventInsert };
}

function makeAnonUser() {
  return { id: 'anon-user-1', is_anonymous: true };
}

beforeEach(() => {
  jest.clearAllMocks();
  (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { user: makeAnonUser() } },
  });
  (mockSupabase.auth.signInAnonymously as jest.Mock).mockResolvedValue({
    data: { session: { user: makeAnonUser() } },
  });
});

describe('useSessionTrackingInternal', () => {
  it('inserts a session row on mount', async () => {
    const chain = makeInsertChain('session-1');
    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'app_sessions') return { insert: chain.insert, update: chain.update };
      return { insert: chain.eventInsert };
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    renderHook(() => useSessionTrackingInternal('he'), { wrapper });

    await waitFor(() => {
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'anon-user-1',
          is_anonymous: true,
          platform: expect.any(String),
          locale: 'he',
        }),
      );
    });
  });

  it('emits app_open event after session is created', async () => {
    const chain = makeInsertChain('session-1');
    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'app_sessions') return { insert: chain.insert, update: chain.update };
      return { insert: chain.eventInsert };
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    renderHook(() => useSessionTrackingInternal('he'), { wrapper });

    await waitFor(() => {
      expect(chain.eventInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'session-1',
          event_type: 'app_open',
        }),
      );
    });
  });

  it('trackEvent queues events before session is ready and flushes after', async () => {
    let resolveInsert!: (v: unknown) => void;
    const insertPromise = new Promise((res) => { resolveInsert = res; });
    const single = jest.fn().mockReturnValue(insertPromise);
    const select = jest.fn().mockReturnValue({ single });
    const sessionInsert = jest.fn().mockReturnValue({ select });
    const eventInsert = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });

    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'app_sessions') return { insert: sessionInsert, update };
      return { insert: eventInsert };
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useSessionTrackingInternal('en'), { wrapper });

    // trackEvent called before session_id available
    act(() => { result.current.trackEvent('game_played', { won: true, mode: 'bot' }); });

    // Resolve session insert
    await act(async () => {
      resolveInsert({ data: { id: 'session-1' }, error: null });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(eventInsert).toHaveBeenCalledWith(
        expect.objectContaining({ event_type: 'game_played', session_id: 'session-1' }),
      );
    });
  });
});
```

- [ ] **Step 2: Run failing test**

```bash
npx jest src/hooks/useSessionTracking.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module './useSessionTracking'"

- [ ] **Step 3: Implement the hook**

`src/hooks/useSessionTracking.ts`:

```ts
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
  // Capture isAnonymous at session-start time so event tracking uses the correct value
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

  // Start session whenever user.id becomes available (first auth).
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

      // Flush events queued before session was ready
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
  }, [user?.id]); // only restart when user identity changes

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
          // Long background — end old session; new one starts on next user effect run
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
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest src/hooks/useSessionTracking.test.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSessionTracking.ts src/hooks/useSessionTracking.test.ts
git commit -m "feat(analytics): add useSessionTracking hook with session lifecycle + event tracking"
```

---

## Task 5: Wire useSessionTracking into AppShell

**Files:**
- Modify: `index.tsx` (AppShell component, around line 22898)

- [ ] **Step 1: Import the hook and context**

At the top of `index.tsx`, after the existing auth import (line 320):

```ts
import {
  useSessionTrackingInternal,
  SessionTrackingContext,
} from './src/hooks/useSessionTracking';
```

- [ ] **Step 2: Add a SessionTrackingProvider wrapper**

Find the `App` function component (around line 22880 — the one that renders `<AuthProvider>`). Add a new inner component `AppWithTracking` that calls `useSessionTrackingInternal` and provides the context:

```tsx
function AppWithTracking({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  const tracking = useSessionTrackingInternal(locale);
  return (
    <SessionTrackingContext.Provider value={tracking}>
      {children}
    </SessionTrackingContext.Provider>
  );
}
```

Place this function definition just above the `App` function.

- [ ] **Step 3: Wrap AppShell with AppWithTracking**

In the `App` function return, wrap `<AppShell .../>` inside `<AppWithTracking>`:

```tsx
return (
  <AuthProvider>
    <LocaleProvider>
      <ThemeProvider>
        <AppWithTracking>
          <MultiplayerProvider>
            <GameProvider>
              <AppShell showSplash={showSplash} setShowSplash={setShowSplash} />
            </GameProvider>
          </MultiplayerProvider>
        </AppWithTracking>
      </ThemeProvider>
    </LocaleProvider>
  </AuthProvider>
);
```

Note: `AppWithTracking` must be inside `<LocaleProvider>` (to call `useLocale()`) and inside `<AuthProvider>` (to call `useAuth()` inside the hook).

- [ ] **Step 4: Smoke test**

Run the app (`npx expo start`). Open in browser. In Supabase dashboard → Table Editor → `app_sessions`: a new row should appear within a few seconds.

- [ ] **Step 5: Commit**

```bash
git add index.tsx
git commit -m "feat(analytics): wire session tracking into app root"
```

---

## Task 6: Track game_played event

**Files:**
- Modify: `index.tsx` (`AppShell` function, around line 22578)

- [ ] **Step 1: Locate AppShell and its game state access**

`AppShell` is defined around line 22578 in `index.tsx`. It is rendered inside `<GameProvider>`, so `useGame()` is available there. The local state variable for the current screen is `activePlayMode` (set via `setActivePlayMode`). Access game state with:

```tsx
const { state: gameState } = useGame();
```

Add this near the top of the `AppShell` function body alongside other hooks.

- [ ] **Step 2: Add the game_played tracking effect**

Inside `AppShell`, after the `useGame()` call, add:

```tsx
const { trackEvent } = useTrackEvent();

const prevGamePhaseRef = useRef<string | null>(null);
useEffect(() => {
  if (
    gameState.phase === 'game-over' &&
    prevGamePhaseRef.current !== 'game-over'
  ) {
    const won = gameState.currentPlayerIndex === 0;
    const mode: 'local' | 'online' | 'bot' =
      activePlayMode === 'online' ? 'online'
      : gameState.botConfig ? 'bot'
      : 'local';
    trackEvent('game_played', { won, mode });
  }
  prevGamePhaseRef.current = gameState.phase;
}, [gameState.phase, gameState.currentPlayerIndex, gameState.botConfig, activePlayMode, trackEvent]);
```

Add `import { useTrackEvent } from './src/hooks/useSessionTracking';` at the top of `index.tsx` alongside the other hook import added in Task 5.

- [ ] **Step 3: Verify**

Play a game to completion. Check `app_events` table in Supabase: a row with `event_type = 'game_played'` should appear.

- [ ] **Step 4: Commit**

```bash
git add index.tsx
git commit -m "feat(analytics): emit game_played event on game over"
```

---

## Task 7: Track tutorial events

**Files:**
- Modify: `src/tutorial/InteractiveTutorialScreen.tsx`

- [ ] **Step 1: Import useTrackEvent**

At the top of `InteractiveTutorialScreen.tsx`, add:

```ts
import { useTrackEvent } from '../hooks/useSessionTracking';
```

- [ ] **Step 2: Call the hook inside the component**

Inside `InteractiveTutorialScreen` component (near the top, after other hooks):

```ts
const trackEvent = useTrackEvent();
```

- [ ] **Step 3: Emit tutorial_lesson_complete**

Find the `useEffect` that watches `engine.phase`. When `engine.phase === 'lesson-done'`, emit:

```ts
useEffect(() => {
  if (engine.phase === 'lesson-done') {
    trackEvent('tutorial_lesson_complete', { lesson_index: engine.lessonIndex });
  }
}, [engine.phase, engine.lessonIndex, trackEvent]);
```

- [ ] **Step 4: Emit tutorial_complete**

When `engine.phase === 'core-complete'` (core tutorial done) or `engine.phase === 'all-done'` (advanced done), emit:

```ts
useEffect(() => {
  if (engine.phase === 'core-complete' || engine.phase === 'all-done') {
    trackEvent('tutorial_complete', { advanced: engine.phase === 'all-done' });
  }
}, [engine.phase, trackEvent]);
```

- [ ] **Step 5: Verify**

Run the tutorial. After completing lesson 1, check `app_events` in Supabase: `tutorial_lesson_complete` with `lesson_index: 0` should appear.

- [ ] **Step 6: Commit**

```bash
git add src/tutorial/InteractiveTutorialScreen.tsx
git commit -m "feat(analytics): emit tutorial lesson and completion events"
```

---

## Task 8: AnalyticsScreen — build the screen

**Files:**
- Create: `src/screens/AnalyticsScreen.tsx`
- Create: `src/screens/AnalyticsScreen.test.tsx`

- [ ] **Step 1: Write failing tests**

`src/screens/AnalyticsScreen.test.tsx`:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { AnalyticsScreen } from './AnalyticsScreen';
import { supabase } from '../lib/supabase';
import { AuthProvider } from '../hooks/useAuth';
import { LocaleProvider } from '../i18n/LocaleContext';

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signInAnonymously: jest.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

jest.mock('../admin/useAdminAccess', () => ({
  useAdminAccess: () => ({ isAdmin: true, loading: false }),
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const makeMockSessions = () => [
  {
    id: 's1',
    user_id: 'u1',
    is_anonymous: true,
    platform: 'android',
    locale: 'he',
    app_version: '1.0.0',
    session_start: new Date(Date.now() - 120_000).toISOString(),
    session_end: new Date(Date.now() - 60_000).toISOString(),
    last_seen_at: new Date(Date.now() - 60_000).toISOString(),
    event_count: 2,
    username_snapshot: null,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  const order = jest.fn().mockReturnThis();
  const limit = jest.fn().mockResolvedValue({ data: makeMockSessions(), error: null });
  (mockSupabase.from as jest.Mock).mockReturnValue({ select: jest.fn().mockReturnThis(), order, limit });
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider><LocaleProvider>{children}</LocaleProvider></AuthProvider>
);

describe('AnalyticsScreen', () => {
  it('renders session list after load', async () => {
    render(<AnalyticsScreen onBack={jest.fn()} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByTestId('analytics-session-list')).toBeTruthy();
    });
  });

  it('calls onBack when back button pressed', async () => {
    const onBack = jest.fn();
    render(<AnalyticsScreen onBack={onBack} />, { wrapper });
    await waitFor(() => screen.getByTestId('analytics-back-button'));
    screen.getByTestId('analytics-back-button').props.onPress();
    expect(onBack).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
npx jest src/screens/AnalyticsScreen.test.tsx --no-coverage
```

Expected: FAIL — "Cannot find module './AnalyticsScreen'"

- [ ] **Step 3: Implement AnalyticsScreen**

`src/screens/AnalyticsScreen.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAdminAccess } from '../admin/useAdminAccess';
import { useLocale } from '../i18n/LocaleContext';
import { supabase } from '../lib/supabase';

interface SessionRow {
  id: string;
  user_id: string | null;
  is_anonymous: boolean;
  platform: string;
  locale: string;
  app_version: string | null;
  session_start: string;
  session_end: string | null;
  last_seen_at: string;
  event_count: number;
  username_snapshot?: string | null;
}

function platformColor(platform: string): string {
  if (platform === 'android') return '#4ADE80';
  if (platform === 'ios') return '#60A5FA';
  return '#C084FC';
}

function formatDuration(startIso: string, endIso: string | null, lastSeenIso: string): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : new Date(lastSeenIso).getTime();
  const secs = Math.max(0, Math.round((end - start) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

function formatDate(iso: string, locale: 'he' | 'en'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US');
}

interface AnalyticsScreenProps {
  onBack: () => void;
}

export function AnalyticsScreen({ onBack }: AnalyticsScreenProps) {
  const { locale } = useLocale();
  const { isAdmin, loading: adminLoading } = useAdminAccess();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<'all' | 'android' | 'ios' | 'web'>('all');
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'anonymous' | 'registered'>('all');

  const loadSessions = useCallback(async () => {
    if (!isAdmin) { setLoading(false); return; }
    setLoading(true);
    setHasError(false);
    try {
      let query = supabase
        .from('app_sessions')
        .select('id, user_id, is_anonymous, platform, locale, app_version, session_start, session_end, last_seen_at, event_count');

      if (platformFilter !== 'all') query = query.eq('platform', platformFilter);
      if (userTypeFilter === 'anonymous') query = query.eq('is_anonymous', true);
      if (userTypeFilter === 'registered') query = query.eq('is_anonymous', false);

      const { data, error } = await query
        .order('session_start', { ascending: false })
        .limit(200);

      if (error) { setHasError(true); return; }
      setSessions(Array.isArray(data) ? (data as SessionRow[]) : []);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, platformFilter, userTypeFilter]);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  // Compute summary stats from loaded sessions
  const totalSessions = sessions.length;
  const anonymousCount = sessions.filter((s) => s.is_anonymous).length;
  const completedSessions = sessions.filter((s) => s.session_end !== null);
  const avgDurationSecs = completedSessions.length > 0
    ? Math.round(
        completedSessions.reduce((sum, s) => {
          const ms = new Date(s.session_end!).getTime() - new Date(s.session_start).getTime();
          return sum + ms / 1000;
        }, 0) / completedSessions.length,
      )
    : 0;
  const avgDurationLabel = avgDurationSecs < 60
    ? `${avgDurationSecs}s`
    : `${Math.floor(avgDurationSecs / 60)}m ${avgDurationSecs % 60}s`;

  if (adminLoading) {
    return (
      <View style={styles.shell}>
        <ActivityIndicator size="large" color="#FACC15" />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.screen}>
        <TouchableOpacity testID="analytics-back-button" onPress={onBack} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>{locale === 'he' ? 'חזור' : 'Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.noAccessText}>{locale === 'he' ? 'אין גישה' : 'No access'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity testID="analytics-back-button" onPress={onBack} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>{locale === 'he' ? 'חזור' : 'Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{locale === 'he' ? 'אנליטיקס' : 'Analytics'}</Text>
        <TouchableOpacity onPress={() => void loadSessions()} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>{locale === 'he' ? 'רענן' : 'Refresh'}</Text>
        </TouchableOpacity>
      </View>

      {/* Summary chips */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statValue}>{totalSessions}</Text>
          <Text style={styles.statLabel}>{locale === 'he' ? 'כניסות' : 'Sessions'}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statValue}>{anonymousCount}</Text>
          <Text style={styles.statLabel}>{locale === 'he' ? 'אנונימי' : 'Anonymous'}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statValue}>{totalSessions - anonymousCount}</Text>
          <Text style={styles.statLabel}>{locale === 'he' ? 'רשומים' : 'Registered'}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statValue}>{avgDurationLabel}</Text>
          <Text style={styles.statLabel}>{locale === 'he' ? 'ממוצע' : 'Avg time'}</Text>
        </View>
      </View>

      {/* Platform filter */}
      <View style={styles.filterRow}>
        {(['all', 'android', 'ios', 'web'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPlatformFilter(p)}
            style={[styles.filterChip, platformFilter === p && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, platformFilter === p && styles.filterChipTextActive]}>
              {p === 'all' ? (locale === 'he' ? 'הכל' : 'All') : p}
            </Text>
          </TouchableOpacity>
        ))}
        {(['all', 'anonymous', 'registered'] as const).map((u) => (
          <TouchableOpacity
            key={u}
            onPress={() => setUserTypeFilter(u)}
            style={[styles.filterChip, userTypeFilter === u && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, userTypeFilter === u && styles.filterChipTextActive]}>
              {u === 'all' ? (locale === 'he' ? 'כולם' : 'All users')
                : u === 'anonymous' ? (locale === 'he' ? 'אנונימי' : 'Anon')
                : (locale === 'he' ? 'רשום' : 'Reg')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.shell}>
          <ActivityIndicator size="large" color="#FACC15" />
        </View>
      ) : (
        <ScrollView
          testID="analytics-session-list"
          style={styles.scroll}
          contentContainerStyle={sessions.length > 0 ? styles.listContent : styles.emptyContent}
          showsVerticalScrollIndicator={false}
        >
          {hasError ? (
            <Text style={styles.emptyText}>{locale === 'he' ? 'שגיאה בטעינה' : 'Load error'}</Text>
          ) : sessions.length === 0 ? (
            <Text style={styles.emptyText}>{locale === 'he' ? 'אין נתונים' : 'No sessions'}</Text>
          ) : (
            sessions.map((s) => (
              <View key={s.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.platformBadge, { backgroundColor: platformColor(s.platform) + '33', borderColor: platformColor(s.platform) + '88' }]}>
                    <Text style={[styles.platformText, { color: platformColor(s.platform) }]}>{s.platform}</Text>
                  </View>
                  <Text style={styles.durationText}>
                    {formatDuration(s.session_start, s.session_end, s.last_seen_at)}
                  </Text>
                  <Text style={styles.anonText}>
                    {s.is_anonymous ? (locale === 'he' ? 'אנונימי' : 'Anon') : (locale === 'he' ? 'רשום' : 'Reg')}
                  </Text>
                </View>
                <Text style={styles.dateText}>{formatDate(s.session_start, locale)}</Text>
                {s.event_count > 0 && (
                  <Text style={styles.eventCountText}>
                    {locale === 'he' ? `${s.event_count} פעולות` : `${s.event_count} events`}
                  </Text>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A1628', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 24 },
  shell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headerButton: { minWidth: 72, minHeight: 40, borderRadius: 16, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(37,99,235,0.18)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.34)' },
  headerButtonText: { color: '#BFDBFE', fontSize: 13, fontWeight: '800' },
  headerTitle: { flex: 1, color: '#F8FAFC', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 14, justifyContent: 'space-between' },
  statChip: { flex: 1, backgroundColor: 'rgba(15,23,42,0.85)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.22)', padding: 10, alignItems: 'center' },
  statValue: { color: '#FACC15', fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#CBD5E1', fontSize: 10, fontWeight: '700', marginTop: 2 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  filterChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(15,23,42,0.76)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.22)' },
  filterChipActive: { backgroundColor: 'rgba(37,99,235,0.24)', borderColor: 'rgba(96,165,250,0.52)' },
  filterChipText: { color: 'rgba(191,219,254,0.6)', fontSize: 11, fontWeight: '800' },
  filterChipTextActive: { color: '#BFDBFE' },
  scroll: { flex: 1, marginTop: 14 },
  listContent: { gap: 10, paddingBottom: 12 },
  emptyContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#CBD5E1', fontSize: 14, textAlign: 'center' },
  noAccessText: { color: '#CBD5E1', fontSize: 16, textAlign: 'center', marginTop: 40 },
  card: { borderRadius: 18, padding: 14, backgroundColor: 'rgba(9,23,43,0.92)', borderWidth: 1, borderColor: 'rgba(125,211,252,0.18)' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  platformBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  platformText: { fontSize: 11, fontWeight: '800' },
  durationText: { color: '#FACC15', fontSize: 13, fontWeight: '800', marginLeft: 'auto' },
  anonText: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  dateText: { color: '#64748B', fontSize: 11, marginTop: 6 },
  eventCountText: { color: '#7DD3FC', fontSize: 11, fontWeight: '700', marginTop: 4 },
});
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest src/screens/AnalyticsScreen.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/screens/AnalyticsScreen.tsx src/screens/AnalyticsScreen.test.tsx
git commit -m "feat(analytics): add AnalyticsScreen with session list and stats"
```

---

## Task 9: Wire AnalyticsScreen into admin navigation

**Files:**
- Modify: `index.tsx`

- [ ] **Step 1: Import AnalyticsScreen**

Near line 328 where `FeedbackInboxScreen` is imported:

```ts
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
```

- [ ] **Step 2: Add 'analytics' to ShellPlayMode**

At line 10883, extend the type:

```ts
type ShellPlayMode = 'choose' | 'game-entry' | 'friends-choice' | 'local' | 'online' | 'tutorial' | 'mockup-room' | 'classroom' | 'classroom-game' | 'feedback-inbox' | 'admin-coins' | 'auth' | 'analytics';
```

- [ ] **Step 3: Handle analytics in back handler**

In `AppShell`, find the back handler that checks `activePlayMode === 'feedback-inbox'` (around line 21459). Add immediately after it:

```ts
if (activePlayMode === 'analytics') {
  setActivePlayMode('choose');
  return;
}
```

- [ ] **Step 4: Render AnalyticsScreen**

Find where `FeedbackInboxScreen` is rendered (search for `activePlayMode === 'feedback-inbox'`). Add immediately after its block:

```tsx
{activePlayMode === 'analytics' ? (
  <AnalyticsScreen onBack={() => setActivePlayMode('choose')} />
) : null}
```

- [ ] **Step 5: Add button in admin section**

Find the admin buttons section (around line 20541 where `feedbackInbox.open` button is). Add after the feedback inbox button:

```tsx
<LulosButton
  text={locale === 'he' ? 'אנליטיקס' : 'Analytics'}
  color="blue"
  width={220}
  height={42}
  fontSize={14}
  testID="home-analytics"
  onPress={() => setActivePlayMode('analytics')}
  style={{ marginTop: 12, alignSelf: 'center' }}
/>
```

- [ ] **Step 6: Add ambient background for analytics**

On line 10901, the `shouldShowAmbientBackground` function receives `playMode` as a parameter (different from the `activePlayMode` variable in `AppShell` — this is the parameter name in the function signature). Add `'analytics'` to the list:

```ts
if (playMode === 'online' || playMode === 'mockup-room' || playMode === 'classroom' || playMode === 'feedback-inbox' || playMode === 'admin-coins' || playMode === 'analytics') return true;
```

- [ ] **Step 7: Verify end-to-end**

Open the app as an admin user. On the start screen, the "אנליטיקס" button should appear. Tap it — the analytics screen should load with sessions listed.

- [ ] **Step 8: Commit**

```bash
git add index.tsx
git commit -m "feat(analytics): wire AnalyticsScreen into admin navigation"
```

---

## Task 10: Update pre-push hook for mobile OTA

**Files:**
- Modify: `.git/hooks/pre-push`

- [ ] **Step 1: View current hook**

```bash
cat .git/hooks/pre-push
```

The current hook updates `LAST_PUSH` in `buildInfo.ts` and amends the commit.

- [ ] **Step 2: Add EAS Update step**

Open `.git/hooks/pre-push` and add after the `git commit --amend` line:

```bash
# Push OTA update to mobile production channel
echo "[pre-push] Running eas update..."
cd "$REPO_ROOT/card"
eas update --channel production --non-interactive --message "push $TIMESTAMP" || echo "[pre-push] eas update failed (non-fatal)"
cd "$REPO_ROOT"
```

The `|| echo` makes it non-fatal so a failed EAS update doesn't block the git push.

- [ ] **Step 3: Verify**

Make a trivial change (e.g. add a space to a comment), commit it, and run `git push`. The hook output should include:
```
[pre-push] LAST_PUSH updated to ...
[pre-push] Running eas update...
```
And after a minute, the mobile app should show the new `LAST_PUSH` timestamp on the start screen.

- [ ] **Step 4: Commit the docs note**

```bash
git add docs/superpowers/specs/2026-05-26-visitor-analytics-design.md
git commit -m "docs: note that EAS update is wired into pre-push hook"
```

---

## Summary Checklist

- [ ] Task 1: Feedback inbox bug fixed (migrations 020/021 applied)
- [ ] Task 2: `app_sessions` migration created + applied
- [ ] Task 3: `app_events` migration created + applied
- [ ] Task 4: `useSessionTracking` hook + tests
- [ ] Task 5: Hook wired into app root
- [ ] Task 6: `game_played` event tracked
- [ ] Task 7: Tutorial events tracked
- [ ] Task 8: `AnalyticsScreen` built + tested
- [ ] Task 9: Analytics screen wired into admin nav
- [ ] Task 10: Pre-push hook updated for mobile OTA
