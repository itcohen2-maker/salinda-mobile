import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { FeedbackInboxScreen } from './FeedbackInboxScreen';

const mockUseAuth = jest.fn();
const mockUseFeedbackAdmin = jest.fn();
const mockSetStringAsync = jest.fn();
const mockLimit = jest.fn();
const mockOrder = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../feedback/useFeedbackAdmin', () => ({
  useFeedbackAdmin: () => mockUseFeedbackAdmin(),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]) => mockSetStringAsync(...args),
}));

jest.mock('../i18n/LocaleContext', () => ({
  useLocale: () => ({
    locale: 'en',
    isRTL: false,
    t: (key: string) => {
      const copy: Record<string, string> = {
        'feedbackInbox.back': 'Back',
        'feedbackInbox.refresh': 'Refresh',
        'feedbackInbox.title': 'Feedback inbox',
        'feedbackInbox.subtitle': 'Latest in-app feedback submissions from players.',
        'feedbackInbox.empty': 'No feedback has been submitted yet.',
        'feedbackInbox.error': 'Could not load feedback right now.',
        'feedbackInbox.noAccessTitle': 'Access restricted',
        'feedbackInbox.noAccessBody': 'This screen is only available to allowlisted admins.',
        'feedbackInbox.senderAnonymous': 'Anonymous player',
        'feedbackInbox.senderUnknown': 'Unknown player',
        'feedbackInbox.senderTypeGuest': 'Guest',
        'feedbackInbox.senderTypeRegistered': 'Registered',
        'feedbackInbox.locale': 'Locale',
        'feedbackInbox.version': 'Version',
        'feedbackInbox.noComment': 'No comment',
        'feedbackInbox.openGift': 'Gift coins',
        'feedbackInbox.kind.general': 'General',
        'feedbackInbox.kind.game': 'Game',
        'feedbackInbox.kind.tutorial': 'Tutorial',
        'feedbackInbox.status.new': 'New',
        'feedbackInbox.status.reviewed': 'Reviewed',
        'feedbackInbox.status.archived': 'Archived',
        'feedbackInbox.sortNewest': 'Newest first',
        'feedbackInbox.sortOldest': 'Oldest first',
        'feedbackInbox.markReviewed': 'Mark reviewed',
        'feedbackInbox.archive': 'Archive',
        'feedbackInbox.actionError': 'Action failed. Please try again.',
      };
      return copy[key] ?? key;
    },
  }),
}));

describe('FeedbackInboxScreen', () => {
  const openAdminCoinGifts = jest.fn();

  beforeEach(() => {
    mockLimit.mockReset();
    mockOrder.mockReset();
    mockEq.mockReset();
    mockSelect.mockReset();
    mockFrom.mockReset();
    mockUseAuth.mockReset();
    mockUseFeedbackAdmin.mockReset();
    mockSetStringAsync.mockReset();
    openAdminCoinGifts.mockReset();

    mockOrder.mockReturnValue({ limit: mockLimit });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSetStringAsync.mockResolvedValue(undefined);
  });

  it('shows a restricted message for non-admin users', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
    mockUseFeedbackAdmin.mockReturnValue({ isFeedbackAdmin: false, loading: false });

    render(<FeedbackInboxScreen onBack={jest.fn()} onOpenAdminCoinGifts={openAdminCoinGifts} />);

    expect(screen.getByText('Access restricted')).toBeTruthy();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('renders registered feedback rows and shows the gift shortcut', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'admin-1' } });
    mockUseFeedbackAdmin.mockReturnValue({ isFeedbackAdmin: true, loading: false });
    mockLimit.mockResolvedValue({
      data: [
        {
          id: 'fb-1',
          username_snapshot: 'Noa',
          is_anonymous: false,
          locale: 'he',
          experience_kind: 'game',
          rating: 5,
          comment: 'Loved it',
          platform: 'android',
          app_version: '1.0.0',
          status: 'new',
          created_at: '2026-05-20T12:00:00.000Z',
        },
      ],
      error: null,
    });

    render(<FeedbackInboxScreen onBack={jest.fn()} onOpenAdminCoinGifts={openAdminCoinGifts} />);

    await waitFor(() => {
      expect(screen.getByText('Noa')).toBeTruthy();
      expect(screen.getByText('Registered')).toBeTruthy();
      expect(screen.getByText(/Game/)).toBeTruthy();
      expect(screen.getByText(/android/)).toBeTruthy();
      expect(screen.getByText('Loved it')).toBeTruthy();
      expect(screen.getByTestId('feedback-open-gift-fb-1')).toBeTruthy();
    });
  });

  it('shows the guest badge and still opens coin gifts when an anonymous sender has a username', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'admin-1' } });
    mockUseFeedbackAdmin.mockReturnValue({ isFeedbackAdmin: true, loading: false });
    mockLimit.mockResolvedValue({
      data: [
        {
          id: 'fb-guest',
          username_snapshot: 'guest_42',
          is_anonymous: true,
          locale: 'en',
          experience_kind: 'general',
          rating: 4,
          comment: 'Useful',
          platform: 'ios',
          app_version: '1.0.0',
          status: 'new',
          created_at: '2026-05-20T12:00:00.000Z',
        },
      ],
      error: null,
    });

    render(<FeedbackInboxScreen onBack={jest.fn()} onOpenAdminCoinGifts={openAdminCoinGifts} />);

    const giftButton = await screen.findByTestId('feedback-open-gift-fb-guest');
    fireEvent.press(giftButton);

    expect(screen.getByText('Guest')).toBeTruthy();
    expect(openAdminCoinGifts).toHaveBeenCalledWith('guest_42');
  });

  it('does not show the gift shortcut when there is no username snapshot', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'admin-1' } });
    mockUseFeedbackAdmin.mockReturnValue({ isFeedbackAdmin: true, loading: false });
    mockLimit.mockResolvedValue({
      data: [
        {
          id: 'fb-2',
          username_snapshot: null,
          is_anonymous: true,
          locale: 'en',
          experience_kind: 'tutorial',
          rating: 3,
          comment: '',
          platform: 'web',
          app_version: '1.0.0',
          status: 'new',
          created_at: '2026-05-20T12:00:00.000Z',
        },
      ],
      error: null,
    });

    render(<FeedbackInboxScreen onBack={jest.fn()} onOpenAdminCoinGifts={openAdminCoinGifts} />);

    await waitFor(() => {
      expect(screen.getByText('Guest')).toBeTruthy();
      expect(screen.queryByTestId('feedback-open-gift-fb-2')).toBeNull();
    });
  });

  it('copies the username when an admin taps it', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'admin-1' } });
    mockUseFeedbackAdmin.mockReturnValue({ isFeedbackAdmin: true, loading: false });
    mockLimit.mockResolvedValue({
      data: [
        {
          id: 'fb-1',
          username_snapshot: 'Noa',
          is_anonymous: false,
          locale: 'en',
          experience_kind: 'general',
          rating: 4,
          comment: 'Useful',
          platform: 'ios',
          app_version: '1.0.0',
          status: 'new',
          created_at: '2026-05-20T12:00:00.000Z',
        },
      ],
      error: null,
    });

    render(<FeedbackInboxScreen onBack={jest.fn()} onOpenAdminCoinGifts={openAdminCoinGifts} />);

    const copyButton = await screen.findByTestId('feedback-copy-username-fb-1');
    fireEvent.press(copyButton);

    await waitFor(() => {
      expect(mockSetStringAsync).toHaveBeenCalledWith('Noa');
      expect(screen.getByText('Copied')).toBeTruthy();
    });
  });
});
