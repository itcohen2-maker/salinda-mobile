import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Localization from 'expo-localization';
import { he } from '../../shared/i18n/he';
import { LocaleProvider } from '../i18n/LocaleContext';
import { LobbyScreen } from './OnlineTableScreens';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en' }]),
}));

const mockUseMultiplayer = jest.fn();
const mockGetLocales = Localization.getLocales as jest.Mock;
const originalPlatformOs = Platform.OS;
const baseTable = {
  roomCode: '4821',
  hostName: 'Host',
  visibility: 'public' as const,
  status: 'waiting' as const,
  currentParticipants: 1,
  maxParticipants: 4,
  countdownEndsAt: null,
  hasRandomJoiner: false,
  tableTheme: 'classic' as const,
  configuredDifficulty: 'full' as const,
  showFractions: true,
  fractionKinds: ['1/2', '1/3', '1/4', '1/5'],
  showPossibleResults: true,
  showSolveExercise: true,
  timerSetting: 'off' as const,
  timerCustomSeconds: 60,
};

jest.mock('../hooks/useMultiplayer', () => ({
  useMultiplayer: () => mockUseMultiplayer(),
}));

function renderLobbyScreen(overrides: Record<string, unknown> = {}) {
  mockUseMultiplayer.mockReturnValue({
    roomCode: '4821',
    currentInviteCode: null,
    currentTableVisibility: 'public',
    players: [{ id: 'host', name: 'Host', isHost: true, isConnected: true, isBot: false }],
    tables: [],
    isHost: true,
    configureTable: jest.fn(),
    startTableCountdown: jest.fn(),
    leaveRoom: jest.fn(),
    error: null,
    clearError: jest.fn(),
    toast: null,
    clearToast: jest.fn(),
    startBotGame: jest.fn(),
    serverUrl: 'https://lolos-mobile.onrender.com',
    ...overrides,
  });

  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <LocaleProvider>
        <LobbyScreen />
      </LocaleProvider>
    </SafeAreaProvider>,
  );
}

describe('OnlineTableScreens LobbyScreen', () => {
  beforeEach(() => {
    mockUseMultiplayer.mockReset();
    mockGetLocales.mockReturnValue([{ languageCode: 'en' }]);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOs });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOs });
  });

  it('shows lobby copy for a joiner before table metadata refreshes', () => {
    renderLobbyScreen({
      currentTableVisibility: null,
      players: [],
      tables: [],
      isHost: false,
    });

    expect(screen.getByText('Table lobby')).toBeTruthy();
    expect(screen.queryByText('Game setup')).toBeNull();
    expect(screen.getByText('4821')).toBeTruthy();
    expect(screen.queryByTestId('lobby-summary-section')).toBeNull();
  });

  it('shows an immediate start button for the host', () => {
    renderLobbyScreen({
      players: [
        { id: 'host', name: 'Host', isHost: true, isConnected: true, isBot: false },
        { id: 'guest', name: 'Guest', isHost: false, isConnected: true, isBot: false },
      ],
      tables: [
        {
          ...baseTable,
          currentParticipants: 2,
        },
      ],
    });

    expect(screen.getAllByText('Start game').length).toBeGreaterThan(0);
    expect(screen.queryByText('Start in 10 seconds')).toBeNull();
    expect(within(screen.getByTestId('lobby-summary-card-seats')).getByText('2/4')).toBeTruthy();
  });

  it('shows bot guidance and difficulty options when the host is alone', () => {
    renderLobbyScreen({
      players: [{ id: 'host', name: 'Host', isHost: true, isConnected: true, isBot: false }],
      tables: [{ ...baseTable, currentParticipants: 1 }],
    });

    expect(screen.getByText('If no players are available, you can play with the bot.')).toBeTruthy();
    expect(screen.getByText('Bot level (vs bot)')).toBeTruthy();
    expect(screen.getByText('Easy')).toBeTruthy();
    expect(screen.getByText('Medium')).toBeTruthy();
    expect(screen.getByText('Hard')).toBeTruthy();
    expect(screen.getByText('Start vs bot')).toBeTruthy();
  });

  it('right aligns the configuration menu only on Android RTL', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'he' }]);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    renderLobbyScreen();

    const configPanel = StyleSheet.flatten(screen.getByTestId('lobby-config-panel').props.style);
    const numberRangeRow = StyleSheet.flatten(screen.getByTestId('lobby-config-number-range-row').props.style);
    const maxParticipantsRow = StyleSheet.flatten(screen.getByTestId('lobby-config-max-participants-row').props.style);
    const advancedToggle = StyleSheet.flatten(screen.getByTestId('lobby-config-advanced-toggle').props.style);

    expect(screen.getByText(he['lobby.advancedToggleShow'])).toBeTruthy();
    expect(configPanel.alignItems).toBe('flex-end');
    expect(numberRangeRow.flexDirection).toBe('row-reverse');
    expect(maxParticipantsRow.flexDirection).toBe('row-reverse');
    expect(maxParticipantsRow.justifyContent).toBe('flex-end');
    expect(advancedToggle.width).toBe('100%');
    expect(advancedToggle.alignItems).toBe('center');
  });

  it('shows only the seats summary card before saving with default settings', () => {
    renderLobbyScreen();

    expect(screen.getByTestId('lobby-summary-section')).toBeTruthy();
    expect(within(screen.getByTestId('lobby-summary-card-seats')).getByText('4')).toBeTruthy();
    expect(screen.queryByTestId('lobby-summary-card-private')).toBeNull();
    expect(screen.queryByTestId('lobby-summary-card-difficulty')).toBeNull();
    expect(screen.queryByTestId('lobby-summary-card-fractions-off')).toBeNull();
    expect(screen.queryByTestId('lobby-summary-card-fractions-partial')).toBeNull();
    expect(screen.queryByTestId('lobby-summary-card-possible-results')).toBeNull();
    expect(screen.queryByTestId('lobby-summary-card-solve-exercise')).toBeNull();
    expect(screen.queryByTestId('lobby-summary-card-timer')).toBeNull();
  });

  it('shows a red no-fractions card before saving when fractions are disabled', () => {
    renderLobbyScreen();

    fireEvent.press(screen.getByTestId('lobby-config-advanced-toggle'));
    fireEvent.press(screen.getByText('No fractions'));

    const noFractionsCard = screen.getByTestId('lobby-summary-card-fractions-off');
    const noFractionsStyle = StyleSheet.flatten(noFractionsCard.props.style);

    expect(within(noFractionsCard).getByText('No fractions')).toBeTruthy();
    expect(noFractionsStyle.borderColor).toBe('rgba(248, 113, 113, 0.46)');
  });

  it('shows active and removed fractions when only some fractions remain', () => {
    renderLobbyScreen();

    fireEvent.press(screen.getByTestId('lobby-config-advanced-toggle'));
    fireEvent.press(screen.getByText('1/4'));

    const fractionsCard = screen.getByTestId('lobby-summary-card-fractions-partial');

    expect(within(fractionsCard).getByText('1/2, 1/3, 1/5')).toBeTruthy();
    expect(within(fractionsCard).getByText('Removed: 1/4')).toBeTruthy();
  });

  it('shows cards for hidden possible results, disabled solve exercise, and a custom timer', () => {
    renderLobbyScreen();

    fireEvent.press(screen.getByTestId('lobby-config-advanced-toggle'));
    fireEvent.press(screen.getByText('Hide'));
    fireEvent.press(screen.getAllByText('Off')[0]);
    fireEvent.press(screen.getByText('Custom'));

    expect(screen.getByTestId('lobby-summary-card-possible-results')).toBeTruthy();
    expect(screen.getByTestId('lobby-summary-card-solve-exercise')).toBeTruthy();
    expect(screen.getByTestId('lobby-summary-card-timer')).toBeTruthy();
  });

  it('shows the configured summary from current table metadata for the host and joiners', () => {
    const configuredTable = {
      ...baseTable,
      currentParticipants: 2,
      showPossibleResults: false,
      timerSetting: '15' as const,
    };

    const hostRender = renderLobbyScreen({
      players: [
        { id: 'host', name: 'Host', isHost: true, isConnected: true, isBot: false },
        { id: 'guest', name: 'Guest', isHost: false, isConnected: true, isBot: false },
      ],
      tables: [configuredTable],
      isHost: true,
    });

    expect(within(screen.getByTestId('lobby-summary-card-seats')).getByText('2/4')).toBeTruthy();
    expect(screen.getByTestId('lobby-summary-card-possible-results')).toBeTruthy();
    expect(screen.getByTestId('lobby-summary-card-timer')).toBeTruthy();

    hostRender.unmount();

    renderLobbyScreen({
      players: [
        { id: 'host', name: 'Host', isHost: true, isConnected: true, isBot: false },
        { id: 'guest', name: 'Guest', isHost: false, isConnected: true, isBot: false },
      ],
      tables: [configuredTable],
      isHost: false,
    });

    expect(within(screen.getByTestId('lobby-summary-card-seats')).getByText('2/4')).toBeTruthy();
    expect(screen.getByTestId('lobby-summary-card-possible-results')).toBeTruthy();
    expect(screen.getByTestId('lobby-summary-card-timer')).toBeTruthy();
  });
});
