import { Audio } from 'expo-av';

import { getAudioLoadStatus, getAudioReplayStatus } from './playbackStatus';
import { isSfxMuted, playSfx } from './sfx';

export const CARD_SELECT_SFX_OPTIONS = {
  cooldownMs: 0,
  volumeOverride: 0.24,
} as const;

const TUTORIAL_CARD_SELECT_ASSET = require('../../assets/card_select.mov');

export async function playCardSelectSfx(): Promise<void> {
  await playSfx('tap', CARD_SELECT_SFX_OPTIONS);
}

export async function playTutorialCardSelectSfx(): Promise<void> {
  if (isSfxMuted()) return;
  try {
    const { sound } = await Audio.Sound.createAsync(TUTORIAL_CARD_SELECT_ASSET, getAudioLoadStatus());
    if (isSfxMuted()) {
      sound.unloadAsync().catch(() => {});
      return;
    }
    await sound.replayAsync(getAudioReplayStatus());
    sound.setOnPlaybackStatusUpdate((status) => {
      if ((status as { didJustFinish?: boolean }).didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch {
    // Keep tutorial flow alive even if the dedicated asset is unavailable.
  }
}
