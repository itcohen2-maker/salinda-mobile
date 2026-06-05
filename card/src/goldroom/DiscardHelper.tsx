import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getNumColors } from '../../components/CardDesign';
import { useGoldRoomCopy } from './goldRoomCopy';

export interface DiscardOption {
  value: number; // the hand-card value this solution discards
  equation: string; // e.g. "4 + 5 = 9"
  dice?: number[];
  targetId?: string;
}

const MINI_W = 36;
const MINI_H = 48;
const MINI_R = 8;
const SQUARE_ACTION = 92;

function GoldMiniCard({ value, onPress, testID }: { value: number; onPress?: () => void; testID?: string }) {
  const cl = getNumColors(value);
  const content = (
    <View style={[styles.miniCard, { borderColor: cl.border }]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.9)', 'rgba(248,248,248,0.85)', 'rgba(240,240,240,0.9)']}
        locations={[0, 0.6, 1]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text allowFontScaling={false} style={[styles.miniTxt, { color: cl.face }]}>{value}</Text>
    </View>
  );
  return onPress ? (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.8}>{content}</TouchableOpacity>
  ) : content;
}

export function DiscardHelper({
  options,
  helpUsageCount = 0,
  onRequestOpen,
  onOpenChange,
  onPreviewOption,
}: {
  options: DiscardOption[];
  helpUsageCount?: number;
  onRequestOpen?: () => void;
  onOpenChange?: (open: boolean) => void;
  onPreviewOption?: (option: DiscardOption) => void;
}) {
  const copy = useGoldRoomCopy();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const greenPulse = useRef(new Animated.Value(1)).current;

  const selectedOption = selected != null ? options.find((o) => o.value === selected) ?? null : null;
  const redText = selectedOption ? selectedOption.equation : copy.discardHelperTapHint;
  const showPenaltyWarning = helpUsageCount >= 2;

  useEffect(() => {
    if (open) {
      greenPulse.stopAnimation();
      greenPulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(greenPulse, { toValue: 1.05, duration: 720, useNativeDriver: true }),
        Animated.timing(greenPulse, { toValue: 0.95, duration: 720, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [greenPulse, open]);

  useEffect(() => {
    setOpen(false);
    setSelected(null);
    onOpenChange?.(false);
  }, [onOpenChange, options]);

  const handleOpen = useCallback(() => {
    if (open) return;
    onRequestOpen?.();
    setOpen(true);
    onOpenChange?.(true);
  }, [onOpenChange, onRequestOpen, open]);

  return (
    <View style={styles.wrap}>
      <View style={styles.stack}>
        <View style={styles.greenWrap}>
          {!open ? (
            <Animated.View style={{ transform: [{ scale: greenPulse }] }}>
              <TouchableOpacity
                testID="discard-helper-green"
                activeOpacity={0.85}
                onPress={handleOpen}
                accessibilityRole="button"
                accessibilityLabel={copy.discardHelperA11y}
              >
                <LinearGradient
                  colors={showPenaltyWarning ? ['#2A5D3F', '#234F35', '#1C422B', '#143824'] : ['#2D6B48', '#245C3C', '#1C4C30', '#143824']}
                  start={{ x: 0.3, y: 0.2 }}
                  end={{ x: 0.7, y: 0.9 }}
                  style={[styles.squareBtn, styles.greenBtn, showPenaltyWarning && styles.greenBtnWarning]}
                >
                  <View pointerEvents="none" style={styles.greenGlowRing} />
                  <Text pointerEvents="none" allowFontScaling={false} style={[styles.sparkle, styles.sparkleTopLeft]}>✦</Text>
                  <Text pointerEvents="none" allowFontScaling={false} style={[styles.sparkle, styles.sparkleTopRight]}>✧</Text>
                  <Text pointerEvents="none" allowFontScaling={false} style={[styles.sparkle, styles.sparkleBottom]}>✦</Text>
                  <Text allowFontScaling={false} style={styles.greenTxt}>
                    {showPenaltyWarning ? copy.discardHelperOpenWarn : copy.discardHelperOpen}
                  </Text>
                </LinearGradient>
                {options.length > 0 ? (
                  <View style={styles.badge}>
                    <Text testID="discard-helper-badge" style={styles.badgeTxt}>{options.length}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <View testID="discard-helper-red" style={styles.redBtn}>
              <Text testID="discard-helper-red-text" allowFontScaling={false} style={styles.redTxt}>{redText}</Text>
            </View>
          )}
        </View>

      </View>

      {open ? (
        <View style={styles.miniPanel}>
          <View testID="discard-helper-mini-row" style={styles.miniRow}>
            {options.map((o, i) => (
              <GoldMiniCard
                key={`${o.value}-${i}`}
                value={o.value}
                testID={`discard-helper-mini-${o.value}`}
                onPress={() => {
                  setSelected(o.value);
                  onPreviewOption?.(o);
                }}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', gap: 7, marginTop: -2, marginBottom: 0 },
  stack: { width: '100%', alignItems: 'center', justifyContent: 'center', gap: 6 },
  greenWrap: { alignItems: 'center', gap: 5, minHeight: SQUARE_ACTION },
  squareBtn: {
    width: SQUARE_ACTION,
    height: SQUARE_ACTION,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  greenBtn: { borderColor: '#F5D45A' },
  greenBtnWarning: { borderColor: '#FFE27A', shadowColor: '#F5D45A', shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
  greenTxt: { color: '#F0E8B0', fontSize: 13.5, fontWeight: '900', textAlign: 'center', lineHeight: 16 },
  redBtn: {
    width: 238,
    minHeight: 54,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: '#862222',
    borderColor: '#F5D45A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  redTxt: { color: '#FCE8C8', fontSize: 14, fontWeight: '900', textAlign: 'center', lineHeight: 18, writingDirection: 'rtl' },
  greenGlowRing: {
    position: 'absolute',
    left: 3,
    right: 3,
    top: 3,
    bottom: 3,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,226,122,0.95)',
  },
  sparkle: {
    position: 'absolute',
    color: '#FFF5B8',
    fontSize: 12,
    fontWeight: '900',
    textShadowColor: 'rgba(255,235,120,0.75)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  sparkleTopLeft: { top: 7, left: 9 },
  sparkleTopRight: { top: 9, right: 10 },
  sparkleBottom: { bottom: 8, left: 16, fontSize: 10 },
  badge: {
    position: 'absolute', top: -6, right: -6, backgroundColor: '#FFD700', borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: '#1a1a2e',
  },
  badgeTxt: { color: '#1a1a2e', fontSize: 11, fontWeight: '900' },
  miniPanel: { width: '100%', alignItems: 'center', gap: 6 },
  miniRow: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', minHeight: MINI_H },
  miniCard: {
    width: MINI_W, height: MINI_H, borderRadius: MINI_R, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center',
  },
  miniTxt: { fontSize: 18, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
});
