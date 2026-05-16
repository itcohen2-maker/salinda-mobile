import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LocaleProvider } from '../i18n/LocaleContext';
import { OnlineTablesEntryScreen } from './OnlineTablesEntryScreen';

const mockJoinTable = jest.fn();
const mockJoinPrivateTable = jest.fn();
const mockRefreshTables = jest.fn();
const mockCreateTable = jest.fn();
const mockClearError = jest.fn();
const mockSetServerUrl = jest.fn();

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en' }],
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ profile: null }),
}));

jest.mock('../hooks/useMultiplayer', () => ({
  useMultiplayer: () => ({
    connected: false,
    createTable: mockCreateTable,
    joinTable: mockJoinTable,
    joinPrivateTable: mockJoinPrivateTable,
    refreshTables: mockRefreshTables,
    tables: [],
    error: null,
    clearError: mockClearError,
    setServerUrl: mockSetServerUrl,
  }),
}));

jest.mock('./OnlineTableScreens', () => ({
  LanguageToggle: () => null,
  parseJoinParamsFromUrl: () => ({}),
}));

jest.mock('./TablesLobbyScreen', () => {
  const React = require('react');
  const { Text, TextInput, TouchableOpacity, View } = require('react-native');

  return function MockTablesLobbyScreen(props: {
    onCreateTable: () => void;
    onEnterCode?: () => void;
    onPlayerNameChange: (value: string) => void;
    playerName: string;
  }) {
    return (
      <View>
        <TextInput
          testID="mock-player-name"
          value={props.playerName}
          onChangeText={props.onPlayerNameChange}
        />
        <TouchableOpacity testID="mock-create-table" onPress={props.onCreateTable}>
          <Text>Create table</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="mock-open-code-modal" onPress={props.onEnterCode}>
          <Text>Open code modal</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

describe('OnlineTablesEntryScreen', () => {
  beforeEach(() => {
    mockJoinTable.mockClear();
    mockJoinPrivateTable.mockClear();
    mockRefreshTables.mockClear();
    mockCreateTable.mockClear();
    mockClearError.mockClear();
    mockSetServerUrl.mockClear();
  });

  function renderScreen() {
    return render(
      <LocaleProvider>
        <OnlineTablesEntryScreen />
      </LocaleProvider>,
    );
  }

  it('joins a public room with just the room code', () => {
    renderScreen();

    fireEvent.changeText(screen.getByTestId('mock-player-name'), 'Noa');
    fireEvent.press(screen.getByTestId('mock-open-code-modal'));
    fireEvent.changeText(screen.getByTestId('online-code-join-room'), '1234');
    fireEvent.press(screen.getByTestId('online-code-join-submit'));

    expect(mockJoinTable).toHaveBeenCalledWith('1234', 'Noa');
    expect(mockJoinPrivateTable).not.toHaveBeenCalled();
  });

  it('joins a private room when an invite code is provided', () => {
    renderScreen();

    fireEvent.changeText(screen.getByTestId('mock-player-name'), 'Noa');
    fireEvent.press(screen.getByTestId('mock-open-code-modal'));
    fireEvent.changeText(screen.getByTestId('online-code-join-room'), '1234');
    fireEvent.changeText(screen.getByTestId('online-code-join-invite'), '987654');
    fireEvent.press(screen.getByTestId('online-code-join-submit'));

    expect(mockJoinPrivateTable).toHaveBeenCalledWith('1234', '987654', 'Noa');
    expect(mockJoinTable).not.toHaveBeenCalled();
  });

  it('shows a waiting mockup while creating a table', () => {
    renderScreen();

    fireEvent.changeText(screen.getByTestId('mock-player-name'), 'Noa');
    fireEvent.press(screen.getByTestId('mock-create-table'));

    expect(mockCreateTable).toHaveBeenCalledWith('Noa');
    expect(screen.getByTestId('creating-table-card')).toBeTruthy();
  });
});
