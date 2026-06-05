import React from 'react';
import { Platform, View } from 'react-native';

type AdSlotProps = {
  slot: 'skyscraper' | 'leaderboard';
  visible?: boolean;
};

const SIZES: Record<string, { width: number; height: number }> = {
  skyscraper: { width: 160, height: 600 },
  leaderboard: { width: 728, height: 90 },
};

export function AdSlot({ slot, visible = true }: AdSlotProps) {
  if (Platform.OS !== 'web' || !visible) return null;
  const { width, height } = SIZES[slot];
  return (
    <View
      style={{
        width,
        height,
        backgroundColor: '#0a1628',
        borderColor: '#1e293b',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    />
  );
}
