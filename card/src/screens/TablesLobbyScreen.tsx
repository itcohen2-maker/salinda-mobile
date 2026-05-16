import React, { useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppLocale } from '../../shared/i18n';
import type { Fraction, HostGameSettings, LobbyTableSummary, LobbyTableTheme } from '../../shared/types';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useLocale } from '../i18n/LocaleContext';
import { getScreenSafeTop } from '../theme/screenInsets';

const BG_IMAGE = require('../../assets/bg.jpg');
const LOBBY_LOGO = require('../../assets/branding/salinda-puzzle-game-logo.png');

type LobbyFilter = 'all' | 'easy' | 'full' | 'open' | 'private';

interface TablesLobbyScreenProps {
  balance?: number;
  error?: string | null;
  headerAccessory?: React.ReactNode;
  onBack?: () => void;
  onCreateTable: () => void;
  onEnterCode?: () => void;
  onExitApp?: () => void;
  onJoinTable: (table: LobbyTableSummary) => void;
  onOpenRules: () => void;
  onPlayerNameChange: (value: string) => void;
  onQuickMatch: () => void;
  onRefresh: () => void;
  playerName: string;
  tables: LobbyTableSummary[];
}

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

const GOLD = '#f5d27a';
const TEXT = '#f5f1e6';
const TEXT_DIM = '#b9b0a0';
const TEXT_MUTE = '#8a8275';
const ROOT_BG = '#0a0d14';
const SURFACE = 'rgba(20,15,8,0.76)';
const SURFACE_SOFT = 'rgba(0,0,0,0.4)';
const LINE = 'rgba(245,210,122,0.18)';
const MAX_TABLE_SLOTS = 4;
const DEFAULT_FRACTION_KINDS: readonly Fraction[] = ['1/2', '1/3', '1/4', '1/5'];
const DEFAULT_OPERATORS: readonly string[] = ['+', '-', 'x', '÷'];

function formatOperators(ops: string[]): string {
  return ops.map((op) => (op === 'x' ? '×' : op === '÷' ? '÷' : op)).join(', ');
}

function usesDefaultOperators(ops: string[] | null | undefined): boolean {
  if (!ops || ops.length === 0) return true;
  if (ops.length !== DEFAULT_OPERATORS.length) return false;
  return DEFAULT_OPERATORS.every((op) => ops.includes(op));
}

const TABLE_THEME_STYLES: Record<
  LobbyTableTheme,
  {
    accent: string;
    chip: string;
    background: [string, string];
  }
> = {
  classic: { accent: '#3B82F6', chip: '#BFDBFE', background: ['#122440', '#060c1c'] },
  royal: { accent: '#E11D48', chip: '#FECDD3', background: ['#6b1818', '#2a0606'] },
  forest: { accent: '#10B981', chip: '#A7F3D0', background: ['#0f4a36', '#03251a'] },
  ocean: { accent: '#F59E0B', chip: '#FDE68A', background: ['#1a3a8a', '#0a1c4a'] },
};

function formatTimer(
  translate: TranslateFn,
  timerSetting: HostGameSettings['timerSetting'] | null,
  timerCustomSeconds: number | null,
): string {
  if (!timerSetting || timerSetting === 'off') return translate('lobby.timerOff');
  if (timerSetting === '15') return translate('lobby.timerSec', { n: 15 });
  if (timerSetting === '60') return translate('lobby.timerMin');
  if (timerSetting === '90') return translate('lobby.timerMinHalf');

  const total = Math.max(0, timerCustomSeconds ?? 0);
  if (timerSetting === 'custom') {
    return total >= 60
      ? translate('lobby.timerFmtMinSec', { m: Math.floor(total / 60), s: total % 60 })
      : translate('lobby.timerSec', { n: total });
  }

  return translate('lobby.timerSec', { n: timerSetting });
}

function formatDifficulty(table: LobbyTableSummary, translate: TranslateFn): string {
  return table.configuredDifficulty === 'easy'
    ? translate('lobby.diffEasyRange')
    : translate('lobby.diffFullRange');
}

function formatCount(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US').format(value);
}

export function getTableInfoRowDirection(
  isRTL: boolean,
  platformOS: string = Platform.OS,
): 'row' | 'row-reverse' {
  if (!isRTL) return 'row';
  return platformOS === 'android' ? 'row' : 'row-reverse';
}

export function getTableInfoTextAlign(
  isRTL: boolean,
  side: 'label' | 'value',
  platformOS: string = Platform.OS,
): 'left' | 'right' | undefined {
  void side;
  void platformOS;
  if (!isRTL) return undefined;
  return 'right';
}

function getStatusLabel(table: LobbyTableSummary, translate: TranslateFn): string {
  return table.status === 'waiting'
    ? translate('lobby.tableWaiting')
    : translate('lobby.tableOccupied');
}

function normalizeFractionKinds(kinds: LobbyTableSummary['fractionKinds']): Fraction[] {
  const configuredKinds = new Set((kinds ?? []).filter(Boolean));
  return DEFAULT_FRACTION_KINDS.filter((kind) => configuredKinds.has(kind));
}

function usesDefaultFractions(table: LobbyTableSummary): boolean {
  if (table.showFractions !== true) return false;
  const kinds = normalizeFractionKinds(table.fractionKinds);
  if (kinds.length === 0) return true;
  return DEFAULT_FRACTION_KINDS.every((kind, index) => kinds[index] === kind);
}

function formatFractions(table: LobbyTableSummary, translate: TranslateFn): string {
  if (!table.showFractions) return translate('lobby.noFractions');
  const kinds = normalizeFractionKinds(table.fractionKinds);
  if (kinds.length === 0 || usesDefaultFractions(table)) return translate('lobby.fractionsParticipating');
  return `${translate('lobby.fractionsParticipating')}: ${kinds.join(', ')}`;
}

function getTableInfoRows(
  table: LobbyTableSummary,
  translate: TranslateFn,
): Array<{ label: string; value: string; accent?: boolean }> {
  const rows: Array<{ label: string; value: string; accent?: boolean }> = [
    { label: translate('lobby.host'), value: table.hostName },
    {
      label: translate('lobby.playersLabel'),
      value: translate('lobby.tablePlayers', {
        count: table.currentParticipants,
        max: table.maxParticipants,
      }),
    },
    {
      label: translate('lobby.privateToggle'),
      value: table.visibility === 'private_locked' ? translate('lobby.tablePrivate') : translate('lobby.tablePublic'),
    },
  ];

  if (table.configuredDifficulty === 'easy') {
    rows.push({
      label: translate('lobby.difficulty'),
      value: formatDifficulty(table, translate),
      accent: true,
    });
  }

  if (!usesDefaultOperators(table.enabledOperators)) {
    rows.push({
      label: translate('lobby.operators'),
      value: formatOperators(table.enabledOperators ?? []),
      accent: true,
    });
  }

  rows.push({
    label: translate('lobby.fractions'),
    value: formatFractions(table, translate),
    accent: table.showFractions ?? undefined,
  });

  if (table.showPossibleResults === false) {
    rows.push({
      label: translate('lobby.possibleResults'),
      value: translate('lobby.hide'),
    });
  }

  if (table.showSolveExercise === false) {
    rows.push({
      label: translate('lobby.solveExercise'),
      value: translate('lobby.off'),
    });
  }

  if (table.timerSetting && table.timerSetting !== 'off') {
    rows.push({
      label: translate('lobby.turnTimer'),
      value: formatTimer(translate, table.timerSetting, table.timerCustomSeconds),
      accent: true,
    });
  }

  return rows;
}

function getActionHint(table: LobbyTableSummary, canAct: boolean, translate: TranslateFn): string {
  if (!canAct) return translate('lobby.enterNameFirst');
  if (table.status === 'waiting') {
    return table.visibility === 'private_locked'
      ? translate('lobby.tableTapToEnterCode')
      : translate('lobby.tableTapToJoin');
  }
  return translate('lobby.tableOccupied');
}

function getStatusTone(table: LobbyTableSummary) {
  if (table.status === 'waiting') {
    return {
      dot: '#22C55E',
      text: '#86EFAC',
      border: 'rgba(34,197,94,0.3)',
      background: 'rgba(34,197,94,0.14)',
    };
  }
  if (table.status === 'countdown') {
    return {
      dot: '#F59E0B',
      text: '#FDE68A',
      border: 'rgba(245,158,11,0.3)',
      background: 'rgba(245,158,11,0.14)',
    };
  }
  return {
    dot: '#F43F5E',
    text: '#FCA5A5',
    border: 'rgba(244,63,94,0.3)',
    background: 'rgba(244,63,94,0.14)',
  };
}

export function isTableJoinable(table: LobbyTableSummary): boolean {
  return table.status === 'waiting';
}

export function pickQuickMatchTable(tables: LobbyTableSummary[]): LobbyTableSummary | null {
  return (
    [...tables]
      .filter((table) => table.visibility === 'public' && isTableJoinable(table))
      .sort(
        (a, b) =>
          b.currentParticipants - a.currentParticipants ||
          a.maxParticipants - b.maxParticipants ||
          a.roomCode.localeCompare(b.roomCode),
      )[0] ?? null
  );
}

function applyFilter(tables: LobbyTableSummary[], filter: LobbyFilter): LobbyTableSummary[] {
  if (filter === 'easy') return tables.filter((table) => table.configuredDifficulty === 'easy');
  if (filter === 'full') return tables.filter((table) => table.configuredDifficulty === 'full');
  if (filter === 'open') return tables.filter((table) => table.status === 'waiting');
  if (filter === 'private') return tables.filter((table) => table.visibility === 'private_locked');
  return tables;
}

function StatusPill({
  compactWeb,
  isRTL,
  stacked = false,
  table,
  t,
}: {
  compactWeb: boolean;
  isRTL: boolean;
  stacked?: boolean;
  table: LobbyTableSummary;
  t: TranslateFn;
}) {
  const tone = getStatusTone(table);

  return (
    <View
        style={[
          styles.statusPill,
          compactWeb && styles.statusPillCompactWeb,
          stacked && styles.statusPillStacked,
          {
            borderColor: tone.border,
            backgroundColor: tone.background,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          },
      ]}
    >
      <View style={[styles.statusPillDot, { backgroundColor: tone.dot }]} />
      <Text style={[styles.statusPillText, { color: tone.text }]} numberOfLines={1}>
        {getStatusLabel(table, t)}
      </Text>
    </View>
  );
}

function SeatsRow({
  current,
  isRTL,
  locale,
  max,
  accent,
}: {
  current: number;
  isRTL: boolean;
  locale: AppLocale;
  max: number;
  accent: string;
}) {
  return (
    <View style={[styles.seatsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      {Array.from({ length: max }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.seatDot,
            { backgroundColor: index < current ? accent : 'rgba(255,255,255,0.15)' },
          ]}
        />
      ))}
      <Text style={styles.seatsCount}>
        {formatCount(current, locale)}/{formatCount(max, locale)}
      </Text>
    </View>
  );
}

function TableCard({
  canAct,
  compactVisuals,
  isRTL,
  locale,
  onPress,
  singleColumn,
  stackedHeader,
  table,
  tileWidth,
  t,
}: {
  canAct: boolean;
  compactVisuals: boolean;
  isRTL: boolean;
  locale: AppLocale;
  onPress: (table: LobbyTableSummary) => void;
  singleColumn: boolean;
  stackedHeader: boolean;
  table: LobbyTableSummary;
  tileWidth?: number;
  t: TranslateFn;
}) {
  const joinable = canAct && isTableJoinable(table);
  const locked = table.visibility === 'private_locked';
  const theme = TABLE_THEME_STYLES[table.tableTheme] ?? TABLE_THEME_STYLES.classic;
  const [bgTop, bgBottom] = theme.background;
  const actionHint = getActionHint(table, canAct, t);
  const infoRowDirection = getTableInfoRowDirection(isRTL);
  const infoLabelAlign = getTableInfoTextAlign(isRTL, 'label');
  const infoValueAlign = getTableInfoTextAlign(isRTL, 'value');
  const infoRows = getTableInfoRows(table, t);

  return (
    <Pressable
      testID={`table-card-${table.roomCode}`}
      style={({ pressed }) => [
        styles.tile,
        singleColumn ? styles.tileSingleColumn : [styles.tileTwoColumn, tileWidth ? { width: tileWidth } : null],
        compactVisuals && styles.tileCompactWeb,
        !joinable && styles.tileDisabled,
        pressed && joinable && styles.tilePressed,
      ]}
      onPress={() => onPress(table)}
      disabled={!joinable}
    >
      <View style={styles.tileBaseLayer} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: bgBottom }]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: bgTop, opacity: 0.52 }]} />
      <View style={styles.tileOverlayLayer} />
      <View style={[styles.tileAccentBar, { backgroundColor: theme.accent }]} />

      <View
        testID={`table-card-${table.roomCode}-header`}
        style={[
          styles.tileHeader,
          compactVisuals && styles.tileHeaderCompactWeb,
          stackedHeader
            ? [styles.tileHeaderStacked, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]
            : { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <View
          style={[
            styles.tileBadge,
            compactVisuals && styles.tileBadgeCompactWeb,
            stackedHeader && styles.tileBadgeStacked,
            { borderColor: `${theme.accent}55`, backgroundColor: `${theme.accent}22` },
          ]}
        >
          <Text style={[styles.tileBadgeText, compactVisuals && styles.tileBadgeTextCompactWeb, { color: theme.chip }]} numberOfLines={1}>
            {locked ? t('lobby.tablePrivate') : t('lobby.tablePublic')}
          </Text>
        </View>
        <View style={stackedHeader ? styles.tileStatusWrapStacked : null}>
          <StatusPill compactWeb={compactVisuals} stacked={stackedHeader} table={table} isRTL={isRTL} t={t} />
        </View>
      </View>

      <View style={[styles.tileCenter, compactVisuals && styles.tileCenterCompactWeb]}>
        <Text style={[styles.tileRoomLabel, compactVisuals && styles.tileRoomLabelCompactWeb]}>{t('lobby.roomCodeLabel')}</Text>
        <Text style={[styles.tileRoomCode, compactVisuals && styles.tileRoomCodeCompactWeb, { color: theme.chip }]}>
          {table.roomCode}
        </Text>

        <View style={[styles.tileInfoList, compactVisuals && styles.tileInfoListCompactWeb]}>
          {infoRows.map((row) => (
            <View key={row.label} style={[styles.tileInfoRow, { flexDirection: infoRowDirection }]}>
              <Text
                style={[
                  styles.tileInfoLabel,
                  compactVisuals && styles.tileInfoLabelCompactWeb,
                  infoLabelAlign ? { textAlign: infoLabelAlign } : null,
                ]}
              >
                {row.label}
              </Text>
              <Text
                style={[
                  styles.tileInfoValue,
                  compactVisuals && styles.tileInfoValueCompactWeb,
                  infoValueAlign ? { textAlign: infoValueAlign } : null,
                  row.accent ? { color: theme.chip } : null,
                ]}
              >
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        {table.hasRandomJoiner ? (
          <Text
            style={[
              styles.tileMetaNote,
              { color: theme.chip, textAlign: isRTL ? 'right' : 'left' },
            ]}
          >
            {t('lobby.randomJoiner')}
          </Text>
        ) : null}
      </View>

      <View style={[styles.tileFooter, compactVisuals && styles.tileFooterCompactWeb]}>
        <SeatsRow
          current={table.currentParticipants}
          max={table.maxParticipants}
          accent={theme.accent}
          isRTL={isRTL}
          locale={locale}
        />
        <Text
          style={[
            styles.tileActionHint,
            compactVisuals && styles.tileActionHintCompactWeb,
            {
              color: joinable ? TEXT : locked && canAct ? theme.chip : TEXT_MUTE,
              textAlign: isRTL ? 'right' : 'left',
            },
          ]}
        >
          {actionHint}
        </Text>
      </View>
    </Pressable>
  );
}

function EmptyTableCard({
  canAct,
  compactVisuals,
  isRTL,
  onPress,
  singleColumn,
  stackedHeader,
  t,
  testID,
  tileWidth,
}: {
  canAct: boolean;
  compactVisuals: boolean;
  isRTL: boolean;
  onPress: () => void;
  singleColumn: boolean;
  stackedHeader: boolean;
  t: TranslateFn;
  testID: string;
  tileWidth?: number;
}) {
  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [
        styles.tile,
        singleColumn ? styles.tileSingleColumn : [styles.tileTwoColumn, tileWidth ? { width: tileWidth } : null],
        compactVisuals && styles.tileCompactWeb,
        !canAct && styles.tileDisabled,
        pressed && canAct && styles.tilePressed,
      ]}
      onPress={onPress}
      disabled={!canAct}
    >
      <View style={styles.tileBaseLayer} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#10131d' }]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1f2937', opacity: 0.36 }]} />
      <View style={styles.tileOverlayLayer} />
      <View style={[styles.tileAccentBar, { backgroundColor: GOLD }]} />

      <View
        testID={`${testID}-header`}
        style={[
          styles.tileHeader,
          compactVisuals && styles.tileHeaderCompactWeb,
          stackedHeader
            ? [styles.tileHeaderStacked, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]
            : { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <View
          style={[
            styles.tileBadge,
            compactVisuals && styles.tileBadgeCompactWeb,
            stackedHeader && styles.tileBadgeStacked,
            {
              borderColor: 'rgba(245,210,122,0.28)',
              backgroundColor: 'rgba(245,210,122,0.12)',
            },
          ]}
        >
          <Text style={[styles.tileBadgeText, compactVisuals && styles.tileBadgeTextCompactWeb, { color: GOLD }]} numberOfLines={1}>
            {t('lobby.tableWaiting')}
          </Text>
        </View>
      </View>

      <View style={[styles.tileCenter, compactVisuals && styles.tileCenterCompactWeb]}>
        <Text style={[styles.tileRoomLabel, compactVisuals && styles.tileRoomLabelCompactWeb]}>{t('browse.table')}</Text>
        <Text style={[styles.emptyTilePlus, compactVisuals && styles.emptyTilePlusCompactWeb]}>+</Text>
        <Text style={[styles.emptyTileTitle, compactVisuals && styles.emptyTileTitleCompactWeb]}>
          {t('lobby.createTable')}
        </Text>
      </View>

      <View style={[styles.tileFooter, compactVisuals && styles.tileFooterCompactWeb]}>
        <Text
          style={[
            styles.tileActionHint,
            compactVisuals && styles.tileActionHintCompactWeb,
            {
              color: canAct ? GOLD : TEXT_MUTE,
              textAlign: isRTL ? 'right' : 'left',
            },
          ]}
        >
          {canAct ? t('lobby.createTable') : t('lobby.enterNameFirst')}
        </Text>
      </View>
    </Pressable>
  );
}

export default function TablesLobbyScreen({
  balance: _balance = 0,
  error,
  headerAccessory,
  onBack,
  onCreateTable,
  onEnterCode,
  onExitApp,
  onJoinTable,
  onOpenRules: _onOpenRules,
  onPlayerNameChange,
  onQuickMatch,
  onRefresh,
  playerName,
  tables,
}: TablesLobbyScreenProps) {
  const { isRTL, locale, t } = useLocale();
  const insets = useSafeAreaInsets();
  const safeTop = getScreenSafeTop(insets.top);
  const responsive = useResponsiveLayout();
  const { width } = responsive;
  const [filter, setFilter] = useState<LobbyFilter>('all');
  const [exitConfirmVisible, setExitConfirmVisible] = useState(false);

  const visibleTables = useMemo(() => applyFilter(tables, filter), [filter, tables]);
  const displayItems = useMemo(() => {
    const activeTables = visibleTables.slice(0, MAX_TABLE_SLOTS).map((table) => ({
      kind: 'table' as const,
      table,
    }));
    const placeholders = Array.from(
      { length: Math.max(0, MAX_TABLE_SLOTS - activeTables.length) },
      (_, index) => ({
        kind: 'empty' as const,
        key: `empty-${index + 1}`,
      }),
    );
    return [...activeTables, ...placeholders];
  }, [visibleTables]);
  const canAct = playerName.trim().length > 0;
  const compactVisuals = Platform.OS === 'web' || responsive.isTight;
  const stackedActions = responsive.isSingleColumn;
  const singleColumn = !responsive.isTablet || responsive.isSingleColumn;
  const stackedTileHeader = responsive.isTight;
  const twoColumnTileWidth = singleColumn ? undefined : Math.floor((Math.max(width, 320) - 36) / 2);
  const scrollBottomPad = Math.max(insets.bottom + 40, Platform.OS === 'web' ? 68 : 56);

  const filters = useMemo(
    () => [
      { key: 'all' as const, label: t('lobby.filterAll') },
      { key: 'easy' as const, label: t('lobby.diffEasyRange') },
      { key: 'full' as const, label: t('lobby.diffFullRange') },
      { key: 'open' as const, label: t('lobby.filterOpen') },
      { key: 'private' as const, label: t('lobby.tablePrivate') },
    ],
    [t],
  );

  return (
    <ImageBackground
      source={BG_IMAGE}
      style={styles.root}
      imageStyle={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      {onBack ? (
        <TouchableOpacity
          testID="online-lobby-back"
          style={[
            styles.floatingBackBtn,
            Platform.OS === 'android' ? styles.floatingBackBtnAndroid : styles.floatingBackBtnDefault,
            { top: Math.max(safeTop + 8, 12) },
          ]}
          onPress={onBack}
          activeOpacity={0.85}
        >
          <Text style={styles.floatingBackBtnText}>{isRTL ? '>' : '<'}</Text>
        </TouchableOpacity>
      ) : null}

      {onExitApp ? (
        <TouchableOpacity
          testID="lobby-exit-app"
          style={[
            styles.floatingBackBtn,
            styles.floatingExitBtnAndroid,
            { top: Math.max(safeTop + 8, 12) },
          ]}
          onPress={() => setExitConfirmVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.floatingExitBtnText}>X</Text>
        </TouchableOpacity>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 0,
            paddingBottom: scrollBottomPad,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.heroPanel,
            compactVisuals ? styles.heroPanelCompactWeb : null,
            { paddingTop: Math.max(safeTop + (compactVisuals ? 10 : 20), compactVisuals ? 14 : 30) },
          ]}
        >
          {!compactVisuals ? (
            <View style={styles.logoWrap}>
              <Image
                source={LOBBY_LOGO}
                style={[styles.logoImage, compactVisuals && styles.logoImageCompactWeb]}
                resizeMode="contain"
              />
            </View>
          ) : null}

          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, compactVisuals && styles.sectionTitleCompactWeb, { textAlign: 'center' }]}>
              {t('lobby.tablesTitle')}
            </Text>
            {!compactVisuals ? (
              <Text style={[styles.sectionSub, compactVisuals && styles.sectionSubCompactWeb, { textAlign: 'center' }]}>
                {t('lobby.tablesSubtitle')}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.controlCard, compactVisuals && styles.controlCardCompactWeb]}>
          {headerAccessory ? <View style={styles.headerAccessoryWrap}>{headerAccessory}</View> : null}

          {!compactVisuals ? (
            <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
              {t('lobby.yourName')}
            </Text>
          ) : null}
          <View style={[styles.nameInputShell, compactVisuals && styles.nameInputShellCompactWeb]}>
            <TextInput
              testID="lobby-player-name"
              style={[styles.nameInput, compactVisuals && styles.nameInputCompactWeb]}
              value={playerName}
              onChangeText={(value) => onPlayerNameChange(value.slice(0, 7))}
              placeholder={t('lobby.namePlaceholder')}
              placeholderTextColor={TEXT_MUTE}
              maxLength={7}
              textAlign="center"
            />
          </View>

          <View
            testID="lobby-action-row"
            style={[
              styles.actionRow,
              { flexDirection: stackedActions ? 'column' : isRTL ? 'row-reverse' : 'row' },
            ]}
          >
            <TouchableOpacity
              testID="lobby-quick-match"
              style={[
                styles.quickMatchBtn,
                compactVisuals && styles.quickMatchBtnCompactWeb,
                stackedActions ? styles.actionBtnStacked : null,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
                !canAct && styles.disabledButton,
              ]}
              disabled={!canAct}
              onPress={onQuickMatch}
              activeOpacity={0.85}
            >
              <Text style={styles.quickMatchText}>{t('lobby.quickMatch')}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.utilityRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {onEnterCode ? (
              <TouchableOpacity
                testID="lobby-enter-code"
                style={[styles.utilityBtn, styles.utilityBtnEnterCode, compactVisuals && styles.utilityBtnCompactWeb]}
                onPress={onEnterCode}
                activeOpacity={0.85}
              >
                <Text style={[styles.utilityBtnText, styles.utilityBtnTextLight]}>{t('lobby.enterCode')}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              testID="lobby-refresh"
              style={[styles.utilityBtn, styles.utilityBtnRefresh, compactVisuals && styles.utilityBtnCompactWeb]}
              onPress={onRefresh}
              activeOpacity={0.85}
            >
              <Text style={[styles.utilityBtnText, styles.utilityBtnTextLight]}>{t('lobby.refresh')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.chips, compactVisuals && styles.chipsCompactWeb]}
          contentContainerStyle={[styles.chipsContent, compactVisuals && styles.chipsContentCompactWeb]}
        >
          {filters.map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.chip, compactVisuals && styles.chipCompactWeb, filter === item.key && styles.chipActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, compactVisuals && styles.chipTextCompactWeb, filter === item.key && styles.chipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={[styles.grid, compactVisuals && styles.gridCompactWeb]}>
          {displayItems.map((item) =>
            item.kind === 'table' ? (
              <TableCard
                key={`${item.table.roomCode}-${item.table.status}-${item.table.currentParticipants}`}
                table={item.table}
                onPress={onJoinTable}
                canAct={canAct}
                compactVisuals={compactVisuals}
                locale={locale}
                isRTL={isRTL}
                singleColumn={singleColumn}
                stackedHeader={stackedTileHeader}
                tileWidth={twoColumnTileWidth}
                t={t}
              />
            ) : (
              <EmptyTableCard
                key={item.key}
                testID={`table-card-${item.key}`}
                canAct={canAct}
                compactVisuals={compactVisuals}
                isRTL={isRTL}
                onPress={onCreateTable}
                singleColumn={singleColumn}
                stackedHeader={stackedTileHeader}
                tileWidth={twoColumnTileWidth}
                t={t}
              />
            ),
          )}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={[styles.errorText, { textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={exitConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExitConfirmVisible(false)}
      >
        <View style={styles.exitModalBackdrop}>
          <View style={styles.exitModalCard}>
            <Text style={styles.exitModalTitle}>{t('lobby.exitAppConfirmTitle')}</Text>
            <Text style={styles.exitModalBody}>{t('lobby.exitAppConfirmBody')}</Text>
            <View style={styles.exitModalButtons}>
              <TouchableOpacity
                style={[styles.exitModalBtn, styles.exitModalBtnConfirm]}
                onPress={() => {
                  setExitConfirmVisible(false);
                  onExitApp?.();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.exitModalBtnConfirmText}>{t('lobby.exitApp')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exitModalBtn, styles.exitModalBtnCancel]}
                onPress={() => setExitConfirmVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.exitModalBtnCancelText}>{t('ui.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    backgroundColor: ROOT_BG,
    overflow: 'hidden',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  scroll: {
    flex: 1,
  },
  floatingBackBtn: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  floatingBackBtnDefault: {
    left: 12,
  },
  floatingBackBtnAndroid: {
    right: 12,
  },
  floatingExitBtnDefault: {
    right: 12,
  },
  floatingExitBtnAndroid: {
    left: 12,
  },
  floatingExitBtnText: {
    color: GOLD,
    fontWeight: '900',
    fontSize: 20,
  },
  exitModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitModalCard: {
    backgroundColor: '#1a1510',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,210,122,0.3)',
    padding: 24,
    marginHorizontal: 32,
    alignItems: 'center',
    gap: 12,
  },
  exitModalTitle: {
    color: GOLD,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  exitModalBody: {
    color: TEXT,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  exitModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  exitModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  exitModalBtnConfirm: {
    backgroundColor: '#c0392b',
  },
  exitModalBtnConfirmText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  exitModalBtnCancel: {
    backgroundColor: 'rgba(245,210,122,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,210,122,0.3)',
  },
  exitModalBtnCancelText: {
    color: GOLD,
    fontWeight: '600',
    fontSize: 15,
  },
  floatingBackBtnText: {
    color: TEXT,
    fontWeight: '900',
    fontSize: 22,
    lineHeight: 22,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 88,
  },
  heroPanel: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 14,
  },
  heroPanelCompactWeb: {
    paddingBottom: 6,
    gap: 6,
  },
  logoWrap: {
    alignItems: 'center',
  },
  logoImage: {
    width: 300,
    height: 88,
  },
  logoImageCompactWeb: {
    width: 220,
    height: 64,
  },
  sectionHead: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: GOLD,
    letterSpacing: 0.2,
  },
  sectionTitleCompactWeb: {
    fontSize: 24,
  },
  sectionSub: {
    fontSize: 13,
    color: TEXT_DIM,
    lineHeight: 20,
  },
  sectionSubCompactWeb: {
    fontSize: 12,
    lineHeight: 18,
  },
  controlCard: {
    marginHorizontal: 12,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: SURFACE,
    gap: 12,
  },
  controlCardCompactWeb: {
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  headerAccessoryWrap: {
    alignItems: 'center',
    marginBottom: 2,
  },
  fieldLabel: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
  },
  nameInputShell: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: GOLD,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  nameInputShellCompactWeb: {
    borderRadius: 14,
  },
  nameInput: {
    backgroundColor: 'rgba(0,0,0,0.42)',
    color: TEXT,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 13,
    letterSpacing: 0.4,
  },
  nameInputCompactWeb: {
    fontSize: 15,
    paddingVertical: 7,
  },
  helperText: {
    color: TEXT_DIM,
    fontSize: 12,
    lineHeight: 18,
  },
  actionRow: {
    gap: 10,
  },
  actionBtnStacked: {
    width: '100%',
  },
  utilityRow: {
    gap: 10,
    justifyContent: 'center',
  },
  utilityBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: SURFACE_SOFT,
  },
  utilityBtnEnterCode: {
    borderColor: 'rgba(96,165,250,0.85)',
    backgroundColor: 'rgba(37,99,235,0.2)',
  },
  utilityBtnRefresh: {
    borderColor: 'rgba(196,181,253,0.85)',
    backgroundColor: 'rgba(168,85,247,0.2)',
  },
  utilityBtnCompactWeb: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  utilityBtnText: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  utilityBtnTextLight: {
    color: '#F8FAFC',
  },
  quickMatchBtn: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 10px 24px rgba(245,210,122,0.18)' }
      : {
          shadowColor: GOLD,
          shadowOpacity: 0.22,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
          elevation: 5,
        }),
  },
  quickMatchBtnCompactWeb: {
    paddingVertical: 8,
  },
  quickMatchText: {
    color: '#1a1207',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  createBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: LINE,
  },
  createBtnText: {
    color: TEXT,
    fontWeight: '800',
    fontSize: 14,
  },
  chips: {
    paddingHorizontal: 14,
    marginBottom: 12,
    flexGrow: 0,
  },
  chipsCompactWeb: {
    marginBottom: 6,
  },
  chipsContent: {
    gap: 8,
    paddingHorizontal: 2,
  },
  chipsContentCompactWeb: {
    gap: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: SURFACE_SOFT,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 999,
  },
  chipCompactWeb: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: 'rgba(245,210,122,0.18)',
    borderColor: GOLD,
  },
  chipText: {
    color: TEXT_DIM,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextCompactWeb: {
    fontSize: 11,
  },
  chipTextActive: {
    color: GOLD,
  },
  emptyBox: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: SURFACE,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  emptyTitle: {
    color: TEXT,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    color: TEXT_DIM,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
  },
  grid: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'stretch',
  },
  gridCompactWeb: {
    gap: 8,
  },
  tile: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'column',
  },
  tileSingleColumn: {
    width: '100%',
    minHeight: 318,
  },
  tileTwoColumn: {
    minHeight: 332,
  },
  tileCompactWeb: {
    minHeight: 148,
  },
  tileDisabled: {
    opacity: 0.62,
  },
  tilePressed: {
    transform: [{ scale: 0.99 }],
  },
  tileBaseLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#06060a',
  },
  tileOverlayLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  tileAccentBar: {
    height: 4,
    width: '100%',
  },
  tileHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 8,
  },
  tileHeaderCompactWeb: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 3,
    gap: 6,
  },
  tileHeaderStacked: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  tileBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '58%',
  },
  tileBadgeStacked: {
    maxWidth: '100%',
  },
  tileBadgeCompactWeb: {
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tileBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  tileBadgeTextCompactWeb: {
    fontSize: 9,
  },
  statusPill: {
    alignItems: 'center',
    gap: 5,
    maxWidth: '42%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillCompactWeb: {
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusPillStacked: {
    maxWidth: '100%',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  statusPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  tileStatusWrapStacked: {
    width: '100%',
  },
  tileCenter: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 1,
  },
  tileCenterCompactWeb: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tileRoomLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: TEXT_MUTE,
    letterSpacing: 1,
    marginBottom: 4,
    textAlign: 'center',
  },
  tileRoomLabelCompactWeb: {
    fontSize: 9,
    marginBottom: 2,
  },
  tileRoomCode: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 3,
    lineHeight: 40,
    textAlign: 'center',
    marginBottom: 12,
  },
  tileRoomCodeCompactWeb: {
    fontSize: 20,
    lineHeight: 24,
    marginBottom: 5,
  },
  emptyTilePlus: {
    color: GOLD,
    fontSize: 54,
    fontWeight: '300',
    textAlign: 'center',
    lineHeight: 60,
    marginTop: 8,
    marginBottom: 12,
  },
  emptyTilePlusCompactWeb: {
    fontSize: 28,
    lineHeight: 30,
    marginTop: 2,
    marginBottom: 3,
  },
  emptyTileTitle: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyTileTitleCompactWeb: {
    fontSize: 13,
  },
  tileInfoList: {
    gap: 8,
  },
  tileInfoListCompactWeb: {
    gap: 4,
  },
  tileInfoRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tileInfoLabel: {
    color: TEXT_DIM,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    flexShrink: 1,
  },
  tileInfoLabelCompactWeb: {
    fontSize: 11,
  },
  tileInfoValue: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    flexShrink: 1,
  },
  tileInfoValueCompactWeb: {
    fontSize: 12,
  },
  tileMetaNote: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
  },
  tileFooter: {
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 8,
    zIndex: 1,
  },
  tileFooterCompactWeb: {
    gap: 4,
    paddingHorizontal: 10,
    paddingBottom: 8,
    paddingTop: 4,
  },
  seatsRow: {
    alignItems: 'center',
    gap: 3,
  },
  seatDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  seatsCount: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_DIM,
    marginHorizontal: 3,
  },
  tileActionHint: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  tileActionHintCompactWeb: {
    fontSize: 10,
    lineHeight: 13,
  },
  errorBox: {
    marginTop: 14,
    marginHorizontal: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(252,165,165,0.22)',
    backgroundColor: 'rgba(127,29,29,0.44)',
  },
  errorText: {
    color: '#fecaca',
    fontSize: 13,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
