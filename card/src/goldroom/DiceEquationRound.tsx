// ============================================================
// DiceEquationRound — Gold Room "equation practice" flow.
//
// Orchestration only: wires together the existing pieces —
//   generateDiceSet()  → validated random dice (no walls)
//   AnimatedDice        → the live game's roll animation
//   EquationSlots       → the live equation-builder UI
//
// Stage machine:  pickCard → rolling → build → (new round)
// During the roll the brand slogan "לחשוב מחוץ למשוואה..."
// floats at the bottom as a small branding beat.
// ============================================================

import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedDice, { GoldDieFace } from '../../AnimatedDice';
import EquationSlots from '../components/onboarding/EquationSlots';
import { applyOperation } from '../utils/arithmetic';
import { generateTutorialSeed } from './generateDiceSet';

const GOLD = ['#F8E08E', '#F0C659', '#D9A23A', '#8A5A1C'] as const;
const SLOGAN = 'לחשוב מחוץ למשוואה...';

type Stage = 'pickCard' | 'rolling' | 'build';

// ── Local equation-builder state (controlled props for EquationSlots) ──

interface EquationDraftView {
  targetTileId: string | null;
  slots: [number | null, number | null];
  operator: '+' | '-';
  result: number | null;
}

interface EqState {
  equations: [EquationDraftView, EquationDraftView];
  activeEquationIndex: 0 | 1;
}

const emptyEq = (): EquationDraftView => ({ targetTileId: null, slots: [null, null], operator: '+', result: null });
const initialEqState = (): EqState => ({ equations: [emptyEq(), emptyEq()], activeEquationIndex: 0 });

function recompute(eq: EquationDraftView): EquationDraftView {
  const [a, b] = eq.slots;
  const result = a !== null && b !== null ? applyOperation(a, eq.operator, b) : null;
  return { ...eq, result };
}

type EqAction =
  | { type: 'SET_ACTIVE'; index: 0 | 1 }
  | { type: 'TAP_SOURCE'; number: number }
  | { type: 'TOGGLE_OP'; index: 0 | 1 }
  | { type: 'RESET' };

function eqReducer(state: EqState, action: EqAction): EqState {
  switch (action.type) {
    case 'RESET':
      return initialEqState();
    case 'SET_ACTIVE':
      return { ...state, activeEquationIndex: action.index };
    case 'TOGGLE_OP': {
      const equations = [...state.equations] as [EquationDraftView, EquationDraftView];
      const cur = equations[action.index];
      equations[action.index] = recompute({ ...cur, operator: cur.operator === '+' ? '-' : '+' });
      return { ...state, equations };
    }
    case 'TAP_SOURCE': {
      const idx = state.activeEquationIndex;
      const equations = [...state.equations] as [EquationDraftView, EquationDraftView];
      const cur = equations[idx];
      let slots: [number | null, number | null];
      if (cur.slots[0] === null) slots = [action.number, cur.slots[1]];
      else if (cur.slots[1] === null) slots = [cur.slots[0], action.number];
      else slots = [action.number, null]; // both full → start over with the new tap
      equations[idx] = recompute({ ...cur, slots });
      return { ...state, equations };
    }
    default:
      return state;
  }
}

// ── Stage: the card "stack" the learner taps to begin a round ──
function CardStack({ onPick }: { onPick: () => void }) {
  return (
    <View style={styles.centerStage}>
      <Text style={styles.prompt}>בחר קלף מהערימה כדי להתחיל</Text>
      <Pressable onPress={onPick} accessibilityRole="button" accessibilityLabel="בחר קלף מהערימה" style={styles.stackWrap}>
        {[2, 1, 0].map((depth) => (
          <View key={depth} style={[styles.stackCard, { top: depth * 6, left: depth * 6, zIndex: 3 - depth }]}>
            <LinearGradient colors={GOLD} locations={[0, 0.3, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.stackFace}>
              <Text style={styles.stackBack}>🎲</Text>
            </LinearGradient>
          </View>
        ))}
      </Pressable>
    </View>
  );
}

// ── Stage: rolling dice + branding slogan ──
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

// ── Stage: build the equation from the landed dice ──
function BuildStage({ dice, onNewRound }: { dice: [number, number, number]; onNewRound: () => void }) {
  const [state, dispatch] = useReducer(eqReducer, undefined, initialEqState);
  const [solved, setSolved] = useState(false);

  const handleConfirm = useCallback(
    (index: 0 | 1) => {
      const eq = state.equations[index];
      // A complete, legal equation (both slots filled, valid result) = success.
      if (eq.slots[0] !== null && eq.slots[1] !== null && eq.result !== null) setSolved(true);
    },
    [state.equations],
  );

  return (
    <View style={styles.buildStage}>
      <Text style={styles.prompt}>בנה משוואה מהקוביות</Text>
      <View style={styles.diceRow}>
        {dice.map((v, i) => (
          <GoldDieFace key={i} value={v} size={46} />
        ))}
      </View>
      <EquationSlots
        equations={state.equations}
        activeEquationIndex={state.activeEquationIndex}
        sourceNumbers={dice}
        onSelectEquation={(index) => dispatch({ type: 'SET_ACTIVE', index })}
        onTapSource={(number) => dispatch({ type: 'TAP_SOURCE', number })}
        onToggleOperator={(index) => dispatch({ type: 'TOGGLE_OP', index })}
        onConfirmEquation={handleConfirm}
      />
      {solved ? <Text style={styles.success}>כל הכבוד! משוואה חוקית ✓</Text> : null}
      <Pressable
        onPress={() => {
          dispatch({ type: 'RESET' });
          onNewRound();
        }}
        accessibilityRole="button"
        style={styles.newRoundBtn}
      >
        <Text style={styles.newRoundTxt}>סבב חדש 🎲</Text>
      </Pressable>
    </View>
  );
}

export function DiceEquationRound() {
  const [stage, setStage] = useState<Stage>('pickCard');
  const [dice, setDice] = useState<[number, number, number]>([1, 1, 1]);

  const startRound = useCallback(() => {
    setDice(generateTutorialSeed());
    setStage('rolling');
  }, []);

  return (
    <View style={styles.root}>
      {stage === 'pickCard' && <CardStack onPick={startRound} />}
      {stage === 'rolling' && <RollingStage dice={dice} onDone={() => setStage('build')} />}
      {stage === 'build' && <BuildStage dice={dice} onNewRound={startRound} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  centerStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  buildStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 22 },
  prompt: { color: '#F4CD5A', fontSize: 18, fontWeight: '800', textAlign: 'center' },

  // card stack
  stackWrap: { width: 120, height: 150 },
  stackCard: { position: 'absolute', width: 100, height: 134 },
  stackFace: {
    width: 100,
    height: 134,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#8A5A1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackBack: { fontSize: 40 },

  // rolling
  slogan: { color: '#F4CD5A', fontSize: 20, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' },

  // build
  diceRow: { flexDirection: 'row', gap: 12 },
  success: { color: '#7BE08A', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  newRoundBtn: {
    marginTop: 6,
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 14,
    backgroundColor: 'rgba(20,12,4,0.6)',
    borderWidth: 1.5,
    borderColor: 'rgba(244,205,90,0.5)',
  },
  newRoundTxt: { color: '#F4CD5A', fontSize: 16, fontWeight: '800' },
});

export default DiceEquationRound;
