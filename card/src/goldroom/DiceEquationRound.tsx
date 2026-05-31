// ============================================================
// DiceEquationRound — Gold Room "Mastery Loop", rebuilt as a faithful,
// SINGLE-SCREEN simulation of the live game. The frame (gold table, the
// prominent deck, the hand fan) is persistent; only the play state changes:
//
//   roll  →  solve   (+ a result overlay)
//
// Game-faithful dimensions (taken from the live game): the dice use the real
// AnimatedDice with its ORIGINAL animated roll button; cards use the live
// 5:7 ratio; the deck (הערימה) is rendered big and prominent in the corner,
// and the hand fan is anchored low at the bottom — exactly like the table.
//
//   Phase 1 — Roll
//     The live AnimatedDice sits over the gold table with its own animated
//     roll button. Pressing it shakes + lands the dice (on a guaranteed-
//     solvable seed) with the game's roll beat, then advances to solve.
//
//   Phase 2 — Solve
//     The landed dice sit ABOVE the equation (same as the live dice pool);
//     the learner builds one equation with the shared EquationSlots (gold)
//     and taps "בדוק" to resolve.
//
//   Result — the Mastery Loop overlay: Retry (fresh dice), Next (new hand),
//     Menu. Room is left below the table for the upcoming "discard a card"
//     button + possible-results, to keep growing toward the full game.
//
// Orchestration only: reuses generateTutorialSeed, AnimatedDice, the shared
// HandFan and EquationSlots. No duplicated game logic.
// ============================================================

import React, { useCallback, useMemo, useReducer, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import AnimatedDice from '../../AnimatedDice';
import { type Card, type Fraction } from '../../components/CardDesign';
import HandFan from '../../components/HandFan';
import EquationSlots from '../components/onboarding/EquationSlots';
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

type Stage = 'roll' | 'solve' | 'result';

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

// ── Phase 2: build the SINGLE equation from the landed dice. The dice sit
// ABOVE the equation (the live "dice pool" convention). Resolves when the
// learner taps "בדוק" on a legal equation. Frozen = static backdrop for the
// result overlay.
function SolvingStage({ dice, frozen, onResolve }: { dice: [number, number, number]; frozen: boolean; onResolve: () => void }) {
  const [eq, dispatch] = useReducer(eqReducer, undefined, emptyEq);

  const handleConfirm = useCallback(() => {
    if (frozen) return;
    if (eq.slots[0] !== null && eq.slots[1] !== null && eq.result !== null) onResolve();
  }, [frozen, eq, onResolve]);

  return (
    <View style={styles.solveZone} pointerEvents={frozen ? 'none' : 'auto'}>
      {/* The SAME equation builder as the tutorial (EquationSlots), gold skin:
       *  the landed dice are the tappable source bubbles (above the slots);
       *  the track is transparent so it sits ON the table; "בדוק" resolves. */}
      <EquationSlots
        theme="gold"
        equations={[{ targetTileId: null, slots: eq.slots, operator: eq.operator, result: eq.result }]}
        activeEquationIndex={0}
        sourceNumbers={dice}
        onSelectEquation={() => {}}
        onTapSource={(n) => dispatch({ type: 'TAP_SOURCE', number: n })}
        onToggleOperator={() => dispatch({ type: 'TOGGLE_OP' })}
        onConfirmEquation={handleConfirm}
        confirmLabel="בדוק ✓"
        confirmDisabledForIndex={() => eq.slots[0] === null || eq.slots[1] === null || eq.result === null}
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
          <GoldButton label="הבא ›" onPress={onNext} accessibilityLabel="קלף חדש" fullWidth height={58} fontSize={20} />
          <GoldButton label="נסה שוב 🔁" onPress={onRetry} accessibilityLabel="הטלה מחדש" fullWidth height={50} fontSize={17} />
          <GoldButton label="יציאה" onPress={onMenu} accessibilityLabel="יציאה לחדר הזהב" tone="stone" fullWidth height={46} fontSize={15} />
        </View>
      </View>
    </View>
  );
}

export function DiceEquationRound({ onExit, onComplete }: { onExit?: () => void; onComplete?: () => void }) {
  const [stage, setStage] = useState<Stage>('roll');
  const [roundKey, setRoundKey] = useState(0); // new HAND (and dice)
  const [diceKey, setDiceKey] = useState(0); // fresh dice for the SAME hand (retry)

  // The dice are rolled for real (random, fully animated) — captured from the
  // roll. Any +/- pair of dice yields a legal equation, so no seeding needed.
  const [dice, setDice] = useState<[number, number, number]>([1, 1, 1]);
  const hand = useMemo(() => buildObservationHand(), [roundKey]);

  const handleRollStart = useCallback(() => {
    void playSfx('transition', { cooldownMs: 0 }); // the game's roll beat
  }, []);

  const handleRollComplete = useCallback((vals: [number, number, number]) => {
    setDice(vals); // use the values that actually landed
    setStage('solve');
  }, []);

  const handleResolve = useCallback(() => {
    void playSfx('success', { cooldownMs: 0 }); // reward chime on a legal equation
    onComplete?.(); // first legal solve marks the practice task complete (gates the coin reward)
    setStage('result'); // freeze the board; surface the Mastery Loop result screen
  }, [onComplete]);

  // Mastery Loop choices — all explicit, none automatic.
  const handleRetry = useCallback(() => {
    setDiceKey((k) => k + 1); // SAME hand, fresh dice
    setStage('roll');
  }, []);
  const handleNext = useCallback(() => {
    setRoundKey((k) => k + 1); // NEW hand
    setDiceKey((k) => k + 1); // ...and fresh dice
    setStage('roll');
  }, []);
  const handleMenu = useCallback(() => onExit?.(), [onExit]); // back to the Hub

  return (
    <View style={styles.root}>
      {/* The deck (הערימה) — big & prominent in the corner, like the live game. */}
      <GoldDeckPile />

      {/* Play area: the gold table is a sized, semi-transparent surface, and the
       *  dice/roll-button (roll) or the equation (solve) sit CENTERED on it. */}
      <View style={styles.playArea}>
        <View style={styles.tableZone}>
          <Image source={GOLD_TABLE_IMG} resizeMode="contain" style={styles.tableImg} />
          <View style={styles.tableOverlay} pointerEvents="box-none">
            {stage === 'roll' ? (
              <AnimatedDice
                key={`dice-${diceKey}`}
                size={40}
                hideSumBadge
                buttonText="🎲 הטל"
                onRollStart={handleRollStart}
                onRollComplete={handleRollComplete}
              />
            ) : (
              <SolvingStage key={`solve-${diceKey}`} dice={dice} frozen={stage === 'result'} onResolve={handleResolve} />
            )}
          </View>
        </View>
      </View>

      {/* The hand fan — anchored low at the bottom, clear of the dice/button
       *  above it (the live hand placement). */}
      <View style={styles.fanWrap} pointerEvents="box-none">
        <HandFan cards={hand} />
      </View>

      {stage === 'result' ? <ResultOverlay onRetry={handleRetry} onNext={handleNext} onMenu={handleMenu} /> : null}
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

  // Hand fan — raised off the bottom edge so there's room BELOW it for the
  // game-style action buttons (discard / results) that come next.
  fanWrap: { alignItems: 'center', paddingBottom: 104 },

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
});

export default DiceEquationRound;
