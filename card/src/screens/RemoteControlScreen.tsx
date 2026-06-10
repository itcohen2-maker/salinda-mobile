import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

import { useAdminAccess } from '../admin/useAdminAccess';
import { useLocale } from '../i18n/LocaleContext';
import { supabase } from '../lib/supabase';

type BannerTone = 'success' | 'error';

interface InviteRow {
  email: string;
  status: 'invited' | 'blocked';
  first_login_at: string | null;
  last_seen_at: string | null;
}

interface RemoteControlScreenProps {
  onBack: () => void;
}

const DEFAULT_INTERVAL = 30;

export function RemoteControlScreen({ onBack }: RemoteControlScreenProps) {
  const { locale, isRTL } = useLocale();
  const { isAdmin, loading } = useAdminAccess();

  const [email, setEmail] = useState('');
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [interval, setIntervalValue] = useState(String(DEFAULT_INTERVAL));
  const [intervalBusy, setIntervalBusy] = useState(false);
  const [banner, setBanner] = useState<{ text: string; tone: BannerTone } | null>(null);

  const copy = useMemo(() => {
    if (locale === 'he') {
      return {
        back: 'חזרה',
        title: 'שלט רחוק',
        helper: 'רק מי שמופיע כאן כ"מוזמן" יכול להיכנס. כל השאר רואים מסך שחור.',
        emailLabel: 'מייל להזמנה',
        emailPlaceholder: 'name@gmail.com',
        invite: 'הזמן',
        listTitle: 'רשימת מוזמנים',
        empty: 'אין מוזמנים עדיין.',
        statusInvited: 'מוזמן',
        statusBlocked: 'חסום',
        disconnect: 'נתק',
        restore: 'החזר',
        neverSeen: 'לא נכנס עדיין',
        lastSeen: 'נראה לאחרונה',
        intervalTitle: 'תדירות בדיקת ניתוק',
        intervalHelper: 'כל כמה שניות הדפדפן בודק אם המשתמש עדיין מורשה (מינימום 5).',
        intervalSave: 'שמור',
        invalidEmail: 'יש להזין כתובת מייל תקינה.',
        invalidInterval: 'יש להזין מספר שניות תקין (5 ומעלה).',
        invited: (e: string) => `${e} הוזמן.`,
        blocked: (e: string) => `${e} נותק.`,
        restored: (e: string) => `${e} הוחזר.`,
        intervalSaved: 'תדירות הבדיקה נשמרה.',
        forbidden: 'לחשבון הזה אין הרשאת אדמין.',
        loadError: 'לא הצלחנו לטעון את הרשימה.',
        actionError: 'הפעולה נכשלה. נסה שוב.',
        noAccessTitle: 'אין גישה למסך הזה',
        noAccessBody: 'המסך זמין רק לאדמינים שהוגדרו במערכת.',
      };
    }
    return {
      back: 'Back',
      title: 'Remote Control',
      helper: 'Only people listed here as "invited" can enter. Everyone else sees a black screen.',
      emailLabel: 'Email to invite',
      emailPlaceholder: 'name@gmail.com',
      invite: 'Invite',
      listTitle: 'Invite list',
      empty: 'No invitees yet.',
      statusInvited: 'Invited',
      statusBlocked: 'Blocked',
      disconnect: 'Disconnect',
      restore: 'Restore',
      neverSeen: 'Never signed in',
      lastSeen: 'Last seen',
      intervalTitle: 'Disconnect check interval',
      intervalHelper: 'How often (seconds) the browser re-checks access (minimum 5).',
      intervalSave: 'Save',
      invalidEmail: 'Enter a valid email address.',
      invalidInterval: 'Enter a valid number of seconds (5 or more).',
      invited: (e: string) => `${e} invited.`,
      blocked: (e: string) => `${e} disconnected.`,
      restored: (e: string) => `${e} restored.`,
      intervalSaved: 'Check interval saved.',
      forbidden: 'This account is not allowed to manage access.',
      loadError: 'Could not load the list.',
      actionError: 'Action failed. Please try again.',
      noAccessTitle: 'Access restricted',
      noAccessBody: 'This screen is available only to allowlisted admins.',
    };
  }, [locale]);

  const textDirectionStyle = {
    textAlign: (isRTL ? 'right' : 'left') as 'left' | 'right',
    writingDirection: (isRTL ? 'rtl' : 'ltr') as 'ltr' | 'rtl',
  };

  const loadList = useCallback(async () => {
    setListBusy(true);
    try {
      const { data, error } = await supabase
        .from('invited_users')
        .select('email, status, first_login_at, last_seen_at')
        .order('invited_at', { ascending: false });
      if (error) {
        setBanner({ text: copy.loadError, tone: 'error' });
        return;
      }
      setRows((data ?? []) as InviteRow[]);
    } catch {
      setBanner({ text: copy.loadError, tone: 'error' });
    } finally {
      setListBusy(false);
    }
  }, [copy.loadError]);

  const loadInterval = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'gate_recheck')
        .maybeSingle();
      const raw = Number((data?.value as { intervalSeconds?: unknown } | undefined)?.intervalSeconds);
      if (Number.isFinite(raw) && raw > 0) setIntervalValue(String(raw));
    } catch {
      // keep default
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void loadList();
    void loadInterval();
  }, [isAdmin, loadList, loadInterval]);

  const setInvite = useCallback(
    async (targetEmail: string, status: 'invited' | 'blocked', successText: string) => {
      setBanner(null);
      const { data, error } = await supabase.rpc('admin_set_invite', {
        p_email: targetEmail,
        p_status: status,
      });
      if (error) {
        setBanner({ text: copy.actionError, tone: 'error' });
        return false;
      }
      if (data === 'forbidden') {
        setBanner({ text: copy.forbidden, tone: 'error' });
        return false;
      }
      if (data === 'invalid_email') {
        setBanner({ text: copy.invalidEmail, tone: 'error' });
        return false;
      }
      if (data !== 'ok') {
        setBanner({ text: copy.actionError, tone: 'error' });
        return false;
      }
      setBanner({ text: successText, tone: 'success' });
      await loadList();
      return true;
    },
    [copy.actionError, copy.forbidden, copy.invalidEmail, loadList],
  );

  const handleInvite = useCallback(async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      setBanner({ text: copy.invalidEmail, tone: 'error' });
      return;
    }
    setSubmitBusy(true);
    const ok = await setInvite(normalized, 'invited', copy.invited(normalized));
    setSubmitBusy(false);
    if (ok) setEmail('');
  }, [email, copy, setInvite]);

  const handleSaveInterval = useCallback(async () => {
    const seconds = Math.floor(Number(interval) || 0);
    if (seconds < 5) {
      setBanner({ text: copy.invalidInterval, tone: 'error' });
      return;
    }
    setIntervalBusy(true);
    const { data, error } = await supabase.rpc('admin_set_config', {
      p_key: 'gate_recheck',
      p_value: { intervalSeconds: seconds, graceSeconds: 0 },
    });
    setIntervalBusy(false);
    if (error || data === 'forbidden' || data !== 'ok') {
      setBanner({ text: data === 'forbidden' ? copy.forbidden : copy.actionError, tone: 'error' });
      return;
    }
    setBanner({ text: copy.intervalSaved, tone: 'success' });
  }, [interval, copy]);

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
          <Text style={styles.subtitle}>{copy.helper}</Text>

          <Text style={[styles.fieldLabel, textDirectionStyle]}>{copy.emailLabel}</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={Platform.OS === 'ios' ? 'email-address' : 'default'}
            placeholder={copy.emailPlaceholder}
            placeholderTextColor="rgba(191,219,254,0.48)"
            style={[styles.input, textDirectionStyle]}
            testID="remote-invite-email"
            value={email}
            onChangeText={(next) => {
              setEmail(next.trimStart());
              setBanner(null);
            }}
          />
          <TouchableOpacity
            activeOpacity={0.9}
            disabled={submitBusy}
            onPress={() => void handleInvite()}
            style={[styles.primaryButton, submitBusy ? styles.buttonDisabled : null]}
            testID="remote-invite-submit"
          >
            <Text style={styles.primaryButtonText}>{copy.invite}</Text>
          </TouchableOpacity>

          {banner ? (
            <Text
              style={[
                styles.bannerText,
                banner.tone === 'success' ? styles.bannerSuccess : styles.bannerError,
                textDirectionStyle,
              ]}
              testID="remote-banner"
            >
              {banner.text}
            </Text>
          ) : null}
        </View>

        <View style={styles.formCard}>
          <Text style={[styles.fieldLabel, { marginTop: 0 }, textDirectionStyle]}>{copy.intervalTitle}</Text>
          <View style={styles.intervalRow}>
            <TextInput
              keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
              style={[styles.input, styles.intervalInput, textDirectionStyle]}
              testID="remote-interval"
              value={interval}
              onChangeText={(next) => setIntervalValue(next.replace(/[^0-9]/g, ''))}
            />
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={intervalBusy}
              onPress={() => void handleSaveInterval()}
              style={[styles.secondaryButton, styles.intervalButton, intervalBusy ? styles.buttonDisabled : null]}
              testID="remote-interval-save"
            >
              <Text style={styles.secondaryButtonText}>{copy.intervalSave}</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.helperText, textDirectionStyle]}>{copy.intervalHelper}</Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.listHeaderRow}>
            <Text style={[styles.fieldLabel, { marginTop: 0 }, textDirectionStyle]}>{copy.listTitle}</Text>
            {listBusy ? <ActivityIndicator color="#93C5FD" /> : null}
          </View>

          {rows.length === 0 && !listBusy ? (
            <Text style={[styles.helperText, textDirectionStyle]}>{copy.empty}</Text>
          ) : null}

          {rows.map((row) => (
            <View key={row.email} style={styles.inviteRow}>
              <View style={styles.inviteInfo}>
                <Text style={[styles.inviteEmail, textDirectionStyle]} numberOfLines={1}>
                  {row.email}
                </Text>
                <Text style={[styles.inviteMeta, textDirectionStyle]}>
                  {`${row.status === 'invited' ? copy.statusInvited : copy.statusBlocked} · ${
                    row.last_seen_at ? `${copy.lastSeen}: ${formatWhen(row.last_seen_at)}` : copy.neverSeen
                  }`}
                </Text>
              </View>
              {row.status === 'invited' ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => void setInvite(row.email, 'blocked', copy.blocked(row.email))}
                  style={[styles.rowButton, styles.rowButtonDanger]}
                  testID={`remote-disconnect-${row.email}`}
                >
                  <Text style={styles.rowButtonDangerText}>{copy.disconnect}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => void setInvite(row.email, 'invited', copy.restored(row.email))}
                  style={[styles.rowButton, styles.rowButtonRestore]}
                  testID={`remote-restore-${row.email}`}
                >
                  <Text style={styles.rowButtonRestoreText}>{copy.restore}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes(),
    ).padStart(2, '0')}`;
  } catch {
    return iso;
  }
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
    marginBottom: 14,
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
    marginTop: 8,
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
  primaryButton: {
    minHeight: 48,
    marginTop: 14,
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
  secondaryButton: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(30,64,175,0.26)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.34)',
  },
  secondaryButtonText: {
    color: '#BFDBFE',
    fontSize: 14,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  intervalInput: {
    flex: 1,
  },
  intervalButton: {
    marginTop: 8,
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
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.14)',
  },
  inviteInfo: {
    flex: 1,
  },
  inviteEmail: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  inviteMeta: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  rowButton: {
    minHeight: 38,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowButtonDanger: {
    backgroundColor: 'rgba(220,38,38,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.4)',
  },
  rowButtonDangerText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '800',
  },
  rowButtonRestore: {
    backgroundColor: 'rgba(22,163,74,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.4)',
  },
  rowButtonRestoreText: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '800',
  },
  centerCard: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 20,
    marginTop: 16,
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
