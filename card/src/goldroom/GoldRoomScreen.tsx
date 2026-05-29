// ============================================================
// GoldRoomScreen — "חדר הזהב"
// A brand-new, ADMIN-ONLY onboarding tutorial in its own separate
// entry. Full-screen overlay (RN Modal) that floats ABOVE the live
// app and changes nothing in the existing screens.
//
// Architecture (per UX brief — low cognitive load, action-focused,
// progressive disclosure):
//  • Linear step counter (1..4).
//  • Steps 1-3 advance with "המשך"; step 4 turns into "סיום" and
//    closes the modal. Back + Skip are always available.
//  • Numbers mirror the real rules: start with 7 cards, win
//    ("Golden Rule") at exactly 2 cards.
//  • Visual focus layer (Spotlight): instead of placeholder emojis
//    the screen dims and highlights the relevant UX region per step.
//    Targets are expressed as screen fractions so that — once this
//    runs over a real game board — they can be swapped for measured
//    element rects with no structural change.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GoldButton } from '../../components/GoldButton';

interface GoldRoomScreenProps {
  visible: boolean;
  onClose: () => void;
}

type CardAnchor = 'top' | 'bottom' | 'center';

// Spotlight target, as fractions (0..1) of the screen. Replace with measured
// element rects when the room runs over a live board.
interface Spot {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Step {
  tag: string;
  title: string;
  body: string;
  spot?: Spot; // undefined → full dim, centered card (intro / goal)
  cardAnchor: CardAnchor;
}

const STEPS: Step[] = [
  {
    tag: 'חדר הזהב',
    title: 'ברוך הבא! 🪙',
    body: 'בוא נלמד לשחק תוך דקה. יש רק שני דברים שצריך להכיר — הערימה והמניפה. קדימה!',
    cardAnchor: 'center',
  },
  {
    tag: 'הערימה',
    title: 'ערימת הקלפים 🂠',
    body: 'ערימת הקלפים — זהו הבנק של המשחק, שנמצא כאן למעלה בפינה.',
    spot: { top: 0.05, left: 0.05, width: 0.42, height: 0.12 },
    cardAnchor: 'bottom',
  },
  {
    tag: 'המניפה',
    title: 'המניפה 🃏',
    body: 'המניפה — היד שלך. מתחילים את המשחק עם 7 קלפים.',
    spot: { top: 0.72, left: 0.04, width: 0.92, height: 0.2 },
    cardAnchor: 'top',
  },
  {
    tag: 'חוק הזהב',
    title: 'חוק הזהב ✨',
    body: 'המטרה: להישאר עם 2 קלפים בדיוק! בונים משוואה, פוגעים בתוצאה, ונפטרים מה-5 הנותרים. מי שמגיע ראשון ל-2 קלפים — לוקח את הכל!',
    cardAnchor: 'center',
  },
];

// Gold tones sampled from the physical gold plank — "polished D" language.
const GOLD = ['#F8E08E', '#F0C659', '#D9A23A', '#8A5A1C'] as const;
const DIM = 'rgba(8,5,2,0.84)';

// Dark mask with a clear, glowing cutout over the target (built from four dim
// strips around the rect — no SVG masking needed, works on web + native).
function Spotlight({ spot }: { spot?: Spot }) {
  const { width: W, height: H } = useWindowDimensions();
  if (!spot) {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} />;
  }
  const t = spot.top * H;
  const l = spot.left * W;
  const w = spot.width * W;
  const h = spot.height * H;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: t, backgroundColor: DIM }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: t + h, bottom: 0, backgroundColor: DIM }} />
      <View style={{ position: 'absolute', top: t, height: h, left: 0, width: l, backgroundColor: DIM }} />
      <View style={{ position: 'absolute', top: t, height: h, left: l + w, right: 0, backgroundColor: DIM }} />
      {/* glowing highlight ring around the focused element */}
      <View
        style={{
          position: 'absolute',
          top: t,
          left: l,
          width: w,
          height: h,
          borderRadius: 16,
          borderWidth: 3,
          borderColor: '#F4CD5A',
          shadowColor: '#F4CD5A',
          shadowOpacity: 0.9,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 0 },
          elevation: 10,
        }}
      />
    </View>
  );
}

export function GoldRoomScreen({ visible, onClose }: GoldRoomScreenProps) {
  // Linear step counter, 0-based over STEPS (i.e. steps 1..4).
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const handleClose = useCallback(() => {
    setIndex(0);
    onClose();
  }, [onClose]);

  const handleBack = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const handleNext = useCallback(() => {
    if (isLast) handleClose();
    else setIndex((i) => Math.min(STEPS.length - 1, i + 1));
  }, [isLast, handleClose]);

  const anchorStyle =
    step.cardAnchor === 'top' ? styles.cardTop : step.cardAnchor === 'bottom' ? styles.cardBottom : styles.cardCenter;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.root}>
        <Spotlight spot={step.spot} />

        {/* top bar: skip + close */}
        <View style={styles.topbar}>
          <Pressable onPress={handleClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="דלג על ההדרכה">
            <Text style={styles.skip}>דלג ›</Text>
          </Pressable>
          <Pressable onPress={handleClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="יציאה">
            <LinearGradient colors={GOLD} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* instruction card — anchored away from the highlighted region */}
        <View style={[styles.cardLayer, anchorStyle]} pointerEvents="box-none">
          <View style={styles.cardWidth}>
            <LinearGradient
              colors={GOLD}
              locations={[0, 0.3, 0.6, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.plank}
            >
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.sheen}
              />
              <Text style={styles.stepTag}>{step.tag}</Text>
              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.body}>{step.body}</Text>
            </LinearGradient>

            {/* step dots */}
            <View style={styles.dots}>
              {STEPS.map((_, i) => (
                <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
              ))}
            </View>

            {/* controls: back + continue/finish */}
            <View style={styles.controls}>
              {index > 0 ? (
                <Pressable onPress={handleBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="חזור">
                  <Text style={styles.backText}>‹ חזור</Text>
                </Pressable>
              ) : (
                <View style={styles.backSpacer} />
              )}
              <View style={styles.nextWrap}>
                <GoldButton label={isLast ? 'סיום' : 'המשך ›'} onPress={handleNext} fullWidth />
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 44,
    paddingHorizontal: 22,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  skip: { color: '#FFF3C9', fontSize: 15, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  closeBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(255,243,201,0.5)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#3A2A10', fontSize: 20, fontWeight: '900', lineHeight: 22 },

  cardLayer: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 22, alignItems: 'center' },
  cardCenter: { top: 0, bottom: 0, justifyContent: 'center' },
  cardTop: { top: 96 },
  cardBottom: { bottom: 28 },
  cardWidth: { width: '100%', maxWidth: 420 },

  plank: {
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#8A5A1C',
    overflow: 'hidden',
    paddingHorizontal: 26,
    paddingVertical: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '46%' },
  stepTag: { color: '#5E3A10', fontSize: 13, fontWeight: '800', letterSpacing: 1, opacity: 0.7, textAlign: 'right' },
  title: { color: '#2B1D08', fontSize: 25, fontWeight: '900', marginTop: 6, marginBottom: 12, textAlign: 'right' },
  body: { color: '#3D2A0E', fontSize: 16, lineHeight: 24, fontWeight: '600', textAlign: 'right' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 18, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,243,201,0.35)' },
  dotActive: { width: 22, backgroundColor: '#F4CD5A' },
  controls: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  nextWrap: { flex: 1 },
  backBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 14, backgroundColor: 'rgba(20,12,4,0.6)', borderWidth: 1.5, borderColor: 'rgba(244,205,90,0.5)' },
  backText: { color: '#F4CD5A', fontSize: 16, fontWeight: '800' },
  backSpacer: { width: 0 },
});
