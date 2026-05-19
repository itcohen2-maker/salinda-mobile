import {
  WEB_GAME_PLAYFIELD_MAX_WIDTH,
  WEB_GAME_PLAYFIELD_MIN_HEIGHT,
  getWebContentWidth,
  getWebGameLayout,
  getWebTurnTransitionReadyButtonTop,
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
    expect(layout.playfieldWidth).toBe(WEB_GAME_PLAYFIELD_MAX_WIDTH);
    expect(layout.tableHeight).toBe(220);
    expect(layout.tableTop).toBe(185);
    expect(layout.handBottom).toBe(155);
    expect(layout.fanCardHeight).toBe(140);
    expect(layout.fanViewportHeight).toBe(116);
    // Gold button is BELOW the hand zone (hand zone ends at 900-155=745)
    expect(layout.goldActionButtonTop).toBe(760); // = 900 - 140
    expect(layout.goldActionButtonTop).toBeGreaterThan(900 - 155); // below hand zone bottom
    expect(layout.timerTop).toBe(layout.tableTop + layout.tableHeight + 32);
  });

  it('shrinks the playfield on narrow web viewports without overflowing', () => {
    const layout = getWebGameLayout({ width: 360, height: 640 });

    expect(layout.viewportWidth).toBe(360);
    expect(layout.viewportHeight).toBe(640);
    expect(layout.frameHeight).toBe(900); // always 900
    expect(layout.contentScale).toBeCloseTo(640 / 900, 4);
    expect(layout.playfieldWidth).toBe(360);
    expect(layout.goldActionButtonTop).toBe(760);
  });
});

describe('getWebTurnTransitionReadyButtonTop', () => {
  it('keeps the ready button in the same vertical band as the gold action button', () => {
    // With new 900px canvas: goldActionButtonTop=760, handTop=605
    expect(getWebTurnTransitionReadyButtonTop(760, 605, 48)).toBe(555); // Math.min(760, 605-48-2)=555
    expect(getWebTurnTransitionReadyButtonTop(760, 700, 48)).toBe(650); // Math.min(760, 700-48-2)=650
  });

  it('falls back to 300 if handTop is very small', () => {
    expect(getWebTurnTransitionReadyButtonTop(760, 200, 48)).toBe(300);
  });
});
