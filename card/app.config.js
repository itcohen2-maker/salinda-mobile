const appJson = require('./app.json');
const config = appJson.expo;

const APP_ENV = process.env.APP_ENV ?? 'production';
const AUTH_SCHEME = process.env.EXPO_PUBLIC_AUTH_SCHEME;
const isDev = APP_ENV === 'development' || AUTH_SCHEME === 'salinda-dev';

// Build-time stamp for the in-app "last update" label. Evaluated whenever the
// Expo config is resolved (Metro start / EAS build / Vercel web build), so it
// auto-refreshes on every deploy instead of being a hand-edited constant.
// Always rendered in Israel local time (Vercel builds run in UTC, so without an
// explicit timeZone the HH:MM would be ~3h off). Format: DD.MM.YYYY, HH:MM.
const LAST_PUSH = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).format(new Date()).replace(/\//g, '.');

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
