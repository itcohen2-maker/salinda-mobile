import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { findAdminCoinGiftTarget, grantAdminCoins, type AdminCoinGiftTarget } from '../admin/grantCoins';
import { useAdminAccess } from '../admin/useAdminAccess';
import { useLocale } from '../i18n/LocaleContext';

type BannerTone = 'success' | 'error';

export function AdminCoinGiftsScreen({ onBack }: { onBack: () => void }) {
  const { locale, isRTL } = useLocale();
  const { isAdmin, loading } = useAdminAccess();
  const [username, setUsername] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [target, setTarget] = useState<AdminCoinGiftTarget | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [banner, setBanner] = useState<{ text: string; tone: BannerTone } | null>(null);

  const copy = useMemo(() => {
    if (locale === 'he') {
      return {
        amountHint: 'רק מספר שלם חיובי.',
        amountLabel: 'כמות מטבעות',
        amountPlaceholder: 'למשל 250',
        back: 'חזרה',
        currentBalance: 'יתרה נוכחית',
        findPlayer: 'בדוק משתמש',
        findPlayerError: 'לא הצלחנו לטעון את המשתמש כרגע.',
        giftCoins: 'שלח מתנה',
        giftHelper: 'מסך אדמין פנימי. בחר שם משתמש, כמות וסיבה, והמתנה תתווסף מיד.',
        giftSuccess: (coins: number, targetUsername: string) => `נוספו ${coins} מטבעות ל-${targetUsername}.`,
        invalidAmount: 'יש להזין כמות מטבעות תקינה.',
        noAccessBody: 'המסך זמין רק לאדמינים שהוגדרו במערכת.',
        noAccessTitle: 'אין גישה למסך הזה',
        notFound: 'לא מצאנו משתמש בשם הזה.',
        reasonLabel: 'סיבה / הערה',
        reasonPlaceholder: 'למשל מתנת תמיכה',
        submitError: 'לא הצלחנו להוסיף מטבעות כרגע.',
        submitForbidden: 'לחשבון הזה אין הרשאת אדמין.',
        targetLabel: 'משתמש יעד',
        title: 'מתנת מטבעות',
        updatedBalance: 'יתרה אחרי מתנה',
        usernameHelper: 'המערכת מחפשת התאמה מדויקת לשם המשתמש.',
        usernameLabel: 'שם משתמש',
        usernamePlaceholder: 'למשל player_ea9faa',
      };
    }

    return {
      amountHint: 'Use a positive whole number only.',
      amountLabel: 'Coin amount',
      amountPlaceholder: 'e.g. 250',
      back: 'Back',
      currentBalance: 'Current balance',
      findPlayer: 'Find player',
      findPlayerError: 'Could not load that player right now.',
      giftCoins: 'Send gift',
      giftHelper: 'Admin-only tool. Pick a username, amount, and note, and the coins are added immediately.',
      giftSuccess: (coins: number, targetUsername: string) => `Added ${coins} coins to ${targetUsername}.`,
      invalidAmount: 'Enter a valid coin amount.',
      noAccessBody: 'This screen is available only to allowlisted admins.',
      noAccessTitle: 'Access restricted',
      notFound: 'No player was found with that username.',
      reasonLabel: 'Reason / note',
      reasonPlaceholder: 'e.g. support gift',
      submitError: 'Could not add coins right now.',
      submitForbidden: 'This account is not allowed to gift coins.',
      targetLabel: 'Target player',
      title: 'Coin gifts',
      updatedBalance: 'Balance after gift',
      usernameHelper: 'The lookup uses an exact username match.',
      usernameLabel: 'Username',
      usernamePlaceholder: 'e.g. player_ea9faa',
    };
  }, [locale]);

  const textDirectionStyle: {
    textAlign: 'left' | 'right';
    writingDirection: 'ltr' | 'rtl';
  } = {
    textAlign: isRTL ? 'right' : 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  };

  const clearBanner = () => setBanner(null);

  const handleLookup = async () => {
    clearBanner();
    setTarget(null);

    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      setBanner({ text: copy.notFound, tone: 'error' });
      return;
    }

    setLookupBusy(true);
    const result = await findAdminCoinGiftTarget(normalizedUsername);
    setLookupBusy(false);

    if (result === 'error') {
      setBanner({ text: copy.findPlayerError, tone: 'error' });
      return;
    }
    if (!result) {
      setBanner({ text: copy.notFound, tone: 'error' });
      return;
    }

    setTarget(result);
  };

  const handleSubmit = async () => {
    clearBanner();
    const numericAmount = Math.floor(Number(amount) || 0);
    if (numericAmount <= 0) {
      setBanner({ text: copy.invalidAmount, tone: 'error' });
      return;
    }

    setSubmitBusy(true);
    const result = await grantAdminCoins({
      amount: numericAmount,
      reason,
      username,
    });
    setSubmitBusy(false);

    if (result.status === 'ok') {
      setTarget({
        ...result.target,
        totalCoins: result.nextBalance,
      });
      setAmount('');
      setReason('');
      setBanner({ text: copy.giftSuccess(numericAmount, result.target.username), tone: 'success' });
      return;
    }

    if (result.status === 'invalid_amount') {
      setBanner({ text: copy.invalidAmount, tone: 'error' });
      return;
    }
    if (result.status === 'forbidden') {
      setBanner({ text: copy.submitForbidden, tone: 'error' });
      return;
    }
    if (result.status === 'target_not_found') {
      setTarget(null);
      setBanner({ text: copy.notFound, tone: 'error' });
      return;
    }

    setBanner({ text: copy.submitError, tone: 'error' });
  };

  if (loading) {
    return (
      <View style={styles.loadingShell}>
        <ActivityIndicator size="large" color="#FACC15" />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.screen}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={onBack} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>{copy.back}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centerCard}>
          <Text style={styles.centerTitle}>{copy.noAccessTitle}</Text>
          <Text style={styles.centerBody}>{copy.noAccessBody}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>{copy.back}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{copy.title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formCard}>
          <Text style={styles.subtitle}>{copy.giftHelper}</Text>

          <Text style={[styles.fieldLabel, textDirectionStyle]}>{copy.usernameLabel}</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={copy.usernamePlaceholder}
            placeholderTextColor="rgba(191,219,254,0.48)"
            style={[styles.input, textDirectionStyle]}
            testID="admin-coins-username"
            value={username}
            onChangeText={(next) => {
              setUsername(next.trimStart());
              setTarget(null);
              clearBanner();
            }}
          />
          <Text style={[styles.helperText, textDirectionStyle]}>{copy.usernameHelper}</Text>

          <TouchableOpacity
            activeOpacity={0.88}
            disabled={lookupBusy}
            onPress={() => void handleLookup()}
            style={[styles.secondaryButton, lookupBusy ? styles.buttonDisabled : null]}
            testID="admin-coins-find-player"
          >
            <Text style={styles.secondaryButtonText}>{copy.findPlayer}</Text>
          </TouchableOpacity>

          {target ? (
            <View style={styles.targetCard}>
              <Text style={styles.targetTitle}>{copy.targetLabel}</Text>
              <Text style={styles.targetUsername}>{target.username}</Text>
              <Text style={styles.targetMeta}>{`${copy.currentBalance}: ${target.totalCoins}`}</Text>
            </View>
          ) : null}

          <Text style={[styles.fieldLabel, textDirectionStyle]}>{copy.amountLabel}</Text>
          <TextInput
            keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
            placeholder={copy.amountPlaceholder}
            placeholderTextColor="rgba(191,219,254,0.48)"
            style={[styles.input, textDirectionStyle]}
            testID="admin-coins-amount"
            value={amount}
            onChangeText={(next) => {
              setAmount(next.replace(/[^0-9]/g, ''));
              clearBanner();
            }}
          />
          <Text style={[styles.helperText, textDirectionStyle]}>{copy.amountHint}</Text>

          <Text style={[styles.fieldLabel, textDirectionStyle]}>{copy.reasonLabel}</Text>
          <TextInput
            multiline
            placeholder={copy.reasonPlaceholder}
            placeholderTextColor="rgba(191,219,254,0.48)"
            style={[styles.input, styles.reasonInput, textDirectionStyle]}
            testID="admin-coins-reason"
            value={reason}
            onChangeText={(next) => {
              setReason(next);
              clearBanner();
            }}
          />

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={submitBusy}
            onPress={() => void handleSubmit()}
            style={[styles.primaryButton, submitBusy ? styles.buttonDisabled : null]}
            testID="admin-coins-submit"
          >
            <Text style={styles.primaryButtonText}>{copy.giftCoins}</Text>
          </TouchableOpacity>

          {banner ? (
            <Text
              style={[
                styles.bannerText,
                banner.tone === 'success' ? styles.bannerSuccess : styles.bannerError,
                textDirectionStyle,
              ]}
              testID="admin-coins-banner"
            >
              {banner.text}
            </Text>
          ) : null}

          {target && banner?.tone === 'success' ? (
            <Text style={[styles.helperText, textDirectionStyle]}>
              {`${copy.updatedBalance}: ${target.totalCoins}`}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0A1628',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerButton: {
    minWidth: 92,
    minHeight: 40,
    borderRadius: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37,99,235,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.34)',
  },
  headerButtonText: {
    color: '#BFDBFE',
    fontSize: 13,
    fontWeight: '800',
  },
  headerSpacer: {
    minWidth: 92,
  },
  headerTitle: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
    marginTop: 16,
  },
  scrollContent: {
    paddingBottom: 18,
  },
  loadingShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: 'rgba(9,23,43,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.24)',
  },
  subtitle: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  fieldLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 16,
  },
  helperText: {
    color: '#93C5FD',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  input: {
    minHeight: 46,
    borderRadius: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.24)',
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  reasonInput: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  secondaryButton: {
    minHeight: 42,
    marginTop: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,64,175,0.26)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.34)',
  },
  secondaryButtonText: {
    color: '#BFDBFE',
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    minHeight: 48,
    marginTop: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
  },
  primaryButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  bannerText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 14,
  },
  bannerSuccess: {
    color: '#4ADE80',
  },
  bannerError: {
    color: '#FCA5A5',
  },
  targetCard: {
    marginTop: 14,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.24)',
  },
  targetTitle: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  targetUsername: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 6,
  },
  targetMeta: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  centerCard: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 20,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  centerBody: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
});
