describe('useResponsiveLayout', () => {
  it('computes all breakpoint flags from dimensions and font scale', () => {
    const { buildResponsiveLayout } = require('./useResponsiveLayout');

    expect(buildResponsiveLayout(360, 740, 1.3)).toEqual({
      width: 360,
      height: 740,
      fontScale: 1.3,
      isTight: true,
      isCompact: true,
      isSingleColumn: true,
      isTablet: false,
    });

    expect(buildResponsiveLayout(800, 1024, 1)).toEqual({
      width: 800,
      height: 1024,
      fontScale: 1,
      isTight: false,
      isCompact: false,
      isSingleColumn: false,
      isTablet: true,
    });
  });
});
