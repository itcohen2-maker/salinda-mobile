import React, { useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import OperatorGlyph from '../ui/OperatorGlyph';

interface EquationDraftView {
  targetTileId: string | null;
  slots: [number | null, number | null];
  operator: '+' | '-';
  result: number | null;
}

// Visual theme. The math-onboarding tutorial keeps the default blue/dark
// look; the Gold Room reuses the SAME component themed gold. Same logic,
// two skins — so re-skinning the Gold Room never touches the tutorial.
export type EquationSlotsTheme = 'default' | 'gold';

interface ThemePalette {
  sourceBg: string;
  sourceBorder: string;
  sourceTxt: string;
  eqBg: string;
  eqBorder: string;
  eqActiveBorder: string;
  slotBg: string;
  slotBorder: string | null;
  slotTxt: string;
  opBg: string;
  opBorder: string | null;
  opGlyph: string;
  equals: string;
  confirmBg: string;
  confirmTxt: string;
}

const PALETTES: Record<EquationSlotsTheme, ThemePalette> = {
  default: {
    sourceBg: '#1D4ED8', sourceBorder: 'rgba(255,255,255,0.35)', sourceTxt: '#EFF6FF',
    eqBg: 'rgba(17,24,39,0.84)', eqBorder: 'rgba(255,255,255,0.16)', eqActiveBorder: '#F59E0B',
    slotBg: 'rgba(255,255,255,0.08)', slotBorder: null, slotTxt: '#fff',
    opBg: 'rgba(251,191,36,0.24)', opBorder: null, opGlyph: '#FFFFFF',
    equals: '#fff', confirmBg: '#22C55E', confirmTxt: '#082312',
  },
  gold: {
    sourceBg: '#F0C659', sourceBorder: '#8A5A1C', sourceTxt: '#2B1D08',
    // Transparent track so the gold table shows through (Gold Room only).
    eqBg: 'transparent', eqBorder: 'rgba(244,205,90,0.35)', eqActiveBorder: '#F4CD5A',
    slotBg: 'rgba(255,243,201,0.06)', slotBorder: 'rgba(244,205,90,0.5)', slotTxt: '#F8E08E',
    opBg: '#F0C659', opBorder: '#8A5A1C', opGlyph: '#3A2A10',
    equals: '#F8E08E', confirmBg: '#F0C659', confirmTxt: '#2B1D08',
  },
};

interface EquationSlotsProps {
  // Accepts any number of equations (1..N). The Gold Room "Mastery Loop"
  // passes a single equation; the math-onboarding tutorial passes two.
  equations: EquationDraftView[];
  activeEquationIndex: number;
  sourceNumbers: number[];
  onSelectEquation: (index: number) => void;
  onTapSource: (n: number) => void;
  onToggleOperator: (index: number) => void;
  onConfirmEquation: (index: number) => void;
  /** Visual skin (default = tutorial blue, gold = Gold Room). */
  theme?: EquationSlotsTheme;
  /** Confirm button label. Defaults to 'Confirm'. */
  confirmLabel?: string;
  /** Hide the per-equation Confirm button (e.g. free-experiment phase). */
  showConfirm?: boolean;
  /** Disable Confirm until the equation is legal. */
  confirmDisabledForIndex?: (index: number) => boolean;
}

function SourceBubble({ value, onPress, palette }: { value: number; onPress: () => void; palette: ThemePalette }) {
  const anim = useRef(new Animated.Value(0)).current;
  const handlePress = () => {
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  const style = useMemo(
    () => ({
      transform: [
        {
          translateY: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -8],
          }),
        },
      ],
    }),
    [anim],
  );

  return (
    <Pressable android_disableSound onPress={handlePress}>
      <Animated.View style={[styles.sourceShape, { backgroundColor: palette.sourceBg, borderColor: palette.sourceBorder }, style]}>
        <Text style={[styles.sourceTxt, { color: palette.sourceTxt }]}>{value}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function EquationSlots({
  equations,
  activeEquationIndex,
  sourceNumbers,
  onSelectEquation,
  onTapSource,
  onToggleOperator,
  onConfirmEquation,
  theme = 'default',
  confirmLabel = 'Confirm',
  showConfirm = true,
  confirmDisabledForIndex,
}: EquationSlotsProps) {
  const palette = PALETTES[theme];
  return (
    <View style={styles.wrap}>
      <View style={styles.sourcesRow}>
        {sourceNumbers.map((n, i) => (
          <SourceBubble key={`${n}-${i}`} value={n} onPress={() => onTapSource(n)} palette={palette} />
        ))}
      </View>

      {equations.map((eq, idx) => {
        const active = idx === activeEquationIndex;
        const confirmDisabled = confirmDisabledForIndex ? confirmDisabledForIndex(idx) : false;
        return (
          <TouchableOpacity
            key={idx}
            activeOpacity={0.9}
            touchSoundDisabled
            onPress={() => onSelectEquation(idx)}
            style={[styles.eqBox, { backgroundColor: palette.eqBg, borderColor: active ? palette.eqActiveBorder : palette.eqBorder }]}
          >
            <View style={styles.eqRow}>
              <View style={[styles.slot, { backgroundColor: palette.slotBg }, palette.slotBorder ? { borderWidth: 1.5, borderColor: palette.slotBorder } : null]}><Text style={[styles.slotTxt, { color: palette.slotTxt }]}>{eq.slots[0] ?? ' '}</Text></View>
              <TouchableOpacity style={[styles.operatorBtn, { backgroundColor: palette.opBg }, palette.opBorder ? { borderWidth: 1.5, borderColor: palette.opBorder } : null]} onPress={() => onToggleOperator(idx)} touchSoundDisabled>
                <OperatorGlyph op={eq.operator} color={palette.opGlyph} size={22} />
              </TouchableOpacity>
              <View style={[styles.slot, { backgroundColor: palette.slotBg }, palette.slotBorder ? { borderWidth: 1.5, borderColor: palette.slotBorder } : null]}><Text style={[styles.slotTxt, { color: palette.slotTxt }]}>{eq.slots[1] ?? ' '}</Text></View>
              <Text style={[styles.equals, { color: palette.equals }]}>=</Text>
              <View style={[styles.slot, { backgroundColor: palette.slotBg }, palette.slotBorder ? { borderWidth: 1.5, borderColor: palette.slotBorder } : null]}><Text style={[styles.slotTxt, { color: palette.slotTxt }]}>{eq.result ?? '?'}</Text></View>
            </View>
            {showConfirm ? (
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: palette.confirmBg }, confirmDisabled && styles.confirmDisabled]}
                disabled={confirmDisabled}
                onPress={() => onConfirmEquation(idx)}
                touchSoundDisabled
              >
                <Text style={[styles.confirmTxt, { color: palette.confirmTxt }]}>{confirmLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  sourcesRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  sourceShape: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D4ED8',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  sourceTxt: { color: '#EFF6FF', fontSize: 22, fontWeight: '800' },
  eqBox: {
    borderRadius: 12,
    padding: 10,
    backgroundColor: 'rgba(17,24,39,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    gap: 8,
  },
  eqActive: { borderColor: '#F59E0B' },
  eqRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  slot: {
    width: 44,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  operatorBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.24)',
  },
  slotTxt: { color: '#fff', fontSize: 22, fontWeight: '800' },
  equals: { color: '#fff', fontSize: 24, fontWeight: '800' },
  confirmBtn: { alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#22C55E' },
  confirmDisabled: { opacity: 0.45 },
  confirmTxt: { color: '#082312', fontWeight: '800' },
});
