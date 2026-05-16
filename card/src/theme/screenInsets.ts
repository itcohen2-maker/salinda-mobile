import { Platform, StatusBar } from 'react-native';

export function getScreenSafeTop(insetsTop: number): number {
  const androidStatusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
  const androidMinTop = Platform.OS === 'android' ? 32 : 0;
  const androidExtraTop = Platform.OS === 'android' ? 6 : 0;
  return Math.max(insetsTop, androidStatusBarHeight, androidMinTop) + androidExtraTop;
}
