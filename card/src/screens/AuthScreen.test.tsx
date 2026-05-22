import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { AuthScreen } from './AuthScreen';
import { useAuth } from '../hooks/useAuth';

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const platformRef = Platform as typeof Platform & { OS: string };
const originalPlatform = platformRef.OS;

jest.mock('../hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../i18n/LocaleContext', () => ({
  useLocale: () => ({
    locale: 'en',
    t: (key: string) => {
      const copy: Record<string, string> = {
        'auth.homeButton': 'Sign in',
        'auth.chooserSubtitle': 'Choose how to sign in to your account',
        'auth.socialHelper': 'Google or Apple sign-in loads your existing account history. Current guest progress does not merge automatically.',
        'auth.continueWithGoogle': 'Continue with Google',
        'auth.continueWithApple': 'Continue with Apple',
        'auth.continueWithEmail': 'Sign in with email',
        'auth.backToOptions': 'Back to sign-in options',
        'auth.linkTitle': 'Save Your Progress',
        'auth.linkSubtitle': 'Add an email to keep your coins and rating across devices',
        'auth.linkBtn': 'Save Progress',
        'auth.signInTitle': 'Sign In',
        'auth.signInSubtitle': 'Sign in to restore your coins and rating',
        'auth.usernamePlaceholder': 'Username (2-15 characters)',
        'auth.emailPlaceholder': 'Email',
        'auth.passwordPlaceholder': 'Password',
        'auth.signInBtn': 'Sign In',
        'auth.noAccount': "Don't have an account? Save progress",
        'auth.haveAccount': 'Already have an account? Sign in',
        'auth.back': 'Back',
        'auth.usernameMinLength': 'Username must be at least 2 characters',
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

  beforeEach(() => {
    platformRef.OS = originalPlatform;
    onBack.mockReset();
    onSuccess.mockReset();
    signUp.mockReset();
    signIn.mockReset();
    signInWithProvider.mockReset();
    signInWithProvider.mockResolvedValue({ error: null });
    mockUseAuth.mockReturnValue({
      signUp,
      signIn,
      signInWithProvider,
      isAnonymous: true,
      user: { id: 'abc123' } as never,
      profile: null,
    } as ReturnType<typeof useAuth>);
  });

  afterAll(() => {
    platformRef.OS = originalPlatform;
  });

  it('shows the provider chooser first on native', () => {
    platformRef.OS = 'android';

    render(<AuthScreen onBack={onBack} onSuccess={onSuccess} />);

    expect(screen.getByTestId('auth-social-google-button')).toBeTruthy();
    expect(screen.getByTestId('auth-social-apple-button')).toBeTruthy();
    expect(screen.getByTestId('auth-email-fallback-button')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Email')).toBeNull();
  });

  it('keeps the email form on web', () => {
    platformRef.OS = 'web';

    render(<AuthScreen onBack={onBack} onSuccess={onSuccess} />);

    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.queryByTestId('auth-social-google-button')).toBeNull();
  });

  it('reveals the email form from the native chooser', () => {
    platformRef.OS = 'ios';

    render(<AuthScreen onBack={onBack} onSuccess={onSuccess} />);
    fireEvent.press(screen.getByTestId('auth-email-fallback-button'));

    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByTestId('auth-back-to-options-button')).toBeTruthy();
  });

  it('submits social sign-in through the selected provider', async () => {
    platformRef.OS = 'android';

    render(<AuthScreen onBack={onBack} onSuccess={onSuccess} />);
    fireEvent.press(screen.getByTestId('auth-social-google-button'));

    await waitFor(() => {
      expect(signInWithProvider).toHaveBeenCalledWith('google');
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
