import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useAuth } from '../hooks/useAuth';
import { AuthScreen } from './AuthScreen';

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const platformRef = Platform as typeof Platform & { OS: string };
const originalPlatform = platformRef.OS;

jest.mock('../hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../i18n/LocaleContext', () => ({
  useLocale: () => ({
    locale: 'en',
    t: (key: string, params?: Record<string, string>) => {
      const copy: Record<string, string> = {
        'auth.homeButton': 'Sign in',
        'auth.switchUserButton': 'Switch user',
        'auth.chooserSubtitle': 'Choose how to sign in to your account',
        'auth.socialHelper': 'Google sign-in loads your existing account history. Current guest progress does not merge automatically.',
        'auth.continueWithGoogle': 'Continue with Google',
        'auth.continueWithEmail': 'Sign in with email',
        'auth.backToOptions': 'Back to sign-in options',
        'auth.linkTitle': 'Save Your Progress',
        'auth.linkSubtitle': 'Add an email to keep your coins and rating across devices',
        'auth.linkBtn': 'Save Progress',
        'auth.signInTitle': 'Sign In',
        'auth.signInSubtitle': 'Sign in to restore your coins and rating',
        'auth.onlineRequiredTitle': 'Sign in to play online',
        'auth.onlineRequiredSubtitle': 'Online games are available only to registered Google or email accounts.',
        'auth.onlineRequiredError': 'Sign in with Google or email to play online.',
        'auth.usernamePlaceholder': 'Username (2-15 characters)',
        'auth.emailPlaceholder': 'Email',
        'auth.passwordPlaceholder': 'Password',
        'auth.signInBtn': 'Sign In',
        'auth.noAccount': "Don't have an account? Save progress",
        'auth.haveAccount': 'Already have an account? Sign in',
        'auth.back': 'Back',
        'auth.usernameMinLength': 'Username must be at least 2 characters',
        'auth.accountMenuTitle': 'Account',
        'auth.accountMenuSubtitle': 'Manage the user currently connected to this device.',
        'auth.currentAccountLabel': 'Current account',
        'auth.signOutButton': 'Sign out',
      };
      return copy[key] ?? key;
    },
  }),
}));

describe('AuthScreen', () => {
  const onBack = jest.fn();
  const onSuccess = jest.fn();
  const signUp = jest.fn();
  const signIn = jest.fn();
  const signInWithProvider = jest.fn();
  const signOutToGuest = jest.fn();

  let authState: ReturnType<typeof useAuth>;

  beforeEach(() => {
    platformRef.OS = originalPlatform;
    onBack.mockReset();
    onSuccess.mockReset();
    signUp.mockReset();
    signIn.mockReset();
    signInWithProvider.mockReset();
    signOutToGuest.mockReset();
    signInWithProvider.mockResolvedValue({ error: null });
    signOutToGuest.mockResolvedValue({ error: null });

    authState = {
      signUp,
      signIn,
      signInWithProvider,
      signOutToGuest,
      signOut: jest.fn(),
      refreshProfile: jest.fn(),
      purchaseSlinda: jest.fn(),
      consumeSlinda: jest.fn(),
      purchaseWild: jest.fn(),
      consumeWild: jest.fn(),
      purchaseTheme: jest.fn(),
      purchaseTableSkin: jest.fn(),
      setActiveSkin: jest.fn(),
      awardCoins: jest.fn(),
      session: { user: { id: 'abc123', is_anonymous: true } } as never,
      isAnonymous: true,
      isAuthenticated: true,
      loading: false,
      user: { id: 'abc123', is_anonymous: true } as never,
      profile: null,
    } as ReturnType<typeof useAuth>;

    mockUseAuth.mockImplementation(() => authState);
  });

  afterAll(() => {
    platformRef.OS = originalPlatform;
  });

  it('shows the provider chooser first on native without Apple', () => {
    platformRef.OS = 'android';
    authState = {
      ...authState,
      profile: { username: 'player_e829d4' } as never,
    };

    render(<AuthScreen onBack={onBack} onSuccess={onSuccess} />);

    expect(screen.getByTestId('auth-social-google-button')).toBeTruthy();
    expect(screen.getByTestId('auth-email-fallback-button')).toBeTruthy();
    expect(screen.queryByTestId('auth-social-apple-button')).toBeNull();
    expect(screen.queryByPlaceholderText('Email')).toBeNull();
    expect(screen.queryByText(/Current guest ID/i)).toBeNull();
    expect(screen.queryByText(/abc/i)).toBeNull();
    expect(screen.queryByText(/player_e829d4/i)).toBeNull();
  });

  it('shows the provider chooser first on web too', () => {
    platformRef.OS = 'web';

    render(<AuthScreen onBack={onBack} onSuccess={onSuccess} />);

    expect(screen.getByTestId('auth-social-google-button')).toBeTruthy();
    expect(screen.getByTestId('auth-email-fallback-button')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Email')).toBeNull();
  });

  it('shows online-required copy when opened from the online gate', () => {
    render(<AuthScreen intent="online-required" onBack={onBack} onSuccess={onSuccess} />);

    expect(screen.getByText('Sign in to play online')).toBeTruthy();
    expect(screen.getByText('Online games are available only to registered Google or email accounts.')).toBeTruthy();
    expect(screen.getByTestId('auth-social-google-button')).toBeTruthy();
  });

  it('reveals the email form from the native chooser', () => {
    platformRef.OS = 'ios';

    render(<AuthScreen onBack={onBack} onSuccess={onSuccess} />);
    fireEvent.press(screen.getByTestId('auth-email-fallback-button'));

    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByTestId('auth-back-to-options-button')).toBeTruthy();
  });

  it('submits Google sign-in through the chooser', async () => {
    platformRef.OS = 'android';

    render(<AuthScreen onBack={onBack} onSuccess={onSuccess} />);
    fireEvent.press(screen.getByTestId('auth-social-google-button'));

    await waitFor(() => {
      expect(signInWithProvider).toHaveBeenCalledWith('google', undefined);
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('shows the account menu first for signed-in users', () => {
    authState = {
      ...authState,
      isAnonymous: false,
      user: { id: 'user-123', email: 'lea@example.com', is_anonymous: false } as never,
      profile: { username: 'Lea' } as never,
    };

    render(<AuthScreen onBack={onBack} onSuccess={onSuccess} />);

    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Lea')).toBeTruthy();
    expect(screen.getByText('lea@example.com')).toBeTruthy();
    expect(screen.getByTestId('auth-switch-user-button')).toBeTruthy();
    expect(screen.getByTestId('auth-sign-out-button')).toBeTruthy();
  });

  it('switches a signed-in user into the chooser with a forced Google account picker', async () => {
    platformRef.OS = 'android';
    signOutToGuest.mockImplementation(async () => {
      authState = {
        ...authState,
        isAnonymous: true,
        user: { id: 'guest-1', is_anonymous: true } as never,
        profile: null,
      };
      return { error: null };
    });
    authState = {
      ...authState,
      isAnonymous: false,
      user: { id: 'user-123', email: 'lea@example.com', is_anonymous: false } as never,
      profile: { username: 'Lea' } as never,
    };

    render(<AuthScreen onBack={onBack} onSuccess={onSuccess} />);
    fireEvent.press(screen.getByTestId('auth-switch-user-button'));

    await waitFor(() => {
      expect(signOutToGuest).toHaveBeenCalled();
      expect(screen.getByTestId('auth-social-google-button')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('auth-social-google-button'));

    await waitFor(() => {
      expect(signInWithProvider).toHaveBeenCalledWith('google', { forceAccountPicker: true });
    });
  });

  it('signs out to guest and returns to the lobby', async () => {
    authState = {
      ...authState,
      isAnonymous: false,
      user: { id: 'user-123', email: 'lea@example.com', is_anonymous: false } as never,
      profile: { username: 'Lea' } as never,
    };

    render(<AuthScreen onBack={onBack} onSuccess={onSuccess} />);
    fireEvent.press(screen.getByTestId('auth-sign-out-button'));

    await waitFor(() => {
      expect(signOutToGuest).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
