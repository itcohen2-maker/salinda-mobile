// ============================================================
// DiceEquationRound — Gold Room "Mastery Loop", rebuilt as a faithful,
// SINGLE-SCREEN simulation of the live game. The frame (gold table, the
// prominent deck, the hand fan) is persistent; only the play state changes:
//
//   roll  →  solve  →  success
//
// Game-faithful dimensions (taken from the live game): the dice use the real
// AnimatedDice with its ORIGINAL animated roll button; cards use the live
// 5:7 ratio; the deck (הערימה) is rendered big and prominent in the corner,
// and the hand fan is anchored low at the bottom — exactly like the table.
//
//   Phase 1 — Roll
//     The live AnimatedDice sits over the gold table with its own animated
//     roll button. Pressing it shakes + lands the dice with the game's roll
//     beat. A reachable TARGET card is derived from the landed values, so the
//     puzzle is fresh every round yet 100% winnable.
//
//   Phase 2 — Solve  (STRICT target matching — "Game of Silence")
//     The landed dice sit ABOVE the equation as gold source bubbles (the live
//     "dice pool" convention). The learner builds ONE equation with the
//     premium GoldEquationTrack; its 3D GoldButton "בדוק" stays dimmed until
//     the equation is structurally complete, then lights up.
//       • Exact match  → lock + gold flash → auto-advance to SuccessCelebration.
//       • Mismatch     → a gentle shake on the track. No loud "wrong" text,
//                        no popup — the player intuitively swaps a card / sign.
//
//   Success — the SuccessCelebration: trophy + finish. No Retry/Next/Menu
//     choice overlay; the round proceeds with zero intermediate friction.
//
// Orchestration only: reuses AnimatedDice, the shared HandFan and the
// Gold-Room GoldEquationTrack. No duplicated game logic.
// ============================================================

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import AnimatedDice from '../../AnimatedDice';
import { type Card, type Fraction } from '../../components/CardDesign';
import HandFan from '../../components/HandFan';
import GoldEquationTrack from './GoldEquationTrack';
import { GoldButton } from '../../components/GoldButton';
import { applyOperation } from '../utils/arithmetic';
import { playSfx } from '../audio/sfx';

// The Gold Room table surface (same asset family the live game uses).
const GOLD_TABLE_IMG = require('../../assets/table_golden_nobg.png');
// The real game's branded card back — used for the deck pile (הערימה).
const CARD_BACK_IMG = require('../../assets/card-back-salinda-preview.png');

// Game-faithful card geometry (matches getNativeHandFanMetrics' 100×140 base).
const CARD_RATIO = 5 / 7;
const DECK_CARD_H = 134; // prominent on entry, tucked into the corner
const DECK_CARD_W = Math.round(DECK_CARD_H * CARD_RATIO);

// Layered offsets copied from the live game's DrawPile so the deck reads
// as a real, slightly-messy stack of cards.
const PILE_ROTATIONS = [
  { rotate: '-3deg', tx: -3, ty: 5 },
  { rotate: '2deg', tx: 4, ty: 3 },
  { rotate: '-1deg', tx: -1, ty: 1 },
  { rotate: '0deg', tx: 0, ty: 0 },
];

// ── The deck (הערימה) — "the bank". A big, prominent corner pile of branded
// card backs in the TOP-RIGHT, mirroring the live game's draw pile, so the
// learner meets the deck on entry. Recognition only (no draw).
function GoldDeckPile() {
  return (
    <View style={styles.deckWrap} pointerEvents="none">
      <View style={styles.deckStack}>
        {PILE_ROTATIONS.map((r, i) => (
          <Image
            key={i}
            source={CARD_BACK_IMG}
            resizeMode="cover"
            style={[styles.deckCard, { transform: [{ rotate: r.rotate }, { translateX: r.tx }, { translateY: r.ty }] }]}
          />
        ))}
      </View>
    </View>
  );
}

type Stage = 'roll' | 'solve' | 'success';

// ── A demo hand for the bottom fan (a few number cards + one fraction), so
// the learner sees a real hand below the table. Built fresh per round.
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

// ── Derive a reachable TARGET from the LANDED dice. The equation uses two of
// the three dice under '+'/'-', so we enumerate every legal, non-negative
// two-die result and pick one. Because the target is built FROM a real
// equation on these exact dice, the round is always solvable — no seeding,
// no impossible wall.
function deriveTarget(dice: [number, number, number]): number {
  const [a, b, c] = dice;
  const pairs: Array<[number, number]> = [[a, b], [a, c], [b, c]];
  const reachable = new Set<number>();
  for (const [x, y] of pairs) {
    for (const op of ['+', '-'] as const) {
      const r = applyOperation(x, op, y);
      if (r !== null && r >= 0) reachable.add(r);
      const swapped = applyOperation(y, op, x);
      if (swapped !== null && swapped >= 0) reachable.add(swapped);
    }
  }
  const options = [...reachable];
  // `+` always yields a non-negative result, so `options` is never empty.
  return options[Math.floor(Math.random() * options.length)];
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

// ── Phase 2: build the SINGLE equation from the landed dice and check it
// against the TARGET. The premium GoldEquationTrack supplies the 3D "בדוק"
// button (dimmed until the equation is structurally complete). Resolving with
// an exact match flashes gold and wins; a mismatch shakes the track.
function SolvingStage({ dice, target, onWin }: { dice: [number, number, number]; target: number; onWin: () => void }) {
  const [eq, dispatch] = useReducer(eqReducer, undefined, emptyEq);
  const [locked, setLocked] = useState(false); // freezes input during the win flash
  const shake = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;

  // FAILURE — "Game of Silence": a gentle shake, no text, no jarring chime.
  const doShake = useCallback(() => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0.55, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -0.55, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shake]);

  // SUCCESS — lock the track, flash gold, then auto-advance.
  const doWin = useCallback(() => {
    setLocked(true);
    void playSfx('success', { cooldownMs: 0 }); // reward chime on the exact match
    Animated.sequence([
      Animated.timing(flash, { toValue: 1, duration: 170, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 430, useNativeDriver: true }),
    ]).start(() => onWin());
  }, [flash, onWin]);

  const handleConfirm = useCallback(() => {
    if (locked || eq.result === null) return; // result === null ⇒ button is dimmed anyway
    if (eq.result === target) doWin();
    else doShake();
  }, [locked, eq.result, target, doWin, doShake]);

  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] });

  return (
    <View style={styles.solveZone} pointerEvents={locked ? 'none' : 'auto'}>
      <Animated.View style={{ transform: [{ translateX }] }}>
        <View>
          <GoldEquationTrack
            slots={eq.slots}
            operator={eq.operator}
            result={eq.result}
            sources={dice}
            onTapSource={(n) => { if (!locked) dispatch({ type: 'TAP_SOURCE', number: n }); }}
            onToggleOperator={() => { if (!locked) dispatch({ type: 'TOGGLE_OP' }); }}
            showConfirm
            onConfirm={handleConfirm}
          />
          {/* Gold success flash — a soft glow over the whole track on a match. */}
          <Animated.View pointerEvents="none" style={[styles.winFlash, { opacity: flash }]} />
        </View>
      </Animated.View>
    </View>
  );
}

// ── The target card (קלף המטרה) — a persistent, face-up goal card the learner
// must reach EXACTLY, with one concise instruction beside it. Kept clear of
// the deck on the right.
function TargetHeader({ target }: { target: number }) {
  return (
    <View style={styles.topHeader} pointerEvents="none">
      <View style={styles.targetCol}>
        <Text style={styles.targetLabel}>קלף המטרה</Text>
        <View style={styles.targetCard}><Text style={styles.targetValue}>{target}</Text></View>
      </View>
      <Text style={styles.headerText}>
        בנו משוואה שמגיעה בדיוק אל קלף המטרה — בחרו שני מספרים וסימן, ולחצו בדוק.
      </Text>
    </View>
  );
}

// ── Success — the explicit finish. A trophy pops, then a single "סיום"
// returns to the Hub. No Retry/Next/Menu choice overlay.
function SuccessCelebration({ onDone }: { onDone?: () => void }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
  }, [pop]);
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  return (
    <View style={styles.successOverlay}>
      <View style={styles.successCard}>
        <Animated.Text style={[styles.successTrophy, { opacity: pop, transform: [{ scale }] }]}>🏆</Animated.Text>
        <Text style={styles.successTitle}>כל הכבוד!</Text>
        <Text style={styles.successSub}>הגעת בדיוק אל קלף המטרה ✓</Text>
        <View style={styles.successCta}>
          <GoldButton label="סיום" onPress={onDone} accessibilityLabel="סיום" fullWidth height={56} fontSize={20} />
        </View>
      </View>
    </View>
  );
}

export function DiceEquationRound({ onExit, onComplete }: { onExit?: () => void; onComplete?: () => void }) {
  const [stage, setStage] = useState<Stage>('roll');

  // The dice are rolled for real (random, fully animated) — captured from the
  // roll. The TARGET is then derived from the landed values, so any round is
  // both fresh and guaranteed solvable.
  const [dice, setDice] = useState<[number, number, number]>([1, 1, 1]);
  const [target, setTarget] = useState(0);
  const hand = useMemo(() => buildObservationHand(), []);

  const handleRollStart = useCallback(() => {
    void playSfx('transition', { cooldownMs: 0 }); // the game's roll beat
  }, []);

  const handleRollComplete = useCallback((vals: [number, number, number]) => {
    setDice(vals); // use the values that actually landed
    setTarget(deriveTarget(vals)); // a reachable goal for THESE dice
    setStage('solve');
  }, []);

  // Exact match → mark the practice complete (gates the coin reward) and
  // advance straight to the celebration.
  const handleWin = useCallback(() => {
    onComplete?.();
    setStage('success');
  }, [onComplete]);

  return (
    <View style={styles.root}>
      {/* The deck (הערימה) — big & prominent in the corner, like the live game. */}
      <GoldDeckPile />

      {/* Target card + instruction — persistent at the top during solving. */}
      {stage === 'solve' ? <TargetHeader target={target} /> : null}

      {/* Play area: the gold table is a sized, semi-transparent surface, and the
       *  dice/roll-button (roll) or the equation (solve) sit CENTERED on it. */}
      <View style={styles.playArea}>
        <View style={styles.tableZone}>
          <Image source={GOLD_TABLE_IMG} resizeMode="contain" style={styles.tableImg} />
          <View style={styles.tableOverlay} pointerEvents="box-none">
            {stage === 'roll' ? (
              <AnimatedDice
                size={40}
                hideSumBadge
                buttonText="🎲 הטל"
                onRollStart={handleRollStart}
                onRollComplete={handleRollComplete}
              />
            ) : stage === 'solve' ? (
              <SolvingStage dice={dice} target={target} onWin={handleWin} />
            ) : null}
          </View>
        </View>
      </View>

      {/* The hand fan — anchored low at the bottom, clear of the dice/button
       *  above it (the live hand placement). */}
      <View style={styles.fanWrap} pointerEvents="box-none">
        <HandFan cards={hand} />
      </View>

      {stage === 'success' ? <SuccessCelebration onDone={onExit} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // The deck (הערימה) — big corner pile of branded card backs, TOP-RIGHT.
  deckWrap: { position: 'absolute', top: 10, right: 16, alignItems: 'center', zIndex: 5 },
  deckStack: { width: DECK_CARD_W + 14, height: DECK_CARD_H + 12, alignItems: 'center', justifyContent: 'center' },
  deckCard: {
    position: 'absolute',
    width: DECK_CARD_W,
    height: DECK_CARD_H,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(244,205,90,0.5)',
  },

  // Play area — fills the space above the fan; the table sits centered in it.
  playArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  // The table: a sized, semi-transparent surface. Content is overlaid centered
  // ON it, so the roll button / equation always sit on the table, not off it.
  tableZone: { width: '94%', maxWidth: 380, aspectRatio: 1024 / 774, alignItems: 'center', justifyContent: 'center' },
  tableImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.55 },
  tableOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  solveZone: { alignItems: 'center', width: '100%' },

  // The gold success flash — a soft gold wash over the equation track.
  winFlash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: 'rgba(248,224,142,0.55)',
  },

  // Hand fan — raised off the bottom edge so there's room BELOW it for the
  // game-style action buttons (discard / results) that come next.
  fanWrap: { alignItems: 'center', paddingBottom: 104 },

  // Target card + instruction header — premium gold, near the top, kept clear
  // of the deck on the right.
  topHeader: {
    position: 'absolute',
    top: 10,
    left: 14,
    right: 116,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 15,
  },
  targetCol: { alignItems: 'center' },
  targetLabel: { color: '#D8C49A', fontSize: 11, fontWeight: '800', marginBottom: 4 },
  targetCard: {
    width: 52,
    height: 72,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,205,90,0.14)',
    borderWidth: 2,
    borderColor: 'rgba(244,205,90,0.85)',
  },
  targetValue: { color: '#F8E08E', fontSize: 30, fontWeight: '900' },
  headerText: { flex: 1, color: '#F8E08E', fontSize: 13, fontWeight: '700', lineHeight: 19, textAlign: 'right' },

  // Success celebration — full-screen, explicit finish.
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,5,2,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 20,
  },
  successCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#2E7D43',
    backgroundColor: 'rgba(17,12,4,0.96)',
    paddingHorizontal: 26,
    paddingVertical: 30,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 14,
  },
  successTrophy: { fontSize: 56 },
  successTitle: { color: '#7BE08A', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  successSub: { color: '#D8C49A', fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 22, marginBottom: 6 },
  successCta: { alignSelf: 'stretch', marginTop: 6 },
});

export default DiceEquationRound;
