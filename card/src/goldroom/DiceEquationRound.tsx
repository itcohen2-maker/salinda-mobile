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
// The round is SEEDED for the tutorial: [2,4,5] teaches + with card 6, then
// teaches ordered subtraction with card 3. No game/excellence meters are shown
// or updated here: this is pure mathematical explanation.
//
// Orchestration only: reuses AnimatedDice/GoldDieFace, the shared HandFan, the
// GoldButton and OperatorGlyph. No duplicated/shared game state.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedDice, { type AnimatedDiceHandle, GoldDieFace } from '../../AnimatedDice';
import { GameCard, type Card, type Operation } from '../../components/CardDesign';
import HandFan from '../../components/HandFan';
import { GoldButton } from '../../components/GoldButton';
import OperatorGlyph from '../components/ui/OperatorGlyph';
import { applyOperation } from '../utils/arithmetic';
import { playSfx } from '../audio/sfx';
import { interpolateCopy, useGoldRoomCopy } from './goldRoomCopy';

// The Gold Room table surface (same asset family the live game uses).
const GOLD_TABLE_IMG = require('../../assets/table_golden_nobg.png');

// ── Steps. Each guided step fixes a single operator so the lesson stays sharp.
type StepId = 'plus' | 'minus';
const STEP_OP: Record<StepId, '+' | '-'> = { plus: '+', minus: '-' };

const SEEDED_DICE: [number, number, number] = [2, 4, 5];
const FIXED_HAND_VALUES = [12, 6, 3, 9, 15, 20, 1] as const;
const OPERATOR_PRACTICE_DICE: [number, number, number] = [5, 2, 4];
const SALINDA_OPERATOR_HAND: Card[] = [
  { id: 'op-lesson-num-12', type: 'number', value: 12 },
  { id: 'op-lesson-num-9', type: 'number', value: 9 },
  { id: 'op-lesson-target-3', type: 'number', value: 3 },
  { id: 'op-lesson-salinda', type: 'salinda' },
  { id: 'op-lesson-num-6', type: 'number', value: 6 },
  { id: 'op-lesson-num-15', type: 'number', value: 15 },
  { id: 'op-lesson-num-1', type: 'number', value: 1 },
];
const OPERATOR_LESSON_SALINDA_ID = 'op-lesson-salinda';
const OPERATOR_LESSON_TARGET_ID = 'op-lesson-target-3';
type SalindaOperatorStage = 'tapSalinda' | 'chooseOperator' | 'placeOperator' | 'selectTarget';
const OPERATOR_PLUS_CARD_ID = 'operator-training-plus';
const OPERATOR_MINUS_CARD_ID = 'operator-training-minus';
const OPERATOR_TARGET_CARD_ID = 'operator-training-target-3';
const OPERATOR_TRAINING_HAND: Card[] = [
  { id: 'operator-training-num-6', type: 'number', value: 6 },
  { id: OPERATOR_PLUS_CARD_ID, type: 'operation', operation: '+' },
  { id: 'operator-training-num-8', type: 'number', value: 8 },
  { id: OPERATOR_MINUS_CARD_ID, type: 'operation', operation: '-' },
  { id: OPERATOR_TARGET_CARD_ID, type: 'number', value: 3 },
  { id: 'operator-training-num-11', type: 'number', value: 11 },
];
const OPERATOR_INTRO_TEXT = 'הכירו את קלפי הסימן +, -, *, /. הציבו אותם בתרגיל וכך תיפטרו מהם';
const OPERATOR_SLOT_HINT_TEXT = 'מצוין! עכשיו לחצו על חריץ הסימן הריק שבמשוואה למעלה.';
const OPERATOR_READY_TEXT = "התרגיל מושלם! לחצו על קלף 3 במניפה ואז על 'שגר' כדי להעיף אותו!";

// ── Specials sequence (three continuous on-board substeps) ──────────────────
// Substep 1 — sign cards (+/-): the board is pre-seeded with 5 _ 2 = 3; the hand
// carries the minus sign card plus the target number 3.
const SIGN_STEP_DICE: [number, number, number] = [5, 2, 4];
const SIGN_MINUS_ID = 'sign-minus';
const SIGN_TARGET_ID = 'sign-target-3';
const SIGN_HAND: Card[] = [
  { id: 'sign-num-7', type: 'number', value: 7 },
  { id: SIGN_MINUS_ID, type: 'operation', operation: '-' },
  { id: SIGN_TARGET_ID, type: 'number', value: 3 },
  { id: 'sign-num-9', type: 'number', value: 9 },
  { id: 'sign-num-5', type: 'number', value: 5 },
];

// Substep 2 — Salinda wild operator: the board is pre-seeded with 4 _ 3 = 12; the
// hand carries the gold Salinda plus the target number 12. The correct sign is ×.
const SALINDA_STEP_DICE: [number, number, number] = [4, 3, 6];
const SALINDA_CARD_ID = 'salinda-wild';
const SALINDA_TARGET_ID = 'salinda-target-12';
const SALINDA_HAND: Card[] = [
  { id: 'salinda-num-5', type: 'number', value: 5 },
  { id: SALINDA_CARD_ID, type: 'salinda' },
  { id: SALINDA_TARGET_ID, type: 'number', value: 12 },
  { id: 'salinda-num-7', type: 'number', value: 7 },
  { id: 'salinda-num-9', type: 'number', value: 9 },
];

// Substep 3 — wild number card: the board shows the ready equation 6 + 2 = ?; the
// wild card fills the missing 8. The hand never already contains an 8.
const WILD_STEP_DICE: [number, number] = [6, 2];
const WILD_CARD_ID = 'wild-number';
const WILD_RESULT = 8;
const WILD_HAND: Card[] = [
  { id: 'wild-num-4', type: 'number', value: 4 },
  { id: WILD_CARD_ID, type: 'wild' },
  { id: 'wild-num-7', type: 'number', value: 7 },
  { id: 'wild-num-2', type: 'number', value: 2 },
  { id: 'wild-num-5', type: 'number', value: 5 },
];

const SEND_BUTTON_WIDTH = 180;
const SEND_BUTTON_HEIGHT = 50;
const SEND_BUTTON_RADIUS = 12;
const SEND_BUTTON_RAISE = 5;
const SEND_BUTTON_FONT_SIZE = 22;

// ── A round: the three landed dice (inputs) and the fixed operator for this
// guided step.
interface Round {
  dice: [number, number, number];
  op: '+' | '-';
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

function makeRound(step: StepId): Round {
  const op = STEP_OP[step];
  return { dice: SEEDED_DICE, op };
}

// ── Fixed 7-card tutorial hand for the Golden Rule explanation. Card 6 is the
// first Plus target (2 + 4), and card 3 is the second Minus target (5 - 2).
function buildTutorialHand(): Card[] {
  return FIXED_HAND_VALUES.map((value, i) => ({ id: `gr-hand-${i + 1}`, type: 'number', value }));
}

// ── A tappable gold DIE on the track — the landed face the player adds to the
// equation. Placed dice dim + show a check so it's clear they're "in".
function DiceChip({ value, placed, order, onPress }: { value: number; placed: boolean; order: number | null; onPress: () => void }) {
  const copy = useGoldRoomCopy();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={interpolateCopy(placed ? copy.removeDie : copy.addDie, { value })}
    >
      <View style={[styles.diceChip, placed && styles.diceChipPlaced]}>
        <GoldDieFace value={value} size={52} />
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
  const copy = useGoldRoomCopy();
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
              <View style={styles.trackOperatorGlyph}>
                <OperatorGlyph op={op} color={operatorBright ? '#F8E08E' : 'rgba(244,205,90,0.48)'} size={32} />
              </View>
            ) : null}
            {filled ? (
              <Pressable onPress={() => onRemove(diceIdx)} accessibilityRole="button" accessibilityLabel={interpolateCopy(copy.removeDie, { value: dice[diceIdx] })}>
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
        <Text allowFontScaling={false} style={styles.headerText}>{text}</Text>
      </View>
    </View>
  );
}

// ── A matched card flying out of the hand toward the deck — the "discard" beat
// the player earns on a correct equation. The success chime plays LOUD and clear
// here — this is the player's first win, the dopamine moment.
function FlyingCard({ card, onDone, doneDelayMs = 0, durationMs = 620 }: { card: Card; onDone: () => void; doneDelayMs?: number; durationMs?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let doneTimer: ReturnType<typeof setTimeout> | null = null;
    void playSfx('success', { cooldownMs: 0, volumeOverride: 0.95 });
    const animation = Animated.timing(a, { toValue: 1, duration: durationMs, useNativeDriver: true });
    animation.start(() => {
      doneTimer = setTimeout(onDone, doneDelayMs);
    });
    return () => {
      animation.stop();
      if (doneTimer) clearTimeout(doneTimer);
    };
  }, [a, doneDelayMs, durationMs, onDone]);
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
  const copy = useGoldRoomCopy();
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
  }, [pop]);
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  return (
    <View style={styles.successOverlay}>
      <View style={styles.successCard}>
        <Animated.Text style={[styles.successTrophy, { opacity: pop, transform: [{ scale }] }]}>🏆</Animated.Text>
        <Text style={styles.successTitle}>{copy.rewardTitle}</Text>
        <Text style={styles.successSub}>{copy.successSub}</Text>
        <View style={styles.successCta}>
          <GoldButton label={copy.finish} onPress={onDone} accessibilityLabel={copy.finish} fullWidth height={56} fontSize={20} />
        </View>
      </View>
    </View>
  );
}

function MiniOperatorCard({ op }: { op: Operation }) {
  return (
    <LinearGradient colors={['#F8E08E', '#F0C659', '#D9A23A', '#8A5A1C']} locations={[0, 0.35, 0.68, 1]} style={styles.operatorMiniCard}>
      <OperatorGlyph op={op} color="#3D2A0E" size={26} />
    </LinearGradient>
  );
}

function MiniSalindaOperatorCard({ op }: { op: Operation }) {
  return (
    <LinearGradient colors={['#FFF7CC', '#F8E08E', '#D9A23A', '#2E7D43']} locations={[0, 0.32, 0.68, 1]} style={styles.operatorMiniCard}>
      <Text style={styles.salindaMiniLetter}>S</Text>
      <View style={styles.salindaMiniOpWrap}>
        <OperatorGlyph op={op} color="#3D2A0E" size={22} />
      </View>
    </LinearGradient>
  );
}

function SpecialEquationTrack({
  left,
  right,
  op,
  result,
  operatorInserted,
  operatorReady,
  pulse,
  onPlaceOperator,
  resultGlow = false,
  salindaOperator = false,
}: {
  left: number;
  right: number;
  op: Operation;
  result: number;
  operatorInserted: boolean;
  operatorReady: boolean;
  pulse: Animated.Value;
  onPlaceOperator?: () => void;
  resultGlow?: boolean;
  salindaOperator?: boolean;
}) {
  const copy = useGoldRoomCopy();
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.9] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.1] });
  const slot = (
    <View style={[styles.operatorHole, operatorReady && styles.operatorHoleReady]}>
      {operatorReady ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.operatorHoleGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
        />
      ) : null}
      {operatorInserted ? (salindaOperator ? <MiniSalindaOperatorCard op={op} /> : <MiniOperatorCard op={op} />) : null}
    </View>
  );

  return (
    <View style={styles.track}>
      <View style={[styles.slot, styles.slotFilled]}><Text style={styles.slotTxt}>{left}</Text></View>
      {operatorReady && onPlaceOperator ? (
        <Pressable onPress={onPlaceOperator} accessibilityRole="button" accessibilityLabel={copy.placeSignCard}>
          {slot}
        </Pressable>
      ) : slot}
      <View style={[styles.slot, styles.slotFilled]}><Text style={styles.slotTxt}>{right}</Text></View>
      <Text style={styles.equals}>=</Text>
      <View style={[styles.slot, styles.resultSlot, resultGlow && styles.resultSlotGlow]}><Text style={styles.slotTxt}>{result}</Text></View>
    </View>
  );
}

function FlyingSpecialCard({ card, onDone, variant = 'card' }: { card: Card; onDone: () => void; variant?: 'card' | 'salinda' }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    void playSfx(variant === 'salinda' ? 'complete' : 'success', { cooldownMs: 0, volumeOverride: variant === 'salinda' ? 0.9 : 0.75 });
    const animation = Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true });
    animation.start(onDone);
    return () => animation.stop();
  }, [a, onDone, variant]);

  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [0, -360] });
  const translateX = a.interpolate({ inputRange: [0, 1], outputRange: [0, variant === 'salinda' ? 96 : 42] });
  const rotate = a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', variant === 'salinda' ? '28deg' : '14deg'] });
  const scale = a.interpolate({ inputRange: [0, 0.25, 1], outputRange: [1, variant === 'salinda' ? 1.18 : 1.1, 0.66] });
  const opacity = a.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, 1, 0] });

  return (
    <View pointerEvents="none" style={styles.flyingLayer}>
      <Animated.View style={{ opacity, transform: [{ translateX }, { translateY }, { rotate }, { scale }] }}>
        <GameCard card={card} selected={variant === 'salinda'} small onPress={undefined} />
      </Animated.View>
    </View>
  );
}

// ── A reusable looping pulse: runs `value` between `from`↔`to` while `active`,
// and snaps back to `from` (stopping the loop) the instant it turns off. Used for
// the operator-slot glow hint and the launch-button "ready" pulse.
function usePulseLoop(value: Animated.Value, active: boolean, from: number, to: number, duration: number) {
  useEffect(() => {
    if (!active) {
      value.stopAnimation();
      value.setValue(from);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: to, duration, useNativeDriver: true }),
        Animated.timing(value, { toValue: from, duration, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, duration, from, to, value]);
}

// ── The wild-card track (substep 3): a READY equation with a fixed operator,
// where the RESULT slot is the empty target the wild card fills in (and then
// pulses gold).
function WildEquationTrack({ left, right, op, result, filled, pulse }: { left: number; right: number; op: Operation; result: number; filled: boolean; pulse: Animated.Value }) {
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.95] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] });
  return (
    <View style={styles.track}>
      <View style={[styles.slot, styles.slotFilled]}><Text style={styles.slotTxt}>{left}</Text></View>
      <View style={styles.trackOperatorGlyph}><OperatorGlyph op={op} color="#F8E08E" size={32} /></View>
      <View style={[styles.slot, styles.slotFilled]}><Text style={styles.slotTxt}>{right}</Text></View>
      <Text style={styles.equals}>=</Text>
      <View style={[styles.slot, styles.resultSlot, filled && styles.resultSlotGlow]}>
        {filled ? (
          <Animated.View pointerEvents="none" style={[styles.resultGlowRing, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
        ) : null}
        <Text style={styles.slotTxt}>{filled ? result : '?'}</Text>
      </View>
    </View>
  );
}

// ── Shared on-board shell for every specials substep: instruction banner pinned
// at the top, the gold table with the seeded dice / equation track / fixed-width
// launch button centered on it, then the hand fan below — plus optional selector
// + flying-card overlays. Fades in on mount so each substep reads as a fresh
// "board refresh".
function SpecialsBoard({
  instruction,
  dice,
  resolving,
  track,
  button,
  fan,
  overlay,
  selector,
}: {
  instruction: string;
  dice?: number[];
  resolving: boolean;
  track: React.ReactNode;
  button: React.ReactNode;
  fan: React.ReactNode;
  overlay?: React.ReactNode;
  selector?: React.ReactNode;
}) {
  const intro = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [intro]);
  return (
    <Animated.View style={[styles.root, { opacity: intro }]} pointerEvents={resolving ? 'none' : 'auto'}>
      <InstructionBanner text={instruction} />
      <View style={styles.playArea}>
        <View style={styles.tableZone}>
          <Image source={GOLD_TABLE_IMG} resizeMode="contain" style={styles.tableImg} />
          <View style={styles.tableOverlay} pointerEvents="box-none">
            <View style={styles.operatorLessonArea}>
              {dice ? (
                <View style={styles.diceRow}>
                  {dice.map((value, idx) => (
                    <View key={idx} style={styles.diceChip}>
                      <GoldDieFace value={value} size={48} />
                    </View>
                  ))}
                </View>
              ) : null}
              {track}
              {button}
            </View>
          </View>
        </View>
      </View>
      <View style={styles.fanWrap} pointerEvents={resolving ? 'none' : 'box-none'}>
        {fan}
      </View>
      {selector}
      {overlay}
    </Animated.View>
  );
}

const SELECTOR_OPS: Operation[] = ['+', '-'];

function SalindaOperatorSelector({ title, body, onPick, onClose }: { title: string; body: string; onPick: (op: Operation) => void; onClose: () => void }) {
  const copy = useGoldRoomCopy();
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 150, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  return (
    <View style={styles.selectorOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={copy.close} />
      <Animated.View style={[styles.selectorCard, { opacity, transform: [{ scale }] }]}>
        <Text style={styles.selectorTitle}>{title}</Text>
        <Text style={styles.selectorBody}>{body}</Text>
        <View style={styles.selectorOps}>
          {SELECTOR_OPS.map((op) => (
            <Pressable key={op} onPress={() => onPick(op)} accessibilityRole="button" accessibilityLabel={interpolateCopy(copy.chooseOperatorA11y, { op })} style={styles.selectorOpButton}>
              <LinearGradient colors={['#F8E08E', '#F0C659', '#D9A23A', '#8A5A1C']} style={styles.selectorOpFace}>
                <OperatorGlyph op={op} color="#3D2A0E" size={38} />
              </LinearGradient>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

type SpecialsStepId =
  | 'signIntro'
  | 'signPractice'
  | 'salindaIntro'
  | 'salindaPractice'
  | 'wildIntro'
  | 'wildPractice';

const SIGN_INTRO_HAND: Card[] = [
  { id: 'specials-intro-plus', type: 'operation', operation: '+' },
  { id: 'specials-intro-minus', type: 'operation', operation: '-' },
  { id: 'specials-intro-times', type: 'operation', operation: 'x' },
  { id: 'specials-intro-divide', type: 'operation', operation: '÷' },
];
const SALINDA_INTRO_HAND: Card[] = [
  { id: 'specials-salinda-intro-num-4', type: 'number', value: 4 },
  { id: 'specials-salinda-intro-plus', type: 'operation', operation: '+' },
  { id: 'specials-salinda-intro', type: 'salinda' },
  { id: 'specials-salinda-intro-minus', type: 'operation', operation: '-' },
  { id: 'specials-salinda-intro-num-9', type: 'number', value: 9 },
];
const SALINDA_PRACTICE_CARD_ID = 'specials-salinda-card';
const SALINDA_PRACTICE_TARGET_ID = 'specials-salinda-target-6';
const SALINDA_PRACTICE_HAND: Card[] = [
  { id: 'specials-salinda-num-9', type: 'number', value: 9 },
  { id: 'specials-salinda-num-4', type: 'number', value: 4 },
  { id: SALINDA_PRACTICE_CARD_ID, type: 'salinda' },
  { id: SALINDA_PRACTICE_TARGET_ID, type: 'number', value: 6 },
  { id: 'specials-salinda-num-11', type: 'number', value: 11 },
];
const WILD_INTRO_HAND: Card[] = [
  { id: 'specials-wild-intro-num-2', type: 'number', value: 2 },
  { id: 'specials-wild-intro-num-6', type: 'number', value: 6 },
  { id: 'specials-wild-intro', type: 'wild' },
  { id: 'specials-wild-intro-num-10', type: 'number', value: 10 },
  { id: 'specials-wild-intro-num-13', type: 'number', value: 13 },
];
const WILD_PRACTICE_CARD_ID = 'specials-wild-card';
const WILD_PRACTICE_HAND: Card[] = [
  { id: 'specials-wild-num-3', type: 'number', value: 3 },
  { id: 'specials-wild-num-5', type: 'number', value: 5 },
  { id: WILD_PRACTICE_CARD_ID, type: 'wild' },
  { id: 'specials-wild-num-10', type: 'number', value: 10 },
  { id: 'specials-wild-num-13', type: 'number', value: 13 },
];

function OperatorCardsLesson({ onComplete }: { onComplete?: () => void }) {
  const { width: winW } = useWindowDimensions();
  const fanW = Math.min(winW, 480);
  const [step, setStep] = useState<SpecialsStepId>('signIntro');
  const [hand, setHand] = useState<Card[]>(SIGN_INTRO_HAND);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [signOperatorPlaced, setSignOperatorPlaced] = useState(false);
  const [salindaOperator, setSalindaOperator] = useState<Operation | null>(null);
  const [salindaOperatorPlaced, setSalindaOperatorPlaced] = useState(false);
  const [salindaModalOpen, setSalindaModalOpen] = useState(false);
  const [wildPlaced, setWildPlaced] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [flyingCard, setFlyingCard] = useState<Card | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotPulse = useRef(new Animated.Value(0)).current;
  const buttonPulse = useRef(new Animated.Value(1)).current;
  const fanPulse = useRef(new Animated.Value(0)).current;
  const fanShake = useRef(new Animated.Value(0)).current;

  const selectedCard = useMemo(() => hand.find((card) => card.id === selectedCardId) ?? null, [hand, selectedCardId]);
  const selectedIds = useMemo(() => (selectedCardId ? new Set([selectedCardId]) : new Set<string>()), [selectedCardId]);
  const isIntroStep = step === 'signIntro' || step === 'salindaIntro' || step === 'wildIntro';
  const signSlotReady = step === 'signPractice' && selectedCardId === OPERATOR_MINUS_CARD_ID && !signOperatorPlaced && !resolving;
  const signTargetSelected = step === 'signPractice' && signOperatorPlaced && selectedCardId === OPERATOR_TARGET_CARD_ID;
  const salindaSlotReady = step === 'salindaPractice' && salindaOperator === '+' && !salindaOperatorPlaced && !resolving;
  const salindaTargetSelected = step === 'salindaPractice' && salindaOperatorPlaced && selectedCardId === SALINDA_PRACTICE_TARGET_ID;
  const wildReady = step === 'wildPractice' && wildPlaced && !resolving;
  const launchReady = signTargetSelected || salindaTargetSelected || wildReady;
  const actionLabel = isIntroStep ? 'הבנתי, בוא נתרגל!' : launchReady ? 'שגר' : 'בחר קלפים';
  const actionDisabled = !isIntroStep && !launchReady;
  const fanCenterCardId = useMemo(() => {
    if (step === 'signPractice') return signOperatorPlaced ? OPERATOR_TARGET_CARD_ID : OPERATOR_MINUS_CARD_ID;
    if (step === 'salindaPractice') return salindaOperatorPlaced ? SALINDA_PRACTICE_TARGET_ID : SALINDA_PRACTICE_CARD_ID;
    if (step === 'wildPractice' && !wildPlaced) return WILD_PRACTICE_CARD_ID;
    return null;
  }, [salindaOperatorPlaced, signOperatorPlaced, step, wildPlaced]);

  usePulseLoop(slotPulse, signSlotReady || salindaSlotReady || (step === 'wildPractice' && !wildPlaced), 0, 1, 520);
  usePulseLoop(buttonPulse, launchReady || isIntroStep || actionDisabled, 1, 1.055, 520);
  usePulseLoop(fanPulse, isIntroStep, 0, 1, 720);

  useEffect(() => (
    () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    }
  ), []);

  const resetTimers = useCallback(() => {
    if (transitionTimer.current) {
      clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
    }
  }, []);

  const goToStep = useCallback((next: SpecialsStepId) => {
    resetTimers();
    setStep(next);
    setSelectedCardId(null);
    setResolving(false);
    setFlyingCard(null);
    setSalindaModalOpen(false);
    if (next === 'signIntro') {
      setHand(SIGN_INTRO_HAND);
      setSignOperatorPlaced(false);
    } else if (next === 'signPractice') {
      setHand(OPERATOR_TRAINING_HAND);
      setSignOperatorPlaced(false);
    } else if (next === 'salindaIntro') {
      setHand(SALINDA_INTRO_HAND);
      setSalindaOperator(null);
      setSalindaOperatorPlaced(false);
    } else if (next === 'salindaPractice') {
      setHand(SALINDA_PRACTICE_HAND);
      setSalindaOperator(null);
      setSalindaOperatorPlaced(false);
    } else if (next === 'wildIntro') {
      setHand(WILD_INTRO_HAND);
      setWildPlaced(false);
    } else {
      setHand(WILD_PRACTICE_HAND);
      setWildPlaced(false);
    }
  }, [resetTimers]);

  const completeAfterFlying = useCallback((nextStep?: SpecialsStepId) => {
    transitionTimer.current = setTimeout(() => {
      if (nextStep) {
        goToStep(nextStep);
      } else {
        onComplete?.();
      }
    }, 700);
  }, [goToStep, onComplete]);

  const instructionText = useMemo(() => {
    if (step === 'signIntro') return OPERATOR_INTRO_TEXT;
    if (step === 'signPractice') {
      if (signOperatorPlaced) return "התרגיל מושלם! לחצו על קלף 3 במניפה ואז על 'שגר' כדי להעיף אותו!";
      if (selectedCardId === OPERATOR_MINUS_CARD_ID) return 'מצוין! עכשיו לחצו על חריץ הסימן הריק שבמשוואה למעלה.';
      return OPERATOR_INTRO_TEXT;
    }
    if (step === 'salindaIntro') {
      return 'הכירו את קלף סלינדה. הוא מכיל את כל הסימנים יחד! בחרו סימן, הציבו בתרגיל וכך תיפטרו מהקלף.';
    }
    if (step === 'salindaPractice') {
      if (salindaOperatorPlaced) return "מבריק! לחצו על קלף 6 במניפה ואז על 'שגר' כדי להעיף אותו!";
      if (salindaOperator === '+') return 'מעולה! עכשיו לחצו על חריץ הסימן הריק במשוואה כדי למקם את קלף סלינדה.';
      return 'לחצו על קלף סלינדה במניפה כדי לבחור סימן.';
    }
    if (step === 'wildIntro') {
      return 'חגיגה! הכירו את קלף הפרא — הקלף הכי חזק במשחק. הוא הופך לכל מספר שחסר לכם כדי להשלים את התרגיל!';
    }
    if (wildPlaced) return "הקלף הפך ל-8 והשלים את התרגיל. לחצו על כפתור 'שגר' כדי לנצח!";
    return 'לחצו על קלף הפרא במניפה כדי להפוך אותו ל-8 ולהשלים את התרגיל.';
  }, [salindaOperator, salindaOperatorPlaced, selectedCardId, signOperatorPlaced, step, wildPlaced]);

  const canTapCard = useCallback((card: Card) => {
    if (resolving || isIntroStep || salindaModalOpen) return false;
    if (step === 'signPractice') {
      if (!signOperatorPlaced) return card.id === OPERATOR_MINUS_CARD_ID || card.id === OPERATOR_PLUS_CARD_ID;
      return card.id === OPERATOR_TARGET_CARD_ID;
    }
    if (step === 'salindaPractice') {
      if (!salindaOperator) return card.id === SALINDA_PRACTICE_CARD_ID;
      if (!salindaOperatorPlaced) return false;
      return card.id === SALINDA_PRACTICE_TARGET_ID;
    }
    if (step === 'wildPractice') return !wildPlaced && card.id === WILD_PRACTICE_CARD_ID;
    return false;
  }, [isIntroStep, resolving, salindaModalOpen, salindaOperator, salindaOperatorPlaced, signOperatorPlaced, step, wildPlaced]);

  const tapCard = useCallback((card: Card) => {
    if (!canTapCard(card)) return;
    if (step === 'signPractice' && !signOperatorPlaced && card.id === OPERATOR_PLUS_CARD_ID) {
      void playSfx('errorSoft', { cooldownMs: 0, volumeOverride: 0.45 });
      fanShake.setValue(0);
      Animated.sequence([
        Animated.timing(fanShake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(fanShake, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(fanShake, { toValue: 0.55, duration: 50, useNativeDriver: true }),
        Animated.timing(fanShake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
      return;
    }
    if (step === 'salindaPractice' && card.id === SALINDA_PRACTICE_CARD_ID) {
      setSelectedCardId(card.id);
      setSalindaModalOpen(true);
      void playSfx('meterCelebrateIntro', { cooldownMs: 0, volumeOverride: 0.72 });
      return;
    }
    if (step === 'wildPractice' && card.id === WILD_PRACTICE_CARD_ID) {
      void playSfx('complete', { cooldownMs: 0, volumeOverride: 0.75 });
      const resolvedWild: Card = { ...card, resolvedValue: 8 };
      setSelectedCardId(null);
      setWildPlaced(true);
      setHand((cards) => cards.filter((item) => item.id !== WILD_PRACTICE_CARD_ID));
      setFlyingCard(resolvedWild);
      return;
    }
    setSelectedCardId(card.id);
  }, [canTapCard, fanShake, signOperatorPlaced, step]);

  const chooseSalindaOperator = useCallback((op: Operation) => {
    if (op !== '+') {
      void playSfx('errorSoft', { cooldownMs: 0, volumeOverride: 0.5 });
      return;
    }
    setSalindaOperator('+');
    setSalindaModalOpen(false);
    void playSfx('complete', { cooldownMs: 0, volumeOverride: 0.55 });
  }, []);

  const placeOperator = useCallback(() => {
    if (signSlotReady) {
      void playSfx('place', { cooldownMs: 0, volumeOverride: 0.45 });
      setHand((cards) => cards.filter((card) => card.id !== OPERATOR_MINUS_CARD_ID));
      setSelectedCardId(null);
      setSignOperatorPlaced(true);
      return;
    }
    if (salindaSlotReady) {
      void playSfx('place', { cooldownMs: 0, volumeOverride: 0.45 });
      setHand((cards) => cards.filter((card) => card.id !== SALINDA_PRACTICE_CARD_ID));
      setSelectedCardId(null);
      setSalindaOperatorPlaced(true);
    }
  }, [salindaSlotReady, signSlotReady]);

  const launch = useCallback(() => {
    if (resolving) return;
    if (step === 'signIntro') {
      goToStep('signPractice');
      return;
    }
    if (step === 'salindaIntro') {
      goToStep('salindaPractice');
      return;
    }
    if (step === 'wildIntro') {
      goToStep('wildPractice');
      return;
    }
    if (step === 'signPractice' && signTargetSelected && selectedCard) {
      setResolving(true);
      setFlyingCard(selectedCard);
      completeAfterFlying('salindaIntro');
      return;
    }
    if (step === 'salindaPractice' && salindaTargetSelected && selectedCard) {
      setResolving(true);
      setFlyingCard(selectedCard);
      completeAfterFlying('wildIntro');
      return;
    }
    if (step === 'wildPractice' && wildReady) {
      setResolving(true);
      setFlyingCard({ id: 'specials-wild-final-8', type: 'wild', resolvedValue: 8 });
      completeAfterFlying();
    }
  }, [completeAfterFlying, goToStep, resolving, salindaTargetSelected, selectedCard, signTargetSelected, step, wildReady]);

  const fanScale = fanPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const fanHaloOpacity = fanPulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.84] });
  const fanShakeX = fanShake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  const introTrack = (
    <View style={styles.introBoardDim}>
      <Text style={styles.introBoardDimText}>{step === 'signIntro' ? '+  -  x  ÷' : step === 'salindaIntro' ? 'S' : '★'}</Text>
    </View>
  );

  const practiceTrack = step === 'wildPractice' ? (
    <WildEquationTrack left={6} right={2} op="+" result={8} filled={wildPlaced} pulse={slotPulse} />
  ) : (
    <SpecialEquationTrack
      left={step === 'salindaPractice' ? 4 : 5}
      right={2}
      op={step === 'salindaPractice' ? '+' : '-'}
      result={step === 'salindaPractice' ? 6 : 3}
      operatorInserted={step === 'salindaPractice' ? salindaOperatorPlaced : signOperatorPlaced}
      operatorReady={step === 'salindaPractice' ? salindaSlotReady : signSlotReady}
      pulse={slotPulse}
      onPlaceOperator={placeOperator}
      resultGlow={step === 'salindaPractice' ? salindaTargetSelected : signTargetSelected}
      salindaOperator={step === 'salindaPractice'}
    />
  );

  return (
    <SpecialsBoard
      instruction={instructionText}
      resolving={resolving}
      dice={isIntroStep ? undefined : step === 'salindaPractice' ? [4, 2, 5] : step === 'wildPractice' ? undefined : [5, 2, 4]}
      track={isIntroStep ? introTrack : practiceTrack}
      button={(
        <Animated.View style={[styles.operatorActionWrap, { transform: [{ scale: buttonPulse }] }]}>
          <GoldButton
            label={actionLabel}
            onPress={launch}
            disabled={actionDisabled}
            fullWidth
            height={SEND_BUTTON_HEIGHT}
            radius={SEND_BUTTON_RADIUS}
            raise={SEND_BUTTON_RAISE}
            fontSize={SEND_BUTTON_FONT_SIZE}
            style={actionDisabled ? styles.litDisabledActionButton : undefined}
            textStyle={styles.fixedActionText}
            accessibilityLabel={actionLabel}
          />
        </Animated.View>
      )}
      fan={(
        <Animated.View style={{ transform: [{ translateX: fanShakeX }, { scale: fanScale }] }}>
          {isIntroStep ? (
            <Animated.View pointerEvents="none" style={[styles.specialsFanHalo, { opacity: fanHaloOpacity }]} />
          ) : null}
          <HandFan
            cards={hand}
            width={fanW}
            selectedIds={selectedIds}
            onTapCard={isIntroStep ? undefined : tapCard}
            canTap={isIntroStep ? undefined : canTapCard}
            centerCardId={fanCenterCardId}
          />
        </Animated.View>
      )}
      selector={salindaModalOpen ? (
        <SalindaOperatorSelector
          title="בחרו סימן"
          body="בחרו את הסימן שאתם צריכים כדי לפתור את התרגיל!"
          onPick={chooseSalindaOperator}
          onClose={() => setSalindaModalOpen(false)}
        />
      ) : null}
      overlay={flyingCard ? <FlyingSpecialCard card={flyingCard} onDone={() => undefined} /> : null}
    />
  );
}
type DiceEquationRoundProps = {
  onExit?: () => void;
  onComplete?: () => void;
  mode?: 'practice' | 'operators';
};

export function DiceEquationRound({ onExit, onComplete, mode = 'practice' }: DiceEquationRoundProps) {
  const copy = useGoldRoomCopy();
  if (mode === 'operators') {
    return <OperatorCardsLesson onComplete={onComplete} />;
  }

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
  const [hand, setHand] = useState<Card[]>(buildTutorialHand);

  // The dice the player has placed on the track (dice indices, in tap order),
  // and the hand card they've marked as the matching target.
  const [placed, setPlaced] = useState<number[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [resolving, setResolving] = useState(false); // freezes input during the win
  const [flying, setFlying] = useState<Card | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const shake = useRef(new Animated.Value(0)).current;
  // Cross-fade driver: 0 = dice rolling (solve UI hidden, fan dimmed to 0.25),
  // 1 = solving (solve UI lit, fan fully lit + interactive). Nothing unmounts —
  // every element stays rendered and is governed only by opacity / pointerEvents.
  const reveal = useRef(new Animated.Value(0)).current;
  const didPlusGuidedPrefill = useRef(false);
  const didMinusGuidedPrefill = useRef(false);

  const op = round.op;
  const result = useMemo(() => calcResult(placed, round.dice, op), [placed, round.dice, op]);
  const selectedIds = useMemo(() => (selectedId ? new Set([selectedId]) : new Set<string>()), [selectedId]);
  const selectedCard = useMemo(() => hand.find((c) => c.id === selectedId) ?? null, [hand, selectedId]);
  const expectedTarget = step === 'plus' ? 6 : 3;
  const instructionText = useMemo(() => {
    if (step === 'plus' && selectedId !== null) {
      return copy.firstCardLaunch;
    }
    if (step === 'minus' && selectedCard?.value === 3) {
      return copy.cardLaunch;
    }
    return step === 'plus' ? copy.practicePlus : copy.practiceMinus;
  }, [copy, selectedCard?.value, selectedId, step]);
  const checkButtonLabel = useMemo(() => {
    if (placed.length >= 2 && selectedId === null) return copy.chooseCards;
    if (placed.length >= 2 && selectedId !== null) return copy.launch;
    return copy.check;
  }, [copy, placed.length, selectedId]);
  const equationReady = placed.length >= 2;
  // The action is intentionally locked until the matching fan card is selected;
  // the label still reflects that the equation itself is ready.
  const canAttemptCheck = equationReady && selectedCard?.value === expectedTarget && !resolving;
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

  // The dice finished rolling — fade the solve UI in and lift the hand fan from
  // dim to fully lit (it never unmounts; only its opacity / touchability change).
  const handleRollComplete = useCallback(() => {
    setSubstage('solve');
    Animated.timing(reveal, { toValue: 1, duration: 420, useNativeDriver: true }).start();
    if (step === 'plus' && !didPlusGuidedPrefill.current) {
      didPlusGuidedPrefill.current = true;
      setPlaced([0, 1]); // [2,4] => 6, the guided first win.
      setSelectedId(null);
    }
    if (step === 'minus' && !didMinusGuidedPrefill.current) {
      didMinusGuidedPrefill.current = true;
      setPlaced([2, 0]); // [5,2] => 3, the guided subtraction win.
      setSelectedId(null);
    }
  }, [reveal, step]);

  // Tap a die: add it to the equation (in order) or remove it if already placed.
  const tapDie = useCallback(
    (idx: number) => {
      if (resolving) return;
      if (step === 'minus' && substage === 'solve') return;
      const alreadyPlaced = placed.includes(idx);
      if (alreadyPlaced) {
        void playSfx('transition', { cooldownMs: 0, volumeOverride: 0.24 });
        setPlaced((prev) => prev.filter((i) => i !== idx));
        return;
      }
      if (placed.length >= 3) return;
      void playSfx('place', { cooldownMs: 0, volumeOverride: 0.34 });
      setPlaced((prev) => (prev.includes(idx) || prev.length >= 3 ? prev : [...prev, idx]));
    },
    [placed, resolving, step, substage],
  );

  // Tap a hand card: mark (or unmark) it as the matching target card.
  const tapCard = useCallback(
    (card: Card) => {
      if (resolving || typeof card.value !== 'number') return;
      if (step === 'plus' && card.value !== 6) {
        console.log('[GoldRoom DiceEquationRound] blocked card tap', {
          step,
          cardId: card.id,
          cardValue: card.value,
          expectedValue: 6,
        });
        doShake();
        return;
      }
      if (step === 'minus' && card.value !== 3) {
        console.log('[GoldRoom DiceEquationRound] blocked card tap', {
          step,
          cardId: card.id,
          cardValue: card.value,
          expectedValue: 3,
        });
        doShake();
        return;
      }
      console.log('[GoldRoom DiceEquationRound] selected card tap', {
        step,
        cardId: card.id,
        cardValue: card.value,
        nextSelectedId: selectedId === card.id ? null : card.id,
      });
      setSelectedId((cur) => (cur === card.id ? null : card.id));
    },
    [doShake, resolving, selectedId, step],
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
      setStep('minus');
      reveal.setValue(0); // back to the rolling state for part B (subtraction)
      setSubstage('roll');
    } else {
      onComplete?.();
      setShowSuccess(true);
    }
  }, [selectedId, step, resetSelections, onComplete, reveal]);

  // "בדוק": does the dice equation equal the marked hand card?
  //   • match (result === selectedCard.value) → freeze input, the card flies out
  //     with the celebratory success chime, then finishWin advances the step.
  //   • mismatch → a quiet shake (no popup) — the "Game of Silence" failure beat.
  const handleCheck = useCallback(() => {
    console.log('[GoldRoom DiceEquationRound] handleCheck', {
      step,
      result,
      selectedCardValue: selectedCard?.value ?? null,
      selectedCardId: selectedCard?.id ?? null,
      selectedId,
      placedLength: placed.length,
      placed,
      canAttemptCheck,
      resolving,
    });
    if (!canAttemptCheck) return;
    if (selectedCard && selectedCard.value === result) {
      setResolving(true);
      setFlying(selectedCard); // FlyingCard plays 'success' loud, then calls finishWin
    } else {
      doShake();
    }
  }, [canAttemptCheck, doShake, placed, resolving, result, selectedCard, selectedId, step]);

  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] });
  const solving = substage === 'solve';
  const interactive = solving && !resolving;
  // Opacity ramps driven by `reveal` — the dice cross-fade into the solve UI and
  // the fan lifts from dim to full. No element is ever removed from the tree.
  const rollOpacity = reveal.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const fanOpacity = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });

  return (
    <View style={styles.root}>
      {/* The instruction bubble — pinned to the very top black space. */}
      <InstructionBanner text={instructionText} />

      <View style={styles.playArea}>
        <View style={styles.tableZone}>
          <Image source={GOLD_TABLE_IMG} resizeMode="contain" style={styles.tableImg} />
          <View style={styles.tableOverlay} pointerEvents="box-none">
            {/* ROLL layer — the rolling dice. ALWAYS mounted; fades out on solve. */}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rollLayer, { opacity: rollOpacity }]}>
              <AnimatedDice
                key={step}
                ref={diceRef}
                size={58}
                fixedFinalValues={round.dice}
                autoRollOnMount
                hideRollButton
                hideSumBadge
                onRollStart={() => {
                  void playSfx('diceRoll', { cooldownMs: 0, volumeOverride: 0.5 });
                }}
                onRollComplete={handleRollComplete}
              />
            </Animated.View>

            {/* SOLVE layer — landed dice (tappable), the 3-slot equation track and
             *  the check button. ALWAYS mounted; hidden + inert while rolling. */}
            <Animated.View
              pointerEvents={interactive ? 'box-none' : 'none'}
              style={[styles.solveZone, { opacity: reveal, transform: [{ translateX }] }]}
            >
              {/* The landed dice — tappable inputs; tap again to remove (Undo). */}
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
              <EquationTrack placed={placed} dice={round.dice} op={op} result={result} onRemove={tapDie} />
              <View style={styles.confirmWrap}>
                <View style={styles.checkPulseWrap}>
                  <GoldButton
                    label={checkButtonLabel}
                    onPress={handleCheck}
                    disabled={!canAttemptCheck}
                    fullWidth
                    height={SEND_BUTTON_HEIGHT}
                    radius={SEND_BUTTON_RADIUS}
                    raise={SEND_BUTTON_RAISE}
                    fontSize={SEND_BUTTON_FONT_SIZE}
                    textStyle={styles.fixedActionText}
                    accessibilityLabel={checkButtonLabel}
                  />
                </View>
                <Text style={styles.confirmHint}>{copy.twoDiceHint}</Text>
              </View>
            </Animated.View>
          </View>
        </View>
      </View>

      {/* The hand fan — the TARGET cards. ALWAYS mounted: dimmed (0.25) and
       *  untouchable while the dice roll, then fades to full + interactive on
       *  solve. Tap the card equal to the equation result; "בדוק" flies it out. */}
      <Animated.View style={[styles.fanWrap, { opacity: fanOpacity }]} pointerEvents={interactive ? 'box-none' : 'none'}>
        <HandFan cards={hand} width={fanW} selectedIds={selectedIds} onTapCard={tapCard} />
      </Animated.View>

      {flying ? <FlyingCard card={flying} onDone={finishWin} doneDelayMs={step === 'minus' ? 700 : 0} /> : null}

      {showSuccess ? <SuccessCelebration onDone={onExit} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Play area — fills the space above the bottom hand. Anchored to the BOTTOM
  // (just above the fan) with a small gap, so the dice/equation sit LOW and well
  // clear of the instruction banner pinned at the top (no overlap).
  playArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 18, gap: 12 },
  // The table: a sized, semi-transparent surface. Content is overlaid centered
  // ON it, so the dice / equation always sit on the table, not off it.
  tableZone: { width: '94%', maxWidth: 380, aspectRatio: 1024 / 774, alignItems: 'center', justifyContent: 'center' },
  tableImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.55 },
  tableOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  solveZone: { alignItems: 'center', width: '100%', gap: 14 },
  // The rolling-dice layer sits absolutely over the solve UI and centers the
  // dice; it fades out (never unmounts) once the dice land.
  rollLayer: { alignItems: 'center', justifyContent: 'center' },

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
  operatorLessonArea: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 12,
    paddingHorizontal: 4,
  },

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
  slotEmpty: { borderStyle: 'dashed', borderColor: 'rgba(244,205,90,0.3)', backgroundColor: 'transparent' },
  // A filled, tappable die sitting in a slot — brighter so it reads as "active,
  // tap to take it back out".
  slotFilled: { borderColor: 'rgba(244,205,90,0.85)', backgroundColor: 'rgba(244,205,90,0.10)' },
  // The optional third slot: faded so it clearly reads as "open for more", not
  // "required" — two dice already solve the equation.
  slotOptional: { opacity: 0.4 },
  resultSlot: { borderColor: 'rgba(244,205,90,0.85)', backgroundColor: 'rgba(244,205,90,0.12)' },
  slotTxt: { color: '#F8E08E', fontSize: 18, fontWeight: '900' },
  slotHintTxt: { color: 'rgba(244,205,90,0.35)', fontSize: 18, fontWeight: '900' },
  trackOperatorGlyph: {
    width: 34,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorHole: {
    width: 42,
    height: 44,
    borderRadius: 11,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(244,205,90,0.48)',
    backgroundColor: 'rgba(255,243,201,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorHoleReady: {
    borderColor: '#F8E08E',
    backgroundColor: 'rgba(244,205,90,0.12)',
  },
  operatorHoleGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F4CD5A',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 12,
  },
  operatorHoleHint: { color: 'rgba(244,205,90,0.48)', fontSize: 22, fontWeight: '900' },
  resultSlotGlow: {
    borderColor: '#F8E08E',
    backgroundColor: 'rgba(244,205,90,0.24)',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 14,
  },
  resultGlowRing: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(248,224,142,0.22)',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 12,
    elevation: 12,
  },
  operatorMiniCard: {
    width: 32,
    height: 40,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#8A5A1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorMiniText: {
    color: '#3D2A0E',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 30,
    textAlign: 'center',
  },
  salindaMiniLetter: {
    position: 'absolute',
    top: 3,
    left: 5,
    color: '#2E7D43',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
  },
  salindaMiniOpWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  salindaMiniOp: {
    color: '#3D2A0E',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
    textAlign: 'center',
  },
  equals: { color: '#F8E08E', fontSize: 20, fontWeight: '900', marginHorizontal: 2 },
  confirmWrap: { alignSelf: 'stretch', alignItems: 'center', marginTop: 2 },
  checkPulseWrap: { alignSelf: 'center', width: SEND_BUTTON_WIDTH, borderRadius: SEND_BUTTON_RADIUS },
  fixedActionWrap: { alignSelf: 'center', width: SEND_BUTTON_WIDTH, borderRadius: SEND_BUTTON_RADIUS },
  operatorActionWrap: { alignSelf: 'center', width: 280, maxWidth: '80%', borderRadius: SEND_BUTTON_RADIUS },
  litDisabledActionButton: {
    opacity: 1,
    shadowColor: '#F8E08E',
    shadowOpacity: 0.52,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  fixedActionText: { textAlign: 'center' as const },
  confirmHint: { color: 'rgba(244,205,90,0.65)', fontSize: 14.5, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  introBoardDim: {
    width: '100%',
    minHeight: 126,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(244,205,90,0.18)',
    backgroundColor: 'rgba(0,0,0,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.72,
  },
  introBoardDimText: {
    color: 'rgba(248,224,142,0.34)',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
  },

  // Hand fan — anchored low at the bottom of the screen, swipeable; only a small
  // safe-area gap below it (clear of the iPhone home indicator).
  fanWrap: { alignItems: 'center', paddingBottom: 28 },
  specialsFanHalo: {
    position: 'absolute',
    left: '50%',
    top: 24,
    width: 260,
    height: 182,
    marginLeft: -130,
    borderRadius: 92,
    backgroundColor: 'rgba(46,125,67,0.22)',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 24,
    elevation: 18,
  },
  salindaFanHalo: {
    position: 'absolute',
    left: '50%',
    top: 28,
    width: 132,
    height: 178,
    marginLeft: -66,
    borderRadius: 22,
    backgroundColor: 'rgba(248,224,142,0.25)',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 18,
    elevation: 16,
  },
  selectorOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    backgroundColor: 'rgba(8,5,2,0.68)',
  },
  selectorCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#F8E08E',
    backgroundColor: 'rgba(20,12,4,0.96)',
    paddingHorizontal: 20,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 18,
  },
  selectorTitle: {
    color: '#F8E08E',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  selectorBody: {
    color: '#F5E6BF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 23,
    textAlign: 'center',
  },
  selectorOps: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 4,
  },
  selectorOpButton: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  selectorOpFace: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFF1A8',
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  headerText: { color: '#F8E08E', fontSize: 18, fontWeight: '700', lineHeight: 26, textAlign: 'right' },

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
