import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { useFeedbackAdmin } from '../feedback/useFeedbackAdmin';
import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../i18n/LocaleContext';
import { supabase } from '../lib/supabase';

type FeedbackSubmissionStatus = 'new' | 'reviewed' | 'archived';
type FeedbackSubmissionKind = 'game' | 'tutorial' | 'general';

interface FeedbackSubmissionRow {
  id: string;
  username_snapshot: string | null;
  is_anonymous: boolean;
  locale: string;
  experience_kind: FeedbackSubmissionKind;
  rating: number;
  comment: string;
  platform: string;
  app_version: string | null;
  status: FeedbackSubmissionStatus;
  created_at: string;
}

interface FeedbackInboxScreenProps {
  onBack: () => void;
  onOpenAdminCoinGifts: (username?: string) => void;
}

function formatTimestamp(value: string, locale: 'he' | 'en'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US');
}

function stars(rating: number): string {
  const safeRating = Math.max(1, Math.min(5, Math.round(rating)));
  return '★'.repeat(safeRating);
}

function statusColor(status: FeedbackSubmissionStatus): string {
  if (status === 'reviewed') return '#93C5FD';
  if (status === 'archived') return '#CBD5E1';
  return '#FCD34D';
}

export function FeedbackInboxScreen({ onBack, onOpenAdminCoinGifts }: FeedbackInboxScreenProps) {
  const { locale, t, isRTL } = useLocale();
  const { user } = useAuth();
  const { isFeedbackAdmin, loading: adminLoading } = useFeedbackAdmin();
  const [feedbackItems, setFeedbackItems] = useState<FeedbackSubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [copiedFeedbackId, setCopiedFeedbackId] = useState<string | null>(null);
  const copiedResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTab, setActiveTab] = useState<FeedbackSubmissionStatus>('new');
  const [ascending, setAscending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadFeedbackItems = useCallback(async () => {
    if (!user?.id || !isFeedbackAdmin) {
      setFeedbackItems([]);
      setHasError(false);
      setLoading(false);
      return;
    }

    setActionError(null);
    setLoading(true);
    setHasError(false);
    try {
      const { data, error: queryError } = await supabase
        .from('feedback_submissions')
        .select(
          'id, username_snapshot, is_anonymous, locale, experience_kind, rating, comment, platform, app_version, status, created_at',
        )
        .eq('status', activeTab)
        .order('created_at', { ascending })
        .limit(200);

      if (queryError) {
        setFeedbackItems([]);
        setHasError(true);
        return;
      }

      setFeedbackItems(Array.isArray(data) ? (data as FeedbackSubmissionRow[]) : []);
    } catch {
      setFeedbackItems([]);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, [isFeedbackAdmin, user?.id, activeTab, ascending]);

  useEffect(() => {
    void loadFeedbackItems();
  }, [loadFeedbackItems]);

  useEffect(() => () => {
    if (copiedResetTimerRef.current) {
      clearTimeout(copiedResetTimerRef.current);
      copiedResetTimerRef.current = null;
    }
  }, []);

  const cardDirection = isRTL ? 'rtl' : 'ltr';
  const labelAlign = isRTL ? 'right' : 'left';
  const emptyMessage = hasError ? t('feedbackInbox.error') : t('feedbackInbox.empty');
  const copyHint = locale === 'he' ? 'לחצו על השם להעתקה' : 'Tap username to copy';
  const copiedLabel = locale === 'he' ? 'הועתק' : 'Copied';
  const senderTypeGuestLabel = locale === 'he' ? 'מזדמן' : t('feedbackInbox.senderTypeGuest');
  const senderTypeRegisteredLabel = locale === 'he' ? 'רשום' : t('feedbackInbox.senderTypeRegistered');
  const openGiftLabel = locale === 'he' ? 'מתנת מטבעות' : t('feedbackInbox.openGift');

  const handleCopyUsername = useCallback(async (feedbackId: string, username: string) => {
    const safeUsername = username.trim();
    if (!safeUsername) return;

    await Clipboard.setStringAsync(safeUsername);
    setCopiedFeedbackId(feedbackId);

    if (copiedResetTimerRef.current) {
      clearTimeout(copiedResetTimerRef.current);
    }

    copiedResetTimerRef.current = setTimeout(() => {
      setCopiedFeedbackId((currentId) => (currentId === feedbackId ? null : currentId));
      copiedResetTimerRef.current = null;
    }, 1600);
  }, []);

  const handleUpdateStatus = useCallback(async (id: string, newStatus: FeedbackSubmissionStatus) => {
    setFeedbackItems((prev) => prev.filter((item) => item.id !== id));
    setActionError(null);
    try {
      const { error } = await supabase
        .from('feedback_submissions')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) {
        setActionError(t('feedbackInbox.actionError'));
        void loadFeedbackItems();
      }
    } catch {
      setActionError(t('feedbackInbox.actionError'));
      void loadFeedbackItems();
    }
  }, [loadFeedbackItems, t]);

  if (adminLoading) {
    return (
      <View style={styles.loadingShell}>
        <ActivityIndicator size="large" color="#FACC15" />
      </View>
    );
  }

  if (!isFeedbackAdmin) {
    return (
      <View style={styles.screen}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={onBack} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>{t('feedbackInbox.back')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centerCard}>
          <Text style={styles.centerTitle}>{t('feedbackInbox.noAccessTitle')}</Text>
          <Text style={styles.centerBody}>{t('feedbackInbox.noAccessBody')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>{t('feedbackInbox.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('feedbackInbox.title')}</Text>
        <TouchableOpacity onPress={() => void loadFeedbackItems()} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>{t('feedbackInbox.refresh')}</Text>
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {(['new', 'reviewed', 'archived'] as FeedbackSubmissionStatus[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
              {t(`feedbackInbox.status.${tab}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sort toggle */}
      <TouchableOpacity
        onPress={() => setAscending((prev) => !prev)}
        style={[styles.sortToggle, { alignSelf: isRTL ? 'flex-start' : 'flex-end' }]}
      >
        <Text style={styles.sortToggleText}>
          {ascending ? t('feedbackInbox.sortOldest') : t('feedbackInbox.sortNewest')} ↕
        </Text>
      </TouchableOpacity>

      {/* Action error banner */}
      {actionError ? (
        <Text style={styles.actionErrorText}>{actionError}</Text>
      ) : null}

      {loading ? (
        <View style={styles.loadingShell}>
          <ActivityIndicator size="large" color="#FACC15" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={feedbackItems.length > 0 ? styles.scrollContent : styles.emptyContent}
          showsVerticalScrollIndicator={false}
        >
          {feedbackItems.length === 0 ? (
            <View style={styles.centerCard}>
              <Text style={styles.centerBody}>{emptyMessage}</Text>
            </View>
          ) : (
            feedbackItems.map((item) => {
              const senderUsername = item.username_snapshot?.trim() ?? '';
              const hasSenderUsername = senderUsername.length > 0;
              const senderTypeLabel = item.is_anonymous
                ? senderTypeGuestLabel
                : senderTypeRegisteredLabel;

              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderMain}>
                      {hasSenderUsername ? (
                        <TouchableOpacity
                          onPress={() => void handleCopyUsername(item.id, senderUsername)}
                          style={styles.senderButton}
                          activeOpacity={0.82}
                          testID={`feedback-copy-username-${item.id}`}
                        >
                          <Text style={styles.senderText}>{senderUsername}</Text>
                          <Text style={styles.copyHintText}>
                            {copiedFeedbackId === item.id ? copiedLabel : copyHint}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.senderText}>
                          {item.is_anonymous ? t('feedbackInbox.senderAnonymous') : t('feedbackInbox.senderUnknown')}
                        </Text>
                      )}
                      <Text style={styles.timestampText}>{formatTimestamp(item.created_at, locale)}</Text>
                    </View>
                    <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                      {t(`feedbackInbox.status.${item.status}`)}
                    </Text>
                  </View>

                  <View style={[styles.senderMetaRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <View
                      style={[
                        styles.senderTypeBadge,
                        item.is_anonymous ? styles.senderTypeGuestBadge : styles.senderTypeRegisteredBadge,
                      ]}
                    >
                      <Text style={styles.senderTypeText}>{senderTypeLabel}</Text>
                    </View>
                    {hasSenderUsername ? (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => onOpenAdminCoinGifts(senderUsername)}
                        style={styles.giftShortcutButton}
                        testID={`feedback-open-gift-${item.id}`}
                      >
                        <Text style={styles.giftShortcutButtonText}>{openGiftLabel}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <Text style={[styles.metaText, { textAlign: labelAlign, writingDirection: cardDirection }]}>
                    {`${t(`feedbackInbox.kind.${item.experience_kind}`)} · ${stars(item.rating)} · ${item.platform}`}
                  </Text>
                  <Text style={[styles.metaText, { textAlign: labelAlign, writingDirection: cardDirection }]}>
                    {`${t('feedbackInbox.locale')}: ${item.locale}${item.app_version ? ` · ${t('feedbackInbox.version')}: ${item.app_version}` : ''}`}
                  </Text>
                  <Text style={[styles.commentText, { textAlign: labelAlign, writingDirection: cardDirection }]}>
                    {item.comment.trim() || t('feedbackInbox.noComment')}
                  </Text>
                  {activeTab !== 'archived' ? (
                    <View style={[styles.actionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                      {activeTab === 'new' ? (
                        <TouchableOpacity
                          onPress={() => void handleUpdateStatus(item.id, 'reviewed')}
                          style={styles.actionButton}
                          testID={`feedback-mark-reviewed-${item.id}`}
                        >
                          <Text style={styles.actionButtonText}>{t('feedbackInbox.markReviewed')}</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        onPress={() => void handleUpdateStatus(item.id, 'archived')}
                        style={[styles.actionButton, styles.actionButtonArchive]}
                        testID={`feedback-archive-${item.id}`}
                      >
                        <Text style={styles.actionButtonText}>{t('feedbackInbox.archive')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })
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
  subtitle: {
    marginTop: 12,
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
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
  card: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(9,23,43,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.24)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardHeaderMain: {
    flex: 1,
  },
  senderButton: {
    alignSelf: 'flex-start',
  },
  senderMetaRow: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  senderTypeBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  senderTypeGuestBadge: {
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderColor: 'rgba(96,165,250,0.34)',
  },
  senderTypeRegisteredBadge: {
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderColor: 'rgba(52,211,153,0.34)',
  },
  senderTypeText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '800',
  },
  senderText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
  },
  copyHintText: {
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  timestampText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900',
  },
  giftShortcutButton: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37,99,235,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.34)',
  },
  giftShortcutButtonText: {
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '800',
  },
  metaText: {
    color: '#BFDBFE',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  commentText: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 10,
  },
  tabBar: {
    marginTop: 14,
    gap: 8,
    justifyContent: 'center',
  },
  tabButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(37,99,235,0.24)',
    borderColor: 'rgba(96,165,250,0.52)',
  },
  tabButtonText: {
    color: 'rgba(191,219,254,0.6)',
    fontSize: 12,
    fontWeight: '800',
  },
  tabButtonTextActive: {
    color: '#BFDBFE',
  },
  sortToggle: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sortToggleText: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  actionErrorText: {
    marginTop: 8,
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionRow: {
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37,99,235,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.34)',
  },
  actionButtonArchive: {
    backgroundColor: 'rgba(100,116,139,0.18)',
    borderColor: 'rgba(148,163,184,0.34)',
  },
  actionButtonText: {
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '800',
  },
});
