import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMultiplayer } from '../hooks/useMultiplayer';
import type {
  BotDifficulty,
  Fraction,
  HostGameSettings,
  LobbyTableSummary,
  LobbyTableVisibility,
  Operation,
} from '../../shared/types';
import type { MsgParams } from '../../shared/i18n';
import { useLocale } from '../i18n/LocaleContext';
import SalindaPuzzleGameLogo from '../components/branding/SalindaPuzzleGameLogo';
import { brand } from '../theme/brand';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { CARDS_PER_PLAYER } from '../../shared/gameConstants';
import { pickQuickMatchTable } from './TablesLobbyScreen';
import { buildPrivateInviteShareMessage, buildRoomShareMessage } from './onlineShareMessages';
import { getScreenSafeTop } from '../theme/screenInsets';
import { WEB_GAME_PLAYFIELD_MAX_WIDTH } from '../theme/webLayout';
import { SlindaCoin } from '../../components/SlindaCoin';

const WEB_INVITE_BASE_STORAGE_KEY = 'salinda_web_invite_base';
const ALL_FRACTION_KINDS: readonly Fraction[] = ['1/2', '1/3', '1/4', '1/5'];

type TFn = (key: string, params?: MsgParams) => string;

const ROOT_BG = '#0a0d14';
const SURFACE = 'rgba(20, 15, 8, 0.76)';
const SURFACE_ALT = 'rgba(20, 15, 8, 0.88)';
const SURFACE_SOFT = 'rgba(0, 0, 0, 0.34)';
const GOLD_LINE = 'rgba(245, 210, 122, 0.18)';
const GOLD_LINE_STRONG = 'rgba(245, 210, 122, 0.3)';
const ACTION_GOLD = '#f5d27a';
const ACTION_GOLD_DARK = '#c9a55a';
const ACTION_AMBER = '#a34705';
const TEXT_MAIN = '#f5f1e6';
const TEXT_DIM = '#b9b0a0';
const TEXT_MUTE = '#8a8275';
const DEFAULT_SUMMARY_MAX_PARTICIPANTS = 4;
const DEFAULT_SUMMARY_VISIBILITY: LobbyTableVisibility = 'public';

type SummaryTone = 'info' | 'danger' | 'warning' | 'accent';

interface LobbySummaryItem {
  key: string;
  title: string;
  value: string;
  detail?: string;
  tone: SummaryTone;
  testID: string;
}

interface LobbySummarySource {
  visibility?: LobbyTableVisibility | null;
  maxParticipants?: number | null;
  currentParticipants?: number | null;
  configuredDifficulty?: 'easy' | 'full' | null;
  showFractions?: boolean | null;
  fractionKinds?: Fraction[] | readonly Fraction[] | null;
  showPossibleResults?: boolean | null;
  showSolveExercise?: boolean | null;
  timerSetting?: HostGameSettings['timerSetting'] | null;
  timerCustomSeconds?: number | null;
}

function lobbyTimerLabel(t: TFn, ts: HostGameSettings['timerSetting'], customSec: number): string {
  if (ts === 'off') return t('lobby.timerOff');
  if (ts === 'custom') {
    return customSec >= 60
      ? t('lobby.timerFmtMinSec', { m: Math.floor(customSec / 60), s: customSec % 60 })
      : t('lobby.timerSec', { n: customSec });
  }
  if (ts === '15') return t('lobby.timerSec', { n: 15 });
  if (ts === '60') return t('lobby.timerMin');
  if (ts === '90') return t('lobby.timerMinHalf');
  return t('lobby.timerSec', { n: ts });
}

function getSummaryToneColors(tone: SummaryTone) {
  switch (tone) {
    case 'danger':
      return {
        borderColor: 'rgba(248, 113, 113, 0.46)',
        backgroundColor: 'rgba(127, 29, 29, 0.26)',
        titleColor: '#FECACA',
        valueColor: '#FEE2E2',
        detailColor: '#FCA5A5',
      };
    case 'warning':
      return {
        borderColor: 'rgba(245, 158, 11, 0.42)',
        backgroundColor: 'rgba(120, 53, 15, 0.26)',
        titleColor: '#FDE68A',
        valueColor: '#FEF3C7',
        detailColor: '#FCD34D',
      };
    case 'accent':
      return {
        borderColor: 'rgba(168, 85, 247, 0.44)',
        backgroundColor: 'rgba(88, 28, 135, 0.24)',
        titleColor: '#DDD6FE',
        valueColor: '#F3E8FF',
        detailColor: '#C4B5FD',
      };
    case 'info':
    default:
      return {
        borderColor: 'rgba(96, 165, 250, 0.42)',
        backgroundColor: 'rgba(30, 64, 175, 0.22)',
        titleColor: '#BFDBFE',
        valueColor: '#EFF6FF',
        detailColor: '#93C5FD',
      };
  }
}

function normalizeSummaryFractionKinds(kinds?: Fraction[] | readonly Fraction[] | null): Fraction[] {
  const configuredKinds = new Set((kinds ?? []).filter(Boolean));
  if (configuredKinds.size === 0) return [...ALL_FRACTION_KINDS];
  return ALL_FRACTION_KINDS.filter((kind) => configuredKinds.has(kind));
}

function buildLobbySummaryItems(
  source: LobbySummarySource,
  t: TFn,
  includeCurrentParticipants: boolean,
): LobbySummaryItem[] {
  const maxParticipants = Math.max(2, source.maxParticipants ?? DEFAULT_SUMMARY_MAX_PARTICIPANTS);
  const currentParticipants = Math.max(0, source.currentParticipants ?? 0);
  const visibility = source.visibility ?? DEFAULT_SUMMARY_VISIBILITY;
  const showFractions = source.showFractions ?? true;
  const fractionKinds = normalizeSummaryFractionKinds(source.fractionKinds);
  const showPossibleResults = source.showPossibleResults ?? true;
  const showSolveExercise = source.showSolveExercise ?? true;
  const timerSetting = source.timerSetting ?? 'off';
  const timerCustomSeconds = source.timerCustomSeconds ?? 60;
  const items: LobbySummaryItem[] = [
    {
      key: 'seats',
      title: t('lobby.maxParticipants'),
      value: includeCurrentParticipants ? `${currentParticipants}/${maxParticipants}` : String(maxParticipants),
      tone: 'info',
      testID: 'lobby-summary-card-seats',
    },
  ];

  if (visibility === 'private_locked') {
    items.push({
      key: 'private',
      title: t('lobby.summary.access'),
      value: t('lobby.tablePrivate'),
      tone: 'warning',
      testID: 'lobby-summary-card-private',
    });
  }

  if (source.configuredDifficulty === 'easy') {
    items.push({
      key: 'difficulty',
      title: t('lobby.difficulty'),
      value: t('lobby.diffEasyRange'),
      tone: 'accent',
      testID: 'lobby-summary-card-difficulty',
    });
  }

  if (!showFractions) {
    items.push({
      key: 'fractions-off',
      title: t('lobby.fractions'),
      value: t('lobby.noFractions'),
      tone: 'danger',
      testID: 'lobby-summary-card-fractions-off',
    });
  } else if (fractionKinds.length < ALL_FRACTION_KINDS.length) {
    const removedKinds = ALL_FRACTION_KINDS.filter((kind) => !fractionKinds.includes(kind));
    items.push({
      key: 'fractions-partial',
      title: t('lobby.summary.activeFractions'),
      value: fractionKinds.join(', '),
      detail: t('lobby.summary.removedFractions', { value: removedKinds.join(', ') }),
      tone: 'warning',
      testID: 'lobby-summary-card-fractions-partial',
    });
  }

  if (!showPossibleResults) {
    items.push({
      key: 'possible-results',
      title: t('lobby.possibleResults'),
      value: t('lobby.hide'),
      tone: 'danger',
      testID: 'lobby-summary-card-possible-results',
    });
  }

  if (!showSolveExercise) {
    items.push({
      key: 'solve-exercise',
      title: t('lobby.solveExercise'),
      value: t('lobby.off'),
      tone: 'danger',
      testID: 'lobby-summary-card-solve-exercise',
    });
  }

  if (timerSetting !== 'off') {
    items.push({
      key: 'timer',
      title: t('lobby.turnTimer'),
      value: lobbyTimerLabel(t, timerSetting, timerCustomSeconds),
      tone: 'info',
      testID: 'lobby-summary-card-timer',
    });
  }

  return items;
}

function LobbySummarySection({
  items,
  isRTL,
  t,
}: {
  items: LobbySummaryItem[];
  isRTL: boolean;
  t: TFn;
}) {
  if (items.length === 0) return null;
  const ta = isRTL ? 'right' : 'left';
  const summaryTitleStyle = isRTL
    ? [styles.summarySectionTitle, styles.summarySectionTitleRtl]
    : styles.summarySectionTitle;

  return (
    <View testID="lobby-summary-section" style={styles.summarySection}>
      <Text style={[summaryTitleStyle, { textAlign: ta }]}>{t('lobby.summaryTitle')}</Text>
      <View testID="lobby-summary-grid" style={styles.summaryGrid}>
        {items.map((item) => {
          const tone = getSummaryToneColors(item.tone);
          return (
            <View
              key={item.key}
              testID={item.testID}
              style={[
                styles.summaryCard,
                {
                  borderColor: tone.borderColor,
                  backgroundColor: tone.backgroundColor,
                },
              ]}
            >
              <Text style={[styles.summaryCardTitle, { color: tone.titleColor, textAlign: ta }]}>{item.title}</Text>
              <Text style={[styles.summaryCardValue, { color: tone.valueColor, textAlign: ta }]}>{item.value}</Text>
              {item.detail ? (
                <Text style={[styles.summaryCardDetail, { color: tone.detailColor, textAlign: ta }]}>{item.detail}</Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();
  return (
    <View style={styles.langRow} testID="lobby-language-toggle">
      <Text style={styles.langLabel}>{t('lang.label')}:</Text>
      <TouchableOpacity onPress={() => void setLocale('he')} style={[styles.langBtn, locale === 'he' && styles.langBtnActive]}>
        <Text style={[styles.langBtnText, locale === 'he' && styles.langBtnTextActive]}>{t('lang.he')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => void setLocale('en')} style={[styles.langBtn, locale === 'en' && styles.langBtnActive]}>
        <Text style={[styles.langBtnText, locale === 'en' && styles.langBtnTextActive]}>{t('lang.en')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function getInviteWebBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_WEB_APP_URL) {
    return String(process.env.EXPO_PUBLIC_WEB_APP_URL).trim();
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const pathname = window.location.pathname || '/';
    const cleanPath = pathname === '/' ? '' : pathname.replace(/\/$/, '');
    return `${window.location.origin}${cleanPath}`;
  }
  return 'https://salinda-web.onrender.com';
}

function isLocalServerUrl(url: string): boolean {
  const raw = (url || '').trim().toLowerCase();
  return raw.includes('localhost') || raw.includes('127.0.0.1') || raw.includes('0.0.0.0') || raw.includes('10.0.2.2');
}

function guestInviteSearchParams(roomCode: string, serverUrl: string, inviteCode?: string | null): URLSearchParams {
  const fallbackPublicServer =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SERVER_URL
      ? String(process.env.EXPO_PUBLIC_SERVER_URL).trim()
      : 'https://lolos-mobile.onrender.com';
  const safeServerUrl = isLocalServerUrl(serverUrl) ? fallbackPublicServer : serverUrl.trim();
  const params = new URLSearchParams({ room: roomCode });
  if (inviteCode?.trim()) params.set('invite', inviteCode.trim());
  if (safeServerUrl) params.set('server', safeServerUrl);
  return params;
}

export function parseJoinParamsFromUrl(): { roomCode?: string; inviteCode?: string; serverUrl?: string; name?: string } {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return {};
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      roomCode: params.get('room') ?? undefined,
      inviteCode: params.get('invite') ?? undefined,
      serverUrl: params.get('server') ?? undefined,
      name: params.get('name') ?? undefined,
    };
  } catch {
    return {};
  }
}

function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, isRTL } = useLocale();
  const ta = isRTL ? 'right' : 'left';
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.rulesModalLogoWrap}>
            <SalindaPuzzleGameLogo width={220} />
          </View>
          <Text style={styles.modalTitle}>{t('start.rulesTitle')}</Text>
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            <Text style={[styles.rulesSectionTitle, { textAlign: ta }]}>{t('start.goalTitle')}</Text>
            <Text style={[styles.rulesLine, { textAlign: ta }]}>{t('start.rules.goal1', { n: CARDS_PER_PLAYER })}</Text>
            <Text style={[styles.rulesLine, { textAlign: ta }]}>{t('start.rules.goalLimit')}</Text>
            <Text style={[styles.rulesLine, { textAlign: ta }]}>{t('start.rules.goal2')}</Text>
            <Text style={[styles.rulesSectionTitle, { textAlign: ta }]}>{t('start.turnTitle')}</Text>
            <Text style={[styles.rulesLine, { textAlign: ta }]}>{t('start.rules.t1')}</Text>
            <Text style={[styles.rulesLine, { textAlign: ta }]}>{t('start.rules.t2')}</Text>
            <Text style={[styles.rulesLine, { textAlign: ta }]}>{t('start.rules.t3')}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.rulesModalCloseBtn} onPress={onClose}>
            <Text style={styles.rulesModalCloseBtnText}>{t('lobby.rulesModalClose')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function LobbyEntry({
  onBackToChoice,
  defaultPlayerName,
  onOpenCelebrationMockup: _onOpenCelebrationMockup,
}: {
  onBackToChoice?: () => void;
  defaultPlayerName?: string;
  onOpenCelebrationMockup?: () => void;
} = {}) {
  const { t, isRTL } = useLocale();
  const insets = useSafeAreaInsets();
  const safeTop = getScreenSafeTop(insets.top);
  const { createTable, joinTable, joinPrivateTable, refreshTables, tables, error, clearError, setServerUrl } = useMultiplayer();
  const ta = isRTL ? 'right' : 'left';
  const [playerName, setPlayerName] = useState((defaultPlayerName ?? '').slice(0, 7));
  const [privateJoinRoomCode, setPrivateJoinRoomCode] = useState('');
  const [privateJoinCode, setPrivateJoinCode] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [, setCountdownTick] = useState(Date.now());

  useEffect(() => {
    refreshTables();
  }, [refreshTables]);

  useEffect(() => {
    if (error) {
      setIsConnecting(false);
      const timer = setTimeout(clearError, 4000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  useEffect(() => {
    if (!isConnecting) return;
    const timer = setTimeout(() => setIsConnecting(false), 15000);
    return () => clearTimeout(timer);
  }, [isConnecting]);

  useEffect(() => {
    const { roomCode, inviteCode, serverUrl, name } = parseJoinParamsFromUrl();
    if (!roomCode) return;
    setPrivateJoinRoomCode(roomCode.replace(/\D/g, '').slice(0, 4));
    setPrivateJoinCode((inviteCode ?? '').replace(/\D/g, '').slice(0, 6));
    if (name) setPlayerName(name.slice(0, 7));
    if (serverUrl) setServerUrl(serverUrl);
  }, [setServerUrl]);

  useEffect(() => {
    if (playerName.trim().length > 0) return;
    if (!defaultPlayerName) return;
    setPlayerName(defaultPlayerName.slice(0, 7));
  }, [defaultPlayerName, playerName]);

  useEffect(() => {
    const hasCountdown = tables.some((table) => table.countdownEndsAt != null);
    if (!hasCountdown) return;
    const timer = setInterval(() => setCountdownTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [tables]);

  const renderTableStatus = (table: LobbyTableSummary) => {
    if (table.status === 'countdown' || table.status === 'in_game' || table.status === 'full') {
      return t('lobby.tableOccupied');
    }
    return t('lobby.tableWaiting');
  };

  const handleCreateTable = () => {
    if (!playerName.trim()) return;
    setIsConnecting(true);
    createTable(playerName.trim());
  };

  const handleJoinTable = (table: LobbyTableSummary) => {
    if (!playerName.trim()) return;
    if (table.visibility === 'private_locked') {
      setPrivateJoinCode('');
      setPrivateJoinRoomCode(table.roomCode);
      return;
    }
    setIsConnecting(true);
    joinTable(table.roomCode, playerName.trim());
  };

  const handleQuickMatch = () => {
    if (!playerName.trim()) return;
    const candidate = pickQuickMatchTable(tables);
    setIsConnecting(true);
    if (candidate) {
      joinTable(candidate.roomCode, playerName.trim());
      return;
    }
    createTable(playerName.trim());
  };

  const handleSubmitPrivateJoin = () => {
    if (!playerName.trim() || privateJoinCode.length < 6) return;
    setIsConnecting(true);
    joinPrivateTable(privateJoinRoomCode, privateJoinCode, playerName.trim());
  };

  return (
    <View style={{ flex: 1 }}>
      <Modal visible={isConnecting} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.connectingCard}>
            <ActivityIndicator size="large" color="#FDE047" />
            <Text style={styles.connectingTitle}>{t('mp.connectingTitle')}</Text>
            <Text style={styles.connectingBody}>{t('mp.connectingBody')}</Text>
          </View>
        </View>
      </Modal>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingTop: Math.max(safeTop + 12, 60) }]}
        keyboardShouldPersistTaps="handled"
      >
      <LanguageToggle />
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      {onBackToChoice && (
        <TouchableOpacity style={[styles.backBtn, Platform.OS === 'android' ? styles.backBtnAndroid : null]} onPress={onBackToChoice}>
          <Text style={styles.backBtnText}>{t('lobby.backToMode')}</Text>
        </TouchableOpacity>
      )}
      <View style={styles.logoWrap}>
        <SalindaPuzzleGameLogo width={260} />
      </View>
      <Text style={styles.title}>{t('lobby.tablesTitle')}</Text>
      <Text style={styles.subtitle}>{t('lobby.tablesSubtitle')}</Text>
      <TouchableOpacity style={styles.rulesLinkBtn} onPress={() => setRulesOpen(true)}>
        <Text style={styles.rulesLinkText}>׳”׳“׳¨׳›׳” | {t('start.showRules')}</Text>
      </TouchableOpacity>

      <Text style={[styles.label, { alignSelf: 'center', textAlign: 'center' }]}>{t('lobby.yourName')}</Text>
      <View style={styles.inputShell}>
        <TextInput
          style={styles.input}
          value={playerName}
          onChangeText={(value) => setPlayerName(value.slice(0, 7))}
          placeholder={t('lobby.namePlaceholder')}
          placeholderTextColor="#94A3B8"
          textAlign="center"
          maxLength={7}
        />
      </View>
      <TouchableOpacity style={[styles.primaryBtn, !playerName.trim() && styles.primaryBtnDisabled]} onPress={() => {
        if (!playerName.trim()) return;
        setIsConnecting(true);
        createTable(playerName.trim());
      }} disabled={!playerName.trim()}>
        <Text style={styles.primaryBtnText}>{t('lobby.createTable')}</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>{t('lobby.createHint')}</Text>

      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.label, { marginTop: 0 }]}>{t('lobby.availableTables')}</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={refreshTables}>
          <Text style={styles.refreshBtnText}>ג†»</Text>
        </TouchableOpacity>
      </View>
      {tables.length === 0 ? (
        <View style={styles.emptyTablesBox}>
          <Text style={[styles.infoText, { textAlign: 'center' }]}>{t('lobby.noTables')}</Text>
        </View>
      ) : (
        tables.map((table) => {
          const disabled = table.status === 'countdown' || table.status === 'full' || table.status === 'in_game';
          return (
            <View key={table.roomCode} style={styles.tableCard}>
              <View style={styles.tableTopRow}>
                <Text style={styles.tableCode}>{table.roomCode}</Text>
                <Text style={[styles.tableBadge, table.visibility === 'private_locked' && styles.tableBadgePrivate]}>
                  {table.visibility === 'private_locked' ? t('lobby.tablePrivate') : t('lobby.tablePublic')}
                </Text>
              </View>
              <Text style={[styles.tableHost, { textAlign: ta }]}>{table.hostName}</Text>
              <Text style={[styles.tableMeta, { textAlign: ta }]}>{t('lobby.tablePlayers', { count: table.currentParticipants, max: table.maxParticipants })}</Text>
              <Text style={[styles.tableMeta, { textAlign: ta }]}>{renderTableStatus(table)}</Text>
              {table.status === 'countdown' && (
                <Text style={[styles.tableMetaAccent, styles.tableCountdownNotice, { textAlign: ta }]}>
                  {t('lobby.startingSoonBanner')}
                </Text>
              )}
              {table.hasRandomJoiner && <Text style={[styles.tableMetaAccent, { textAlign: ta }]}>{t('lobby.randomJoiner')}</Text>}
              <TouchableOpacity
                style={[styles.tableActionBtn, table.visibility === 'private_locked' && styles.tableActionBtnPrivate, (disabled || !playerName.trim()) && styles.primaryBtnDisabled]}
                disabled={disabled || !playerName.trim()}
                onPress={() => {
                  if (table.visibility === 'private_locked') {
                    setPrivateJoinRoomCode(table.roomCode);
                    return;
                  }
                  setIsConnecting(true);
                  joinTable(table.roomCode, playerName.trim());
                }}
              >
                <Text style={[styles.tableActionBtnText, table.visibility === 'private_locked' && styles.tableActionBtnTextOnDark]}>
                  {disabled ? renderTableStatus(table) : table.visibility === 'private_locked' ? t('lobby.enterCode') : t('lobby.joinTable')}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}

      {privateJoinRoomCode.length > 0 && (
        <View style={styles.privateJoinCard}>
          <Text style={[styles.label, { marginTop: 0 }]}>{t('lobby.inviteCodeLabel')}</Text>
          <Text style={styles.privateJoinRoomCode}>{privateJoinRoomCode}</Text>
          <View style={styles.inputShell}>
            <TextInput
              style={styles.input}
              value={privateJoinCode}
              onChangeText={(value) => setPrivateJoinCode(value.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('lobby.inviteCodePlaceholder')}
              placeholderTextColor="#94A3B8"
              textAlign="center"
              maxLength={6}
              keyboardType="number-pad"
            />
          </View>
          <TouchableOpacity
            style={[styles.primaryBtn, (!playerName.trim() || privateJoinCode.length < 6) && styles.primaryBtnDisabled]}
            onPress={() => {
              if (!playerName.trim() || privateJoinCode.length < 6) return;
              setIsConnecting(true);
              joinPrivateTable(privateJoinRoomCode, privateJoinCode, playerName.trim());
            }}
            disabled={!playerName.trim() || privateJoinCode.length < 6}
          >
            <Text style={styles.primaryBtnText}>{t('lobby.joinTable')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      </ScrollView>
    </View>
  );
}


export function LobbyScreen({
  onOpenCelebrationMockup: _onOpenCelebrationMockup,
  onStartLocalBotGame,
}: {
  onOpenCelebrationMockup?: () => void;
  onStartLocalBotGame: (difficulty: 'easy' | 'full', settings: HostGameSettings) => void;
}) {
  const { t, isRTL } = useLocale();
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveLayout();
  const safeTop = getScreenSafeTop(insets.top);
  const {
    roomCode,
    currentInviteCode,
    currentTableVisibility,
    players,
    tables,
    currentRoomTable,
    isHost,
    configureTable,
    startTableCountdown,
    leaveRoom,
    error,
    clearError,
    toast,
    clearToast,
    serverUrl,
  } = useMultiplayer();
  const ta = isRTL ? 'right' : 'left';
  // Android's forceRTL already flips 'row'; iOS needs manual row-reverse.
  const isRtlNeedsFlip = isRTL && Platform.OS === 'web';
  const currentTable = currentRoomTable ?? tables.find((table) => table.roomCode === roomCode) ?? null;
  const [difficulty, setDifficulty] = useState<'easy' | 'full'>('full');
  const [enabledOperators, setEnabledOperators] = useState<Operation[]>(['+', '-', 'x', '÷' as Operation]);
  const [showFractions, setShowFractions] = useState(true);
  const [fractionKinds, setFractionKinds] = useState<Fraction[]>([...ALL_FRACTION_KINDS]);
  const [showPossibleResults, setShowPossibleResults] = useState(true);
  const [showSolveExercise, setShowSolveExercise] = useState(true);
  const [timerSetting, setTimerSetting] = useState<HostGameSettings['timerSetting']>('off');
  const [timerCustomSeconds, setTimerCustomSeconds] = useState(60);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium');
  const [botDisplayName, setBotDisplayName] = useState('');
  const [visibility, setVisibility] = useState<LobbyTableVisibility>('public');
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [manualWebInviteBase, setManualWebInviteBase] = useState('');
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(WEB_INVITE_BASE_STORAGE_KEY)
      .then((value) => {
        if (!cancelled && value?.trim()) setManualWebInviteBase(value.trim());
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 4000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  useEffect(() => {
    if (currentTableVisibility) {
      setVisibility(currentTableVisibility);
    }
  }, [currentTableVisibility]);

  useEffect(() => {
    const value = manualWebInviteBase.trim();
    const timer = setTimeout(() => {
      if (value) void AsyncStorage.setItem(WEB_INVITE_BASE_STORAGE_KEY, value);
      else void AsyncStorage.removeItem(WEB_INVITE_BASE_STORAGE_KEY);
    }, 300);
    return () => clearTimeout(timer);
  }, [manualWebInviteBase]);

  useEffect(() => {
    if (!copyFeedback) return;
    const timer = setTimeout(() => setCopyFeedback(null), 2500);
    return () => clearTimeout(timer);
  }, [copyFeedback]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(clearToast, 6000);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  const configuredWebBase = getInviteWebBaseUrl().replace(/\/$/, '');
  const inviteSuffix = useMemo(() => {
    if (!roomCode) return '';
    return `?${guestInviteSearchParams(roomCode, serverUrl, currentInviteCode).toString()}`;
  }, [roomCode, serverUrl, currentInviteCode]);
  const effectiveWebBase = (manualWebInviteBase.trim() || configuredWebBase).replace(/\/$/, '');
  const inviteLink = useMemo(() => {
    if (!roomCode || !effectiveWebBase) return '';
    return `${effectiveWebBase}${inviteSuffix}`;
  }, [roomCode, effectiveWebBase, inviteSuffix]);
  const shareRoomMessage = useMemo(() => {
    return buildRoomShareMessage({
      t,
      roomCode,
      inviteCode: currentInviteCode,
      inviteLink,
      inviteSuffix,
    });
  }, [currentInviteCode, inviteLink, inviteSuffix, roomCode, t]);
  const privateInviteShareMessage = useMemo(() => {
    return buildPrivateInviteShareMessage({
      t,
      roomCode,
      inviteCode: currentInviteCode,
      inviteLink,
      inviteSuffix,
    });
  }, [currentInviteCode, inviteLink, inviteSuffix, roomCode, t]);
  const humanCount = players.filter((player) => !player.isBot).length;
  const roomCapacity = currentTable?.maxParticipants ?? (isHost ? maxParticipants : DEFAULT_SUMMARY_MAX_PARTICIPANTS);
  const configured = (!isHost && !!roomCode) || configSaved || currentTable?.configuredDifficulty != null;
  const shouldRightAlignLeaveButton = Platform.OS === 'android' || (!configured && isRTL);
  const lobbyShellWidth = Platform.OS === 'web'
    ? Math.min(WEB_GAME_PLAYFIELD_MAX_WIDTH, responsive.width)
    : responsive.width;
  // Keep Hebrew text direction in the panel without pushing the whole setup UI to the right.
  const rtlDirection = isRTL && Platform.OS === 'web' ? ({ direction: 'rtl' } as const) : null;
  const setupPanelStyle = [styles.setupPanel, isRTL ? rtlDirection : null];
  const setupLabelStyle = [
    styles.label,
    styles.setupFieldLabel,
    isRTL ? styles.setupFieldLabelRtl : null,
  ];
  const setupPlayersLabelStyle = isRTL ? [styles.label, styles.labelRtl] : styles.label;
  const setupRowStyle = [styles.row, styles.setupFieldRow];
  const setupCountRowStyle = [styles.countRow, styles.setupFieldRow];
  const setupChipWrapStyle = [styles.chipWrap, styles.setupFieldRow];
  const setupHintStyle = [
    styles.hint,
    styles.setupFieldHint,
    isRTL ? styles.setupFieldHintRtl : null,
  ];
  const setupSecondaryBtnStyle = [styles.secondaryBtn, styles.setupActionBtn];
  const setupPrimaryBtnStyle = [styles.primaryBtn, styles.setupActionBtn];
  const setupTimerGridStyle = [styles.timerGrid, styles.setupFieldRow];
  const setupTimerCustomRowStyle = [styles.timerCustomRow, styles.setupFieldRow];
  const minuteTimerStepper = {
    key: 'min',
    label: t('start.timerPickerMin'),
    value: Math.floor(timerCustomSeconds / 60),
    decrement: () => setTimerCustomSeconds((s) => Math.max(1, s - 60)),
    increment: () => setTimerCustomSeconds((s) => Math.min(600, s + 60)),
  };
  const secondTimerStepper = {
    key: 'sec',
    label: t('start.timerPickerSec'),
    value: String(timerCustomSeconds % 60).padStart(2, '0'),
    decrement: () => setTimerCustomSeconds((s) => Math.max(1, Math.floor(s / 60) * 60 + Math.max(0, (s % 60) - 5))),
    increment: () => setTimerCustomSeconds((s) => Math.min(600, Math.floor(s / 60) * 60 + Math.min(55, (s % 60) + 5))),
  };
  const customTimerSteppers = [minuteTimerStepper, secondTimerStepper];
  const roomStatusCard = useMemo(() => {
    if (!configured || !currentTable) return null;
    if (humanCount < 2) {
      return {
        accentStyle: styles.infoBoxMuted,
        primary: t('lobby.waitingForPlayer'),
        secondary: t('lobby.minPlayers'),
      };
    }
    if (isHost) {
      return {
        accentStyle: styles.infoBoxReady,
        primary: t('lobby.roomReady'),
        secondary: t('lobby.startGame'),
      };
    }
    return {
      accentStyle: styles.infoBoxMuted,
      primary: t('lobby.waitHost'),
      secondary: t('lobby.waitingRoomHint'),
    };
  }, [configured, currentTable, humanCount, isHost, t]);

  const buildGameSettings = (): HostGameSettings => ({
    diceMode: '3',
    showFractions,
    showPossibleResults,
    showSolveExercise,
    mathRangeMax: difficulty === 'easy' ? 12 : 25,
    enabledOperators: [...enabledOperators],
    allowNegativeTargets: false,
    fractionKinds: showFractions ? (fractionKinds.length > 0 ? fractionKinds : [...ALL_FRACTION_KINDS]) : [],
    difficultyStage: difficulty === 'easy' ? 'A' : 'H',
    abVariant: difficulty === 'easy' ? 'control_0_12_plus' : 'variant_0_15_plus',
    timerSetting,
    timerCustomSeconds: timerSetting === 'custom' ? timerCustomSeconds : 60,
    botDifficulty,
    ...(botDisplayName.trim() ? { botDisplayName: botDisplayName.trim().slice(0, 24) } : {}),
  });

  const draftSummaryItems = useMemo(
    () =>
      buildLobbySummaryItems(
        {
          visibility,
          maxParticipants,
          configuredDifficulty: difficulty,
          showFractions,
          fractionKinds,
          showPossibleResults,
          showSolveExercise,
          timerSetting,
          timerCustomSeconds: timerSetting === 'custom' ? timerCustomSeconds : 60,
        },
        t,
        false,
      ),
    [
      difficulty,
      fractionKinds,
      maxParticipants,
      showFractions,
      showPossibleResults,
      showSolveExercise,
      t,
      timerCustomSeconds,
      timerSetting,
      visibility,
    ],
  );
  const configuredSummaryItems = useMemo(() => {
    if (!currentTable) return [];
    return buildLobbySummaryItems(currentTable, t, true);
  }, [currentTable, t]);

  const handleSaveConfiguration = () => {
    configureTable({
      visibility,
      maxParticipants,
      difficulty,
      gameSettings: buildGameSettings(),
    });
    setConfigSaved(true);
  };

  const autoStartFiredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isHost) return;
    if (currentTable?.configuredDifficulty == null) return;
    if (humanCount < 2 || humanCount !== roomCapacity) {
      autoStartFiredRef.current = null;
      return;
    }
    const autoStartKey = `${roomCode ?? 'room'}:${roomCapacity}:${humanCount}`;
    if (autoStartFiredRef.current === autoStartKey) return;
    autoStartFiredRef.current = autoStartKey;
    startTableCountdown();
  }, [
    currentTable?.configuredDifficulty,
    humanCount,
    isHost,
    roomCapacity,
    roomCode,
    startTableCountdown,
  ]);

  const handleShareRoomCode = async () => {
    if (!shareRoomMessage) return;
    try {
      await Share.share({ message: shareRoomMessage });
    } catch {
      // ignore user cancel / unavailable share target
    }
  };

  const handleCopyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await Clipboard.setStringAsync(roomCode);
      setCopyFeedback(null);
    } catch {
      setCopyFeedback(t('lobby.copyFail'));
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: Math.max(safeTop + 12, 60) }]}
    >
      <View style={[styles.contentFrame, Platform.OS === 'web' ? { width: lobbyShellWidth } : null]}>
        <LanguageToggle />
        <TouchableOpacity style={[styles.backBtn, shouldRightAlignLeaveButton ? styles.backBtnAndroid : null]} onPress={leaveRoom}>
          <Text style={styles.backBtnText}>{t('lobby.leaveRoom')}</Text>
        </TouchableOpacity>
        <View style={styles.logoWrap}>
          <SalindaPuzzleGameLogo width={260} />
        </View>
        <Text style={styles.title}>{configured ? t('lobby.waitingRoomTitle') : t('lobby.configureTitle')}</Text>
        <Text style={styles.subtitle}>{configured ? t('lobby.waitingRoomHint') : t('lobby.configureHint')}</Text>

        {!configured && isHost && (
          <View testID="lobby-config-panel" style={setupPanelStyle}>
          <Text testID="lobby-config-number-range-label" style={setupLabelStyle}>{t('start.wheel.numberRange')}</Text>
          <View testID="lobby-config-number-range-row" style={setupRowStyle}>
            <TouchableOpacity style={[styles.optionBtn, difficulty === 'full' && styles.optionBtnActive]} onPress={() => setDifficulty('full')}>
              <Text style={[styles.optionBtnText, difficulty === 'full' && styles.optionBtnTextActive]}>0-25</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionBtn, difficulty === 'easy' && styles.optionBtnActive]} onPress={() => setDifficulty('easy')}>
              <Text style={[styles.optionBtnText, difficulty === 'easy' && styles.optionBtnTextActive]}>0-12</Text>
            </TouchableOpacity>
          </View>

          <Text style={setupLabelStyle}>{t('lobby.privateToggle')}</Text>
          <View style={setupRowStyle}>
            <TouchableOpacity style={[styles.optionBtn, visibility === 'public' && styles.optionBtnActive]} onPress={() => setVisibility('public')}>
              <Text style={[styles.optionBtnText, visibility === 'public' && styles.optionBtnTextActive]}>{t('lobby.tablePublic')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionBtn, visibility === 'private_locked' && styles.optionBtnActive]} onPress={() => setVisibility('private_locked')}>
              <Text style={[styles.optionBtnText, visibility === 'private_locked' && styles.optionBtnTextActive]}>{t('lobby.tablePrivate')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={setupHintStyle}>{t('lobby.privateHint')}</Text>

          <Text testID="lobby-config-max-participants-label" style={setupLabelStyle}>{t('lobby.maxParticipants')}</Text>
          <View testID="lobby-config-max-participants-row" style={setupCountRowStyle}>
            {Array.from({ length: 3 }, (_, index) => index + 2).map((count) => (
              <TouchableOpacity key={count} style={[styles.countBtn, maxParticipants === count && styles.countBtnActive]} onPress={() => setMaxParticipants(count)}>
                <Text style={[styles.countBtnText, maxParticipants === count && styles.countBtnTextActive]}>{count}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity testID="lobby-config-advanced-toggle" style={setupSecondaryBtnStyle} onPress={() => setShowAdvanced((value) => !value)}>
            <Text style={styles.secondaryBtnText}>{showAdvanced ? t('lobby.advancedToggleHide') : t('lobby.advancedToggleShow')}</Text>
          </TouchableOpacity>

          {showAdvanced && (
            <>
              <Text style={setupLabelStyle}>{t('lobby.fractions')}</Text>
              <View style={setupRowStyle}>
                <TouchableOpacity style={[styles.optionBtn, showFractions && styles.optionBtnActive]} onPress={() => setShowFractions(true)}>
                  <Text style={[styles.optionBtnText, showFractions && styles.optionBtnTextActive]}>{t('lobby.withFractions')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.optionBtn, !showFractions && styles.optionBtnActive]} onPress={() => setShowFractions(false)}>
                  <Text style={[styles.optionBtnText, !showFractions && styles.optionBtnTextActive]}>{t('lobby.noFractions')}</Text>
                </TouchableOpacity>
              </View>
              {showFractions && (
                <View style={setupChipWrapStyle}>
                  {ALL_FRACTION_KINDS.map((kind) => {
                    const active = fractionKinds.includes(kind);
                    return (
                      <TouchableOpacity
                        key={kind}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => {
                          setFractionKinds((current) => {
                            if (!current.includes(kind)) return [...current, kind];
                            if (current.length <= 1) return current;
                            return current.filter((value) => value !== kind);
                          });
                        }}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{kind}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={setupLabelStyle}>{t('lobby.possibleResults')}</Text>
              <View style={setupRowStyle}>
                <TouchableOpacity style={[styles.optionBtn, showPossibleResults && styles.optionBtnActive]} onPress={() => setShowPossibleResults(true)}>
                  <Text style={[styles.optionBtnText, showPossibleResults && styles.optionBtnTextActive]}>{t('lobby.show')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.optionBtn, !showPossibleResults && styles.optionBtnActive]} onPress={() => setShowPossibleResults(false)}>
                  <Text style={[styles.optionBtnText, !showPossibleResults && styles.optionBtnTextActive]}>{t('lobby.hide')}</Text>
                </TouchableOpacity>
              </View>

              <Text style={setupLabelStyle}>{t('lobby.solveExercise')}</Text>
              <View style={setupRowStyle}>
                <TouchableOpacity style={[styles.optionBtn, showSolveExercise && styles.optionBtnActive]} onPress={() => setShowSolveExercise(true)}>
                  <Text style={[styles.optionBtnText, showSolveExercise && styles.optionBtnTextActive]}>{t('lobby.on')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.optionBtn, !showSolveExercise && styles.optionBtnActive]} onPress={() => setShowSolveExercise(false)}>
                  <Text style={[styles.optionBtnText, !showSolveExercise && styles.optionBtnTextActive]}>{t('lobby.off')}</Text>
                </TouchableOpacity>
              </View>

              <Text style={setupLabelStyle}>{t('lobby.turnTimer')}</Text>
              <View style={setupTimerGridStyle}>
                {(['off', '15', '60', '90', 'custom'] as const).map((value) => (
                  <TouchableOpacity
                    key={value}
                    style={[styles.timerChip, timerSetting === value && styles.optionBtnActive]}
                    onPress={() => setTimerSetting(value)}
                  >
                    <Text style={[styles.optionBtnText, timerSetting === value && styles.optionBtnTextActive]}>
                      {value === 'off'
                        ? t('lobby.timerOff')
                        : value === '15'
                          ? t('lobby.timerSec', { n: 15 })
                          : value === '60'
                            ? t('lobby.timerMin')
                            : value === '90'
                              ? t('lobby.timerMinHalf')
                              : t('lobby.timerCustom')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {timerSetting === 'custom' && (
                <View style={setupTimerCustomRowStyle}>
                  {customTimerSteppers.map((stepper) => (
                    <View key={stepper.key} style={styles.timerStepper}>
                      <Text style={styles.timerStepLabel}>{stepper.label}</Text>
                      <View style={styles.timerStepRow}>
                        <TouchableOpacity onPress={stepper.decrement} style={styles.timerStepBtn}>
                          <Text style={styles.timerStepBtnTxt}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.timerStepVal}>{stepper.value}</Text>
                        <TouchableOpacity onPress={stepper.increment} style={styles.timerStepBtn}>
                          <Text style={styles.timerStepBtnTxt}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          <View style={styles.setupSummaryWrap}>
            <LobbySummarySection items={draftSummaryItems} isRTL={isRTL} t={t} />
          </View>
          <TouchableOpacity style={setupPrimaryBtnStyle} onPress={handleSaveConfiguration}>
            <Text style={styles.primaryBtnText}>{t('lobby.continueToRoom')}</Text>
          </TouchableOpacity>
          </View>
        )}

        {configured && (
          <>
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>{t('lobby.roomCodeLabel')}</Text>
            <Text testID="room-code" style={styles.codeValue}>{roomCode}</Text>
            <Text style={[styles.codeHint, { textAlign: ta }]}>{t('lobby.shareCodeHint')}</Text>
            <View style={styles.inviteActionsRow}>
              <TouchableOpacity style={[styles.inviteBtn, !shareRoomMessage && styles.inviteBtnDisabled]} onPress={handleShareRoomCode} disabled={!shareRoomMessage}>
                <Text style={styles.inviteBtnText}>{t('lobby.share')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.inviteBtn, styles.inviteCopyBtn, !roomCode && styles.inviteBtnDisabled]} onPress={handleCopyRoomCode} disabled={!roomCode}>
                <Text style={[styles.inviteBtnText, styles.inviteCopyBtnLabel]}>{t('lobby.copy')}</Text>
              </TouchableOpacity>
            </View>
            {copyFeedback && <Text style={styles.copyFeedbackText}>{copyFeedback}</Text>}
            {visibility === 'private_locked' && currentInviteCode ? (
              <View style={styles.inviteBox}>
                <Text style={[styles.inviteLabel, { textAlign: ta }]}>{t('lobby.shareInviteCode')}</Text>
                <Text style={styles.privateInviteCode}>{currentInviteCode}</Text>
                <TextInput
                  style={styles.input}
                  value={manualWebInviteBase}
                  onChangeText={setManualWebInviteBase}
                  placeholder={configuredWebBase || 'https://your-site...'}
                  placeholderTextColor="#6B7280"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text selectable style={styles.inviteLink}>{inviteLink || inviteSuffix}</Text>
                <View style={styles.inviteActionsRow}>
                  <TouchableOpacity
                    style={[styles.inviteBtn, !privateInviteShareMessage && styles.inviteBtnDisabled]}
                    disabled={!privateInviteShareMessage}
                    onPress={async () => {
                      if (!privateInviteShareMessage) return;
                      try {
                        await Share.share({ message: privateInviteShareMessage });
                      } catch {
                        // ignore user cancel / unavailable share target
                      }
                    }}
                  >
                    <Text style={styles.inviteBtnText}>{t('lobby.share')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.inviteBtn, styles.inviteCopyBtn]} onPress={async () => {
                    await Clipboard.setStringAsync(currentInviteCode);
                    setCopyFeedback(t('lobby.inviteCodeCopied'));
                  }}>
                    <Text style={[styles.inviteBtnText, styles.inviteCopyBtnLabel]}>{t('lobby.copy')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>

          {toast ? (
            <View style={styles.toastBox}>
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          ) : null}

          {roomStatusCard ? (
            <View style={[styles.infoBox, roomStatusCard.accentStyle]}>
              <Text style={[styles.infoTextStrong, { textAlign: ta }]}>{roomStatusCard.primary}</Text>
              <Text style={[styles.infoText, { textAlign: ta }]}>{roomStatusCard.secondary}</Text>
            </View>
          ) : null}

          <LobbySummarySection items={configuredSummaryItems} isRTL={isRTL} t={t} />

          <Text testID="lobby-players-in-room-label" style={setupPlayersLabelStyle}>
            {t('lobby.playersInRoom', { count: players.length, max: roomCapacity })}
          </Text>
          {players.map((player) => (
            <View key={player.id} style={styles.playerRow}>
              <Text testID={player.isHost !== isHost ? 'opponent-name' : 'player-name'} style={styles.playerName}>{player.name}</Text>
              {player.isHost && <Text style={styles.hostBadge}>{t('lobby.host')}</Text>}
              {!player.isConnected && <Text style={styles.disconnectedBadge}>{t('lobby.disconnected')}</Text>}
            </View>
          ))}

          {isHost && humanCount >= 2 && (
            <TouchableOpacity style={styles.primaryBtn} onPress={startTableCountdown}>
              <Text style={styles.primaryBtnText}>{t('lobby.startGame')}</Text>
            </TouchableOpacity>
          )}

          {isHost && humanCount === 1 && (
            <View style={styles.botStartBox}>
              <Text style={[styles.botOfferInlineText, { textAlign: ta }]}>{t('lobby.botOfferInline')}</Text>
              <Text style={[styles.label, styles.botDifficultyLabel]}>{t('lobby.botDifficultyLabel')}</Text>
              <View style={styles.botDifficultyRow}>
                {([
                  ['easy', t('start.botEasy')],
                  ['medium', t('start.botMedium')],
                  ['hard', t('start.botHard')],
                ] as const).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    testID={`bot-difficulty-${key}`}
                    style={[styles.timerChip, botDifficulty === key && styles.optionBtnActive]}
                    onPress={() => setBotDifficulty(key)}
                  >
                    <Text style={[styles.optionBtnText, botDifficulty === key && styles.optionBtnTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.secondaryPrimaryBtn}
                onPress={() => onStartLocalBotGame(difficulty, buildGameSettings())}
              >
                <Text style={styles.secondaryPrimaryBtnText}>{t('lobby.startBotGame')}</Text>
              </TouchableOpacity>
            </View>
          )}
          </>
        )}

        {error && error !== t('game.countdownAlreadyRunning') && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {error === t('game.countdownAlreadyRunning') && (
          <View style={styles.countdownBanner}>
            <SlindaCoin size={52} spin />
            <Text style={styles.countdownBannerText}>
              {t('lobby.gameStartsSoon')}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: ROOT_BG },
  container: { padding: 24, paddingTop: 60, paddingBottom: 44, alignItems: 'center' },
  contentFrame: { width: '100%', alignSelf: 'center' },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, alignSelf: 'stretch', justifyContent: 'center' },
  langLabel: { color: TEXT_MUTE, fontSize: 12 },
  langBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: SURFACE_SOFT, borderWidth: 1, borderColor: GOLD_LINE },
  langBtnActive: { backgroundColor: ACTION_GOLD, borderColor: GOLD_LINE_STRONG },
  langBtnText: { color: TEXT_MAIN, fontWeight: '700', fontSize: 12 },
  langBtnTextActive: { color: '#1a1207' },
  backBtn: { alignSelf: 'flex-start', marginBottom: 16, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: SURFACE_SOFT, borderWidth: 1, borderColor: GOLD_LINE },
  backBtnAndroid: { alignSelf: 'flex-end' },
  backBtnText: { color: ACTION_GOLD, fontSize: 14, fontWeight: '600' },
  logoWrap: { alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '800', color: ACTION_GOLD, marginBottom: 8, alignSelf: 'stretch', textAlign: 'center' },
  subtitle: { color: TEXT_DIM, fontSize: 14, marginBottom: 18, alignSelf: 'stretch', textAlign: 'center' },
  label: { color: TEXT_MAIN, fontSize: 14, fontWeight: '600', alignSelf: 'stretch', marginTop: 16, marginBottom: 8 },
  labelRtl: { textAlign: 'right', writingDirection: 'rtl' },
  setupPanel: { width: '100%', alignItems: 'center' },
  setupFieldLabel: { width: '100%', maxWidth: 420, alignSelf: 'center', textAlign: 'center' },
  setupFieldLabelRtl: { writingDirection: 'rtl' },
  inputShell: { width: '100%', backgroundColor: ACTION_GOLD_DARK, borderRadius: 18, padding: 2, marginBottom: 8 },
  input: { width: '100%', backgroundColor: 'rgba(0,0,0,0.42)', borderWidth: 1, borderColor: 'rgba(255,240,180,0.16)', borderRadius: 15, paddingHorizontal: 16, paddingVertical: 12, color: TEXT_MAIN, fontSize: 16, fontWeight: '700' },
  primaryBtn: { backgroundColor: ACTION_GOLD, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, width: '100%', alignItems: 'center', marginTop: 12 },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#1a1207', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { width: '100%', marginTop: 12, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14, borderWidth: 2, borderColor: '#A855F7', backgroundColor: 'rgba(168,85,247,0.18)', alignItems: 'center' },
  secondaryBtnText: { color: '#DDD6FE', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  hint: { color: TEXT_MUTE, fontSize: 12, marginTop: 4, marginBottom: 8, alignSelf: 'stretch', textAlign: 'right' },
  setupFieldHint: { width: '100%', maxWidth: 420, alignSelf: 'center', textAlign: 'center' },
  setupFieldHintRtl: { writingDirection: 'rtl' },
  setupFieldRow: { width: '100%', maxWidth: 420, alignSelf: 'center', justifyContent: 'center' },
  setupActionBtn: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  sectionHeaderRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  refreshBtn: { backgroundColor: SURFACE_SOFT, borderWidth: 1, borderColor: GOLD_LINE, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  refreshBtnText: { color: ACTION_GOLD, fontSize: 16, fontWeight: '700' },
  emptyTablesBox: { width: '100%', padding: 14, borderRadius: 16, backgroundColor: SURFACE, borderWidth: 1, borderColor: GOLD_LINE },
  tableCard: { width: '100%', backgroundColor: SURFACE, borderWidth: 1, borderColor: GOLD_LINE, borderRadius: 16, padding: 14, marginBottom: 10 },
  tableTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tableCode: { color: TEXT_MAIN, fontSize: 24, fontWeight: '800', letterSpacing: 3 },
  tableBadge: { color: '#2f2110', backgroundColor: 'rgba(245,210,122,0.22)', borderWidth: 1, borderColor: 'rgba(245,210,122,0.24)', fontSize: 11, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  tableBadgePrivate: { backgroundColor: 'rgba(163,71,5,0.34)', borderColor: 'rgba(245,210,122,0.16)', color: '#f7e7b3' },
  tableHost: { color: TEXT_MAIN, fontSize: 16, fontWeight: '700', marginTop: 10 },
  tableMeta: { color: TEXT_DIM, fontSize: 13, marginTop: 4 },
  tableMetaAccent: { color: ACTION_GOLD, fontSize: 12, fontWeight: '700', marginTop: 4 },
  tableCountdownNotice: { lineHeight: 18 },
  tableActionBtn: { marginTop: 12, backgroundColor: ACTION_GOLD, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  tableActionBtnPrivate: { backgroundColor: ACTION_AMBER },
  tableActionBtnText: { color: '#1a1207', fontSize: 14, fontWeight: '700' },
  tableActionBtnTextOnDark: { color: '#F8FAFC' },
  privateJoinCard: { width: '100%', marginTop: 8, padding: 14, borderRadius: 16, backgroundColor: SURFACE_ALT, borderWidth: 1, borderColor: GOLD_LINE },
  privateJoinRoomCode: { color: '#FDE68A', fontSize: 26, fontWeight: '800', letterSpacing: 4, textAlign: 'center', marginBottom: 6 },
  row: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 8 },
  rowAndroidRtl: { flexDirection: 'row-reverse' },
  optionBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: SURFACE_SOFT, borderWidth: 1, borderColor: GOLD_LINE, alignItems: 'center' },
  optionBtnActive: { backgroundColor: brand.gold },
  optionBtnText: { color: TEXT_DIM, fontWeight: '700' },
  optionBtnTextActive: { color: '#1a1207' },
  countRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', justifyContent: 'center' },
  countBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: SURFACE_SOFT, borderWidth: 1, borderColor: GOLD_LINE, alignItems: 'center', justifyContent: 'center' },
  countBtnActive: { backgroundColor: brand.gold },
  countBtnText: { color: TEXT_MAIN, fontWeight: '700', fontSize: 16 },
  countBtnTextActive: { color: '#1a1207' },
  timerGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', gap: 8, marginBottom: 4, justifyContent: 'center' },
  timerChip: { flexGrow: 1, flexBasis: '45%', paddingVertical: 10, borderRadius: 10, backgroundColor: SURFACE_SOFT, borderWidth: 1, borderColor: GOLD_LINE, alignItems: 'center' },
  timerCustomRow: { flexDirection: 'row', justifyContent: 'center', gap: 32, paddingVertical: 12, paddingHorizontal: 8 },
  timerStepper: { alignItems: 'center', gap: 6 },
  timerStepLabel: { color: TEXT_DIM, fontSize: 11, fontWeight: '700' },
  timerStepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timerStepBtn: { backgroundColor: SURFACE_SOFT, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: GOLD_LINE },
  timerStepBtnTxt: { color: TEXT_MAIN, fontSize: 18, fontWeight: '700' },
  timerStepVal: { color: TEXT_MAIN, fontSize: 24, fontWeight: '900', minWidth: 36, textAlign: 'center' },
  chipWrap: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 8 },
  chipWrapAndroidRtl: { flexDirection: 'row-reverse', justifyContent: 'flex-end' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: GOLD_LINE, backgroundColor: SURFACE_SOFT },
  chipActive: { borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.16)' },
  chipText: { color: TEXT_MAIN, fontWeight: '700' },
  chipTextActive: { color: '#FEF3C7' },
  codeBox: { width: '100%', backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: GOLD_LINE_STRONG },
  codeLabel: { color: brand.gold, fontSize: 12, marginBottom: 4 },
  codeValue: { fontSize: 36, fontWeight: '800', color: TEXT_MAIN, letterSpacing: 8 },
  codeHint: { color: TEXT_MUTE, fontSize: 11, marginTop: 8 },
  inviteBox: { marginTop: 12, width: '100%', backgroundColor: SURFACE_SOFT, borderRadius: 12, borderWidth: 1, borderColor: GOLD_LINE, padding: 10 },
  inviteLabel: { color: ACTION_GOLD, fontSize: 12, marginBottom: 6 },
  privateInviteCode: { color: '#FDE68A', fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: 4, marginBottom: 8 },
  inviteLink: { color: TEXT_MAIN, fontSize: 12, textAlign: 'left', marginTop: 8 },
  inviteActionsRow: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  inviteBtn: { backgroundColor: ACTION_GOLD, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  inviteBtnDisabled: { opacity: 0.5 },
  inviteCopyBtn: { backgroundColor: ACTION_AMBER },
  inviteBtnText: { color: '#1a1207', fontWeight: '700', fontSize: 12 },
  inviteCopyBtnLabel: { color: '#F8FAFC' },
  copyFeedbackText: { color: '#A7F3D0', fontSize: 11, marginTop: 8, textAlign: 'center' },
  playerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: 'rgba(0,0,0,0.24)', borderRadius: 12, borderWidth: 1, borderColor: GOLD_LINE, padding: 12, marginBottom: 6 },
  playerName: { color: TEXT_MAIN, fontSize: 16, flex: 1, textAlign: 'right' },
  hostBadge: { backgroundColor: brand.gold, color: '#111827', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  disconnectedBadge: { color: '#EF4444', fontSize: 10 },
  botStartBox: { width: '100%', marginTop: 8 },
  botOfferInlineText: { color: '#DDD6FE', fontSize: 13, lineHeight: 20, marginBottom: 10 },
  botDifficultyLabel: { marginTop: 0, marginBottom: 8, textAlign: 'center', alignSelf: 'center', width: '100%' },
  botDifficultyRow: { flexDirection: 'row', gap: 8, width: '100%', justifyContent: 'center', marginBottom: 2 },
  secondaryPrimaryBtn: { backgroundColor: ACTION_AMBER, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, marginTop: 12, alignItems: 'center', width: '100%' },
  secondaryPrimaryBtnText: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  setupSummaryWrap: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  summarySection: { width: '100%', marginTop: 16, marginBottom: 4 },
  summarySectionTitle: { color: TEXT_MAIN, fontSize: 14, fontWeight: '700', marginBottom: 8, alignSelf: 'stretch' },
  summarySectionTitleRtl: { writingDirection: 'rtl' },
  summaryGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 150, borderRadius: 14, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 12 },
  summaryCardTitle: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  summaryCardValue: { fontSize: 18, fontWeight: '800', lineHeight: 22 },
  summaryCardDetail: { fontSize: 12, fontWeight: '600', lineHeight: 18, marginTop: 8 },
  errorBox: { marginTop: 16, padding: 12, backgroundColor: 'rgba(127,29,29,0.4)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(248,113,113,0.24)', width: '100%' },
  errorText: { color: '#FCA5A5', textAlign: 'right' },
  infoBox: { width: '100%', borderRadius: 12, borderWidth: 1, borderColor: GOLD_LINE, backgroundColor: 'rgba(125, 86, 14, 0.2)', paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 },
  infoBoxMuted: { borderColor: 'rgba(245,210,122,0.12)', backgroundColor: SURFACE_SOFT },
  infoBoxReady: { borderColor: GOLD_LINE, backgroundColor: 'rgba(125, 86, 14, 0.24)' },
  infoBoxCountdown: { borderColor: 'rgba(245,210,122,0.24)', backgroundColor: 'rgba(163,71,5,0.22)' },
  infoText: { color: TEXT_MAIN, fontSize: 12, textAlign: 'right' },
  infoTextStrong: { color: '#F8FAFC', fontSize: 14, fontWeight: '800', textAlign: 'right', marginBottom: 4 },
  toastBox: { width: '100%', borderRadius: 12, borderWidth: 1, borderColor: GOLD_LINE, backgroundColor: SURFACE_ALT, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 },
  toastText: { color: ACTION_GOLD, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  countdownBanner: { width: '100%', borderRadius: 16, borderWidth: 2, borderColor: 'rgba(34,197,94,0.7)', backgroundColor: 'rgba(20,83,45,0.85)', paddingVertical: 20, paddingHorizontal: 16, marginTop: 16, alignItems: 'center', gap: 12 },
  countdownBannerText: { color: '#86EFAC', fontSize: 20, fontWeight: '900', textAlign: 'center', lineHeight: 28 },
  rulesLinkBtn: { marginTop: 8, marginBottom: 4, paddingVertical: 8 },
  rulesLinkText: { color: ACTION_GOLD, fontSize: 14, fontWeight: '700', textAlign: 'right', textDecorationLine: 'underline' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: SURFACE_ALT, borderRadius: 20, borderWidth: 1, borderColor: GOLD_LINE, padding: 18 },
  modalTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  rulesModalLogoWrap: { alignItems: 'center', marginBottom: 12 },
  rulesSectionTitle: { color: '#FCD34D', fontSize: 14, fontWeight: '800', marginBottom: 8, marginTop: 12 },
  rulesLine: { color: TEXT_MAIN, fontSize: 13, lineHeight: 20, marginBottom: 4 },
  rulesModalCloseBtn: { marginTop: 12, backgroundColor: SURFACE_SOFT, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: GOLD_LINE },
  rulesModalCloseBtnText: { color: '#F8FAFC', fontWeight: '700' },
  connectingCard: { backgroundColor: SURFACE_ALT, borderRadius: 18, borderWidth: 1.5, borderColor: GOLD_LINE_STRONG, paddingVertical: 26, paddingHorizontal: 24, alignItems: 'center' },
  connectingTitle: { color: '#FDE047', fontSize: 20, fontWeight: '800', marginTop: 16, marginBottom: 6 },
  connectingBody: { color: TEXT_DIM, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
