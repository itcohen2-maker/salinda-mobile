import { resolveStoredSoundsEnabled } from './preferences';

describe('resolveStoredSoundsEnabled', () => {
  it('defaults to enabled when no value was stored yet', () => {
    expect(resolveStoredSoundsEnabled(null)).toBe(true);
    expect(resolveStoredSoundsEnabled(undefined)).toBe(true);
  });

  it('keeps an explicit disabled preference', () => {
    expect(resolveStoredSoundsEnabled('false')).toBe(false);
  });

  it('keeps an explicit enabled preference', () => {
    expect(resolveStoredSoundsEnabled('true')).toBe(true);
  });
});
