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
  const goldActionButtonTopBase = Math.max(96, Math.min(680, safeHeight - Math.round(140 + compactRatio * 40)));
  // The fan cards visually extend below their layout strip, so lower action
  // buttons need to start after the rendered fan, not merely after the strip.
  const visualFanBottom = safeHeight - handBottom - metrics.stripHeight + 195;
  const lowerActionBottomReserve = 60;
  const belowFanActionTop = Math.min(
    safeHeight - lowerActionBottomReserve,
    Math.max(
      safeHeight - Math.round(110 - compactRatio * 25),
      visualFanBottom + 32,
    ),
  );
  const goldActionButtonTop = isAndroid
    ? Math.max(goldActionButtonTopBase, belowFanActionTop)
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
