// src/audio/sfx.test.ts

// sfx.ts uses module-level state — reset between tests by re-importing
// We use jest.resetModules() so each test gets a fresh module instance.

describe('sfx — initializeSfx', () => {
  let sfx: typeof import('./sfx');
  let mockSetAudioModeAsync: jest.Mock;
  let mockCreateAsync: jest.Mock;

  beforeEach(() => {
    jest.resetModules();

    mockSetAudioModeAsync = jest.fn().mockResolvedValue(undefined);
    mockCreateAsync = jest.fn().mockResolvedValue({
      sound: {
        playAsync: jest.fn(),
        replayAsync: jest.fn(),
        stopAsync: jest.fn(),
        unloadAsync: jest.fn(),
        setVolumeAsync: jest.fn(),
        setOnPlaybackStatusUpdate: jest.fn(),
      },
    });

    // sfx.ts imports: { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av'
    // InterruptionModeIOS and InterruptionModeAndroid must be top-level exports in the mock.
    jest.doMock('expo-av', () => ({
      Audio: {
        Sound: { createAsync: mockCreateAsync },
        setAudioModeAsync: mockSetAudioModeAsync,
        setIsEnabledAsync: undefined,
      },
      InterruptionModeIOS: { MixWithOthers: 'MixWithOthers' },
      InterruptionModeAndroid: { DoNotMix: 'DoNotMix', DuckOthers: 'DuckOthers' },
    }));

    jest.doMock('react-native', () => ({
      AppState: {
        addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
        currentState: 'active',
      },
      Platform: { OS: 'android' },
    }));

    sfx = require('./sfx');
  });

  afterEach(async () => {
    await sfx.disposeSfx();
    jest.resetAllMocks();
  });

  it('retries initialization after a failure', async () => {
    mockSetAudioModeAsync.mockRejectedValueOnce(new Error('audio focus denied'));

    await sfx.initializeSfx();  // first call — fails
    expect(mockSetAudioModeAsync).toHaveBeenCalledTimes(1);

    await sfx.initializeSfx();  // second call — should retry, not be a no-op
    expect(mockSetAudioModeAsync).toHaveBeenCalledTimes(2);
  });

  it('does not reinitialize after success', async () => {
    await sfx.initializeSfx();
    await sfx.initializeSfx();

    expect(mockSetAudioModeAsync).toHaveBeenCalledTimes(1);
  });

  it('does not call setAudioModeAsync when playing a sound after init', async () => {
    await sfx.initializeSfx();
    mockSetAudioModeAsync.mockClear();  // reset call count after init

    await sfx.playSfx('tap', { cooldownMs: 0 });

    expect(mockSetAudioModeAsync).not.toHaveBeenCalled();
  });
});
