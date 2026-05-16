import {
  WEB_GAME_PLAYFIELD_MAX_WIDTH,
  WEB_GAME_PLAYFIELD_MIN_HEIGHT,
  getWebContentWidth,
  getWebGameLayout,
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
    // goldActionButtonTop = max(96, min(680, H-140))
    [{ width: 1366, height: 768 }, { goldActionButtonTop: 628 }],
    [{ width: 1440, height: 900 }, { goldActionButtonTop: 680 }],
    [{ width: 1920, height: 1080 }, { goldActionButtonTop: 680 }],
    [{ width: 768, height: 1024 }, { goldActionButtonTop: 680 }],
  ])('returns stable compact web-game layout for %o', (viewport, expected) => {
    const layout = getWebGameLayout(viewport);

    expect(layout.viewportWidth).toBe(viewport.width);
    expect(layout.viewportHeight).toBe(viewport.height);
    expect(layout.frameHeight).toBe(viewport.height);
    expect(layout.contentScale).toBe(1);
    expect(layout.playfieldWidth).toBe(WEB_GAME_PLAYFIELD_MAX_WIDTH);
    // All wide viewports return the same compact desktop constants
    expect(layout.tableHeight).toBe(220);
    expect(layout.tableTop).toBe(185);
    expect(layout.handBottom).toBe(155);
    expect(layout.fanCardHeight).toBe(140);
    expect(layout.fanCardWidth).toBe(99);
    expect(layout.fanViewportHeight).toBe(116);
    expect(layout.tableWidth).toBe(388);
    expect(layout.resultsRight).toBe(128);
    expect(layout.goldActionButtonTop).toBe(expected.goldActionButtonTop);
    expect(layout.handStripHeight).toBe(layout.fanViewportHeight + 24);
    expect(layout.timerTop).toBe(layout.tableTop + layout.tableHeight + 32);
  });

  it('shrinks the playfield on narrow web viewports without overflowing', () => {
    const layout = getWebGameLayout({ width: 360, height: 640 });

    expect(layout.viewportWidth).toBe(360);
    expect(layout.viewportHeight).toBe(640);
    expect(layout.frameHeight).toBe(WEB_GAME_PLAYFIELD_MIN_HEIGHT);
    expect(layout.contentScale).toBeCloseTo(640 / WEB_GAME_PLAYFIELD_MIN_HEIGHT, 4);
    expect(layout.playfieldWidth).toBe(360);
    expect(layout.contentWidth).toBe(360);
    expect(layout.tableWidth).toBe(336);
    expect(layout.tableWidth).toBeLessThanOrEqual(layout.playfieldWidth);
    expect(layout.resultsRight).toBe(128);
    expect(layout.tableHeight).toBe(220);
    expect(layout.handBottom).toBe(155);
    expect(layout.goldActionButtonTop).toBe(628);
  });
});
