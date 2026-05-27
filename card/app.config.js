const appJson = require('./app.json');
const config = appJson.expo;

const APP_ENV = process.env.APP_ENV ?? 'production';
const isDev = APP_ENV === 'development';

module.exports = {
  expo: {
    ...config,
    scheme: isDev ? 'salinda-dev' : 'salinda',
    android: {
      ...config.android,
      package: isDev ? 'com.salinda.game.dev' : 'com.salinda.game',
    },
  },
};
