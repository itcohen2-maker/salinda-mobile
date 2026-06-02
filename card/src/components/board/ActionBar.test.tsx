import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import ActionBar from './ActionBar';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

const mockDispatch = jest.fn();

jest.mock('../../hooks/useGame', () => ({
  useGame: () => ({
    dispatch: mockDispatch,
    state: {
      players: [{ id: 'p1', name: 'Noa' }],
      currentPlayerIndex: 0,
      phase: 'select-cards',
      hasPlayedCards: false,
      hasDrawnCard: false,
      activeOperation: null,
      selectedCards: [{ id: 'salinda-1' }],
      message: '',
      salindaModalOpen: true,
    },
  }),
}));

jest.mock('../../hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: jest.fn(),
}));

jest.mock('../../i18n/LocaleContext', () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('./EquationBuilder', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockEquationBuilder() {
    return React.createElement(View, { testID: 'equation-builder' });
  };
});

jest.mock('../ui/Modal', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return function MockModal({
    visible,
    title,
    children,
  }: {
    visible: boolean;
    title: string;
    children: React.ReactNode;
  }) {
    if (!visible) return null;
    return React.createElement(
      View,
      { testID: 'mock-modal' },
      React.createElement(Text, null, title),
      children,
    );
  };
});

const mockUseResponsiveLayout = useResponsiveLayout as jest.MockedFunction<typeof useResponsiveLayout>;

describe('ActionBar responsive layout', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
  });

  it('promotes stacked full-width controls on narrow android-style layouts', () => {
    mockUseResponsiveLayout.mockReturnValue({
      width: 412,
      height: 844,
      fontScale: 1.3,
      isTight: true,
      isCompact: true,
      isSingleColumn: true,
      isTablet: false,
    });

    render(<ActionBar />);

    expect(StyleSheet.flatten(screen.getByTestId('action-bar-salinda-grid').props.style).flexDirection).toBe('column');
    expect(StyleSheet.flatten(screen.getByTestId('action-bar-draw').props.style).width).toBe('100%');
    expect(StyleSheet.flatten(screen.getByTestId('action-bar-salinda-+').props.style).width).toBe('100%');
  });
});
