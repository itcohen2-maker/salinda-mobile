// ============================================================
// GoldEquationTrack — Gold Room ONLY single-equation builder.
//
// A dark-gold, single-focus equation track for the practice rounds. It supports
// two input modes (both Gold-Room-local, neither leaks into the live tutorial):
//
//   • Source-bubble mode (SpecialCardsIntro): tappable gold "source" numbers
//     (e.g. dice) sit ABOVE the track; tapping one fills the next slot.
//   • Hand mode (DiceEquationRound): the operands are HAND cards the player taps
//     in the fan; the track just DISPLAYS the placed cards, and `hasSecond`
//     controls whether the operator + 2nd slot are shown (single- vs two-card).
//
// One or two operands: "[a] = [r]" or "[a] [op] [b] = [r]". The premium 3D
// "בדוק" confirm is gold and dims until the equation is ready.
// ============================================================

import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import OperatorGlyph from '../components/ui/OperatorGlyph';
import { GoldButton } from '../../components/GoldButton';
import { interpolateCopy, useGoldRoomCopy } from './goldRoomCopy';

const GOLD = ['#F8E08E', '#F0C659', '#D9A23A', '#8A5A1C'] as const;

// A tappable gold source number (e.g. a landed die value). Bobs up on tap.
function SourceBubble({ value, onPress }: { value: number; onPress: () => void }) {
  const copy = useGoldRoomCopy();
  const anim = useRef(new Animated.Value(0)).current;
  const handlePress = () => {
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  return (
    <Pressable onPress={handlePress} accessibilityRole="button" accessibilityLabel={interpolateCopy(copy.add, { value })}>
      <Animated.View style={{ transform: [{ translateY }] }}>
        <LinearGradient colors={GOLD} locations={[0, 0.3, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.source}>
          <Text style={styles.sourceTxt}>{value}</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

export interface GoldEquationTrackProps {
  slots: [number | null, number | null];
  operator: '+' | '-';
  result: number | null;
  /** Source-bubble mode: tappable numbers shown above the track (omit for hand mode). */
  sources?: number[];
  onTapSource?: (n: number) => void;
  /** Whether a SECOND operand exists — renders the operator + 2nd slot.
   *  Defaults to true (back-compat: both slots always shown). */
  hasSecond?: boolean;
  onToggleOperator: () => void;
  /** Show the gold "בדוק" confirm button (solving phase). */
  showConfirm?: boolean;
  onConfirm?: () => void;
  /** Override the "בדוק" enabled state; defaults to "both slots filled". */
  canConfirm?: boolean;
}

export default function GoldEquationTrack({
  slots,
  operator,
  result,
  sources,
  onTapSource,
  hasSecond = true,
  onToggleOperator,
  showConfirm = false,
  onConfirm,
  canConfirm,
}: GoldEquationTrackProps) {
  const copy = useGoldRoomCopy();
  const ready = canConfirm ?? (slots[0] !== null && slots[1] !== null && result !== null);
  return (
    <View style={styles.wrap}>
      {/* Source bubbles (omitted in hand mode, where the fan supplies the numbers). */}
      {sources && sources.length > 0 ? (
        <View style={styles.sourcesRow}>
          {sources.map((n, i) => (
            <SourceBubble key={`${n}-${i}`} value={n} onPress={() => onTapSource?.(n)} />
          ))}
        </View>
      ) : null}

      <View style={styles.track}>
        <View style={styles.slot}><Text style={styles.slotTxt}>{slots[0] ?? ''}</Text></View>
        {hasSecond ? (
          <>
            <Pressable style={styles.operatorBtn} onPress={onToggleOperator} accessibilityRole="button" accessibilityLabel={copy.changeAction}>
              <OperatorGlyph op={operator} color="#3A2A10" size={22} />
            </Pressable>
            <View style={styles.slot}><Text style={styles.slotTxt}>{slots[1] ?? ''}</Text></View>
          </>
        ) : null}
        <Text style={styles.equals}>=</Text>
        <View style={[styles.slot, styles.resultSlot]}><Text style={styles.slotTxt}>{result ?? '?'}</Text></View>
      </View>

      {showConfirm ? (
        <View style={styles.confirmWrap}>
          <GoldButton label={copy.checkMark} onPress={onConfirm} disabled={!ready} height={50} fontSize={22} accessibilityLabel={copy.checkEquation} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16, alignItems: 'center' },
  sourcesRow: { flexDirection: 'row', direction: 'ltr', gap: 12, justifyContent: 'center' },
  source: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#8A5A1C',
  },
  sourceTxt: { color: '#2B1D08', fontSize: 22, fontWeight: '900' },

  track: {
    flexDirection: 'row',
    // A math equation always reads left-to-right; force LTR so ambient RTL (the
    // Hebrew app direction) doesn't mirror it into "result = b + a".
    direction: 'ltr',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(20,12,4,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(244,205,90,0.35)',
  },
  slot: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,243,201,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(244,205,90,0.5)',
  },
  resultSlot: { borderColor: 'rgba(244,205,90,0.85)', backgroundColor: 'rgba(244,205,90,0.12)' },
  slotTxt: { color: '#F8E08E', fontSize: 18, fontWeight: '900' },
  operatorBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0C659',
    borderWidth: 1.5,
    borderColor: '#8A5A1C',
  },
  equals: { color: '#F8E08E', fontSize: 20, fontWeight: '900', marginHorizontal: 2 },
  confirmWrap: { alignSelf: 'stretch', alignItems: 'center', marginTop: 2 },
});
