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
export const WEB_GAME_PLAYFIELD_MIN_HEIGHT = 768;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
  const frameHeight = Math.max(viewportHeight, WEB_GAME_PLAYFIELD_MIN_HEIGHT);
  const contentScale = clamp(viewportHeight / frameHeight, 0.5, 1);
  const playfieldWidth = Math.min(WEB_GAME_PLAYFIELD_MAX_WIDTH, viewportWidth);
  const contentWidth = playfieldWidth;
  // Mobile-equivalent constants — web game column (≤412px) matches native mobile appearance.
  const tableHeight = 220;
  const tableTop = 185;
  const tableBottomPadding = 65;
  const handBottom = 155;
  const fanCardHeight = 140;
  const fanCardWidth = Math.round(fanCardHeight * 0.71);
  // Matches native HAND_INNER_HEIGHT = Math.ceil(140*1.15+55-100) = 116
  const fanViewportHeight = Math.ceil(fanCardHeight * 1.15 + 55 - 100);
  const handStripAboveFan = 24;
  const handStripHeight = fanViewportHeight + handStripAboveFan;
  const handZoneTop = handBottom + handStripHeight;
  const miniResultsBottom = handZoneTop - 10;
  const tableWidth = clamp(playfieldWidth - 24, 300, WEB_GAME_PLAYFIELD_MAX_WIDTH - 24);
  const resultsTop = 76;
  const resultsRight = 128;
  const parensTop = 156;
  const timerTop = tableTop + tableHeight + 32;
  // Same formula as native, but against the unscaled playfield height so
  // shorter desktop windows can shrink uniformly instead of colliding.
  const goldActionButtonTop = Math.max(96, Math.min(680, frameHeight - 140));

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
