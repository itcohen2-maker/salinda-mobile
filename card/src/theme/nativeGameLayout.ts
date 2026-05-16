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
  const timerTop = Math.round(tableTop + tableHeight + 32 - compactRatio * 12);
  const bottomControlClearance = isAndroid ? 14 : 10;
  const bottomControlTop = Math.max(0, safeHeight - handBottom + bottomControlClearance);
  const goldActionButtonTopBase = Math.max(96, Math.min(680, safeHeight - Math.round(140 + compactRatio * 40)));
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
