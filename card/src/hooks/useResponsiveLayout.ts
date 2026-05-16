import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

export type ResponsiveLayout = {
  width: number;
  height: number;
  fontScale: number;
  isTight: boolean;
  isCompact: boolean;
  isSingleColumn: boolean;
  isTablet: boolean;
};

export function buildResponsiveLayout(
  width: number,
  height: number,
  fontScale: number = 1,
): ResponsiveLayout {
  const safeWidth = Math.max(0, Math.round(width || 0));
  const safeHeight = Math.max(0, Math.round(height || 0));
  const safeFontScale = fontScale > 0 ? fontScale : 1;

  return {
    width: safeWidth,
    height: safeHeight,
    fontScale: safeFontScale,
    isTight: safeWidth < 380 || safeHeight < 760 || safeFontScale >= 1.25,
    isCompact: safeWidth < 420 || safeHeight < 860 || safeFontScale >= 1.15,
    isSingleColumn: safeWidth < 440 || safeFontScale >= 1.2,
    isTablet: safeWidth >= 760,
  };
}

export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height, fontScale } = useWindowDimensions();

  return useMemo(
    () => buildResponsiveLayout(width, height, fontScale),
    [width, height, fontScale],
  );
}
