const appJson = require('./app.json');
const config = appJson.expo;

const APP_ENV = process.env.APP_ENV ?? 'production';
const AUTH_SCHEME = process.env.EXPO_PUBLIC_AUTH_SCHEME;
const isDev = APP_ENV === 'development' || AUTH_SCHEME === 'salinda-dev';

// Build-time stamp for the in-app "last update" label. Evaluated whenever the
// Expo config is resolved (Metro start / EAS build), so it auto-refreshes on
// every build instead of being a hand-edited constant. Format: DD.MM.YYYY, HH:MM.
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const LAST_PUSH = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())}`;

module.exports = {
  expo: {
    ...config,
    scheme: isDev ? 'salinda-dev' : 'salinda',
    android: {
      ...config.android,
      package: isDev ? 'com.salinda.game.dev' : 'com.salinda.game',
    },
    extra: {
      ...config.extra,
      lastPush: LAST_PUSH,
    },
  },
};
