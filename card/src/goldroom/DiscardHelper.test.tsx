import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DiscardHelper, type DiscardOption } from './DiscardHelper';

const OPTIONS: DiscardOption[] = [
  { value: 6, equation: '2 + 4 = 6' },
  { value: 9, equation: '4 + 5 = 9' },
];

describe('DiscardHelper', () => {
  it('starts with the green button showing the option count, no mini-cards', () => {
    const { getByTestId, queryByTestId } = render(<DiscardHelper options={OPTIONS} />);
    expect(getByTestId('discard-helper-green')).toBeTruthy();
    expect(getByTestId('discard-helper-badge').props.children).toBe(2);
    expect(queryByTestId('discard-helper-red')).toBeNull();
    expect(queryByTestId('discard-helper-orange')).toBeNull();
    expect(queryByTestId('discard-helper-mini-row')).toBeNull();
  });

  it('pressing green replaces it with red in the same action slot and shows mini-cards only', () => {
    const onOpenChange = jest.fn();
    const { getByTestId, queryByTestId } = render(<DiscardHelper options={OPTIONS} onOpenChange={onOpenChange} />);
    fireEvent.press(getByTestId('discard-helper-green'));
    expect(queryByTestId('discard-helper-green')).toBeNull();
    expect(queryByTestId('discard-helper-orange')).toBeNull();
    expect(getByTestId('discard-helper-red')).toBeTruthy();
    expect(getByTestId('discard-helper-mini-row')).toBeTruthy();
    expect(queryByTestId('discard-helper-mini-help')).toBeNull();
    expect(getByTestId('discard-helper-red-text').props.children).toBeTruthy();
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('tapping a mini-card shows its equation in the red surface', () => {
    const { getByTestId } = render(<DiscardHelper options={OPTIONS} />);
    fireEvent.press(getByTestId('discard-helper-green'));
    fireEvent.press(getByTestId('discard-helper-mini-9'));
    expect(getByTestId('discard-helper-red-text').props.children).toBe('4 + 5 = 9');
  });

  it('notifies the parent when opened after prior helper uses', () => {
    const onRequestOpen = jest.fn();
    const { getByTestId } = render(
      <DiscardHelper options={OPTIONS} helpUsageCount={2} onRequestOpen={onRequestOpen} />,
    );
    fireEvent.press(getByTestId('discard-helper-green'));
    expect(onRequestOpen).toHaveBeenCalledTimes(1);
  });
});
