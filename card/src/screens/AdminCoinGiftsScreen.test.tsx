import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { useAdminAccess } from '../admin/useAdminAccess';
import { grantAdminCoins } from '../admin/grantCoins';
import { AdminCoinGiftsScreen } from './AdminCoinGiftsScreen';

jest.mock('../admin/useAdminAccess', () => ({
  useAdminAccess: jest.fn(),
}));

jest.mock('../admin/grantCoins', () => ({
  findAdminCoinGiftTarget: jest.fn(),
  grantAdminCoins: jest.fn(),
}));

jest.mock('../i18n/LocaleContext', () => ({
  useLocale: () => ({
    isRTL: false,
    locale: 'en',
  }),
}));

describe('AdminCoinGiftsScreen', () => {
  const mockUseAdminAccess = useAdminAccess as jest.Mock;
  const mockGrantAdminCoins = grantAdminCoins as jest.Mock;

  beforeEach(() => {
    mockUseAdminAccess.mockReset();
    mockGrantAdminCoins.mockReset();
  });

  it('shows a restricted message for non-admin users', () => {
    mockUseAdminAccess.mockReturnValue({ isAdmin: false, loading: false });

    render(<AdminCoinGiftsScreen onBack={jest.fn()} />);

    expect(screen.getByText('Access restricted')).toBeTruthy();
  });

  it('submits a coin gift for admins', async () => {
    mockUseAdminAccess.mockReturnValue({ isAdmin: true, loading: false });
    mockGrantAdminCoins.mockResolvedValue({
      nextBalance: 1350,
      status: 'ok',
      target: {
        id: 'target-1',
        totalCoins: 1000,
        username: 'player_abc123',
      },
    });

    render(<AdminCoinGiftsScreen onBack={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('admin-coins-username'), 'player_abc123');
    fireEvent.changeText(screen.getByTestId('admin-coins-amount'), '350');
    fireEvent.changeText(screen.getByTestId('admin-coins-reason'), 'support gift');
    fireEvent.press(screen.getByTestId('admin-coins-submit'));

    await waitFor(() => {
      expect(mockGrantAdminCoins).toHaveBeenCalledWith({
        amount: 350,
        reason: 'support gift',
        username: 'player_abc123',
      });
      expect(screen.getByText('Added 350 coins to player_abc123.')).toBeTruthy();
      expect(screen.getByText('Balance after gift: 1350')).toBeTruthy();
    });
  });
});
