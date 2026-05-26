import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

interface AnalyticsScreenProps {
  onBack: () => void;
}

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

export function AnalyticsScreen({ onBack }: AnalyticsScreenProps) {
  const { isRTL } = useLocale();
  const { isAdmin, loading: adminLoading } = useAdminAccess();

  const [sessions, setSessions] = useState<AppSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [userTypeFilter, setUserTypeFilter] = useState<UserTypeFilter>('all');

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
        );

      if (platformFilter !== 'all') {
        query = (query as ReturnType<typeof query.eq>).eq('platform', platformFilter);
      }

      if (userTypeFilter === 'anonymous') {
        query = (query as ReturnType<typeof query.eq>).eq('is_anonymous', true);
      } else if (userTypeFilter === 'registered') {
        query = (query as ReturnType<typeof query.eq>).eq('is_anonymous', false);
      }

      const { data, error: queryError } = await (query as unknown as { order: (col: string, opts: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: AppSession[] | null; error: unknown }> } })
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
            <Text style={styles.headerButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centerCard}>
          <Text style={styles.centerTitle}>Access restricted</Text>
          <Text style={styles.centerBody}>
            This screen is only available to allowlisted admins.
          </Text>
        </View>
      </View>
    );
  }

  // Compute summary stats
  const totalCount = sessions.length;
  const anonymousCount = sessions.filter((s) => s.is_anonymous).length;
  const registeredCount = totalCount - anonymousCount;
  const completedSessions = sessions.filter((s) => s.session_end !== null);
  let avgDurationLabel = '—';
  if (completedSessions.length > 0) {
    const totalMs = completedSessions.reduce((acc, s) => {
      const diff = new Date(s.session_end!).getTime() - new Date(s.session_start).getTime();
      return acc + (Number.isNaN(diff) || diff < 0 ? 0 : diff);
    }, 0);
    const avgMs = totalMs / completedSessions.length;
    const avgSeconds = Math.floor(avgMs / 1000);
    const avgMin = Math.floor(avgSeconds / 60);
    const avgSec = avgSeconds % 60;
    avgDurationLabel = avgMin === 0 ? `${avgSec}s` : `${avgMin}m ${avgSec}s`;
  }

  const platformOptions: PlatformFilter[] = ['all', 'android', 'ios', 'web'];
  const userTypeOptions: UserTypeFilter[] = ['all', 'anonymous', 'registered'];

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.headerButton}
          testID="analytics-back-button"
        >
          <Text style={styles.headerButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <TouchableOpacity onPress={() => void loadSessions()} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Summary chips */}
      <View style={[styles.summaryRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={styles.statChip}>
          <Text style={styles.statValue}>{totalCount}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statValue}>{anonymousCount}</Text>
          <Text style={styles.statLabel}>Anonymous</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statValue}>{registeredCount}</Text>
          <Text style={styles.statLabel}>Registered</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statValue}>{avgDurationLabel}</Text>
          <Text style={styles.statLabel}>Avg duration</Text>
        </View>
      </View>

      {/* Platform filter */}
      <View style={[styles.filterRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {platformOptions.map((opt) => (
          <TouchableOpacity
            key={opt}
            onPress={() => setPlatformFilter(opt)}
            style={[styles.filterChip, platformFilter === opt && styles.filterChipActive]}
          >
            <Text
              style={[styles.filterChipText, platformFilter === opt && styles.filterChipTextActive]}
            >
              {opt === 'all' ? 'All' : opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* User type filter */}
      <View style={[styles.filterRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {userTypeOptions.map((opt) => (
          <TouchableOpacity
            key={opt}
            onPress={() => setUserTypeFilter(opt)}
            style={[styles.filterChip, userTypeFilter === opt && styles.filterChipActive]}
          >
            <Text
              style={[styles.filterChipText, userTypeFilter === opt && styles.filterChipTextActive]}
            >
              {opt === 'all' ? 'All users' : opt === 'anonymous' ? 'Anonymous' : 'Registered'}
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
          <Text style={styles.centerBody}>Could not load sessions. Please try again.</Text>
        </View>
      ) : (
        <ScrollView
          testID="analytics-session-list"
          style={styles.scroll}
          contentContainerStyle={sessions.length > 0 ? styles.scrollContent : styles.emptyContent}
          showsVerticalScrollIndicator={false}
        >
          {sessions.length === 0 ? (
            <View style={styles.centerCard}>
              <Text style={styles.centerBody}>No sessions found.</Text>
            </View>
          ) : (
            sessions.map((session) => (
              <View key={session.id} style={styles.card}>
                <View style={[styles.cardHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
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
                      {session.is_anonymous ? 'Anonymous' : 'Registered'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.durationText}>
                  {`Duration: ${formatDuration(session.session_start, session.session_end)}`}
                </Text>

                <Text style={styles.metaText}>
                  {formatTimestamp(session.session_start)}
                </Text>

                {session.event_count > 0 ? (
                  <Text style={styles.eventCountText}>
                    {`${session.event_count} events`}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
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
  headerTitle: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  summaryRow: {
    marginTop: 16,
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
  },
  statLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  filterRow: {
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
  },
  centerCard: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 20,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
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
  card: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(9,23,43,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.24)',
  },
  cardHeader: {
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
  },
  durationText: {
    color: '#BFDBFE',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 10,
  },
  metaText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  eventCountText: {
    color: '#FCD34D',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
});
