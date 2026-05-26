import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { useAdminAccess } from '../admin/useAdminAccess';
import { AnalyticsScreen } from './AnalyticsScreen';

jest.mock('../admin/useAdminAccess', () => ({
  useAdminAccess: jest.fn(),
}));

jest.mock('../i18n/LocaleContext', () => ({
  useLocale: () => ({
    locale: 'en',
    isRTL: false,
    t: (key: string) => key,
  }),
}));

const mockLimit = jest.fn();
const mockOrder = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

const sampleStats = {
  online_now: 7,
  online_by_platform: { web: 3, android: 2, ios: 2 },
  entries_last_hour: 12,
  entries_today: 45,
  entries_7d: 200,
  entries_30d: 800,
  total: 1500,
  anonymous: 900,
  registered: 600,
  avg_duration_seconds: 120,
  by_platform: { web: 600, android: 500, ios: 400 },
  by_activity: {
    game_played: 300,
    tutorial_complete: 150,
    feedback_submitted: 50,
    user_registered: 30,
    app_open: 800,
    tutorial_lesson_complete: 200,
  },
};

describe('AnalyticsScreen', () => {
  const mockUseAdminAccess = useAdminAccess as jest.Mock;

  beforeEach(() => {
    mockLimit.mockReset();
    mockOrder.mockReset();
    mockEq.mockReset();
    mockSelect.mockReset();
    mockFrom.mockReset();
    mockUseAdminAccess.mockReset();
    mockRpc.mockReset();

    mockLimit.mockResolvedValue({ data: [], error: null });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  it('renders session list after load', async () => {
    mockUseAdminAccess.mockReturnValue({ isAdmin: true, loading: false });
    mockLimit.mockResolvedValue({
      data: [
        {
          id: 'session-1',
          user_id: 'user-abc',
          is_anonymous: false,
          platform: 'android',
          locale: 'en',
          app_version: '1.0.0',
          session_start: '2026-05-20T10:00:00.000Z',
          session_end: '2026-05-20T10:30:00.000Z',
          last_seen_at: '2026-05-20T10:30:00.000Z',
          event_count: 5,
        },
      ],
      error: null,
    });

    render(<AnalyticsScreen onBack={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('analytics-session-list')).toBeTruthy();
    });
  });

  it('calls onBack when back button pressed', () => {
    mockUseAdminAccess.mockReturnValue({ isAdmin: true, loading: false });

    const onBack = jest.fn();
    render(<AnalyticsScreen onBack={onBack} />);

    fireEvent.press(screen.getByTestId('analytics-back-button'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders live panel with online_now value from RPC', async () => {
    mockUseAdminAccess.mockReturnValue({ isAdmin: true, loading: false });
    mockRpc.mockResolvedValue({ data: sampleStats, error: null });

    render(<AnalyticsScreen onBack={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('analytics-live-panel')).toBeTruthy();
    });

    expect(screen.getByText('7')).toBeTruthy();
  });

  it('calls rpc again after 10 seconds', async () => {
    jest.useFakeTimers();
    mockUseAdminAccess.mockReturnValue({ isAdmin: true, loading: false });
    mockRpc.mockResolvedValue({ data: sampleStats, error: null });

    render(<AnalyticsScreen onBack={jest.fn()} />);

    // Let the initial async effects settle
    await act(async () => {
      await Promise.resolve();
    });

    const callsAfterMount = mockRpc.mock.calls.length;

    await act(async () => {
      jest.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    expect(mockRpc.mock.calls.length).toBeGreaterThan(callsAfterMount);

    jest.useRealTimers();
  });

  it('shows access-restricted when not admin', () => {
    mockUseAdminAccess.mockReturnValue({ isAdmin: false, loading: false });

    render(<AnalyticsScreen onBack={jest.fn()} />);

    expect(screen.getByTestId('analytics-back-button')).toBeTruthy();
    expect(screen.getByText('analytics.noAccess')).toBeTruthy();
  });
});
