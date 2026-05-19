export const DEFAULT_SALINDA_VOLUME_RATIO = 0.45;

export function getDefaultSalindaVolume(maxVolume: number): number {
  return Math.round(Math.max(0, maxVolume) * DEFAULT_SALINDA_VOLUME_RATIO * 100) / 100;
}

export function resolveStoredSalindaVolume(
  value: string | null | undefined,
  maxVolume: number
): number {
  const clampedMax = Math.max(0, maxVolume);
  if (value == null) {
    return getDefaultSalindaVolume(clampedMax);
  }
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return getDefaultSalindaVolume(clampedMax);
  }
  return Math.max(0, Math.min(clampedMax, parsed));
}

export function resolveRestoredSalindaVolume(
  value: string | null | undefined,
  maxVolume: number,
  hasUserAdjusted: boolean
): number {
  if (hasUserAdjusted) {
    return resolveStoredSalindaVolume(value, maxVolume);
  }
  if (value == null) {
    return getDefaultSalindaVolume(maxVolume);
  }
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return getDefaultSalindaVolume(maxVolume);
  }
  if (parsed <= 0) {
    return getDefaultSalindaVolume(maxVolume);
  }
  return Math.max(0, Math.min(Math.max(0, maxVolume), parsed));
}
