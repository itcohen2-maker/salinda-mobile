import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAdminAccess } from '../admin/useAdminAccess';
import { useLocale } from '../i18n/LocaleContext';
import { supabase } from '../lib/supabase';

type Platform = 'android' | 'ios' | 'web';
type UserTypeFilter = 'all' | 'anonymous' | 'registered';
type PlatformFilter = 'all' | Platform;

interface AppSession {
  id: string;
  user_id: string | null;
  is_anonymous: boolean;
  platform: string;
  locale: string;
  app_version: string | null;
  session_start: string;
  session_end: string | null;
  last_seen_at: string;
  event_count: number;
}

interface AdminAnalytics {
  online_now: number;
  online_by_platform: Record<string, number>;
  entries_last_hour: number;
  entries_today: number;
  entries_7d: number;
  entries_30d: number;
  total: number;
  anonymous: number;
  registered: number;
  avg_duration_seconds: number | null;
  by_platform: Record<string, number>;
  by_activity: Record<string, number>;
}

interface InviteAnalyticsRow {
  email: string;
  status: 'invited' | 'blocked';
  first_login_at: string | null;
  last_seen_at: string | null;
  online: boolean;
}

interface InviteAnalytics {
  total_invited: number;
  total_blocked: number;
  online_now: number;
  invites: InviteAnalyticsRow[];
}

interface AnalyticsScreenProps {
  onBack: () => void;
}

type SessionsQuery = {
  eq: (column: string, value: string | boolean) => SessionsQuery;
  order: (
    column: string,
    options: { ascending: boolean },
  ) => { limit: (count: number) => Promise<{ data: AppSession[] | null; error: unknown }> };
};

function formatDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return '—';
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return '—';
  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-US');
}

function platformBadgeStyle(platform: string) {
  if (platform === 'android') return styles.badgeAndroid;
  if (platform === 'ios') return styles.badgeIos;
  return styles.badgeWeb;
}

function formatAvgDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m === 0 ? `${rem}s` : `${m}m ${rem}s`;
}

export function AnalyticsScreen({ onBack }: AnalyticsScreenProps) {
  const { t, isRTL } = useLocale();
  const { isAdmin, loading: adminLoading } = useAdminAccess();

  const [sessions, setSessions] = useState<AppSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [userTypeFilter, setUserTypeFilter] = useState<UserTypeFilter>('all');

  const [stats, setStats] = useState<AdminAnalytics | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [invite, setInvite] = useState<InviteAnalytics | null>(null);

  const liveOpacity = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(liveOpacity, { toValue: 0.3, duration: 750, useNativeDriver: true }),
        Animated.timing(liveOpacity, { toValue: 1, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [liveOpacity]);

  const loadSessions = useCallback(async () => {
    if (!isAdmin) {
      setSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setHasError(false);

    try {
      let query = supabase
        .from('app_sessions')
        .select(
          'id, user_id, is_anonymous, platform, locale, app_version, session_start, session_end, last_seen_at, event_count',
        ) as unknown as SessionsQuery;

      if (platformFilter !== 'all') {
        query = query.eq('platform', platformFilter);
      }

      if (userTypeFilter === 'anonymous') {
        query = query.eq('is_anonymous', true);
      } else if (userTypeFilter === 'registered') {
        query = query.eq('is_anonymous', false);
      }

      const { data, error: queryError } = await query
        .order('session_start', { ascending: false })
        .limit(200);

      if (queryError) {
        setSessions([]);
        setHasError(true);
        return;
      }

      setSessions(Array.isArray(data) ? (data as AppSession[]) : []);
    } catch {
      setSessions([]);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, platformFilter, userTypeFilter]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const loadStats = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data, error } = await supabase.rpc('get_admin_analytics');
      if (error || !data) { setStatsError(true); return; }
      setStats(data as AdminAnalytics);
      setStatsError(false);
      setLastUpdated(new Date());

      const { data: inviteData, error: inviteError } = await supabase.rpc('get_invite_analytics');
      if (!inviteError && inviteData) setInvite(inviteData as InviteAnalytics);
    } catch {
      setStatsError(true);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadStats();
    const interval = setInterval(() => { void loadStats(); }, 10_000);
    return () => clearInterval(interval);
  }, [isAdmin, loadStats]);

  if (adminLoading) {
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
          <TouchableOpacity
            onPress={onBack}
            style={styles.headerButton}
            testID="analytics-back-button"
          >
            <Text style={styles.headerButtonText}>{t('analytics.back')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centerCard}>
          <Text style={styles.centerTitle}>{t('analytics.noAccess')}</Text>
          <Text style={styles.centerBody}>{t('analytics.noAccessBody')}</Text>
        </View>
      </View>
    );
  }

  const platformOptions: PlatformFilter[] = ['all', 'android', 'ios', 'web'];
  const userTypeOptions: UserTypeFilter[] = ['all', 'anonymous', 'registered'];

  const onlinePlatformText = stats
    ? [
        `${t('analytics.platformWeb')}: ${stats.online_by_platform['web'] ?? 0}`,
        `${t('analytics.platformAndroid')}: ${stats.online_by_platform['android'] ?? 0}`,
        `${t('analytics.platformIos')}: ${stats.online_by_platform['ios'] ?? 0}`,
      ].join('  ')
    : '';

  const activityKeys: Array<{ key: string; label: string }> = [
    { key: 'game_played', label: t('analytics.gamesPlayed') },
    { key: 'tutorial_complete', label: t('analytics.tutorialsCompleted') },
    { key: 'feedback_submitted', label: t('analytics.feedbacks') },
    { key: 'user_registered', label: t('analytics.registrations') },
    { key: 'app_open', label: t('analytics.appOpens') },
    { key: 'tutorial_lesson_complete', label: t('analytics.lessonCompletes') },
  ];

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.headerButton}
          testID="analytics-back-button"
        >
          <Text style={styles.headerButtonText}>{t('analytics.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('analytics.title')}</Text>
        <TouchableOpacity onPress={() => void loadSessions()} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>{t('analytics.refresh')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.outerScroll}
        contentContainerStyle={styles.outerScrollContent}
      >
        {/* Live panel */}
        <Text style={styles.sectionTitle}>{t('analytics.liveTitle')}</Text>
        <View testID="analytics-live-panel" style={styles.livePanel}>
          <View style={styles.liveBadgeRow}>
            <Text style={styles.livePanelTitle}>{t('analytics.liveTitle')}</Text>
            <View style={styles.liveBadgeInner}>
              <Animated.View style={[styles.liveDot, { opacity: liveOpacity }]} />
              <Text style={styles.liveBadgeText}>{t('analytics.liveBadge')}</Text>
            </View>
          </View>
          {statsError ? (
            <Text style={styles.liveSubText}>{t('analytics.statsError')}</Text>
          ) : (
            <>
              <Text style={styles.liveNumber}>{stats ? stats.online_now : '—'}</Text>
              <Text style={styles.liveSubText}>{t('analytics.onlineNow')}</Text>
              {stats && (
                <Text style={styles.liveSubText}>{onlinePlatformText}</Text>
              )}
            </>
          )}
        </View>

        {/* Entries by time */}
        <Text style={styles.sectionTitle}>{t('analytics.entriesTitle')}</Text>
        <View style={styles.summaryRow}>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{stats ? stats.entries_last_hour : '—'}</Text>
            <Text style={styles.statLabel}>{t('analytics.lastHour')}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{stats ? stats.entries_today : '—'}</Text>
            <Text style={styles.statLabel}>{t('analytics.today')}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{stats ? stats.entries_7d : '—'}</Text>
            <Text style={styles.statLabel}>{t('analytics.last7d')}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{stats ? stats.entries_30d : '—'}</Text>
            <Text style={styles.statLabel}>{t('analytics.last30d')}</Text>
          </View>
        </View>

        {/* Totals */}
        <Text style={styles.sectionTitle}>{t('analytics.totalsTitle')}</Text>
        <View style={styles.summaryRow}>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{stats ? stats.total : '—'}</Text>
            <Text style={styles.statLabel}>{t('analytics.total')}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{stats ? stats.anonymous : '—'}</Text>
            <Text style={styles.statLabel}>{t('analytics.anonymous')}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{stats ? stats.registered : '—'}</Text>
            <Text style={styles.statLabel}>{t('analytics.registered')}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{stats ? formatAvgDuration(stats.avg_duration_seconds) : '—'}</Text>
            <Text style={styles.statLabel}>{t('analytics.avgDuration')}</Text>
          </View>
        </View>

        {/* By platform */}
        <Text style={styles.sectionTitle}>{t('analytics.platformTitle')}</Text>
        <View style={styles.summaryRow}>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{stats ? (stats.by_platform['web'] ?? 0) : '—'}</Text>
            <Text style={styles.statLabel}>{t('analytics.platformWeb')}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{stats ? (stats.by_platform['android'] ?? 0) : '—'}</Text>
            <Text style={styles.statLabel}>{t('analytics.platformAndroid')}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{stats ? (stats.by_platform['ios'] ?? 0) : '—'}</Text>
            <Text style={styles.statLabel}>{t('analytics.platformIos')}</Text>
          </View>
        </View>

        {/* By activity */}
        <Text style={styles.sectionTitle}>{t('analytics.activityTitle')}</Text>
        <View style={styles.summaryRow}>
          {activityKeys.map(({ key, label }) => (
            <View key={key} style={styles.statChip}>
              <Text style={styles.statValue}>{stats ? (stats.by_activity[key] ?? 0) : '—'}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Invited-only gate panel */}
        <Text style={styles.sectionTitle}>{t('analytics.inviteTitle')}</Text>
        <View style={styles.summaryRow}>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{invite ? invite.total_invited : '—'}</Text>
            <Text style={styles.statLabel}>{t('analytics.inviteInvited')}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{invite ? invite.online_now : '—'}</Text>
            <Text style={styles.statLabel}>{t('analytics.inviteOnline')}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{invite ? invite.total_blocked : '—'}</Text>
            <Text style={styles.statLabel}>{t('analytics.inviteBlocked')}</Text>
          </View>
        </View>
        {invite && Array.isArray(invite.invites) && invite.invites.length > 0 ? (
          <View style={styles.inviteListCard}>
            {invite.invites.map((row) => (
              <View key={row.email} style={styles.inviteListRow}>
                <View style={styles.inviteListInfo}>
                  <Text style={styles.inviteListEmail} numberOfLines={1}>{row.email}</Text>
                  <Text style={styles.inviteListMeta}>
                    {`${row.status === 'invited' ? t('analytics.inviteStatusInvited') : t('analytics.inviteStatusBlocked')} · ${
                      row.last_seen_at ? formatTimestamp(row.last_seen_at) : t('analytics.inviteNeverSeen')
                    }`}
                  </Text>
                </View>
                {row.online ? <View style={styles.inviteOnlineDot} /> : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Auto-refresh hint */}
        <Text style={styles.autoRefreshText}>
          {`${t('analytics.autoRefreshHint')} · ${t('analytics.updatedAt')} ${lastUpdated ? lastUpdated.toLocaleTimeString('he-IL') : '—'}`}
        </Text>

        {/* Platform filter */}
        <View style={styles.filterRow}>
          {platformOptions.map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => setPlatformFilter(opt)}
              style={[styles.filterChip, platformFilter === opt && styles.filterChipActive]}
            >
              <Text
                style={[styles.filterChipText, platformFilter === opt && styles.filterChipTextActive]}
              >
                {opt === 'all' ? t('analytics.filterAll') : opt === 'web' ? t('analytics.platformWeb') : opt === 'android' ? t('analytics.platformAndroid') : t('analytics.platformIos')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* User type filter */}
        <View style={styles.filterRow}>
          {userTypeOptions.map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => setUserTypeFilter(opt)}
              style={[styles.filterChip, userTypeFilter === opt && styles.filterChipActive]}
            >
              <Text
                style={[styles.filterChipText, userTypeFilter === opt && styles.filterChipTextActive]}
              >
                {opt === 'all'
                  ? t('analytics.filterAllUsers')
                  : opt === 'anonymous'
                  ? t('analytics.filterAnonymous')
                  : t('analytics.filterRegistered')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Session list */}
        {loading ? (
          <View style={styles.loadingShell}>
            <ActivityIndicator size="large" color="#FACC15" />
          </View>
        ) : hasError ? (
          <View style={styles.centerCard}>
            <Text style={styles.centerBody}>{t('analytics.error')}</Text>
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.centerCard}>
            <Text style={styles.centerBody}>{t('analytics.empty')}</Text>
          </View>
        ) : (
          <ScrollView
            testID="analytics-session-list"
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
            nestedScrollEnabled
          >
            {sessions.map((session) => (
              <View key={session.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.platformBadge, platformBadgeStyle(session.platform)]}>
                    <Text style={styles.platformBadgeText}>{session.platform}</Text>
                  </View>
                  <View
                    style={[
                      styles.userTypeBadge,
                      session.is_anonymous ? styles.userTypeBadgeAnon : styles.userTypeBadgeReg,
                    ]}
                  >
                    <Text style={styles.userTypeText}>
                      {session.is_anonymous ? t('analytics.badgeAnonymous') : t('analytics.badgeRegistered')}
                    </Text>
                  </View>
                </View>

                <Text style={styles.durationText}>
                  {`${t('analytics.durationLabel')}: ${formatDuration(session.session_start, session.session_end)}`}
                </Text>

                <Text style={styles.metaText}>
                  {formatTimestamp(session.session_start)}
                </Text>

                {session.event_count > 0 ? (
                  <Text style={styles.eventCountText}>
                    {`${session.event_count} ${t('analytics.eventsLabel')}`}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}
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
  outerScroll: {
    flex: 1,
  },
  outerScrollContent: {
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row-reverse',
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
    textAlign: 'right',
  },
  headerTitle: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'right',
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 6,
    textAlign: 'right',
  },
  livePanel: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(74,222,128,0.34)',
    marginTop: 12,
    alignItems: 'flex-end',
  },
  liveBadgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  liveBadgeInner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ADE80',
  },
  liveBadgeText: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  livePanelTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
    flex: 1,
  },
  liveNumber: {
    color: '#FACC15',
    fontSize: 40,
    fontWeight: '900',
    textAlign: 'right',
    lineHeight: 48,
    marginTop: 2,
  },
  liveSubText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 4,
  },
  autoRefreshText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 8,
  },
  inviteListCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 10,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
  },
  inviteListRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.12)',
  },
  inviteListInfo: {
    flex: 1,
  },
  inviteListEmail: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  inviteListMeta: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
    textAlign: 'right',
  },
  inviteOnlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ADE80',
  },
  summaryRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    flexWrap: 'wrap',
  },
  statChip: {
    flex: 1,
    minWidth: 72,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    alignItems: 'center',
  },
  statValue: {
    color: '#FACC15',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
  },
  statLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  filterRow: {
    flexDirection: 'row-reverse',
    marginTop: 10,
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChip: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(37,99,235,0.24)',
    borderColor: 'rgba(96,165,250,0.52)',
  },
  filterChipText: {
    color: 'rgba(191,219,254,0.6)',
    fontSize: 12,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: '#BFDBFE',
  },
  scroll: {
    flex: 1,
    marginTop: 16,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 12,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  loadingShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  centerCard: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 20,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: 16,
  },
  centerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
  },
  centerBody: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',
    marginTop: 8,
  },
  card: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(9,23,43,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.24)',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  platformBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  badgeAndroid: {
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderColor: 'rgba(52,211,153,0.44)',
  },
  badgeIos: {
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderColor: 'rgba(96,165,250,0.44)',
  },
  badgeWeb: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderColor: 'rgba(167,139,250,0.44)',
  },
  platformBadgeText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },
  userTypeBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  userTypeBadgeAnon: {
    backgroundColor: 'rgba(100,116,139,0.18)',
    borderColor: 'rgba(148,163,184,0.34)',
  },
  userTypeBadgeReg: {
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderColor: 'rgba(52,211,153,0.34)',
  },
  userTypeText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },
  durationText: {
    color: '#BFDBFE',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 10,
    textAlign: 'right',
  },
  metaText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'right',
  },
  eventCountText: {
    color: '#FCD34D',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'right',
  },
});
