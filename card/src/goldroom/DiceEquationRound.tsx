// ============================================================
// DiceEquationRound — Gold Room "Mastery Loop", a fully SELF-CONTAINED
// onboarding sandbox. It is intentionally DECOUPLED from the live game
// engine: all flow + validation logic lives locally here, so the room
// stays a premium, bug-free experience that can never break the real game.
//
// THE AUTHENTIC SALINDA RULE (modelled faithfully here):
//
//   • The DICE are the INPUTS. The player forms an equation FROM the dice on
//     the GoldEquationTrack — using TWO dice (5 + 3 = 8) or, if they choose,
//     all THREE (5 + 3 − 2 = 6). They are never obligated to use all three.
//   • The HAND/FAN holds the TARGET cards. After evaluating the dice equation,
//     the player TAPS the single hand card whose value equals that result, and
//     "בדוק" discards it (it flies out of the hand).
//
// Two guided steps, then a clean frozen success:
//   Step 1 — PLUS : add the dice, tap the matching card, clear it.
//   Step 2 — MINUS: subtract the dice, tap the matching card, clear it. → 🏆
//
// Every round is SEEDED so the dice equation always has a matching card in the
// hand — fresh yet 100% winnable. No game/excellence meters are shown or
// updated here: this is pure mathematical explanation.
//
// Orchestration only: reuses AnimatedDice/GoldDieFace, the shared HandFan, the
// GoldButton and OperatorGlyph. No duplicated/shared game state.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import AnimatedDice, { type AnimatedDiceHandle, GoldDieFace } from '../../AnimatedDice';
import { GameCard, type Card } from '../../components/CardDesign';
import HandFan from '../../components/HandFan';
import { GoldButton } from '../../components/GoldButton';
import OperatorGlyph from '../components/ui/OperatorGlyph';
import { applyOperation } from '../utils/arithmetic';
import { playSfx } from '../audio/sfx';

// The Gold Room table surface (same asset family the live game uses).
const GOLD_TABLE_IMG = require('../../assets/table_golden_nobg.png');

// ── Steps. Each guided step fixes a single operator so the lesson stays sharp.
type StepId = 'plus' | 'minus';
const STEP_OP: Record<StepId, '+' | '-'> = { plus: '+', minus: '-' };

const STEP_TEXT: Record<StepId, string> = {
  // Step 1 (PLUS) — gentle, inviting "scan": almost every card is reachable, so
  // wherever the eye lands there is a move. No single "right" card is dictated.
  plus: 'הסתכלו על הקוביות ועל היד. חברו (+) קוביות כדי לבנות תרגיל ששווה לאחד הקלפים — וסמנו אותו כדי להעיף!',
  // Step 2 (MINUS) — real discovery: not every card is reachable. The player
  // scans the hand and picks one they can actually build toward.
  minus: 'עכשיו חיסור (−). סרקו את היד — לא כל קלף אפשרי. מצאו קלף שאתם יכולים לבנות אליו תרגיל מהקוביות, וסמנו אותו.',
};

// ── A round: the three landed dice (inputs), the step operator, and EVERY value
// the player can reach from those dice under the step's operator (using two dice
// in any order, or all three). The hand is built from this set so "scanning &
// discovery" is honest — what's reachable is exactly what a card can match.
interface Round {
  dice: [number, number, number];
  op: '+' | '-';
  reachable: number[]; // distinct positive integers reachable from the dice
}

const randInt = (lo: number, hi: number): number => lo + Math.floor(Math.random() * (hi - lo + 1));

// Fisher–Yates shuffle (returns a new array).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// All orderings of a small index array (length 2 or 3).
function permutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  const res: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) res.push([arr[i], ...p]);
  }
  return res;
}

// Every distinct POSITIVE integer the player can build from the dice under a
// single operator, using two dice (any order) or all three. Order matters for
// subtraction, so we enumerate permutations and keep the positive results.
function reachableValues(dice: [number, number, number], op: '+' | '-'): number[] {
  const out = new Set<number>();
  const subsets: number[][] = [[0, 1], [0, 2], [1, 2], [0, 1, 2]];
  for (const sub of subsets) {
    for (const perm of permutations(sub)) {
      let acc: number | null = dice[perm[0]];
      for (let i = 1; i < perm.length && acc !== null; i++) {
        acc = applyOperation(acc, op, dice[perm[i]]);
      }
      if (acc !== null && acc > 0 && Number.isInteger(acc)) out.add(acc);
    }
  }
  return [...out];
}

// Pick `n` distinct DECOY values that are guaranteed NOT reachable from the dice
// (drawn from a small plausible card range, minus the reachable set).
function pickDecoys(reachable: number[], n: number): number[] {
  const blocked = new Set(reachable);
  const pool: number[] = [];
  for (let v = 1; v <= 15; v++) if (!blocked.has(v)) pool.push(v);
  return shuffle(pool).slice(0, n);
}

// ── Evaluate the dice the player placed on the track, left-to-right, under the
// step's single operator. Fewer than two operands ⇒ no result yet.
function calcResult(placed: number[], dice: [number, number, number], op: '+' | '-'): number | null {
  if (placed.length < 2) return null;
  let acc = dice[placed[0]];
  for (let i = 1; i < placed.length; i++) {
    const next = applyOperation(acc, op, dice[placed[i]]);
    if (next === null) return null;
    acc = next;
  }
  return acc;
}

// ── Roll dice for a step, ensuring enough DISTINCT reachable values to build the
// step's hand: the gentle PLUS intro needs only one, the MINUS discovery round
// needs at least three (so it can show three real options among decoys).
function makeRound(step: StepId): Round {
  const op = STEP_OP[step];
  const minDistinct = step === 'minus' ? 3 : 1;
  for (let attempt = 0; attempt < 60; attempt++) {
    const dice: [number, number, number] = [randInt(1, 6), randInt(1, 6), randInt(1, 6)];
    const reachable = reachableValues(dice, op);
    if (reachable.length >= minDistinct) return { dice, op, reachable };
  }
  // Fallback dice known to clear the bar (defensive — the loop above all but
  // always succeeds): [6,1,3] gives 5,3,2,4,… for minus; [3,4,5] for plus.
  const dice: [number, number, number] = step === 'minus' ? [6, 1, 3] : [3, 4, 5];
  return { dice, op, reachable: reachableValues(dice, op) };
}

const HAND_SIZE = 7;

// ── Build the step's hand of 7 number cards.
//
//   • PLUS  (step 1, "almost everything solvable"): six slots drawn from the
//     reachable set (repeats allowed) + at most one decoy. Wherever the player
//     looks there is a move — a gentle, inviting introduction.
//   • MINUS (step 2, "scan & discover"): exactly three reachable cards among
//     four guaranteed-unreachable decoys. The player must actually scan and
//     choose a card they can build toward.
//
// Card values match what the dice can produce, never a single dictated target;
// positions are shuffled so the solvable cards are spread across the fan.
function buildHand(round: Round, step: StepId): Card[] {
  const reach = round.reachable;
  let values: number[];
  if (step === 'plus') {
    const solvable: number[] = [];
    for (let i = 0; i < HAND_SIZE - 1; i++) solvable.push(reach[i % reach.length]);
    values = [...solvable, ...pickDecoys(reach, 1)];
  } else {
    const solvable = shuffle(reach).slice(0, 3);
    values = [...solvable, ...pickDecoys(reach, HAND_SIZE - solvable.length)];
  }
  return shuffle(values).map((value, i) => ({ id: `gr-hand-${step}-${i}-${value}`, type: 'number', value }));
}

// ── A tappable gold DIE on the track — the landed face the player adds to the
// equation. Placed dice dim + show a check so it's clear they're "in".
function DiceChip({ value, placed, order, onPress }: { value: number; placed: boolean; order: number | null; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={placed ? `הסר קובייה ${value}` : `הוסף קובייה ${value}`}>
      <View style={[styles.diceChip, placed && styles.diceChipPlaced]}>
        <GoldDieFace value={value} size={38} />
        {placed && order !== null ? (
          <View style={styles.diceOrderBadge}><Text style={styles.diceOrderTxt}>{order}</Text></View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ── The equation track: THREE fixed dice slots (the player may use two or all
// three), joined by the step operator, then "= result". Filled slots show the
// placed die and are tappable to REMOVE it (it returns to the pool); empty slots
// are faint dashed placeholders so the room for up to three dice is always
// visible. The third slot reads as optional ("?") since two dice already solve.
const SLOT_COUNT = 3;
function EquationTrack({
  placed,
  dice,
  op,
  result,
  onRemove,
}: {
  placed: number[];
  dice: [number, number, number];
  op: '+' | '-';
  result: number | null;
  onRemove: (diceIdx: number) => void;
}) {
  return (
    <View style={styles.track}>
      {Array.from({ length: SLOT_COUNT }).map((_, i) => {
        const diceIdx = placed[i]; // dice index sitting in slot i, or undefined
        const filled = diceIdx !== undefined;
        // The operator LEADING INTO this slot is bright only when this slot is
        // actually filled (i.e. it joins two real operands).
        const operatorBright = placed.length > i;
        return (
          <React.Fragment key={`slot-${i}`}>
            {i > 0 ? (
              <OperatorGlyph op={op} color={operatorBright ? '#F8E08E' : 'rgba(244,205,90,0.3)'} size={20} />
            ) : null}
            {filled ? (
              <Pressable onPress={() => onRemove(diceIdx)} accessibilityRole="button" accessibilityLabel={`הסר קובייה ${dice[diceIdx]}`}>
                <View style={[styles.slot, styles.slotFilled]}>
                  <Text style={styles.slotTxt}>{dice[diceIdx]}</Text>
                </View>
              </Pressable>
            ) : (
              <View style={[styles.slot, styles.slotEmpty, i === 2 && styles.slotOptional]}>
                <Text style={styles.slotHintTxt}>{i === 2 ? '?' : '+'}</Text>
              </View>
            )}
          </React.Fragment>
        );
      })}
      <Text style={styles.equals}>=</Text>
      <View style={[styles.slot, styles.resultSlot]}><Text style={styles.slotTxt}>{result ?? '?'}</Text></View>
    </View>
  );
}

// ── The instruction bubble — the rule in one line, pinned to the very TOP black
// space (Y ≈ 10–25), clear of the dice table below.
function InstructionBanner({ text }: { text: string }) {
  return (
    <View style={styles.instructionWrap} pointerEvents="none">
      <View style={styles.instructionBubble}>
        <Text style={styles.headerText}>{text}</Text>
      </View>
    </View>
  );
}

// ── The hand fan, revealed smoothly the moment the dice finish rolling: a soft
// rise + fade as it mounts at the bottom.
function FanReveal({ children }: { children: React.ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }).start();
  }, [a]);
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [44, 0] });
  return <Animated.View style={{ opacity: a, transform: [{ translateY }] }}>{children}</Animated.View>;
}

// ── A matched card flying out of the hand toward the deck — the "discard" beat
// the player earns on a correct equation.
function FlyingCard({ card, onDone }: { card: Card; onDone: () => void }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    void playSfx('success', { cooldownMs: 0 });
    Animated.timing(a, { toValue: 1, duration: 620, useNativeDriver: true }).start(() => onDone());
  }, [a, onDone]);
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [0, -320] });
  const scale = a.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1.12, 0.7] });
  const opacity = a.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] });
  return (
    <View pointerEvents="none" style={styles.flyingLayer}>
      <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
        <GameCard card={card} small onPress={undefined} />
      </Animated.View>
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
        <Text style={styles.successSub}>בנית תרגיל מהקוביות ונפטרת מהקלף המתאים ✓</Text>
        <View style={styles.successCta}>
          <GoldButton label="סיום" onPress={onDone} accessibilityLabel="סיום" fullWidth height={56} fontSize={20} />
        </View>
      </View>
    </View>
  );
}

export function DiceEquationRound({ onExit, onComplete }: { onExit?: () => void; onComplete?: () => void }) {
  // The fan is centered to the ROOM FRAME (capped at 480 on web), not the whole
  // window — without this the hand mis-centers off-frame and feels "stuck".
  const { width: winW } = useWindowDimensions();
  const fanW = Math.min(winW, 480);

  const diceRef = useRef<AnimatedDiceHandle>(null);

  // ── Round + flow state ──────────────────────────────────────────────────
  const initialRound = useRef(makeRound('plus')).current;
  const [step, setStep] = useState<StepId>('plus');
  const [substage, setSubstage] = useState<'roll' | 'solve'>('roll');
  const [round, setRound] = useState<Round>(initialRound);
  const [hand, setHand] = useState<Card[]>(() => buildHand(initialRound, 'plus'));

  // The dice the player has placed on the track (dice indices, in tap order),
  // and the hand card they've marked as the matching target.
  const [placed, setPlaced] = useState<number[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [resolving, setResolving] = useState(false); // freezes input during the win
  const [flying, setFlying] = useState<Card | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const shake = useRef(new Animated.Value(0)).current;

  const op = round.op;
  const result = useMemo(() => calcResult(placed, round.dice, op), [placed, round.dice, op]);
  const selectedIds = useMemo(() => (selectedId ? new Set([selectedId]) : new Set<string>()), [selectedId]);
  const selectedCard = useMemo(() => hand.find((c) => c.id === selectedId) ?? null, [hand, selectedId]);
  // The button LIGHTS UP as soon as the dice form a valid equation — TWO dice is
  // enough (a third is optional). The matching hand card is verified at press
  // time, so the player never sees a dead button after placing two dice.
  const hasEquation = result !== null && placed.length >= 2;

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

  // The dice finished rolling — reveal the track + hand for this step.
  const handleRollComplete = useCallback(() => {
    setSubstage('solve');
  }, []);

  // Tap a die: add it to the equation (in order) or remove it if already placed.
  const tapDie = useCallback(
    (idx: number) => {
      if (resolving) return;
      setPlaced((prev) => {
        if (prev.includes(idx)) return prev.filter((i) => i !== idx);
        if (prev.length >= 3) return prev;
        return [...prev, idx];
      });
    },
    [resolving],
  );

  // Tap a hand card: mark (or unmark) it as the matching target card.
  const tapCard = useCallback(
    (card: Card) => {
      if (resolving || typeof card.value !== 'number') return;
      setSelectedId((cur) => (cur === card.id ? null : card.id));
    },
    [resolving],
  );

  // Reset the placed dice / selection for a fresh round.
  const resetSelections = useCallback(() => {
    setPlaced([]);
    setSelectedId(null);
  }, []);

  // After the matched card flies out: clear it from the hand, then either move
  // to the MINUS step (after PLUS) or freeze on the success state (after MINUS).
  const finishWin = useCallback(() => {
    const clearedId = selectedId;
    setFlying(null);
    setHand((h) => h.filter((c) => c.id !== clearedId));
    setResolving(false);
    resetSelections();
    if (step === 'plus') {
      const next = makeRound('minus');
      setRound(next);
      setHand(buildHand(next, 'minus'));
      setStep('minus');
      setSubstage('roll');
    } else {
      onComplete?.();
      setShowSuccess(true);
    }
  }, [selectedId, step, resetSelections, onComplete]);

  // "בדוק": does the dice equation equal the marked hand card? Success → the
  // card flies out; failure (wrong card, or no card chosen yet) → a quiet shake
  // (no popup) that nudges the player to mark the matching card.
  const handleCheck = useCallback(() => {
    if (!hasEquation || resolving) return;
    if (selectedCard && selectedCard.value === result) {
      setResolving(true);
      setFlying(selectedCard); // FlyingCard's onDone calls finishWin
    } else {
      doShake();
    }
  }, [hasEquation, resolving, result, selectedCard, doShake]);

  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] });

  return (
    <View style={styles.root}>
      {/* The instruction bubble — pinned to the very top black space. */}
      <InstructionBanner text={STEP_TEXT[step]} />

      {/* Play area: the dice roll on the gold table; once landed, the equation
       *  track (dice chips → equation) takes the table's place. */}
      <View style={styles.playArea}>
        <View style={styles.tableZone}>
          <Image source={GOLD_TABLE_IMG} resizeMode="contain" style={styles.tableImg} />
          <View style={styles.tableOverlay} pointerEvents="box-none">
            {substage === 'roll' ? (
              <AnimatedDice
                key={step}
                ref={diceRef}
                size={40}
                fixedFinalValues={round.dice}
                autoRollOnMount
                hideRollButton
                hideSumBadge
                onRollComplete={handleRollComplete}
              />
            ) : (
              <Animated.View style={[styles.solveZone, { transform: [{ translateX }] }]}>
                {/* The landed dice, now tappable inputs for the equation. */}
                <View style={styles.diceRow}>
                  {round.dice.map((v, idx) => {
                    const pos = placed.indexOf(idx);
                    return (
                      <DiceChip
                        key={idx}
                        value={v}
                        placed={pos >= 0}
                        order={pos >= 0 ? pos + 1 : null}
                        onPress={() => tapDie(idx)}
                      />
                    );
                  })}
                </View>
                <EquationTrack placed={placed} dice={round.dice} op={op} result={result} />
                <View style={styles.confirmWrap}>
                  <GoldButton label="בדוק ✓" onPress={handleCheck} disabled={!hasEquation} height={50} fontSize={18} accessibilityLabel="בדוק את המשוואה" />
                  <Text style={styles.confirmHint}>שתי קוביות מספיקות — קובייה שלישית היא רשות, לא חובה.</Text>
                </View>
              </Animated.View>
            )}
          </View>
        </View>
      </View>

      {/* The hand fan (solve stage) — the TARGET cards. Tap the one equal to the
       *  dice equation's result; on "בדוק" it flies out of the hand. */}
      {substage === 'solve' ? (
        <FanReveal>
          <View style={styles.fanWrap} pointerEvents={resolving ? 'none' : 'box-none'}>
            <HandFan cards={hand} width={fanW} selectedIds={selectedIds} onTapCard={tapCard} />
          </View>
        </FanReveal>
      ) : null}

      {flying ? <FlyingCard card={flying} onDone={finishWin} /> : null}

      {showSuccess ? <SuccessCelebration onDone={onExit} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Play area — fills the space above the bottom hand; the table centers.
  playArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 12 },
  // The table: a sized, semi-transparent surface. Content is overlaid centered
  // ON it, so the dice / equation always sit on the table, not off it.
  tableZone: { width: '94%', maxWidth: 380, aspectRatio: 1024 / 774, alignItems: 'center', justifyContent: 'center' },
  tableImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.55 },
  tableOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  solveZone: { alignItems: 'center', width: '100%', gap: 14 },

  // The landed dice, shown as tappable gold chips above the equation track.
  diceRow: { flexDirection: 'row', direction: 'ltr', gap: 12, justifyContent: 'center', alignItems: 'center' },
  diceChip: {
    padding: 4,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  diceChipPlaced: {
    borderColor: 'rgba(244,205,90,0.9)',
    backgroundColor: 'rgba(244,205,90,0.16)',
    opacity: 0.85,
  },
  diceOrderBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#8A5A1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceOrderTxt: { color: '#FFF7DA', fontSize: 11, fontWeight: '900' },

  // The equation track — dice operands, operator glyphs, "= result".
  track: {
    flexDirection: 'row',
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
    minWidth: 44,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,243,201,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(244,205,90,0.5)',
  },
  slotEmpty: { borderStyle: 'dashed', borderColor: 'rgba(244,205,90,0.3)' },
  // The optional third slot (when two dice already form a valid equation): faded
  // so it clearly reads as "open for more", not "required".
  slotOptional: { opacity: 0.4 },
  resultSlot: { borderColor: 'rgba(244,205,90,0.85)', backgroundColor: 'rgba(244,205,90,0.12)' },
  slotTxt: { color: '#F8E08E', fontSize: 18, fontWeight: '900' },
  slotHintTxt: { color: 'rgba(244,205,90,0.35)', fontSize: 18, fontWeight: '900' },
  equals: { color: '#F8E08E', fontSize: 20, fontWeight: '900', marginHorizontal: 2 },
  confirmWrap: { alignSelf: 'stretch', alignItems: 'center', marginTop: 2 },
  confirmHint: { color: 'rgba(244,205,90,0.6)', fontSize: 12.5, fontWeight: '700', textAlign: 'center', marginTop: 8 },

  // Hand fan — anchored low at the bottom of the screen, swipeable; only a small
  // safe-area gap below it (clear of the iPhone home indicator).
  fanWrap: { alignItems: 'center', paddingBottom: 28 },

  // The matched card flying out toward the deck.
  flyingLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 120, zIndex: 18 },

  // The instruction bubble — pinned to the very TOP black space (Y ≈ 10–25),
  // full width, well clear of the centered dice table.
  instructionWrap: { position: 'absolute', top: 14, left: 16, right: 16, zIndex: 15 },
  instructionBubble: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(20,12,4,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(244,205,90,0.35)',
  },
  headerText: { color: '#F8E08E', fontSize: 13.5, fontWeight: '700', lineHeight: 20, textAlign: 'right' },

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
