import React from 'react';
import { Platform, Text, View } from 'react-native';

export type OperatorGlyphToken = '+' | '-' | 'x' | '/';
const OPERATOR_GLYPH_CONTROL_RE = /[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069\s]/g;

function sanitizeOperatorGlyphInput(op: string | null | undefined): string {
  return (op ?? '').replace(OPERATOR_GLYPH_CONTROL_RE, '');
}

export function normalizeOperatorGlyphToken(op: string | null | undefined): OperatorGlyphToken | null {
  const raw = sanitizeOperatorGlyphInput(op);
  if (!raw) return null;
  if (raw.includes('+')) return '+';
  if (raw.includes('-') || raw.includes('\u2212')) return '-';
  if (/[xX*]/.test(raw) || raw.includes('\u00D7') || raw.includes('\u2014') || raw.includes('\u00C3\u2014')) return 'x';
  if (raw.includes('/') || raw.includes('\u00F7') || raw.includes('\u00B7') || raw.includes('\u00C3\u00B7')) return '/';
  return null;
}

export function operatorGlyphFallback(op: string | null | undefined): string {
  const token = normalizeOperatorGlyphToken(op);
  if (token === '-') return '-';
  return token ?? sanitizeOperatorGlyphInput(op);
}

export default function OperatorGlyph({
  op,
  color,
  size,
}: {
  op: string | null | undefined;
  color: string;
  size: number;
}) {
  const label = operatorGlyphFallback(op);
  if (!label) return null;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text
        allowFontScaling={false}
        style={{
          color,
          fontSize: Math.max(12, Math.round(size * 0.92)),
          fontWeight: Platform.OS === 'android' ? '900' : '800',
          includeFontPadding: false,
          lineHeight: size,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
