import { Audio } from 'expo-av';

import { createBotDemonstrator } from './BotDemonstrator';
import { tutorialBus } from './tutorialBus';
import { getAudioLoadStatus, getAudioReplayStatus } from '../audio/playbackStatus';
import { isSfxMuted, playSfx } from '../audio/sfx';

jest.mock('./tutorialBus', () => ({
  tutorialBus: {
    emitFanDemo: jest.fn(),
    getFanLength: jest.fn(() => 0),
    getL4Config: jest.fn(() => null),
    getL6CopyConfig: jest.fn(() => null),
    getL11Config: jest.fn(() => null),
  },
}));

jest.mock('../audio/playbackStatus', () => ({
  getAudioLoadStatus: jest.fn(() => ({ shouldPlay: false })),
  getAudioReplayStatus: jest.fn(() => ({ shouldPlay: true })),
}));

jest.mock('../audio/sfx', () => ({
  isSfxMuted: jest.fn(() => false),
  playSfx: jest.fn(),
}));

describe('createBotDemonstrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps tutorial card staging on the dedicated card-select asset', async () => {
    const mockSound = {
      replayAsync: jest.fn().mockResolvedValue(undefined),
      unloadAsync: jest.fn().mockResolvedValue(undefined),
      setOnPlaybackStatusUpdate: jest.fn(),
    };
    const createAsyncMock = Audio.Sound.createAsync as jest.Mock;
    createAsyncMock.mockResolvedValue({ sound: mockSound });
    const cardSelectAsset = require('../../assets/card_select.mov');

    const api = createBotDemonstrator();
    const stagePromise = api.stageCardByValue(12);

    await Promise.resolve();

    expect(tutorialBus.emitFanDemo).toHaveBeenCalledWith({ kind: 'stageCardByValue', value: 12 });
    expect(createAsyncMock).toHaveBeenCalledWith(cardSelectAsset, getAudioLoadStatus());
    expect(mockSound.replayAsync).toHaveBeenCalledWith(getAudioReplayStatus());
    expect(playSfx).not.toHaveBeenCalled();
    expect(isSfxMuted).toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    await stagePromise;
  });
});
