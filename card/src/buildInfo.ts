import Constants from 'expo-constants';

// The "last update" stamp shown in the lobby. Sourced from app.config.js, which
// injects the build time into expo.extra.lastPush on every build (Metro/EAS), so
// it stays current automatically. The literal below is only a fallback for
// environments where the resolved config isn't available (e.g. unit tests).
const injected = Constants.expoConfig?.extra?.lastPush;
export const LAST_PUSH: string =
  typeof injected === 'string' && injected.trim().length > 0 ? injected.trim() : '02.06.2026, 14:23';
