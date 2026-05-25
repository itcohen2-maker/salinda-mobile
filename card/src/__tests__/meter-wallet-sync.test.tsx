import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { LocaleProvider } from '../i18n/LocaleContext';

const mockAwardCoins = jest.fn().mockResolvedValue('ok');
const mockUseMultiplayerOptional = jest.fn();

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    awardCoins: mockAwardCoins,
  }),
}));

jest.mock('../hooks/useMultiplayer', () => ({
  useMultiplayerOptional: () => mockUseMultiplayerOptional(),
}));

describe('meter wallet sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not sync excellence-meter coins from online override state', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GameProvider, initialState } = require('../../index');

    mockUseMultiplayerOptional.mockReturnValue({
      serverState: { id: 'server-state-present' },
      gameOverride: {
        state: {
          ...initialState,
          phase: 'turn-transition',
          players: [],
          currentPlayerIndex: 0,
          lastCourageCoinsAwarded: true,
          courageRewardPulseId: 3,
          isTutorial: false,
        },
        dispatch: jest.fn(),
      },
    });

    render(
      <LocaleProvider>
        <GameProvider>
          <Text>meter</Text>
        </GameProvider>
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(mockAwardCoins).not.toHaveBeenCalled();
    });
  }, 15000);
});
