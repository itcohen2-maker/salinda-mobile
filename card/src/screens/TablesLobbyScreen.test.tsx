import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { en } from '../../shared/i18n/en';
import { he } from '../../shared/i18n/he';
import type { LobbyTableSummary } from '../../shared/types';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { LocaleProvider, useLocale } from '../i18n/LocaleContext';
import TablesLobbyScreen, { getTableInfoRowDirection, getTableInfoTextAlign } from './TablesLobbyScreen';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en' }],
}));
jest.mock('../hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: jest.fn(),
}));

const mockUseResponsiveLayout = useResponsiveLayout as jest.MockedFunction<typeof useResponsiveLayout>;
const DEFAULT_FRACTION_KINDS = ['1/2', '1/3', '1/4', '1/5'] as const;
const originalPlatformOs = Platform.OS;

const sampleTable: LobbyTableSummary = {
  roomCode: '4821',
  hostName: 'Dana',
  visibility: 'public',
  status: 'waiting',
  currentParticipants: 2,
  maxParticipants: 4,
  countdownEndsAt: null,
  hasRandomJoiner: false,
  tableTheme: 'classic',
  configuredDifficulty: 'full',
  showFractions: true,
  fractionKinds: ['1/2', '1/3'],
  showPossibleResults: false,
  showSolveExercise: true,
  timerSetting: '60',
  timerCustomSeconds: 60,
};

function LocaleSwitcher() {
  const { setLocale } = useLocale();
  return (
    <View>
      <TouchableOpacity onPress={() => void setLocale('en')}>
        <Text>English</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => void setLocale('he')}>
        <Text>Hebrew</Text>
      </TouchableOpacity>
    </View>
  );
}

function renderLobby(
  props: Partial<React.ComponentProps<typeof TablesLobbyScreen>> = {},
) {
  const onCreateTable = jest.fn();
  const onEnterCode = jest.fn();
  const onJoinTable = jest.fn();
  const onOpenRules = jest.fn();
  const onPlayerNameChange = jest.fn();
  const onQuickMatch = jest.fn();
  const onRefresh = jest.fn();

  return {
    onCreateTable,
    onEnterCode,
    onJoinTable,
    onOpenRules,
    onPlayerNameChange,
    onQuickMatch,
    onRefresh,
    ...render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <LocaleProvider>
          <TablesLobbyScreen
            balance={12}
            error={null}
            headerAccessory={<LocaleSwitcher />}
            onCreateTable={onCreateTable}
            onEnterCode={onEnterCode}
            onJoinTable={onJoinTable}
            onOpenRules={onOpenRules}
            onPlayerNameChange={onPlayerNameChange}
            onQuickMatch={onQuickMatch}
            onRefresh={onRefresh}
            playerName="Noa"
            tables={[sampleTable]}
            {...props}
          />
        </LocaleProvider>
      </SafeAreaProvider>,
    ),
  };
}

describe('TablesLobbyScreen', () => {
  beforeAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('salinda_locale_v1', 'en');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOs });
    mockUseResponsiveLayout.mockReturnValue({
      width: 390,
      height: 844,
      fontScale: 1,
      isTight: false,
      isCompact: true,
      isSingleColumn: true,
      isTablet: false,
    });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOs });
  });

  it('updates the lobby copy when the locale changes', async () => {
    renderLobby();

    await waitFor(() => {
      expect(screen.getByText(en['lobby.tablesTitle'])).toBeTruthy();
      expect(screen.getByText(en['lobby.tablesSubtitle'])).toBeTruthy();
      expect(screen.getAllByText(en['lobby.quickMatch']).length).toBeGreaterThan(0);
      expect(screen.getAllByText(en['lobby.createTable']).length).toBeGreaterThan(0);
      expect(screen.getByText(en['lobby.refresh'])).toBeTruthy();
      expect(screen.getByText(en['lobby.tableTapToJoin'])).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Hebrew'));

    await waitFor(() => {
      expect(screen.getByText(he['lobby.tablesTitle'])).toBeTruthy();
      expect(screen.getByText(he['lobby.tablesSubtitle'])).toBeTruthy();
      expect(screen.getAllByText(he['lobby.quickMatch']).length).toBeGreaterThan(0);
      expect(screen.getAllByText(he['lobby.createTable']).length).toBeGreaterThan(0);
      expect(screen.getByText(he['lobby.refresh'])).toBeTruthy();
      expect(screen.getByText(he['lobby.tableTapToJoin'])).toBeTruthy();
    });
  }, 15000);

  it('fills the lobby grid up to four table slots', async () => {
    renderLobby();

    await waitFor(() => {
      expect(screen.getByTestId('table-card-empty-1')).toBeTruthy();
      expect(screen.getByTestId('table-card-empty-2')).toBeTruthy();
      expect(screen.getByTestId('table-card-empty-3')).toBeTruthy();
    });
  });

  it('keeps info rows on the opposite side for android rtl cards', () => {
    expect(getTableInfoRowDirection(true, 'android')).toBe('row');
    expect(getTableInfoTextAlign(true, 'label', 'android')).toBe('right');
    expect(getTableInfoTextAlign(true, 'value', 'android')).toBe('right');
  });

  it('shows only room setting overrides and keeps the utility button styling', async () => {
    renderLobby();

    await waitFor(() => {
      expect(screen.getByText(en['lobby.privateToggle'])).toBeTruthy();
      expect(screen.getAllByText(en['lobby.tablePublic']).length).toBeGreaterThan(0);
      expect(screen.getByText(en['lobby.fractions'])).toBeTruthy();
      expect(screen.getByText(`${en['lobby.fractionsParticipating']}: 1/2, 1/3`)).toBeTruthy();
      expect(screen.getByText(en['lobby.possibleResults'])).toBeTruthy();
      expect(screen.getByText(en['lobby.hide'])).toBeTruthy();
      expect(screen.queryByText(en['lobby.solveExercise'])).toBeNull();
      expect(screen.getByText(en['lobby.turnTimer'])).toBeTruthy();
      expect(screen.queryByText(en['lobby.difficulty'])).toBeNull();
      expect(screen.queryByText('>>')).toBeNull();
    });

    const enterCodeBtn = StyleSheet.flatten(screen.getByTestId('lobby-enter-code').props.style);
    const refreshBtn = StyleSheet.flatten(screen.getByTestId('lobby-refresh').props.style);

    expect(enterCodeBtn.backgroundColor).toBe('rgba(37,99,235,0.2)');
    expect(refreshBtn.backgroundColor).toBe('rgba(168,85,247,0.2)');
  });

  it('shows only possible results when that is the only non-default room setting', async () => {
    renderLobby({
      tables: [
        {
          ...sampleTable,
          roomCode: '4823',
          showFractions: true,
          fractionKinds: [...DEFAULT_FRACTION_KINDS],
          showPossibleResults: false,
          showSolveExercise: true,
          timerSetting: 'off',
          timerCustomSeconds: 60,
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText(en['lobby.fractions'])).toBeTruthy();
      expect(screen.getByText(en['lobby.fractionsParticipating'])).toBeTruthy();
      expect(screen.getByText(en['lobby.possibleResults'])).toBeTruthy();
      expect(screen.getByText(en['lobby.hide'])).toBeTruthy();
      expect(screen.queryByText(en['lobby.turnTimer'])).toBeNull();
      expect(screen.queryByText(en['lobby.difficulty'])).toBeNull();
      expect(screen.queryByText(en['lobby.solveExercise'])).toBeNull();
    });
  });

  it('shows no fractions when the table was configured without them', async () => {
    renderLobby({
      tables: [
        {
          ...sampleTable,
          roomCode: '4822',
          showFractions: false,
          fractionKinds: [],
          showPossibleResults: true,
          showSolveExercise: false,
          timerSetting: 'off',
          timerCustomSeconds: 60,
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText(en['lobby.noFractions'])).toBeTruthy();
      expect(screen.queryByText(en['lobby.possibleResults'])).toBeNull();
      expect(screen.getByText(en['lobby.solveExercise'])).toBeTruthy();
      expect(screen.getByText(en['lobby.off'])).toBeTruthy();
      expect(screen.queryByText(en['lobby.turnTimer'])).toBeNull();
    });
  });

  it('shows difficulty and timer only when they differ from the defaults', async () => {
    renderLobby({
      tables: [
        {
          ...sampleTable,
          roomCode: '4824',
          configuredDifficulty: 'easy',
          showFractions: true,
          fractionKinds: [...DEFAULT_FRACTION_KINDS],
          showPossibleResults: true,
          showSolveExercise: true,
          timerSetting: '90',
          timerCustomSeconds: 60,
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText(en['lobby.difficulty'])).toBeTruthy();
      expect(screen.getAllByText(en['lobby.diffEasyRange']).length).toBeGreaterThan(0);
      expect(screen.getByText(en['lobby.fractions'])).toBeTruthy();
      expect(screen.getByText(en['lobby.fractionsParticipating'])).toBeTruthy();
      expect(screen.getByText(en['lobby.turnTimer'])).toBeTruthy();
      expect(screen.getByText(en['lobby.timerMinHalf'])).toBeTruthy();
      expect(screen.queryByText(en['lobby.possibleResults'])).toBeNull();
    });
  });

  it('joins the room when the user taps an open room card', async () => {
    const { onJoinTable } = renderLobby();

    await waitFor(() => {
      expect(screen.getByTestId('table-card-4821')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('table-card-4821'));

    expect(onJoinTable).toHaveBeenCalledWith(sampleTable);
  });

  it('shows occupied state instead of a join hint for rooms that are not available', async () => {
    renderLobby({
      tables: [
        {
          ...sampleTable,
          status: 'countdown',
          countdownEndsAt: Date.now() + 10_000,
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getAllByText(en['lobby.tableOccupied']).length).toBeGreaterThan(0);
    });

    expect(screen.queryByText(en['lobby.tableTapToJoin'])).toBeNull();
    expect(screen.queryByText(/Game starts in \d+ sec/)).toBeNull();
  });

  it('asks for a player name before allowing a room join', async () => {
    const { onJoinTable } = renderLobby({ playerName: '' });

    await waitFor(() => {
      expect(screen.getAllByText(en['lobby.enterNameFirst']).length).toBeGreaterThan(0);
    });

    fireEvent.press(screen.getByTestId('table-card-4821'));

    expect(onJoinTable).not.toHaveBeenCalled();
  });

  it('stacks the lobby actions and card header when the layout is tight', async () => {
    mockUseResponsiveLayout.mockReturnValue({
      width: 390,
      height: 740,
      fontScale: 1.3,
      isTight: true,
      isCompact: true,
      isSingleColumn: true,
      isTablet: false,
    });

    renderLobby();

    await waitFor(() => {
      expect(screen.getByTestId('table-card-4821-header')).toBeTruthy();
    });

    expect(StyleSheet.flatten(screen.getByTestId('lobby-action-row').props.style).flexDirection).toBe('column');
    expect(StyleSheet.flatten(screen.getByTestId('lobby-quick-match').props.style).width).toBe('100%');
    expect(StyleSheet.flatten(screen.getByTestId('table-card-4821-header').props.style).flexDirection).toBe('column');
  });

  it('keeps the web room browser in a single narrow column even on wide desktop viewports', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    mockUseResponsiveLayout.mockReturnValue({
      width: 1366,
      height: 900,
      fontScale: 1,
      isTight: false,
      isCompact: false,
      isSingleColumn: false,
      isTablet: true,
    });

    renderLobby();

    await waitFor(() => {
      expect(screen.getByTestId('table-card-4821-header')).toBeTruthy();
    });

    expect(StyleSheet.flatten(screen.getByTestId('lobby-action-row').props.style).flexDirection).toBe('column');
    expect(StyleSheet.flatten(screen.getByTestId('lobby-quick-match').props.style).width).toBe('100%');
    expect(StyleSheet.flatten(screen.getByTestId('table-card-4821-header').props.style).flexDirection).toBe('column');
  });

  it('centers the table lobby filter menu on web', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    mockUseResponsiveLayout.mockReturnValue({
      width: 1366,
      height: 900,
      fontScale: 1,
      isTight: false,
      isCompact: false,
      isSingleColumn: false,
      isTablet: true,
    });

    renderLobby();

    await waitFor(() => {
      expect(screen.getByTestId('lobby-filter-menu')).toBeTruthy();
      expect(screen.getByText(en['lobby.filterAll'])).toBeTruthy();
    });

    const filterMenu = StyleSheet.flatten(screen.getByTestId('lobby-filter-menu').props.style);

    expect(filterMenu.flexDirection).toBe('row');
    expect(filterMenu.flexWrap).toBe('wrap');
    expect(filterMenu.justifyContent).toBe('center');
    expect(filterMenu.alignSelf).toBe('center');
  });
});
