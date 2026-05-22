import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../i18n/LocaleContext';

interface Props {
  onSuccess: () => void;
  onBack: () => void;
}

type EmailAuthMode = 'link' | 'signin';

export function AuthScreen({ onSuccess, onBack }: Props) {
  const { t } = useLocale();
  const {
    signUp,
    signIn,
    signInWithProvider,
    signOutToGuest,
    isAnonymous,
    user,
    profile,
  } = useAuth();
  const isNativeChooser = Platform.OS !== 'web';
  const isSignedInUser = !!user && !isAnonymous;
  const shortUserId = user?.id ? user.id.slice(0, 3).toUpperCase() : '---';
  const [mode, setMode] = useState<EmailAuthMode>(isAnonymous ? 'link' : 'signin');
  const [showEmailForm, setShowEmailForm] = useState(!isNativeChooser && isAnonymous);
  const [forceAccountPicker, setForceAccountPicker] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooserCopy = useMemo(() => ({
    title: t('auth.homeButton'),
    subtitle: t('auth.chooserSubtitle'),
    helper: t('auth.socialHelper'),
    google: t('auth.continueWithGoogle'),
    email: t('auth.continueWithEmail'),
    backToOptions: t('auth.backToOptions'),
  }), [t]);

  const currentGuestLabel = t('auth.currentGuest', { id: shortUserId });
  const currentAccountName = profile?.username?.trim() || user?.email || shortUserId;
  const showAccountMenu = isSignedInUser;
  const showChooser = isAnonymous && isNativeChooser && !showEmailForm;

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'link') {
        if (!username.trim() || username.trim().length < 2) {
          setError(t('auth.usernameMinLength'));
          return;
        }

        const result = await signUp(email.trim(), password, username.trim());
        if (result.error) {
          setError(result.error);
        } else {
          onSuccess();
        }
        return;
      }

      const result = await signIn(email.trim(), password);
      if (result.error) {
        setError(result.error);
      } else {
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithProvider(
        'google',
        forceAccountPicker ? { forceAccountPicker: true } : undefined,
      );
      if (result.error) {
        setError(result.error);
      } else {
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchUser = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await signOutToGuest();
      if (result.error) {
        setError(result.error);
        return;
      }

      setMode('signin');
      setForceAccountPicker(true);
      setShowEmailForm(!isNativeChooser);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await signOutToGuest();
      if (result.error) {
        setError(result.error);
        return;
      }

      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {showAccountMenu ? (
          <>
            <Text style={styles.title}>{t('auth.accountMenuTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.accountMenuSubtitle')}</Text>

            <View style={styles.accountCard}>
              <Text style={styles.accountCardLabel}>{t('auth.currentAccountLabel')}</Text>
              <Text style={styles.accountCardName}>{currentAccountName}</Text>
              {user?.email ? (
                <Text style={styles.accountCardMeta}>{user.email}</Text>
              ) : null}
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.socialBtn, loading && styles.btnDisabled]}
              onPress={() => void handleSwitchUser()}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('auth.switchUserButton')}
              testID="auth-switch-user-button"
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.socialBtnText}>{t('auth.switchUserButton')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.emailFallbackBtn, loading && styles.btnDisabled]}
              onPress={() => void handleLogout()}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('auth.signOutButton')}
              testID="auth-sign-out-button"
            >
              <Text style={styles.emailFallbackText}>{t('auth.signOutButton')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('auth.back')}>
              <Text style={styles.backText}>{t('auth.back')}</Text>
            </TouchableOpacity>
          </>
        ) : showChooser ? (
          <>
            <Text style={styles.title}>{chooserCopy.title}</Text>
            <Text style={styles.subtitle}>{chooserCopy.subtitle}</Text>
            <Text style={styles.accountMeta}>
              {currentGuestLabel}
              {profile?.username ? ` - ${profile.username}` : ''}
            </Text>
            <Text style={styles.helperText}>{chooserCopy.helper}</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.socialBtn, loading && styles.btnDisabled]}
              onPress={() => void handleSocialSignIn()}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={chooserCopy.google}
              testID="auth-social-google-button"
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.socialBtnText}>{chooserCopy.google}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.emailFallbackBtn, loading && styles.btnDisabled]}
              onPress={() => {
                setError(null);
                setShowEmailForm(true);
              }}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={chooserCopy.email}
              testID="auth-email-fallback-button"
            >
              <Text style={styles.emailFallbackText}>{chooserCopy.email}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('auth.back')}>
              <Text style={styles.backText}>{t('auth.back')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>
              {mode === 'link' ? t('auth.linkTitle') : t('auth.signInTitle')}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'link' ? t('auth.linkSubtitle') : t('auth.signInSubtitle')}
            </Text>
            <Text style={styles.accountMeta}>
              {currentGuestLabel}
              {profile?.username ? ` - ${profile.username}` : ''}
            </Text>

            {mode === 'link' ? (
              <TextInput
                style={styles.input}
                placeholder={t('auth.usernamePlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                maxLength={15}
                accessibilityLabel="Username"
              />
            ) : null}

            <TextInput
              style={styles.input}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              accessibilityLabel="Email address"
            />

            <TextInput
              style={styles.input}
              placeholder={t('auth.passwordPlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              accessibilityLabel="Password"
            />

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={() => void handleSubmit()}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={mode === 'link' ? t('auth.linkBtn') : t('auth.signInBtn')}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.btnText}>
                  {mode === 'link' ? t('auth.linkBtn') : t('auth.signInBtn')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setMode(mode === 'link' ? 'signin' : 'link');
                setError(null);
              }}
              style={styles.toggle}
              accessibilityRole="button"
              accessibilityLabel={mode === 'link' ? t('auth.haveAccount') : t('auth.noAccount')}
            >
              <Text style={styles.toggleText}>
                {mode === 'link' ? t('auth.haveAccount') : t('auth.noAccount')}
              </Text>
            </TouchableOpacity>

            {isNativeChooser ? (
              <TouchableOpacity
                onPress={() => {
                  setError(null);
                  setShowEmailForm(false);
                }}
                style={styles.toggle}
                accessibilityRole="button"
                accessibilityLabel={chooserCopy.backToOptions}
                testID="auth-back-to-options-button"
              >
                <Text style={styles.toggleText}>{chooserCopy.backToOptions}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('auth.back')}>
              <Text style={styles.backText}>{t('auth.back')}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  title: {
    color: '#FCD34D',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
  helperText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  accountMeta: {
    color: 'rgba(147,197,253,0.9)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 18,
  },
  accountCard: {
    backgroundColor: 'rgba(17,24,39,0.82)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.24)',
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 18,
  },
  accountCardLabel: {
    color: 'rgba(209,213,219,0.78)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 6,
  },
  accountCardName: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  accountCardMeta: {
    color: '#93C5FD',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    color: '#FFF',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  btn: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  socialBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  socialBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
  },
  emailFallbackBtn: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.45)',
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  emailFallbackText: {
    color: '#93C5FD',
    fontSize: 16,
    fontWeight: '700',
  },
  btnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  errorBox: {
    backgroundColor: 'rgba(220,38,38,0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.5)',
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    textAlign: 'center',
  },
  toggle: {
    marginTop: 18,
    alignItems: 'center',
  },
  toggleText: {
    color: '#93C5FD',
    fontSize: 14,
    fontWeight: '600',
  },
  backBtn: {
    marginTop: 24,
    alignItems: 'center',
  },
  backText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
});
