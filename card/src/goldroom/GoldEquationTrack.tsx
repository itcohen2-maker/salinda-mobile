// ============================================================
// GoldEquationTrack — Gold Room ONLY single-equation builder.
//
// A dark-gold, single-focus equation track for the practice round.
// Built fresh (not the shared EquationSlots) so the premium look —
// gold source bubbles, dark slots with a gold rim, ONE track, and a
// gold "בדוק" confirm — never leaks into / breaks the live tutorial,
// which keeps using the shared dual-track EquationSlots with its
// green Confirm.
//
// Exactly ONE equation track. No countdown timer. No green button.
// ============================================================

import React, { useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import OperatorGlyph from '../components/ui/OperatorGlyph';
import { GoldButton } from '../../components/GoldButton';

const GOLD = ['#F8E08E', '#F0C659', '#D9A23A', '#8A5A1C'] as const;

// A tappable gold source number (a landed die value). Bobs up on tap.
function SourceBubble({ value, onPress }: { value: number; onPress: () => void }) {
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
    <Pressable onPress={handlePress} accessibilityRole="button" accessibilityLabel={`הוסף ${value}`}>
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
  sources: number[];
  onTapSource: (n: number) => void;
  onToggleOperator: () => void;
  /** Show the gold "בדוק" confirm button (solving phase). Phase-1
   *  free experimentation passes false — pure poke-around, no resolve. */
  showConfirm?: boolean;
  onConfirm?: () => void;
}

export default function GoldEquationTrack({
  slots,
  operator,
  result,
  sources,
  onTapSource,
  onToggleOperator,
  showConfirm = false,
  onConfirm,
}: GoldEquationTrackProps) {
  const ready = slots[0] !== null && slots[1] !== null && result !== null;
  return (
    <View style={styles.wrap}>
      {/* The gold source bubbles. When sources is empty (Gold-Room Stack
       *  phase) the numbers come from the card fan below instead, so the
       *  bubble row is omitted entirely. */}
      {sources.length > 0 ? (
        <View style={styles.sourcesRow}>
          {sources.map((n, i) => (
            <SourceBubble key={`${n}-${i}`} value={n} onPress={() => onTapSource(n)} />
          ))}
        </View>
      ) : null}

      <View style={styles.track}>
        <View style={styles.slot}><Text style={styles.slotTxt}>{slots[0] ?? ''}</Text></View>
        <Pressable style={styles.operatorBtn} onPress={onToggleOperator} accessibilityRole="button" accessibilityLabel="החלף פעולה">
          <OperatorGlyph op={operator} color="#3A2A10" size={22} />
        </Pressable>
        <View style={styles.slot}><Text style={styles.slotTxt}>{slots[1] ?? ''}</Text></View>
        <Text style={styles.equals}>=</Text>
        <View style={[styles.slot, styles.resultSlot]}><Text style={styles.slotTxt}>{result ?? '?'}</Text></View>
      </View>

      {showConfirm ? (
        <View style={styles.confirmWrap}>
          <GoldButton label="בדוק ✓" onPress={onConfirm} disabled={!ready} height={50} fontSize={18} accessibilityLabel="בדוק את המשוואה" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16, alignItems: 'center' },
  sourcesRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
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
