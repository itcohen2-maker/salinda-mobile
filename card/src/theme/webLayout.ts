import { getNativeHandFanMetrics } from './nativeHandFan';

export type ViewportSize = {
  width: number;
  height: number;
};

export type ContentWidthOptions = {
  maxWidth?: number;
  sidePadding?: number;
};

export type WebGameLayout = {
  viewportWidth: number;
  viewportHeight: number;
  frameHeight: number;
  contentScale: number;
  mobileCompactRatio: number;
  portraitMobileWebViewport: boolean;
  playfieldWidth: number;
  contentWidth: number;
  tableWidth: number;
  tableHeight: number;
  tableTop: number;
  tableBottomPadding: number;
  handBottom: number;
  fanCardHeight: number;
  fanCardWidth: number;
  fanViewportHeight: number;
  handStripAboveFan: number;
  handStripHeight: number;
  handZoneTop: number;
  miniResultsBottom: number;
  resultsTop: number;
  resultsRight: number;
  parensTop: number;
  timerTop: number;
  goldActionButtonTop: number;
};

export const WEB_GAME_PLAYFIELD_MAX_WIDTH = 412;
export const WEB_GAME_PLAYFIELD_MIN_HEIGHT = 900; // was 768
export const WEB_MOBILE_VIEWPORT_MAX_WIDTH = 600;
export const WEB_MOBILE_GAME_FRAME_HEIGHT = 844;
export const WEB_MOBILE_LANDSCAPE_MAX_HEIGHT = 430;
export const WEB_MOBILE_LANDSCAPE_MAX_WIDTH = 900;

function isPortraitMobileViewport(viewportWidth: number, viewportHeight: number): boolean {
  return isWebMobileViewport(viewportWidth, viewportHeight) && viewportHeight >= viewportWidth;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function isWebMobileViewport(viewportWidth: number, viewportHeight?: number): boolean {
  const safeWidth = Math.max(0, Math.round(viewportWidth || 0));
  const safeHeight = Math.max(0, Math.round(viewportHeight || 0));
  if (safeWidth <= WEB_MOBILE_VIEWPORT_MAX_WIDTH) return true;
  if (safeHeight <= 0) return false;
  const shorterSide = Math.min(safeWidth, safeHeight);
  const longerSide = Math.max(safeWidth, safeHeight);
  return (
    shorterSide <= WEB_MOBILE_LANDSCAPE_MAX_HEIGHT &&
    longerSide <= WEB_MOBILE_LANDSCAPE_MAX_WIDTH
  );
}

export function getWebContentWidth(
  viewportWidth: number,
  options: ContentWidthOptions = {},
): number {
  const maxWidth = options.maxWidth ?? 1180;
  const sidePadding = options.sidePadding ?? 32;
  const safeWidth = Math.max(320, Math.round(viewportWidth || 0));
  return Math.min(maxWidth, Math.max(320, safeWidth - sidePadding));
}

export function getWebGameLayout(viewport: ViewportSize): WebGameLayout {
  const rawViewportWidth = Math.max(0, Math.round(viewport.width || 0));
  const rawViewportHeight = Math.max(0, Math.round(viewport.height || 0));
  const viewportWidth = Math.max(320, rawViewportWidth);
  const viewportHeight = rawViewportHeight > 0 ? rawViewportHeight : 568;
  const mobileWebViewport = isWebMobileViewport(rawViewportWidth, rawViewportHeight);
  const portraitMobileWebViewport = isPortraitMobileViewport(rawViewportWidth, rawViewportHeight);
  const mobileCompactRatio = portraitMobileWebViewport
    ? clamp((WEB_MOBILE_GAME_FRAME_HEIGHT - viewportHeight) / (WEB_MOBILE_GAME_FRAME_HEIGHT - 568), 0, 1)
    : 0;
  // Phone-width web mirrors the native app frame; wider web keeps the fixed
  // desktop canvas. Neither path grows with the live viewport height.
  const frameHeight = portraitMobileWebViewport
    ? viewportHeight
    : mobileWebViewport
      ? WEB_MOBILE_GAME_FRAME_HEIGHT
      : WEB_GAME_PLAYFIELD_MIN_HEIGHT;
  const contentScale = portraitMobileWebViewport
    ? 1
    : mobileWebViewport
      ? Math.min(1, viewportHeight / frameHeight)
      : clamp(viewportHeight / frameHeight, 0.5, 1);
  const playfieldWidth = mobileWebViewport
    ? viewportWidth
    : Math.min(WEB_GAME_PLAYFIELD_MAX_WIDTH, viewportWidth);
  const contentWidth = playfieldWidth;
  const nativeIosHandFan = getNativeHandFanMetrics('ios');
  // Phone-size web should mirror the app proportions instead of the narrow
  // desktop column. Wider web still uses the fixed 900px desktop layout.
  const tableHeight = mobileWebViewport ? Math.round(240 - mobileCompactRatio * 30) : 220;
  const tableTop = mobileWebViewport ? Math.round(205 - mobileCompactRatio * 55) : 185;
  const tableBottomPadding = mobileWebViewport ? Math.round(75 - mobileCompactRatio * 20) : 65;
  const fanCardHeight = mobileWebViewport ? nativeIosHandFan.cardHeight : 140;
  const fanCardWidth = mobileWebViewport ? nativeIosHandFan.cardWidth : Math.round(fanCardHeight * 0.71);
  const fanViewportHeight = mobileWebViewport ? nativeIosHandFan.viewportHeight : Math.ceil(fanCardHeight * 1.15 + 55 - 100);
  const handStripAboveFan = mobileWebViewport ? nativeIosHandFan.stripAboveFan : 24;
  const handStripHeight = mobileWebViewport ? nativeIosHandFan.stripHeight : fanViewportHeight + handStripAboveFan;
  const handBottom = mobileWebViewport
    ? Math.round(clamp(195 - mobileCompactRatio * 155, 40, 195))
    : 155;
  const handZoneTop = handBottom + handStripHeight;
  const miniResultsBottom = handZoneTop - 10;
  const tableWidth = mobileWebViewport
    ? Math.max(300, playfieldWidth - 24)
    : clamp(playfieldWidth - 24, 300, WEB_GAME_PLAYFIELD_MAX_WIDTH - 24);
  const resultsTop = mobileWebViewport ? Math.round(84 - mobileCompactRatio * 12) : 76;
  const resultsRight = 128;
  const parensTop = mobileWebViewport ? Math.round(tableTop - 35) : 156;
  const timerTop = mobileWebViewport
    ? Math.round(tableTop + tableHeight - 45 - mobileCompactRatio * 12)
    : tableTop + tableHeight + 32;
  const handTopY = frameHeight - handZoneTop;
  const goldActionButtonTop = mobileWebViewport
    ? Math.max(96, Math.min(680, frameHeight - Math.round(140 + mobileCompactRatio * 40)))
    : Math.max(tableTop + tableHeight + 20, handTopY - 70);

  return {
    viewportWidth,
    viewportHeight,
    frameHeight,
    contentScale,
    mobileCompactRatio,
    portraitMobileWebViewport,
    playfieldWidth,
    contentWidth,
    tableWidth,
    tableHeight,
    tableTop,
    tableBottomPadding,
    handBottom,
    fanCardHeight,
    fanCardWidth,
    fanViewportHeight,
    handStripAboveFan,
    handStripHeight,
    handZoneTop,
    miniResultsBottom,
    resultsTop,
    resultsRight,
    parensTop,
    timerTop,
    goldActionButtonTop,
  };
}

export function getWebTurnTransitionReadyButtonTop(
  goldActionButtonTop: number,
  handTop: number,
  readyButtonHeight: number,
): number {
  return Math.max(300, Math.min(goldActionButtonTop, handTop - readyButtonHeight - 2));
}
