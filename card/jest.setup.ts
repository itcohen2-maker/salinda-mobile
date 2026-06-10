// Shared Jest setup — mocks for native modules imported transitively by index.tsx
// Required because jest-expo does not stub all Expo native modules, and some
// peer dependencies are not installed in the test environment.
//
// This file is referenced from jest.config.js via setupFilesAfterEach so every
// test that imports from ../../index (etc.) inherits the mocks automatically.
// Do NOT duplicate these mocks in individual test files.

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const interpolate = (value: number, input: number[], output: number[]) => {
    if (input.length === 0 || output.length === 0) return value;
    if (value <= input[0]) return output[0];
    for (let i = 1; i < input.length; i += 1) {
      if (value <= input[i]) {
        const span = input[i] - input[i - 1] || 1;
        const pct = (value - input[i - 1]) / span;
        return output[i - 1] + pct * (output[i] - output[i - 1]);
      }
    }
    return output[output.length - 1];
  };
  return {
    __esModule: true,
    default: {
      View: React.forwardRef((props: any, ref: any) => React.createElement(View, { ...props, ref })),
    },
    interpolate,
    runOnJS: (fn: (...args: any[]) => any) => fn,
    useAnimatedStyle: (fn: () => any) => fn(),
    useSharedValue: (value: any) => ({ value }),
    withSequence: (...values: any[]) => values[values.length - 1],
    withSpring: (value: any) => value,
    withTiming: (value: any, _config?: any, callback?: (finished: boolean) => void) => {
      if (callback) callback(true);
      return value;
    },
  };
});

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          playAsync: jest.fn(),
          replayAsync: jest.fn(),
          stopAsync: jest.fn(),
          unloadAsync: jest.fn(),
          setVolumeAsync: jest.fn(),
          setPositionAsync: jest.fn(),
          getStatusAsync: jest.fn().mockResolvedValue({ isLoaded: true, isPlaying: false }),
          setOnPlaybackStatusUpdate: jest.fn(),
        },
      }),
    },
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('expo-navigation-bar', () => ({
  setBackgroundColorAsync: jest.fn().mockResolvedValue(undefined),
  setButtonStyleAsync: jest.fn().mockResolvedValue(undefined),
  setBehaviorAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@expo-google-fonts/fredoka', () => ({
  useFonts: jest.fn().mockReturnValue([true, null]),
  Fredoka_700Bold: 'Fredoka_700Bold',
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      signInAnonymously: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signUp: jest.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
      signInWithPassword: jest.fn(),
      signInWithOAuth: jest.fn(),
      exchangeCodeForSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      setSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      updateUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({ select: jest.fn(), insert: jest.fn(), update: jest.fn(), delete: jest.fn(), eq: jest.fn(), single: jest.fn() })),
    rpc: jest.fn(),
  })),
}));
