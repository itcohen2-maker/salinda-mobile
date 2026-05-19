import {
  DEFAULT_SALINDA_VOLUME_RATIO,
  getDefaultSalindaVolume,
  resolveRestoredSalindaVolume,
  resolveStoredSalindaVolume,
} from './musicPreferences';

describe('musicPreferences', () => {
  it('derives a modest audible default salinda volume from the max volume', () => {
    expect(DEFAULT_SALINDA_VOLUME_RATIO).toBe(0.45);
    expect(getDefaultSalindaVolume(0.55)).toBe(0.25);
    expect(getDefaultSalindaVolume(0.4)).toBe(0.18);
  });

  it('restores the default when no value was stored yet', () => {
    expect(resolveStoredSalindaVolume(null, 0.55)).toBe(0.25);
    expect(resolveStoredSalindaVolume(undefined, 0.4)).toBe(0.18);
  });

  it('keeps explicit stored values including mute', () => {
    expect(resolveStoredSalindaVolume('0', 0.55)).toBe(0);
    expect(resolveStoredSalindaVolume('0.31', 0.55)).toBe(0.31);
    expect(resolveStoredSalindaVolume('9', 0.55)).toBe(0.55);
  });

  it('falls back to the default when the stored value is invalid', () => {
    expect(resolveStoredSalindaVolume('bad', 0.55)).toBe(0.25);
  });

  it('migrates legacy silent zero values to the default until the user adjusts music', () => {
    expect(resolveRestoredSalindaVolume('0', 0.55, false)).toBe(0.25);
    expect(resolveRestoredSalindaVolume('0.31', 0.55, false)).toBe(0.31);
    expect(resolveRestoredSalindaVolume(null, 0.55, false)).toBe(0.25);
  });

  it('honors an explicit user mute after the music control was adjusted', () => {
    expect(resolveRestoredSalindaVolume('0', 0.55, true)).toBe(0);
  });
});
