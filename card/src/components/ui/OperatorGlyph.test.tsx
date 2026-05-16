import React from 'react';
import { Platform } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import OperatorGlyph, { normalizeOperatorGlyphToken, operatorGlyphFallback } from './OperatorGlyph';

describe('OperatorGlyph android regression', () => {
  const originalPlatformOs = Platform.OS;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOs });
  });

  it('normalizes android-unsafe operator glyph inputs to visible math glyphs', () => {
    expect(normalizeOperatorGlyphToken('\u200F \u00D7 \u200E')).toBe('x');
    expect(normalizeOperatorGlyphToken('\u200F \u00F7 \u200E')).toBe('/');
    expect(normalizeOperatorGlyphToken('\u05B3\u2014')).toBe('x');
    expect(normalizeOperatorGlyphToken('\u05B3\u00B7')).toBe('/');
    expect(normalizeOperatorGlyphToken('\u00C3\u2014')).toBe('x');
    expect(normalizeOperatorGlyphToken('\u00C3\u00B7')).toBe('/');
    expect(operatorGlyphFallback('\u00D7')).toBe('\u00D7');
    expect(operatorGlyphFallback('\u00F7')).toBe('\u00F7');
    expect(operatorGlyphFallback('\u05B3\u2014')).toBe('\u00D7');
    expect(operatorGlyphFallback('\u05B3\u00B7')).toBe('\u00F7');
  });

  it('renders a visible division glyph on android instead of a slash fallback', () => {
    render(<OperatorGlyph op={'\u00F7'} color="#FFFFFF" size={22} />);

    expect(screen.getByText('\u00F7')).toBeTruthy();
    expect(screen.queryByText('/')).toBeNull();
  });
});
