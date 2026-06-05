import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

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
  useAuthOptional: () => null,
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
  deviceDefaultLocale: () => 'en',
  useLocaleOptional: () => ({ locale: 'en', isRTL: false }),
  useLocale: () => ({
    locale: 'en',
    isRTL: false,
    setLocale: mockSetLocale,
    t: (key: string) => {
      const copy: Record<string, string> = {
        'auth.homeButton': 'Sign in',
        'auth.switchUserButton': 'Switch user',
        'auth.homeHelper': 'Sign in to load your history, bank, and settings.',
        'feedbackInbox.open': 'Feedback inbox',
        'lang.en': 'English',
        'lang.he': 'Hebrew',
        'lang.label': 'Language',
        'lobby.guideButton': 'Tutorial',
        'lobby.namePlaceholder': 'My name',
        'lobby.playNow': 'Play now',
        'lobby.sendFeedback': 'Send feedback',
        'lobby.startTutorial': 'Start tutorial',
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
    onOpenAnalytics: jest.fn(),
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
  });

  it('keeps the auth button for signed-in players without the helper text', () => {
    mockUseAuth.mockReturnValue({ isAnonymous: false, profile: { total_coins: 15 } });

    render(<PlayModeChoiceScreen {...baseProps} />);

    expect(screen.getByTestId('home-auth-button')).toBeTruthy();
    expect(screen.queryByText('Sign in to load your history, bank, and settings.')).toBeNull();
  });

  it('keeps feedback and coin gifting controls hidden for non-admin players', () => {
    mockUseAuth.mockReturnValue({ isAnonymous: false, profile: { total_coins: 15 } });

    render(<PlayModeChoiceScreen {...baseProps} />);

    expect(screen.queryByTestId('home-feedback-toggle')).toBeNull();
    expect(screen.queryByTestId('home-feedback-inbox')).toBeNull();
    expect(screen.queryByTestId('home-admin-coins')).toBeNull();
  });

  it('shows feedback and coin gifting controls for admins only', () => {
    mockUseAuth.mockReturnValue({ isAnonymous: false, profile: { total_coins: 15 } });
    mockUseFeedbackAdmin.mockReturnValue({ isFeedbackAdmin: true });

    render(<PlayModeChoiceScreen {...baseProps} />);

    expect(screen.getByTestId('home-feedback-toggle')).toBeTruthy();
    expect(screen.getByTestId('home-feedback-inbox')).toBeTruthy();
    expect(screen.getByTestId('home-admin-coins')).toBeTruthy();
  });

  it('opens analytics when an admin presses the analytics button', () => {
    const onOpenAnalytics = jest.fn();
    mockUseAuth.mockReturnValue({ isAnonymous: false, profile: { total_coins: 15 } });
    mockUseFeedbackAdmin.mockReturnValue({ isFeedbackAdmin: true });

    render(<PlayModeChoiceScreen {...baseProps} onOpenAnalytics={onOpenAnalytics} />);

    fireEvent.press(screen.getByTestId('home-analytics'));
    expect(onOpenAnalytics).toHaveBeenCalledTimes(1);
  });

  it('keeps tutorial and shop available after swapping their menu positions', () => {
    mockUseAuth.mockReturnValue({ isAnonymous: true, profile: { total_coins: 15 } });

    render(<PlayModeChoiceScreen {...baseProps} />);

    expect(screen.getByTestId('lobby-tutorial')).toBeTruthy();
    expect(screen.getByTestId('lobby-shop')).toBeTruthy();
  });

  it('keeps shop and sign-in separated on tight mobile layouts', () => {
    mockUseResponsiveLayout.mockReturnValue({
      width: 375,
      height: 633,
      fontScale: 1,
      isTight: true,
      isCompact: true,
      isSingleColumn: true,
      isTablet: false,
    });
    mockUseAuth.mockReturnValue({ isAnonymous: true, profile: { total_coins: 15 } });

    render(<PlayModeChoiceScreen {...baseProps} />);

    const shopStyle = StyleSheet.flatten(screen.getByTestId('lobby-shop').props.style);
    const authSpacerStyle = StyleSheet.flatten(screen.getByTestId('home-auth-spacer').props.style);

    expect(screen.getByTestId('lobby-shop')).toBeTruthy();
    expect(screen.getByTestId('home-auth-button')).toBeTruthy();
    expect(shopStyle.marginBottom).toBeGreaterThanOrEqual(18);
    expect(authSpacerStyle.marginBottom).toBeGreaterThanOrEqual(14);
  });
});
