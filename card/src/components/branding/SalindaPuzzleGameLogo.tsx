import React from 'react';
import { Image, View } from 'react-native';

const LOGO = require('../../../assets/branding/salinda-puzzle-game-logo.png');
const LOGO_W = 1048;
const LOGO_H = 307;

export type SalindaPuzzleGameLogoProps = {
  width?: number;
};

export default function SalindaPuzzleGameLogo({ width = 280 }: SalindaPuzzleGameLogoProps) {
  const height = (width * LOGO_H) / LOGO_W;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Salinda Puzzle Game">
      <Image source={LOGO} style={{ width, height }} resizeMode="contain" />
    </View>
  );
}
