import fs from 'fs';
import path from 'path';

type JsonObject = Record<string, unknown>;

const repoRoot = path.resolve(__dirname, '..', '..');

function readJsonFile<T extends JsonObject>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')) as T;
}

function resolveRepoAsset(assetPath: string): string {
  return path.join(repoRoot, assetPath.replace(/^\.\//, ''));
}

describe('launch screen configuration', () => {
  const appConfig = readJsonFile<{ expo: JsonObject }>('app.json').expo as {
    icon: string;
    splash: { image: string; backgroundColor: string };
    ios: { splash: { image: string; backgroundColor: string } };
    web: { splash: { image: string; backgroundColor: string } };
    updates: { checkAutomatically: string; fallbackToCacheTimeout: number };
    plugins: Array<unknown>;
  };
  const easConfig = readJsonFile<{ build: JsonObject }>('eas.json').build as {
    development: { developmentClient?: boolean };
    preview: { developmentClient?: boolean };
    production: { developmentClient?: boolean };
  };

  it('uses the branded splash asset everywhere the native splash is configured', () => {
    expect(appConfig.splash.image).toBe('./assets/splash-launch-logo.png');
    expect(appConfig.ios.splash.image).toBe('./assets/splash-launch-logo.png');
    expect(appConfig.web.splash.image).toBe('./assets/splash-launch-logo.png');

    const splashPlugin = appConfig.plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen'
    ) as [string, { image?: string; backgroundColor?: string }] | undefined;

    expect(splashPlugin).toBeDefined();
    expect(splashPlugin?.[1]?.image).toBe('./assets/splash-launch-logo.png');
  });

  it('keeps the app icon asset separate from the splash asset', () => {
    expect(appConfig.icon).toBe('./assets/icon.png');
    expect(path.normalize(appConfig.icon)).not.toBe(path.normalize(appConfig.splash.image));

    expect(fs.existsSync(resolveRepoAsset(appConfig.icon))).toBe(true);
    expect(fs.existsSync(resolveRepoAsset(appConfig.splash.image))).toBe(true);
  });

  it('keeps the native splash background dark across app config and splash plugin', () => {
    expect(appConfig.splash.backgroundColor).toBe('#121118');
    expect(appConfig.ios.splash.backgroundColor).toBe('#121118');
    expect(appConfig.web.splash.backgroundColor).toBe('#121118');

    const splashPlugin = appConfig.plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen'
    ) as [string, { image?: string; backgroundColor?: string }] | undefined;

    expect(splashPlugin?.[1]?.backgroundColor).toBe('#121118');
  });

  it('avoids launch-time OTA checks that can show the Expo update screen first', () => {
    expect(appConfig.updates.checkAutomatically).toBe('ON_ERROR_RECOVERY');
    expect(appConfig.updates.fallbackToCacheTimeout).toBe(0);
  });

  it('limits development client behavior to the development build profile', () => {
    expect(easConfig.development.developmentClient).toBe(true);
    expect(Boolean(easConfig.preview.developmentClient)).toBe(false);
    expect(Boolean(easConfig.production.developmentClient)).toBe(false);
  });
});
