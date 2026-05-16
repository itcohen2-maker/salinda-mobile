import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { CoinAwardCelebrationCard } from './CoinAwardCelebrationCard';

jest.mock('../../components/SlindaCoin', () => ({
  SlindaCoin: ({ size }: { size: number }) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View accessibilityLabel={`coin-${size}`} />;
  },
}));

describe('CoinAwardCelebrationCard', () => {
  it('renders the coin amount and copy', () => {
    const { getByText } = render(
      <CoinAwardCelebrationCard
        amount={1}
        badge="End-of-turn bonus"
        title="You received a new coin"
        body="The excellence meter filled up."
        variant="inline"
      />,
    );

    expect(getByText('End-of-turn bonus')).toBeTruthy();
    expect(getByText('You received a new coin')).toBeTruthy();
    expect(getByText('+1')).toBeTruthy();
    expect(getByText('The excellence meter filled up.')).toBeTruthy();
  });

  it('renders a continue button when requested', () => {
    const { getByText } = render(
      <CoinAwardCelebrationCard
        amount={3}
        title="Coins added"
        body="Ready to continue."
        continueLabel="Continue"
        onContinue={() => {}}
      />,
    );

    expect(getByText('+3')).toBeTruthy();
    expect(getByText('Continue')).toBeTruthy();
  });

  it('renders the mini inline variant for turn transition', () => {
    const { getByLabelText, getByTestId, getByText } = render(
      <CoinAwardCelebrationCard
        amount={2}
        badge="Turn bonus"
        title="Coins added"
        body="Compact reward summary"
        variant="inline"
        size="mini"
        testID="turn-coin-celebration"
      />,
    );

    const coinShellStyle = StyleSheet.flatten(getByTestId('turn-coin-celebration-coin-shell').props.style);

    expect(getByTestId('turn-coin-celebration-title-row')).toBeTruthy();
    expect(getByLabelText('coin-28')).toBeTruthy();
    expect(getByText('Turn bonus')).toBeTruthy();
    expect(getByText('+2')).toBeTruthy();
    expect(getByText('Coins added').props.numberOfLines).toBe(2);
    expect(getByText('Compact reward summary').props.numberOfLines).toBe(2);
    expect(coinShellStyle.backgroundColor).toBe('transparent');
    expect(coinShellStyle.borderWidth).toBe(0);
  });
});
