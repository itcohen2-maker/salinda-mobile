export const SOUNDS_ENABLED_STORAGE_KEY = 'salinda_sounds_enabled';

export function resolveStoredSoundsEnabled(value: string | null | undefined): boolean {
  return value == null ? true : value === 'true';
}
