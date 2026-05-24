import { getNativeGameLayout } from './nativeGameLayout';

describe('getNativeGameLayout', () => {
  it('keeps the existing native layout on tall android screens', () => {
    const layout = getNativeGameLayout(844, 'android');

    expect(layout.compactRatio).toBe(0);
    expect(layout.handBottom).toBe(195);
    expect(layout.tableTop).toBe(205);
    expect(layout.tableHeight).toBe(240);
    expect(layout.resultsTop).toBe(84);
    expect(layout.parensTop).toBe(170);
    expect(layout.timerTop).toBe(400);
    expect(layout.bottomControlTop).toBe(663);
    expect(layout.goldActionButtonTop).toBe(709);
  });

  it('compacts the android layout on short screens so lower actions stay visible', () => {
    const layout = getNativeGameLayout(720, 'android');

    expect(layout.compactRatio).toBe(1);
    expect(layout.handBottom).toBe(155);
    expect(layout.tableTop).toBe(185);
    expect(layout.tableHeight).toBe(220);
    expect(layout.resultsTop).toBe(76);
    expect(layout.parensTop).toBe(156);
    expect(layout.timerTop).toBe(348);
    expect(layout.bottomControlTop).toBe(579);
    expect(layout.goldActionButtonTop).toBe(625);
  });

  it('does not compact iOS layout with the android-only rule set', () => {
    const layout = getNativeGameLayout(720, 'ios');

    expect(layout.compactRatio).toBe(0);
    expect(layout.handBottom).toBe(195);
    expect(layout.tableTop).toBe(205);
    expect(layout.tableHeight).toBe(240);
    expect(layout.bottomControlTop).toBe(535);
  });
});
