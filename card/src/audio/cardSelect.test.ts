import { Audio } from 'expo-av';

import { CARD_SELECT_SFX_OPTIONS, playCardSelectSfx, playTutorialCardSelectSfx } from './cardSelect';
import { getAudioLoadStatus, getAudioReplayStatus } from './playbackStatus';
import { playSfx } from './sfx';

jest.mock('./sfx', () => ({
  isSfxMuted: jest.fn(() => false),
  playSfx: jest.fn(),
}));

describe('playCardSelectSfx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes card selection through the shared tap sfx', async () => {
    await playCardSelectSfx();

    expect(playSfx).toHaveBeenCalledWith('tap', CARD_SELECT_SFX_OPTIONS);
  });

  it('keeps tutorial card selection on the dedicated asset cue', async () => {
    const mockSound = {
      replayAsync: jest.fn().mockResolvedValue(undefined),
      unloadAsync: jest.fn().mockResolvedValue(undefined),
      setOnPlaybackStatusUpdate: jest.fn(),
    };
    const createAsyncMock = Audio.Sound.createAsync as jest.Mock;
    createAsyncMock.mockResolvedValue({ sound: mockSound });
    const tutorialCardSelectAsset = require('../../assets/card_select.mov');

    await playTutorialCardSelectSfx();

    expect(createAsyncMock).toHaveBeenCalledWith(tutorialCardSelectAsset, getAudioLoadStatus());
    expect(mockSound.replayAsync).toHaveBeenCalledWith(getAudioReplayStatus());
    expect(playSfx).not.toHaveBeenCalled();
  });
});
