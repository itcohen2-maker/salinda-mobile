import Constants from 'expo-constants';

// Single source of truth for the human-readable app version shown in the UI.
// Reads the RESOLVED Expo config (app.config.js → app.json "version"), so bumping
// app.json's "version" updates every on-screen version badge automatically —
// instead of the value being hardcoded per screen and drifting out of date.
export const APP_VERSION: string = Constants.expoConfig?.version?.trim() || '1.0.0';

// Manual website release date shown in the main lobby header.
// Update this when a new website build/version goes live.
export const WEBSITE_LAST_UPDATED = '04/06/2026';
