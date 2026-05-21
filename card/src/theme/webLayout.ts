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
export const WEB_MOBILE_VIEWPORT_MAX_WIDTH = 480;
export const WEB_MOBILE_GAME_FRAME_HEIGHT = 844;
export const WEB_MOBILE_LANDSCAPE_MAX_HEIGHT = 430;
export const WEB_MOBILE_LANDSCAPE_MAX_WIDTH = 900;

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
  const viewportWidth = Math.max(320, Math.round(viewport.width || 0));
  const viewportHeight = Math.max(568, Math.round(viewport.height || 0));
  const mobileWebViewport = isWebMobileViewport(viewportWidth, viewportHeight);
  // Phone-width web mirrors the native app frame; wider web keeps the fixed
  // desktop canvas. Neither path grows with the live viewport height.
  const frameHeight = mobileWebViewport ? WEB_MOBILE_GAME_FRAME_HEIGHT : WEB_GAME_PLAYFIELD_MIN_HEIGHT;
  const contentScale = clamp(viewportHeight / frameHeight, 0.5, 1);
  const playfieldWidth = mobileWebViewport
    ? viewportWidth
    : Math.min(WEB_GAME_PLAYFIELD_MAX_WIDTH, viewportWidth);
  const contentWidth = playfieldWidth;
  const nativeIosHandFan = getNativeHandFanMetrics('ios');
  // Phone-size web should mirror the app proportions instead of the narrow
  // desktop column. Wider web still uses the fixed 900px desktop layout.
  const tableHeight = mobileWebViewport ? 240 : 220;
  const tableTop = mobileWebViewport ? 205 : 185;
  const tableBottomPadding = mobileWebViewport ? 75 : 65;
  const handBottom = mobileWebViewport ? 195 : 155;
  const fanCardHeight = mobileWebViewport ? nativeIosHandFan.cardHeight : 140;
  const fanCardWidth = mobileWebViewport ? nativeIosHandFan.cardWidth : Math.round(fanCardHeight * 0.71);
  const fanViewportHeight = mobileWebViewport ? nativeIosHandFan.viewportHeight : Math.ceil(fanCardHeight * 1.15 + 55 - 100);
  const handStripAboveFan = mobileWebViewport ? nativeIosHandFan.stripAboveFan : 24;
  const handStripHeight = mobileWebViewport ? nativeIosHandFan.stripHeight : fanViewportHeight + handStripAboveFan;
  const handZoneTop = handBottom + handStripHeight;
  const miniResultsBottom = handZoneTop - 10;
  const tableWidth = mobileWebViewport
    ? Math.max(300, playfieldWidth - 24)
    : clamp(playfieldWidth - 24, 300, WEB_GAME_PLAYFIELD_MAX_WIDTH - 24);
  const resultsTop = mobileWebViewport ? 84 : 76;
  const resultsRight = 128;
  const parensTop = mobileWebViewport ? 170 : 156;
  const timerTop = mobileWebViewport ? 400 : tableTop + tableHeight + 32;
  const goldActionButtonTop = mobileWebViewport
    ? Math.max(96, Math.min(680, frameHeight - 140))
    : frameHeight - 140;

  return {
    viewportWidth,
    viewportHeight,
    frameHeight,
    contentScale,
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
