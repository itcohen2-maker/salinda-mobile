import { resolveGameTableSurface } from './gameTableSurface';

describe('resolveGameTableSurface', () => {
  it('uses active table skin image when equipped', () => {
    const fallback = { test: 'fallback' };
    const equipped = { image: { test: 'skin' }, surfacePresentation: 'framed' as const };

    const result = resolveGameTableSurface(equipped, fallback);

    expect(result).toEqual({ source: equipped.image, presentation: 'framed', resizeMode: 'contain' });
  });

  it('falls back to default game table when no skin equipped', () => {
    const fallback = { test: 'fallback' };

    const result = resolveGameTableSurface(null, fallback);

    expect(result).toEqual({ source: fallback, presentation: 'fill', resizeMode: 'stretch' });
  });

  it('keeps the fallback table stretched on the web too', () => {
    const fallback = { test: 'fallback' };

    const result = resolveGameTableSurface(null, fallback, { platform: 'web' });

    expect(result).toEqual({ source: fallback, presentation: 'fill', resizeMode: 'stretch' });
  });

  it('can render the default classic table as a framed surface', () => {
    const fallback = { test: 'fallback' };

    const result = resolveGameTableSurface(null, fallback, { fallbackPresentation: 'framed' });

    expect(result).toEqual({ source: fallback, presentation: 'framed', resizeMode: 'contain' });
  });

  it('defaults unknown skins to fill presentation', () => {
    const fallback = { test: 'fallback' };
    const equipped = { image: { test: 'skin' } };

    const result = resolveGameTableSurface(equipped, fallback);

    expect(result).toEqual({ source: equipped.image, presentation: 'fill', resizeMode: 'stretch' });
  });
});
