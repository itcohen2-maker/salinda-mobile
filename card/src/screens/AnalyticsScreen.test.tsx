import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

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

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('AnalyticsScreen', () => {
  const mockUseAdminAccess = useAdminAccess as jest.Mock;

  beforeEach(() => {
    mockLimit.mockReset();
    mockOrder.mockReset();
    mockEq.mockReset();
    mockSelect.mockReset();
    mockFrom.mockReset();
    mockUseAdminAccess.mockReset();

    mockLimit.mockResolvedValue({ data: [], error: null });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });
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
});
