import { renderHook, act, waitFor } from '@testing-library/react-native';
import React from 'react';
import { supabase } from '../lib/supabase';
import {
  useSessionTrackingInternal,
  SessionTrackingContext,
  useTrackEvent,
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

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, children);

describe('useSessionTrackingInternal', () => {
  it('inserts a session row on mount', async () => {
    const chain = makeInsertChain('session-1');
    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'app_sessions') return { insert: chain.insert, update: chain.update };
      return { insert: chain.eventInsert };
    });

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

    const { result } = renderHook(() => useSessionTrackingInternal('en'), { wrapper });

    act(() => { result.current.trackEvent('game_played', { won: true, mode: 'bot' }); });

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
