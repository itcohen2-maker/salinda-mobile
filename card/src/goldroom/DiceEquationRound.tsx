// ============================================================
// DiceEquationRound — Gold Room "Mastery Loop" (Simulation Mode).
//
// A focused, single-task practice flow on ONE screen — the layout
// never navigates away; only the stage state changes:
//
//   stack  →  rolling  →  solving   (+ a result overlay)
//
//   Phase 1 — Stack (the Challenge Deck)
//     The premium dark-gold hand fan is anchored at the bottom of the
//     screen — exactly like the live game's hand — with the UNLOCKED
//     equation track sitting directly above it for free experimentation.
//     Tapping a number card in the fan drops its value into the track.
//     When ready, the learner taps the gold "תראה לי" pill (a minimalist
//     chevron sits above it) to roll the dice.
//
//   Phase 2 — Rolling
//     generateTutorialSeed() → validated dice → roll animation, under the
//     brand slogan beat.
//
//   Phase 3 — Solving (single focused track)
//     ONE equation track (GoldEquationTrack). No dual tracks, no green
//     Confirm, no countdown timer. The learner builds the equation and
//     taps the gold "בדוק" button to resolve.
//
//   Result — the Mastery Loop
//     The board freezes and a result overlay offers three explicit
//     choices: Retry (same card, fresh dice), Next (new card), Menu.
//
// Orchestration only: reuses generateTutorialSeed, AnimatedDice, GameCard,
// and the Gold-Room GoldEquationTrack. No duplicated game logic.
// ============================================================

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import AnimatedDice, { GoldDieFace } from '../../AnimatedDice';
import { GameCard, type Card, type Fraction } from '../../components/CardDesign';
import GoldEquationTrack from './GoldEquationTrack';
import { GoldButton } from '../../components/GoldButton';
import { applyOperation } from '../utils/arithmetic';
import { generateTutorialSeed } from './generateDiceSet';

const SLOGAN = 'לחשוב מחוץ למשוואה...';

type Stage = 'stack' | 'rolling' | 'solving' | 'result';

// ── The static stack hand ───────────────────────────────────────────
// Built fresh per round: a few number cards plus one fraction card, so
// the learner sees the pile can hold both.

const FRACTIONS: Fraction[] = ['1/2', '1/3', '1/4', '1/5'];

function buildObservationHand(): Card[] {
  const cards: Card[] = [];
  for (let i = 0; i < 6; i++) {
    cards.push({ id: `obs-n-${i}`, type: 'number', value: 1 + Math.floor(Math.random() * 9) });
  }
  cards.push({ id: 'obs-frac', type: 'fraction', fraction: FRACTIONS[Math.floor(Math.random() * FRACTIONS.length)] });
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

// ── Local equation-builder state (a SINGLE controlled equation) ──────
interface EquationDraftView {
  slots: [number | null, number | null];
  operator: '+' | '-';
  result: number | null;
}

const emptyEq = (): EquationDraftView => ({ slots: [null, null], operator: '+', result: null });

function recompute(eq: EquationDraftView): EquationDraftView {
  const [a, b] = eq.slots;
  const result = a !== null && b !== null ? applyOperation(a, eq.operator, b) : null;
  return { ...eq, result };
}

type EqAction = { type: 'TAP_SOURCE'; number: number } | { type: 'TOGGLE_OP' } | { type: 'RESET' };

function eqReducer(state: EquationDraftView, action: EqAction): EquationDraftView {
  switch (action.type) {
    case 'RESET':
      return emptyEq();
    case 'TOGGLE_OP':
      return recompute({ ...state, operator: state.operator === '+' ? '-' : '+' });
    case 'TAP_SOURCE': {
      let slots: [number | null, number | null];
      if (state.slots[0] === null) slots = [action.number, state.slots[1]];
      else if (state.slots[1] === null) slots = [state.slots[0], action.number];
      else slots = [action.number, null];
      return recompute({ ...state, slots });
    }
    default:
      return state;
  }
}

// ── Phase 1: the Stack (Challenge Deck) — premium dark-gold look, the
// hand fan anchored at the bottom with an UNLOCKED experimentation track
// directly above it, and the unified "תראה לי" pill + chevron transition.
// Tapping a number card feeds its value into the track. ───────────────
function StackStage({ hand, onAdvance }: { hand: Card[]; onAdvance: () => void }) {
  const [eq, dispatch] = useReducer(eqReducer, undefined, emptyEq);
  const chevron = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const appear = Animated.timing(chevron, {
      toValue: 1,
      duration: 450,
      delay: 500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    appear.start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      appear.stop();
      loop.stop();
    };
  }, [chevron, bob]);

  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, 8] });
  const mid = (hand.length - 1) / 2;

  return (
    <View style={styles.stackStage}>
      {/* Top zone — instruction bubble + the unified "תראה לי" advance
       *  control (minimalist chevron above the gold pill). */}
      <View style={styles.stackTop}>
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>אתם יכולים לנסות לפתור בעצמכם! מתי שתרצו, לחצו 'תראה לי'.</Text>
        </View>

        <View style={styles.advanceWrap}>
          <Animated.View style={{ opacity: chevron, transform: [{ translateY: bobY }] }}>
            <Svg width={40} height={24} viewBox="0 0 48 30">
              <Path d="M6 8 L24 24 L42 8" stroke="#F4CD5A" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.85} />
            </Svg>
          </Animated.View>
          <GoldButton label="תראה לי ›" onPress={onAdvance} accessibilityLabel="תראה לי" height={52} fontSize={18} />
        </View>
      </View>

      {/* Bottom zone — the equation workspace sits directly ABOVE the card
       *  fan, which is anchored at the very bottom of the screen, mirroring
       *  the live game's hand placement. */}
      <View style={styles.stackBottom}>
        <GoldEquationTrack
          slots={eq.slots}
          operator={eq.operator}
          result={eq.result}
          sources={[]}
          onTapSource={(n) => dispatch({ type: 'TAP_SOURCE', number: n })}
          onToggleOperator={() => dispatch({ type: 'TOGGLE_OP' })}
        />

        {/* The hand fan — fully interactive: tapping a number card drops its
         *  value into the equation track above. */}
        <View style={styles.fanRow}>
          {hand.map((card, i) => {
            const offset = i - mid;
            const isNumber = card.type === 'number';
            const value = isNumber ? (card as { value: number }).value : null;
            return (
              <Pressable
                key={card.id}
                disabled={!isNumber}
                onPress={isNumber ? () => dispatch({ type: 'TAP_SOURCE', number: value as number }) : undefined}
                accessibilityRole={isNumber ? 'button' : undefined}
                accessibilityLabel={isNumber ? `הוסף ${value}` : undefined}
                style={({ pressed }) => ({
                  marginLeft: i === 0 ? 0 : -62,
                  transform: [
                    { rotate: `${offset * 6}deg` },
                    { translateY: Math.abs(offset) * 8 - (pressed && isNumber ? 10 : 0) },
                  ],
                  zIndex: i,
                })}
              >
                <GameCard card={card} small />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ── Phase 2: rolling dice + branding slogan ──────────────────────────
function RollingStage({ dice, onDone }: { dice: [number, number, number]; onDone: () => void }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [fade]);

  return (
    <View style={styles.centerStage}>
      <AnimatedDice fixedFinalValues={dice} autoRollOnMount hideRollButton hideSumBadge onRollComplete={onDone} />
      <Animated.Text style={[styles.slogan, { opacity: fade }]}>{SLOGAN}</Animated.Text>
    </View>
  );
}

// ── Phase 3: build the SINGLE equation from the landed dice. No timer.
// Resolves the round when the learner taps the gold "בדוק" on a legal
// equation. When frozen, the board is the static backdrop for the
// result overlay — no taps.
function SolvingStage({ dice, frozen, onResolve }: { dice: [number, number, number]; frozen: boolean; onResolve: () => void }) {
  const [eq, dispatch] = useReducer(eqReducer, undefined, emptyEq);

  const handleConfirm = useCallback(() => {
    if (frozen) return;
    if (eq.slots[0] !== null && eq.slots[1] !== null && eq.result !== null) onResolve();
  }, [frozen, eq, onResolve]);

  return (
    <View style={styles.solveStage} pointerEvents={frozen ? 'none' : 'auto'}>
      <View style={styles.diceRow}>
        {dice.map((v, i) => (
          <GoldDieFace key={i} value={v} size={40} />
        ))}
      </View>

      <GoldEquationTrack
        slots={eq.slots}
        operator={eq.operator}
        result={eq.result}
        sources={dice}
        onTapSource={(n) => dispatch({ type: 'TAP_SOURCE', number: n })}
        onToggleOperator={() => dispatch({ type: 'TOGGLE_OP' })}
        showConfirm
        onConfirm={handleConfirm}
      />
    </View>
  );
}

// ── Result — the Mastery Loop overlay. Three explicit choices; nothing
// happens until the learner picks one.
function ResultOverlay({ onRetry, onNext, onMenu }: { onRetry: () => void; onNext: () => void; onMenu: () => void }) {
  return (
    <View style={styles.resultOverlay}>
      <View style={[styles.resultCard, { borderColor: '#2E7D43' }]}>
        <Text style={styles.resultBadge}>🏆</Text>
        <Text style={[styles.resultTitle, { color: '#7BE08A' }]}>כל הכבוד!</Text>
        <Text style={styles.resultSub}>בנית משוואה חוקית ✓</Text>

        <View style={styles.resultActions}>
          <GoldButton label="הבא ›" onPress={onNext} accessibilityLabel="הקלף הבא" fullWidth height={58} fontSize={20} />
          <GoldButton label="נסה שוב 🔁" onPress={onRetry} accessibilityLabel="נסה שוב על אותו קלף" fullWidth height={50} fontSize={17} />
          <GoldButton label="יציאה" onPress={onMenu} accessibilityLabel="יציאה לחדר הזהב" tone="stone" fullWidth height={46} fontSize={15} />
        </View>
      </View>
    </View>
  );
}

// ── Admin/dev layer tracker — mirrors the Hub status line so the active
// flow layer is always legible during development.
const TRACKER: Record<Stage, string> = {
  stack: 'UI: Stack · Flow: Experiment · Action: Try / Show Me',
  rolling: 'UI: Roll · Flow: Auto · Action: Deal Dice',
  solving: 'UI: Equation · Flow: Solve · Action: Single Track',
  result: 'UI: Result Screen | Flow: User Decision | Action: Mastery Loop',
};

function LayerTracker({ stage }: { stage: Stage }) {
  return (
    <View pointerEvents="none" style={styles.tracker}>
      <Text style={styles.trackerText}>{TRACKER[stage]}</Text>
    </View>
  );
}

export function DiceEquationRound({ onExit }: { onExit?: () => void }) {
  const [stage, setStage] = useState<Stage>('stack');
  const [roundKey, setRoundKey] = useState(0); // identifies the current CARD (stack hand)
  const [solveKey, setSolveKey] = useState(0); // forces a fresh equation per solve attempt
  const [dice, setDice] = useState<[number, number, number]>([1, 1, 1]);

  // Fresh stack hand per CARD. Retry keeps the same roundKey (same card);
  // Next bumps it (new card).
  const hand = useMemo(() => buildObservationHand(), [roundKey]);

  // Roll fresh dice and run the simulation for the CURRENT card.
  const startSimulation = useCallback(() => {
    setDice(generateTutorialSeed());
    setSolveKey((k) => k + 1);
    setStage('rolling');
  }, []);

  const handleResolve = useCallback(() => {
    setStage('result'); // freeze the board; surface the Mastery Loop result screen
  }, []);

  // Mastery Loop choices — all explicit, none automatic.
  const handleRetry = useCallback(() => startSimulation(), [startSimulation]); // SAME card, fresh dice
  const handleNext = useCallback(() => {
    setRoundKey((k) => k + 1); // NEW card
    setStage('stack'); // back to the Stack
  }, []);
  const handleMenu = useCallback(() => onExit?.(), [onExit]); // back to the Hub

  return (
    <View style={styles.root}>
      {stage === 'stack' && <StackStage key={roundKey} hand={hand} onAdvance={startSimulation} />}
      {stage === 'rolling' && <RollingStage dice={dice} onDone={() => setStage('solving')} />}
      {(stage === 'solving' || stage === 'result') && (
        <SolvingStage key={solveKey} dice={dice} frozen={stage === 'result'} onResolve={handleResolve} />
      )}
      {stage === 'result' ? <ResultOverlay onRetry={handleRetry} onNext={handleNext} onMenu={handleMenu} /> : null}

      {__DEV__ ? <LayerTracker stage={stage} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  centerStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  // Top-anchored instruction/advance zone + bottom-anchored workspace/fan.
  stackStage: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28 },
  stackTop: { alignItems: 'center', gap: 22 },
  stackBottom: { alignItems: 'center', gap: 22, width: '100%' },
  solveStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 26, paddingHorizontal: 22 },

  bubble: {
    maxWidth: 360,
    backgroundColor: 'rgba(244,205,90,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244,205,90,0.4)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  bubbleText: { color: '#F8E08E', fontSize: 14, fontWeight: '700', textAlign: 'center', lineHeight: 20 },

  fanRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  advanceWrap: { alignItems: 'center', gap: 8 },
  slogan: { color: '#F4CD5A', fontSize: 20, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' },

  diceRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },

  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,5,2,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 20,
  },
  resultCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    borderWidth: 2,
    backgroundColor: 'rgba(17,12,4,0.96)',
    paddingHorizontal: 26,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 14,
  },
  resultBadge: { fontSize: 44 },
  resultTitle: { fontSize: 26, fontWeight: '900', textAlign: 'center' },
  resultSub: { color: '#D8C49A', fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 22, marginBottom: 6 },
  resultActions: { alignSelf: 'stretch', marginTop: 6, gap: 10 },

  tracker: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(244,205,90,0.16)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(244,205,90,0.3)',
  },
  trackerText: { color: '#F4CD5A', fontSize: 11, fontWeight: '700', textAlign: 'center' },
});

export default DiceEquationRound;
