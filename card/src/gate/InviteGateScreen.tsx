import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../i18n/LocaleContext';

interface InviteGateScreenProps {
  /** Raw reason from useInviteGate (decides sign-in prompt vs rejection copy). */
  reason?: string | null;
}

/**
 * Opaque black gate shown before anything else when the caller is not on the
 * invite allowlist. Nothing about the game is rendered. A non-invited account
 * that signs in sees only an "under construction" notice.
 */
export function InviteGateScreen({ reason }: InviteGateScreenProps) {
  const { locale } = useLocale();
  const { user, signInWithProvider, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = useMemo(() => {
    if (locale === 'he') {
      return {
        title: 'סלינדה',
        signInPrompt: 'התחברות נדרשת כדי להמשיך.',
        signInGoogle: 'התחבר עם Google',
        underConstruction: 'האתר בבנייה.',
        underConstructionBody: 'הגישה כרגע מוגבלת. נשמח לראותך בקרוב.',
        tryAnother: 'התחבר עם חשבון אחר',
        genericError: 'משהו השתבש. נסה שוב.',
      };
    }
    return {
      title: 'Salinda',
      signInPrompt: 'Sign in to continue.',
      signInGoogle: 'Sign in with Google',
      underConstruction: 'Site under construction.',
      underConstructionBody: 'Access is currently limited. Check back soon.',
      tryAnother: 'Use a different account',
      genericError: 'Something went wrong. Please try again.',
    };
  }, [locale]);

  // A registered (non-anonymous) account that reaches this screen has been
  // denied by the allowlist → show the "under construction" notice. Anyone
  // else (anonymous / signed-out) gets the sign-in prompt.
  const isRejectedAccount =
    !!user && !user.is_anonymous && reason !== 'anonymous' && reason !== 'admin';

  const handleSignIn = async () => {
    setError(null);
    setBusy(true);
    const result = await signInWithProvider('google', { forceAccountPicker: true });
    setBusy(false);
    if (result.error) setError(result.error);
  };

  const handleTryAnother = async () => {
    setError(null);
    setBusy(true);
    await signOut();
    const result = await signInWithProvider('google', { forceAccountPicker: true });
    setBusy(false);
    if (result.error) setError(result.error);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>{copy.title}</Text>

        {isRejectedAccount ? (
          <>
            <Text style={styles.heading}>{copy.underConstruction}</Text>
            <Text style={styles.body}>{copy.underConstructionBody}</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={busy}
              onPress={() => void handleTryAnother()}
              style={[styles.secondaryButton, busy ? styles.disabled : null]}
            >
              {busy ? (
                <ActivityIndicator color="#E5E7EB" />
              ) : (
                <Text style={styles.secondaryButtonText}>{copy.tryAnother}</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.body}>{copy.signInPrompt}</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={busy}
              onPress={() => void handleSignIn()}
              style={[styles.primaryButton, busy ? styles.disabled : null]}
              testID="invite-gate-google"
            >
              {busy ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Text style={styles.primaryButtonText}>{copy.signInGoogle}</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 28,
  },
  heading: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
  },
  primaryButton: {
    minHeight: 50,
    width: '100%',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
  },
  primaryButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    width: '100%',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  secondaryButtonText: {
    color: '#E5E7EB',
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 16,
  },
});
