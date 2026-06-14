import { useEffect, useRef } from 'react';

/**
 * Safety net for the excellence-meter UI lock.
 *
 * When the courage/excellence meter advances at end of turn, the reducer sets
 * `meterAnimationPending: true` and locks the ENTIRE game screen until an
 * `ExcellenceMeter` instance fires its `onAnimationComplete` callback, which
 * dispatches `METER_ANIMATION_DONE` to release the lock.
 *
 * The catch: the only meter wired with `onAnimationComplete` lives in the
 * left-HUD, and that meter is UNMOUNTED whenever the "results dock" is showing
 * (`hideLeftHudMeterForResultsDock`). If the meter advances while the dock is
 * up — e.g. a "consecutive success" reward on END_TURN, or a full-equation
 * reward on CONFIRM_STAGED, both of which happen in the `solved` phase — then
 * NOTHING ever dispatches `METER_ANIMATION_DONE` and the screen stays locked
 * forever. That is the observed mid-game freeze.
 *
 * This hook guarantees the lock is always released: while `pending` is true it
 * schedules a single fallback `release()` after `maxMs`. When a real meter
 * animation completes first it dispatches `METER_ANIMATION_DONE`, `pending`
 * flips false, and the cleanup cancels the fallback before it fires. So the
 * fallback is a pure no-op on the happy path and only kicks in when no meter
 * was mounted to release the lock.
 *
 * `release` is held in a ref so a fresh closure each render does not restart
 * the timer; only a `pending`/`maxMs` change (re)schedules it.
 *
 * `maxMs` defaults comfortably above the longest meter animation (the
 * celebration sequence ~1.5s) so a visible animation always wins the race.
 */
export function useMeterAnimationReleaseFallback(
  pending: boolean,
  release: () => void,
  maxMs = 3000,
): void {
  const releaseRef = useRef(release);
  releaseRef.current = release;

  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => {
      releaseRef.current();
    }, maxMs);
    return () => clearTimeout(id);
  }, [pending, maxMs]);
}
