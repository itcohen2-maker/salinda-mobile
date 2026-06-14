import { act, renderHook } from '@testing-library/react-native';

import { useMeterAnimationReleaseFallback } from './useMeterAnimationReleaseFallback';

describe('useMeterAnimationReleaseFallback (meter-lock freeze regression)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('releases the lock after maxMs when nothing else does (the frozen-game case)', () => {
    // Reproduces the production freeze: meterAnimationPending stays true because
    // the only meter wired with onAnimationComplete is unmounted behind the
    // results dock, so METER_ANIMATION_DONE is never dispatched on its own.
    const release = jest.fn();
    renderHook(() => useMeterAnimationReleaseFallback(true, release, 3000));

    expect(release).not.toHaveBeenCalled(); // still locked right after the turn

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(release).toHaveBeenCalledTimes(1); // lock guaranteed to release
  });

  it('does nothing while not pending', () => {
    const release = jest.fn();
    renderHook(() => useMeterAnimationReleaseFallback(false, release, 3000));

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(release).not.toHaveBeenCalled();
  });

  it('cancels the fallback when the real animation releases first (happy path)', () => {
    // When a meter IS mounted, its onAnimationComplete dispatches
    // METER_ANIMATION_DONE early → pending flips false → fallback must not fire.
    const release = jest.fn();
    const { rerender } = renderHook(
      ({ pending }: { pending: boolean }) =>
        useMeterAnimationReleaseFallback(pending, release, 3000),
      { initialProps: { pending: true } },
    );

    act(() => {
      jest.advanceTimersByTime(1500); // real animation finishes ~here
    });
    rerender({ pending: false }); // reducer cleared meterAnimationPending

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(release).not.toHaveBeenCalled();
  });

  it('does not restart the timer when only the release closure identity changes', () => {
    const release = jest.fn();
    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) =>
        useMeterAnimationReleaseFallback(true, cb, 3000),
      { initialProps: { cb: () => release('first') } },
    );

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    // New closure each render (as happens in GameScreen) must not reset the timer.
    rerender({ cb: () => release('second') });
    act(() => {
      jest.advanceTimersByTime(1000); // total 3000 from mount
    });

    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith('second'); // latest closure used
  });
});
