import React from 'react';
import { act, render } from '@testing-library/react-native';

import ExcellenceMeter from './ExcellenceMeter';
import { playMeterCelebrateSequence } from '../src/audio/sfx';

jest.mock('../src/audio/sfx', () => ({
  playMeterCelebrateSequence: jest.fn(),
  playSfx: jest.fn(),
}));

describe('ExcellenceMeter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('plays the celebration sequence when a celebrate pulse arrives', () => {
    const { rerender } = render(<ExcellenceMeter value={0} />);

    act(() => {
      rerender(<ExcellenceMeter value={0} pulseKey={1} isCelebrating />);
      jest.runOnlyPendingTimers();
    });

    expect(playMeterCelebrateSequence).toHaveBeenCalledTimes(1);
    expect(playMeterCelebrateSequence).toHaveBeenCalledWith({
      cooldownMs: 0,
      volumeOverride: 0.8,
    });
  });

  it('does not play the celebration sequence for a regular pulse', () => {
    const { rerender } = render(<ExcellenceMeter value={33} />);

    act(() => {
      rerender(<ExcellenceMeter value={66} pulseKey={1} isCelebrating={false} />);
      jest.runOnlyPendingTimers();
    });

    expect(playMeterCelebrateSequence).not.toHaveBeenCalled();
  });
});
