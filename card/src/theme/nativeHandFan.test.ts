import { getNativeHandFanMetrics } from './nativeHandFan';

describe('getNativeHandFanMetrics', () => {
  it('keeps the existing native fan proportions on ios', () => {
    const metrics = getNativeHandFanMetrics('ios');

    expect(metrics.cardWidth).toBe(100);
    expect(metrics.cardHeight).toBe(140);
    expect(metrics.renderScale).toBe(1);
    expect(metrics.maxAngle).toBe(30);
    expect(metrics.centerScale).toBe(1.15);
    expect(metrics.edgeScale).toBe(0.82);
    expect(metrics.viewportHeight).toBe(116);
    expect(metrics.stripHeight).toBe(140);
  });

  it('shrinks the fan on android without changing the strip contract', () => {
    const ios = getNativeHandFanMetrics('ios');
    const android = getNativeHandFanMetrics('android');

    expect(android.cardWidth).toBeLessThan(ios.cardWidth);
    expect(android.cardHeight).toBeLessThan(ios.cardHeight);
    expect(android.renderScale).toBeLessThan(1);
    expect(android.maxAngle).toBeLessThan(ios.maxAngle);
    expect(android.centerScale).toBeLessThan(ios.centerScale);
    expect(android.edgeScale).toBeLessThan(ios.edgeScale);
    expect(android.viewportHeight).toBeLessThan(ios.viewportHeight);
    expect(android.stripHeight).toBe(android.viewportHeight + android.stripAboveFan);
  });
});
