import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import StartScreen from './StartScreen';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

const mockDispatch = jest.fn();

jest.mock('../../hooks/useGame', () => ({
  useGame: () => ({
    dispatch: mockDispatch,
  }),
}));

jest.mock('../../hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: jest.fn(),
}));

jest.mock('../../i18n/LocaleContext', () => ({
  useLocale: () => ({
    t: (key: string) => key,
    isRTL: false,
  }),
}));

jest.mock('../branding/SalindaLogoOption06', () => {
  const React = require('react');
  return function MockLogo() {
    return React.createElement('Logo');
  };
});

const mockUseResponsiveLayout = useResponsiveLayout as jest.MockedFunction<typeof useResponsiveLayout>;

describe('StartScreen responsive layout', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
  });

  it('stacks top actions and difficulty controls on narrow layouts', () => {
    mockUseResponsiveLayout.mockReturnValue({
      width: 360,
      height: 740,
      fontScale: 1.3,
      isTight: true,
      isCompact: true,
      isSingleColumn: true,
      isTablet: false,
    });

    render(
      <StartScreen
        onBackToChoice={jest.fn()}
        onHowToPlay={jest.fn()}
        onShop={jest.fn()}
        preferredName="Noa"
      />,
    );

    expect(StyleSheet.flatten(screen.getByTestId('start-top-actions').props.style).flexDirection).toBe('column');
    expect(StyleSheet.flatten(screen.getByTestId('start-difficulty-row').props.style).flexDirection).toBe('column');
    expect(StyleSheet.flatten(screen.getByTestId('start-play-button').props.style).width).toBe('100%');
  });

  it('keeps horizontal controls when the layout is roomy enough', () => {
    mockUseResponsiveLayout.mockReturnValue({
      width: 480,
      height: 900,
      fontScale: 1,
      isTight: false,
      isCompact: false,
      isSingleColumn: false,
      isTablet: false,
    });

    render(
      <StartScreen
        onBackToChoice={jest.fn()}
        onHowToPlay={jest.fn()}
        onShop={jest.fn()}
        preferredName="Noa"
      />,
    );

    expect(StyleSheet.flatten(screen.getByTestId('start-top-actions').props.style).flexDirection).toBe('row');
    expect(StyleSheet.flatten(screen.getByTestId('start-difficulty-row').props.style).flexDirection).toBe('row');
    expect(StyleSheet.flatten(screen.getByTestId('start-play-button').props.style).width).toBe(220);
  });
});
