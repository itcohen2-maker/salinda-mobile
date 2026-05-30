// ============================================================
// SpecialCardsIntro — Gold Room "Reward Reveal" flow.
//
// NOT a dry operations tutorial. The core loop is "shed cards as fast as
// possible", and special cards let you do exactly that — so each one is
// framed as a WEAPON UPGRADE and shown as a glowing golden treasure.
//
// This flow is the faithful migration of legacy tutorial LAYERS 35–44
// (lesson-05 "op-cycle" — operation signs + the Salinda card). The rigged
// exercise (`4 ? 3 = 7`, target 7) and the in-order layers live in
// goldRoomLayers.ts so the onboarding lessons stay untouched; here we wrap
// them in the premium reveal → focused round language and run them through
// the single-track GoldEquationTrack.
//
// Sequence:
//   1. Sign cards (+ − × ÷)  reveal  — the weapon-upgrade entry point.
//   2. Target card           reveal  — the objective: reach this number.
//   3. Layer 35–36 (place-op)  round — build an equation that hits target.
//   4. Salinda card          reveal  — the all-signs powerhouse.
//   5. Layer 37–40 (joker)     round — same puzzle, solved with Salinda.
//   → Success celebration → mark complete → back to the Hub.
//
// Each round clears ONLY when the built equation reaches the layer's exact
// target (mirrors the legacy "wrong ops don't advance" rule). Text is kept
// minimal and sharp ("Game of Silence"). Pure RN + expo-linear-gradient,
// in the established dark-gold luxury language.
// ============================================================

import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GoldButton } from '../../components/GoldButton';
import GoldEquationTrack from './GoldEquationTrack';
import { applyOperation } from '../utils/arithmetic';
import { GOLD_LAYERS, GOLD_LAYER_SOURCES } from './goldRoomLayers';

// Gold ramp sampled from the physical gold plank — same language as the Hub.
const GOLD = ['#F8E08E', '#F0C659', '#D9A23A', '#8A5A1C'] as const;

// ── Local equation state for the focused rounds. A complete equation
// (both operands placed + a computed result) can be confirmed; the round
// clears only when that result equals the layer's exact target.
interface Eq {
  slots: [number | null, number | null];
  operator: '+' | '-';
  result: number | null;
}
const emptyEq = (): Eq => ({ slots: [null, null], operator: '+', result: null });
function recompute(eq: Eq): Eq {
  const [a, b] = eq.slots;
  return { ...eq, result: a !== null && b !== null ? applyOperation(a, eq.operator, b) : null };
}
type EqAction = { type: 'TAP'; n: number } | { type: 'OP' };
function eqReducer(state: Eq, action: EqAction): Eq {
  switch (action.type) {
    case 'OP':
      return recompute({ ...state, operator: state.operator === '+' ? '-' : '+' });
    case 'TAP': {
      let slots: [number | null, number | null];
      if (state.slots[0] === null) slots = [action.n, state.slots[1]];
      else if (state.slots[1] === null) slots = [state.slots[0], action.n];
      else slots = [action.n, null];
      return recompute({ ...state, slots });
    }
    default:
      return state;
  }
}

// ── A single glowing treasure card: a gold plank face floating over a soft,
// pulsing golden aura, so it reads as something valuable you just won.
function GlowCard({ glow, delay, w, glyph, intensity = 1 }: { glow: Animated.Value; delay: number; w: number; glyph: string; intensity?: number }) {
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 440, delay, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
  }, [rise, delay]);

  const h = w * 1.4;
  const auraOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.3 * intensity, 0.95 * intensity] });
  const auraScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1 + 0.04 * intensity] });
  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  return (
    <Animated.View style={{ width: w, alignItems: 'center', justifyContent: 'center', opacity: rise, transform: [{ translateY }] }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: w + 26,
          height: h + 26,
          borderRadius: 24,
          backgroundColor: '#F4CD5A',
          shadowColor: '#F4CD5A',
          shadowOpacity: 1,
          shadowRadius: 14 + 12 * intensity,
          shadowOffset: { width: 0, height: 0 },
          elevation: 16,
          opacity: auraOpacity,
          transform: [{ scale: auraScale }],
        }}
      />
      <View style={styles.cardShadow}>
        <LinearGradient colors={GOLD} locations={[0, 0.3, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.cardFace, { width: w, height: h }]}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.cardSheen}
          />
          <Text style={[styles.cardGlyph, { fontSize: w * 0.58 }]}>{glyph}</Text>
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

// ── A reveal step: reward badge + headline, the glowing card(s), the
// high-impact copy, and a single premium GoldButton call-to-action.
function Reveal({
  badge,
  headline,
  copy,
  buttonLabel,
  onPress,
  renderCards,
}: {
  badge: string;
  headline: string;
  copy: string;
  buttonLabel: string;
  onPress: () => void;
  renderCards: (glow: Animated.Value) => React.ReactNode;
}) {
  const intro = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 480, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [intro, glow]);

  const headerTranslate = intro.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] });

  return (
    <View style={styles.root}>
      <Animated.View style={{ opacity: intro, transform: [{ translateY: headerTranslate }], alignItems: 'center' }}>
        <View style={styles.rewardBadge}>
          <Text style={styles.rewardBadgeText}>{badge}</Text>
        </View>
        <Text style={styles.headline}>{headline}</Text>
      </Animated.View>

      <View style={styles.cardsRow}>{renderCards(glow)}</View>

      <Animated.Text style={[styles.copy, { opacity: intro }]}>{copy}</Animated.Text>

      <View style={styles.ctaWrap}>
        <GoldButton label={buttonLabel} onPress={onPress} accessibilityLabel={buttonLabel} fullWidth height={58} fontSize={20} />
      </View>
    </View>
  );
}

// ── A focused, single-equation round for one migrated layer. The player
// builds an equation from the rigged sources; the round clears ONLY when
// the result equals the layer's exact target (the legacy "wrong ops don't
// advance" rule). A near-miss shows a transient "try again" nudge.
function LayerRound({ caption, chip, target, onSolved }: { caption: string; chip?: string; target: number; onSolved: () => void }) {
  const [eq, dispatch] = useReducer(eqReducer, undefined, emptyEq);
  const [wrong, setWrong] = useState(false);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (wrongTimer.current) clearTimeout(wrongTimer.current); }, []);

  const clearWrong = () => {
    if (wrongTimer.current) clearTimeout(wrongTimer.current);
    setWrong(false);
  };
  const handleConfirm = () => {
    if (eq.result === target) {
      onSolved();
    } else {
      setWrong(true);
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => setWrong(false), 2200);
    }
  };

  return (
    <View style={styles.roundRoot}>
      <Text style={styles.roundCaption}>{caption}</Text>
      <View style={styles.targetPill}>
        <Text style={styles.targetPillLabel}>היעד</Text>
        <Text style={styles.targetPillValue}>{target}</Text>
      </View>
      {chip ? (
        <View style={styles.chip}>
          <Text style={styles.chipText}>{chip}</Text>
        </View>
      ) : null}
      <GoldEquationTrack
        slots={eq.slots}
        operator={eq.operator}
        result={eq.result}
        sources={GOLD_LAYER_SOURCES}
        onTapSource={(n) => { clearWrong(); dispatch({ type: 'TAP', n }); }}
        onToggleOperator={() => { clearWrong(); dispatch({ type: 'OP' }); }}
        showConfirm
        onConfirm={handleConfirm}
      />
      {wrong ? <Text style={styles.wrongText}>נסו שנית — המשוואה צריכה להגיע ל־{target}</Text> : null}
    </View>
  );
}

// ── Final celebration — explicit finish, then back to the Hub.
function SuccessCelebration({ onDone }: { onDone?: () => void }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
  }, [pop]);
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  return (
    <View style={styles.root}>
      <Animated.Text style={[styles.trophy, { opacity: pop, transform: [{ scale }] }]}>🏆</Animated.Text>
      <Text style={styles.headline}>ניצחתם!</Text>
      <Text style={styles.copy}>שלטתם בקלפי הסימנים ובקלף סלינדה.</Text>
      <View style={styles.ctaWrap}>
        <GoldButton label="סיום" onPress={onDone} accessibilityLabel="סיום" fullWidth height={56} fontSize={20} />
      </View>
    </View>
  );
}

// The two migrated gameplay layers (35–44): the sign-card round and the
// Salinda-card round. Both run the same rigged `4 ? 3 = 7` exercise.
const SIGN_LAYER = GOLD_LAYERS[0];
const SALINDA_LAYER = GOLD_LAYERS[1];

type Phase = 'signs-reveal' | 'target-reveal' | 'signs-round' | 'salinda-reveal' | 'salinda-round' | 'success';

export default function SpecialCardsIntro({ onDone }: { onDone?: () => void }) {
  const [phase, setPhase] = useState<Phase>('signs-reveal');

  switch (phase) {
    case 'signs-reveal':
      return (
        <Reveal
          badge="⚡ שדרוג עוצמה"
          headline="הנשק הסודי שלך"
          copy="קלפים מיוחדים – קיצור הדרך שלך לניצחון! מציבים אותם במשוואה ונפטרים מהם בקלות."
          buttonLabel="הבנתי, בוא ננצח!"
          onPress={() => setPhase('target-reveal')}
          renderCards={(glow) =>
            ['+', '−', '×', '÷'].map((g, i) => <GlowCard key={g} glow={glow} delay={200 + i * 110} w={64} glyph={g} />)
          }
        />
      );

    case 'target-reveal':
      return (
        <Reveal
          badge="🎯 היעד שלך"
          headline="קלף המטרה"
          copy={`קלף המטרה הוא היעד שלך — בנו משוואה שמגיעה בדיוק ל־${SIGN_LAYER.target}, ותסגרו את הסבב.`}
          buttonLabel="קדימה, בוא נבנה!"
          onPress={() => setPhase('signs-round')}
          renderCards={(glow) => <GlowCard glow={glow} delay={200} w={96} glyph={String(SIGN_LAYER.target)} intensity={1.5} />}
        />
      );

    case 'signs-round':
      return <LayerRound key="signs" caption={SIGN_LAYER.caption} chip={SIGN_LAYER.chip} target={SIGN_LAYER.target} onSolved={() => setPhase('salinda-reveal')} />;

    case 'salinda-reveal':
      return (
        <Reveal
          badge="👑 אבן החן"
          headline="קלף סלינדה"
          copy="קלף סלינדה – הכוח המוחלט בידיים שלך! הנשק הסודי שמכיל את כל הסימנים וסוגר את המשחק."
          buttonLabel="בוא נפעיל אותו!"
          onPress={() => setPhase('salinda-round')}
          renderCards={(glow) => <GlowCard glow={glow} delay={200} w={96} glyph="♛" intensity={2} />}
        />
      );

    case 'salinda-round':
      return <LayerRound key="salinda" caption={SALINDA_LAYER.caption} chip={SALINDA_LAYER.chip} target={SALINDA_LAYER.target} onSolved={() => setPhase('success')} />;

    case 'success':
      return <SuccessCelebration onDone={onDone} />;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26, gap: 30 },

  // Reward header
  rewardBadge: {
    backgroundColor: 'rgba(244,205,90,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(244,205,90,0.5)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginBottom: 12,
  },
  rewardBadgeText: { color: '#F8E08E', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  headline: {
    color: '#F4CD5A',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(244,205,90,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },

  // Treasure cards
  cardsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14 },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },
  cardFace: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#8A5A1C',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '48%' },
  cardGlyph: {
    color: '#3A2A10',
    fontWeight: '900',
    textShadowColor: 'rgba(255,250,235,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },

  // Copy
  copy: { color: '#EAD6A4', fontSize: 18, lineHeight: 28, fontWeight: '700', textAlign: 'center', maxWidth: 380 },

  // CTA
  ctaWrap: { alignSelf: 'stretch', maxWidth: 420, width: '100%', alignItems: 'stretch' },

  // Focused layer round
  roundRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, gap: 22 },
  roundCaption: { color: '#F4CD5A', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  targetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(244,205,90,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244,205,90,0.55)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  targetPillLabel: { color: '#EAD6A4', fontSize: 14, fontWeight: '800' },
  targetPillValue: { color: '#F8E08E', fontSize: 20, fontWeight: '900' },
  chip: {
    backgroundColor: 'rgba(244,205,90,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(244,205,90,0.45)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipText: { color: '#F8E08E', fontSize: 14, fontWeight: '800' },
  wrongText: { color: '#F0A85A', fontSize: 15, fontWeight: '800', textAlign: 'center' },

  // Success
  trophy: { fontSize: 72, textAlign: 'center' },
});
