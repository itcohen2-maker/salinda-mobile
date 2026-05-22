import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { PlayModeChoiceScreen } from '../../index';
import { useFeedbackAdmin } from '../feedback/useFeedbackAdmin';
import { useAuth } from '../hooks/useAuth';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

const mockSetLocale = jest.fn();

jest.mock('../feedback/useFeedbackAdmin', () => ({
  useFeedbackAdmin: jest.fn(),
}));

jest.mock('../hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: jest.fn(),
}));

jest.mock('../hooks/useMultiplayer', () => ({
  MultiplayerProvider: ({ children }: { children: React.ReactNode }) => children,
  useMultiplayerOptional: () => null,
}));

jest.mock('../hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: jest.fn(),
}));

jest.mock('../../components/WalkingDice', () => ({
  WalkingDice: () => null,
}));

jest.mock('../i18n/LocaleContext', () => ({
  LocaleProvider: ({ children }: { children: React.ReactNode }) => children,
  useLocale: () => ({
    locale: 'en',
    isRTL: false,
    setLocale: mockSetLocale,
    t: (key: string) => {
      const copy: Record<string, string> = {
        'auth.homeButton': 'Sign in',
        'auth.homeHelper': 'Sign in to load your history, bank, and settings.',
        'feedbackInbox.open': 'Feedback inbox',
        'lang.en': 'English',
        'lang.he': 'Hebrew',
        'lang.label': 'Language',
        'lobby.guideButton': 'Tutorial',
        'lobby.namePlaceholder': 'My name',
        'lobby.yourName': 'Your name',
        'mode.play': 'Play',
        'shop.openShop': 'Shop',
      };
      return copy[key] ?? key;
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('PlayModeChoiceScreen auth button', () => {
  const mockUseAuth = useAuth as jest.Mock;
  const mockUseFeedbackAdmin = useFeedbackAdmin as jest.Mock;
  const mockUseResponsiveLayout = useResponsiveLayout as jest.MockedFunction<typeof useResponsiveLayout>;

  const baseProps = {
    onFeedbackSubmit: jest.fn().mockResolvedValue('submitted'),
    onHowToPlay: jest.fn(),
    onOpenAdminCoinGifts: jest.fn(),
    onOpenAuth: jest.fn(),
    onOpenFeedbackInbox: jest.fn(),
    onPlay: jest.fn(),
    onPreferredNameChange: jest.fn(),
    onShop: jest.fn(),
    preferredName: 'Noa',
  };

  beforeEach(() => {
    mockSetLocale.mockReset();
    mockUseAuth.mockReset();
    mockUseFeedbackAdmin.mockReset();
    mockUseResponsiveLayout.mockReturnValue({
      width: 390,
      height: 844,
      fontScale: 1,
      isTight: false,
      isCompact: false,
      isSingleColumn: false,
      isTablet: false,
    });
    mockUseFeedbackAdmin.mockReturnValue({ isFeedbackAdmin: false });
  });

  it('shows the sign-in button for anonymous players', () => {
    mockUseAuth.mockReturnValue({ isAnonymous: true, profile: { total_coins: 15 } });

    render(<PlayModeChoiceScreen {...baseProps} />);

    expect(screen.getByTestId('home-auth-button')).toBeTruthy();
    expect(screen.getByText('Sign in to load your history, bank, and settings.')).toBeTruthy();
  });

  it('hides the sign-in button for signed-in players', () => {
    mockUseAuth.mockReturnValue({ isAnonymous: false, profile: { total_coins: 15 } });

    render(<PlayModeChoiceScreen {...baseProps} />);

    expect(screen.queryByTestId('home-auth-button')).toBeNull();
  });
});
