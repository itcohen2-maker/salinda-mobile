import { getNativeHandFanMetrics } from './nativeHandFan';
import { clamp } from './webLayout';

export type NativeGameLayout = {
  compactRatio: number;
  handBottom: number;
  tableTop: number;
  tableHeight: number;
  resultsTop: number;
  parensTop: number;
  timerTop: number;
  bottomControlTop: number;
  goldActionButtonTop: number;
  handStripHeight: number;
};

export function getNativeGameLayout(viewportHeight: number, platform: string): NativeGameLayout {
  const safeHeight = Math.max(0, Math.round(viewportHeight || 0));
  const metrics = getNativeHandFanMetrics(platform);
  const isAndroid = platform === 'android';
  const compactRatio = isAndroid ? clamp((820 - safeHeight) / 100, 0, 1) : 0;
  const tableTop = Math.round(205 - compactRatio * 20);
  const tableHeight = Math.round(240 - compactRatio * 20);
  const handBottom = Math.round(clamp(195 - compactRatio * 40, 152, 195));
  const resultsTop = Math.round(84 - compactRatio * 8);
  const parensTop = Math.round(170 - compactRatio * 14);
  // Matches the pre-nativeGameLayout fallback of 400 for iOS (compactRatio=0).
  // +32 placed the fuse at 517px — inside the hand-fan zone (starts ~509) — so
  // we restore -45 which gives 400 on iOS and scales down with compact Android.
  const timerTop = Math.round(tableTop + tableHeight - 45 - compactRatio * 12);
  const bottomControlClearance = isAndroid ? 14 : 10;
  const bottomControlTop = Math.max(0, safeHeight - handBottom + bottomControlClearance);
  // Anchor 100px below the fan strip bottom (safeHeight - handBottom).
  // Cards overflow ~15px below the strip; 100px ensures ~85px clear space,
  // placing the button near the bottom of the screen on tall phones.
  // The old Min(680) cap landed inside the fan on tall phones (930px+).
  const goldActionButtonTopBase = Math.max(96, safeHeight - Math.max(handBottom - 100, 60));
  const goldActionButtonTop = isAndroid
    ? Math.max(goldActionButtonTopBase, bottomControlTop)
    : goldActionButtonTopBase;

  return {
    compactRatio,
    handBottom,
    tableTop,
    tableHeight,
    resultsTop,
    parensTop,
    timerTop,
    bottomControlTop,
    goldActionButtonTop,
    handStripHeight: metrics.stripHeight,
  };
}
