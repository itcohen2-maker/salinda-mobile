import {
  WEB_GAME_PLAYFIELD_MAX_WIDTH,
  WEB_MOBILE_GAME_FRAME_HEIGHT,
  WEB_MOBILE_LANDSCAPE_MAX_HEIGHT,
  WEB_MOBILE_LANDSCAPE_MAX_WIDTH,
  WEB_MOBILE_VIEWPORT_MAX_WIDTH,
  getWebContentWidth,
  getWebGameLayout,
  getWebTurnTransitionReadyButtonTop,
  isWebMobileViewport,
} from './webLayout';

describe('getWebContentWidth', () => {
  it('caps wide viewports to the requested max width', () => {
    expect(getWebContentWidth(1600, { maxWidth: 1100, sidePadding: 40 })).toBe(1100);
  });

  it('preserves readable width on narrow viewports', () => {
    expect(getWebContentWidth(768, { maxWidth: 1100, sidePadding: 40 })).toBe(728);
  });
});

describe('getWebGameLayout', () => {
  it.each([
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 768, height: 1024 },
  ])('always returns fixed 900px canvas for viewport %o', (viewport) => {
    const layout = getWebGameLayout(viewport);

    // Canvas is always fixed at 900px — never grows with viewport
    expect(layout.frameHeight).toBe(900);
    // Scale is 1 for viewports >= 900px, <1 for smaller viewports
    expect(layout.contentScale).toBeCloseTo(Math.min(1, viewport.height / 900), 4);
    expect(layout.mobileCompactRatio).toBe(0);
    expect(layout.playfieldWidth).toBe(WEB_GAME_PLAYFIELD_MAX_WIDTH);
    expect(layout.tableHeight).toBe(220);
    expect(layout.tableTop).toBe(185);
    expect(layout.handBottom).toBe(155);
    expect(layout.fanCardHeight).toBe(140);
    expect(layout.fanViewportHeight).toBe(116);
    // Gold button sits 140px above the bottom of the 900px desktop frame
    expect(layout.goldActionButtonTop).toBe(760);
    expect(layout.timerTop).toBe(layout.tableTop + layout.tableHeight + 32);
  });

  it.each([
    { width: 390, height: 844, handBottom: 195, goldActionButtonTop: 680 },
    { width: 393, height: 851, handBottom: 195, goldActionButtonTop: 680 },
    { width: WEB_MOBILE_VIEWPORT_MAX_WIDTH, height: 900, handBottom: 195, goldActionButtonTop: 680 },
  ])('uses full-width native-style layout for tall portrait mobile web viewport %o', (viewport) => {
    const layout = getWebGameLayout(viewport);

    expect(layout.viewportWidth).toBe(viewport.width);
    expect(layout.viewportHeight).toBe(viewport.height);
    expect(layout.frameHeight).toBe(viewport.height);
    expect(layout.contentScale).toBe(1);
    expect(layout.mobileCompactRatio).toBe(0);
    expect(layout.playfieldWidth).toBe(viewport.width);
    expect(layout.tableTop).toBe(205);
    expect(layout.tableHeight).toBe(240);
    expect(layout.handBottom).toBe(viewport.handBottom);
    expect(layout.tableWidth).toBe(viewport.width - 24);
    expect(layout.resultsTop).toBe(84);
    expect(layout.parensTop).toBe(170);
    expect(layout.goldActionButtonTop).toBe(viewport.goldActionButtonTop);
  });

  it.each([
    { width: 390, height: 568, ratio: 1, tableTop: 150, tableHeight: 210, handBottom: 40, resultsTop: 72, parensTop: 115, timerTop: 303, goldActionButtonTop: 388 },
    { width: 390, height: 640, ratio: 204 / 276, tableTop: 164, tableHeight: 218, handBottom: 80, resultsTop: 75, parensTop: 129, timerTop: 328, goldActionButtonTop: 470 },
    { width: 393, height: 688, ratio: 156 / 276, tableTop: 174, tableHeight: 223, handBottom: 107, resultsTop: 77, parensTop: 139, timerTop: 345, goldActionButtonTop: 525 },
  ])('compacts short portrait mobile web viewport %o without crushing the table and hand', (viewport) => {
    const layout = getWebGameLayout(viewport);

    expect(layout.viewportWidth).toBe(viewport.width);
    expect(layout.viewportHeight).toBe(viewport.height);
    expect(layout.frameHeight).toBe(viewport.height);
    expect(layout.contentScale).toBe(1);
    expect(layout.mobileCompactRatio).toBeCloseTo(viewport.ratio, 4);
    expect(layout.playfieldWidth).toBe(viewport.width);
    expect(layout.tableWidth).toBe(viewport.width - 24);
    expect(layout.tableTop).toBe(viewport.tableTop);
    expect(layout.tableHeight).toBe(viewport.tableHeight);
    expect(layout.handBottom).toBe(viewport.handBottom);
    expect(layout.resultsTop).toBe(viewport.resultsTop);
    expect(layout.parensTop).toBe(viewport.parensTop);
    expect(layout.timerTop).toBe(viewport.timerTop);
    expect(layout.goldActionButtonTop).toBe(viewport.goldActionButtonTop);

    const handTop = viewport.height - layout.handBottom - layout.handStripHeight;
    const tableBottom = layout.tableTop + layout.tableHeight;
    const tableCoveredByHand = Math.max(0, tableBottom - handTop);
    expect(tableCoveredByHand).toBeLessThanOrEqual(layout.tableHeight * 0.26);
    expect(layout.goldActionButtonTop + 58).toBeLessThanOrEqual(viewport.height);
  });

  it('keeps the scaled native frame for short-wide mobile web viewports', () => {
    const layout = getWebGameLayout({ width: 767, height: 391 });

    expect(layout.frameHeight).toBe(WEB_MOBILE_GAME_FRAME_HEIGHT);
    expect(layout.contentScale).toBeCloseTo(391 / WEB_MOBILE_GAME_FRAME_HEIGHT, 4);
    expect(layout.mobileCompactRatio).toBe(0);
    expect(layout.playfieldWidth).toBe(767);
    expect(layout.tableWidth).toBe(743);
  });
});

describe('isWebMobileViewport', () => {
  it('treats phone widths as mobile web', () => {
    expect(isWebMobileViewport(360)).toBe(true);
    expect(isWebMobileViewport(430)).toBe(true);
    expect(isWebMobileViewport(500, 800)).toBe(true);
    expect(isWebMobileViewport(WEB_MOBILE_VIEWPORT_MAX_WIDTH, 900)).toBe(true);
  });

  it('treats short-wide phone-sized viewports as mobile web too', () => {
    expect(isWebMobileViewport(WEB_MOBILE_LANDSCAPE_MAX_WIDTH, WEB_MOBILE_LANDSCAPE_MAX_HEIGHT)).toBe(true);
    expect(isWebMobileViewport(767, 391)).toBe(true);
  });

  it('keeps wider viewports on the desktop web path', () => {
    expect(isWebMobileViewport(WEB_MOBILE_VIEWPORT_MAX_WIDTH + 1, 900)).toBe(false);
    expect(isWebMobileViewport(768)).toBe(false);
    expect(isWebMobileViewport(960, 400)).toBe(false);
  });
});

describe('getWebTurnTransitionReadyButtonTop', () => {
  it('keeps the ready button in the same vertical band as the gold action button', () => {
    // goldActionButtonTop=535 (above hand), handTop=605
    expect(getWebTurnTransitionReadyButtonTop(535, 605, 48)).toBe(535); // min(535, 605-48-2=555) = 535
    expect(getWebTurnTransitionReadyButtonTop(535, 580, 48)).toBe(530); // min(535, 580-48-2=530) = 530
  });

  it('falls back to 300 if handTop is very small', () => {
    expect(getWebTurnTransitionReadyButtonTop(760, 200, 48)).toBe(300);
  });
});
