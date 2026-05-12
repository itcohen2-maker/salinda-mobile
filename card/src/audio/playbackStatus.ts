import type { AVPlaybackStatusToSet } from 'expo-av';

export function getAudioLoadStatus(volume?: number): AVPlaybackStatusToSet {
  return {
    shouldPlay: false,
    ...(volume == null ? {} : { volume }),
  };
}

export function getAudioReplayStatus(volume?: number): AVPlaybackStatusToSet {
  return {
    positionMillis: 0,
    shouldPlay: true,
    ...(volume == null ? {} : { volume }),
  };
}
