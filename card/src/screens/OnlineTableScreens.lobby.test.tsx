import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
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

function renderLobbyScreen(
  overrides: Record<string, unknown> = {},
  onStartLocalBotGame: jest.Mock = jest.fn(),
) {
  mockUseMultiplayer.mockReturnValue({
    roomCode: '4821',
    currentInviteCode: null,
    currentTableVisibility: 'public',
    currentRoomTable: null,
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
        <LobbyScreen onStartLocalBotGame={onStartLocalBotGame} />
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

  it('keeps the room configured as 2 seats even after the table leaves the public list', () => {
    renderLobbyScreen({
      currentRoomTable: {
        ...baseTable,
        status: 'full',
        currentParticipants: 2,
        maxParticipants: 2,
      },
      players: [
        { id: 'host', name: 'Host', isHost: true, isConnected: true, isBot: false },
        { id: 'guest', name: 'Guest', isHost: false, isConnected: true, isBot: false },
      ],
      tables: [],
      isHost: false,
    });

    expect(within(screen.getByTestId('lobby-summary-card-seats')).getByText('2/2')).toBeTruthy();
    expect(screen.getByText('Players in room (2/2)')).toBeTruthy();
  });

  it('auto-starts from the host client when a 2-seat room becomes full', async () => {
    const startTableCountdown = jest.fn();

    renderLobbyScreen({
      currentRoomTable: {
        ...baseTable,
        status: 'full',
        currentParticipants: 2,
        maxParticipants: 2,
      },
      players: [
        { id: 'host', name: 'Host', isHost: true, isConnected: true, isBot: false },
        { id: 'guest', name: 'Guest', isHost: false, isConnected: true, isBot: false },
      ],
      tables: [],
      isHost: true,
      startTableCountdown,
    });

    await waitFor(() => {
      expect(startTableCountdown).toHaveBeenCalledTimes(1);
    });
  });

  it('does not auto-start from the host client before a 4-seat table is full', () => {
    const configureTable = jest.fn();
    const startTableCountdown = jest.fn();
    const tree = (
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <LocaleProvider>
          <LobbyScreen onStartLocalBotGame={jest.fn()} />
        </LocaleProvider>
      </SafeAreaProvider>
    );

    mockUseMultiplayer.mockReturnValue({
      roomCode: '4821',
      currentInviteCode: null,
      currentTableVisibility: 'public',
      players: [{ id: 'host', name: 'Host', isHost: true, isConnected: true, isBot: false }],
      tables: [],
      isHost: true,
      configureTable,
      startTableCountdown,
      leaveRoom: jest.fn(),
      error: null,
      clearError: jest.fn(),
      toast: null,
      clearToast: jest.fn(),
      serverUrl: 'https://lolos-mobile.onrender.com',
    });

    const view = render(tree);
    fireEvent.press(screen.getByText('Save'));
    expect(configureTable).toHaveBeenCalledTimes(1);

    mockUseMultiplayer.mockReturnValue({
      roomCode: '4821',
      currentInviteCode: null,
      currentTableVisibility: 'public',
      players: [
        { id: 'host', name: 'Host', isHost: true, isConnected: true, isBot: false },
        { id: 'guest-1', name: 'Guest 1', isHost: false, isConnected: true, isBot: false },
      ],
      tables: [{ ...baseTable, currentParticipants: 2, maxParticipants: 4 }],
      isHost: true,
      configureTable,
      startTableCountdown,
      leaveRoom: jest.fn(),
      error: null,
      clearError: jest.fn(),
      toast: null,
      clearToast: jest.fn(),
      serverUrl: 'https://lolos-mobile.onrender.com',
    });
    view.rerender(tree);
    expect(startTableCountdown).not.toHaveBeenCalled();

    mockUseMultiplayer.mockReturnValue({
      roomCode: '4821',
      currentInviteCode: null,
      currentTableVisibility: 'public',
      players: [
        { id: 'host', name: 'Host', isHost: true, isConnected: true, isBot: false },
        { id: 'guest-1', name: 'Guest 1', isHost: false, isConnected: true, isBot: false },
        { id: 'guest-2', name: 'Guest 2', isHost: false, isConnected: true, isBot: false },
      ],
      tables: [{ ...baseTable, currentParticipants: 3, maxParticipants: 4 }],
      isHost: true,
      configureTable,
      startTableCountdown,
      leaveRoom: jest.fn(),
      error: null,
      clearError: jest.fn(),
      toast: null,
      clearToast: jest.fn(),
      serverUrl: 'https://lolos-mobile.onrender.com',
    });
    view.rerender(tree);
    expect(startTableCountdown).not.toHaveBeenCalled();
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
    const numberRangeLabel = StyleSheet.flatten(screen.getByTestId('lobby-config-number-range-label').props.style);
    const maxParticipantsLabel = StyleSheet.flatten(screen.getByTestId('lobby-config-max-participants-label').props.style);
    const numberRangeRow = StyleSheet.flatten(screen.getByTestId('lobby-config-number-range-row').props.style);
    const maxParticipantsRow = StyleSheet.flatten(screen.getByTestId('lobby-config-max-participants-row').props.style);
    const advancedToggle = StyleSheet.flatten(screen.getByTestId('lobby-config-advanced-toggle').props.style);

    expect(screen.getByText(he['lobby.advancedToggleShow'])).toBeTruthy();
    expect(configPanel.alignItems).toBe('flex-end');
    expect(numberRangeLabel.textAlign).toBe('right');
    expect(maxParticipantsLabel.textAlign).toBe('right');
    expect(numberRangeRow.flexDirection).toBe('row-reverse');
    expect(maxParticipantsRow.flexDirection).toBe('row');
    expect(maxParticipantsRow.justifyContent).toBe('center');
    expect(advancedToggle.width).toBe('100%');
    expect(advancedToggle.alignItems).toBe('center');
  });

  it('right aligns players in room on iOS RTL', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'he' }]);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    renderLobbyScreen({
      currentRoomTable: {
        ...baseTable,
        currentParticipants: 2,
        maxParticipants: 4,
      },
      players: [
        { id: 'host', name: 'Host', isHost: true, isConnected: true, isBot: false },
        { id: 'guest', name: 'Guest', isHost: false, isConnected: true, isBot: false },
      ],
    });

    const playersInRoomLabel = StyleSheet.flatten(screen.getByTestId('lobby-players-in-room-label').props.style);

    expect(playersInRoomLabel.textAlign).toBe('right');
    expect(playersInRoomLabel.writingDirection).toBe('rtl');
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

  it('calls onStartLocalBotGame with difficulty and settings when Start vs bot is pressed', () => {
    const onStartLocalBotGame = jest.fn();

    renderLobbyScreen(
      {
        players: [{ id: 'host', name: 'Host', isHost: true, isConnected: true, isBot: false }],
        tables: [{ ...baseTable, currentParticipants: 1 }],
        isHost: true,
      },
      onStartLocalBotGame,
    );

    fireEvent.press(screen.getByText('Start vs bot'));

    expect(onStartLocalBotGame).toHaveBeenCalledTimes(1);
    expect(onStartLocalBotGame).toHaveBeenCalledWith(
      'full',
      expect.objectContaining({ botDifficulty: 'medium' }),
    );
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
