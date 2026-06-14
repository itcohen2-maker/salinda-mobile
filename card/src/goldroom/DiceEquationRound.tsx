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
import { Animated, Easing, I18nManager, Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedDice, { type AnimatedDiceHandle, GoldDieFace } from '../../AnimatedDice';
import { GameCard, type Card, type Fraction, type Operation } from '../../components/CardDesign';
import HandFan from '../../components/HandFan';
import { GoldButton } from '../../components/GoldButton';
import { DiscardHelper, type DiscardOption } from './DiscardHelper';
import { ChallengeShowcaseScreen } from './ChallengeShowcaseScreen';
import { FeraShowcaseScreen } from './FeraShowcaseScreen';
import { HotPotatoModal } from './HotPotatoModal';
import { SalindaCardFlow } from './SalindaCardFlow';
import OperatorGlyph from '../components/ui/OperatorGlyph';
import { applyOperation } from '../utils/arithmetic';
import { playSfx } from '../audio/sfx';
import { getNativeHandFanMetrics } from '../theme/nativeHandFan';
import { interpolateCopy, useGoldRoomCopy } from './goldRoomCopy';

// The Gold Room table surface (same asset family the live game uses).
const GOLD_TABLE_IMG = require('../../assets/table_golden_nobg.png');

const rtlText = {
  writingDirection: 'rtl' as const,
  textAlign: 'right' as const,
};

// ── Steps. Each guided step fixes a single operator so the lesson stays sharp.
type StepId = 'plus' | 'minus';
const STEP_OP: Record<StepId, '+' | '-'> = { plus: '+', minus: '-' };

const SEEDED_DICE: [number, number, number] = [2, 4, 5];
const FIXED_HAND_VALUES = [12, 6, 3, 9, 15, 20, 1] as const;
type SpecialsStepId = 'signIntro' | 'sign' | 'salinda' | 'feraShowcase' | 'wild' | 'fractionIntro' | 'fractionAttack' | 'challengeShowcase' | 'fractionDefense';

// ── Specials sequence: an opening showcase of all four sign cards, then three
// continuous on-board substeps ──────────────────────────────────────────────
// Opening — the board shows every sign (+, −, ×, ÷) as a 2×2 grid of 3D buttons,
// while the fan previews the player's hand with the highlighted plus card.
const SIGN_INTRO_PLUS_ID = 'sign-intro-plus';
const SIGN_INTRO_HAND: Card[] = [
  { id: 'sign-intro-num-7', type: 'number', value: 7 },
  { id: 'sign-intro-num-5', type: 'number', value: 5 },
  { id: SIGN_INTRO_PLUS_ID, type: 'operation', operation: '+' },
  { id: 'sign-intro-num-9', type: 'number', value: 9 },
];
// The four signs, in display order, for the opening showcase grid.
const SIGN_SHOWCASE_OPS: Operation[] = ['+', '-', 'x', '÷'];

// Substep 1 — sign cards (+/-): the board is pre-seeded with 5 _ 2 = 7; the hand
// carries the plus sign card plus the target number 7.
const SIGN_STEP_DICE: [number, number, number] = [5, 2, 4];
const SIGN_PLUS_ID = 'sign-plus';
const SIGN_TARGET_ID = 'sign-target-7';
const SIGN_HAND: Card[] = [
  { id: 'sign-num-3', type: 'number', value: 3 },
  { id: SIGN_PLUS_ID, type: 'operation', operation: '+' },
  { id: SIGN_TARGET_ID, type: 'number', value: 7 },
  { id: 'sign-num-9', type: 'number', value: 9 },
  { id: 'sign-num-5', type: 'number', value: 5 },
];

// Substep 2 — Salinda wild operator: the board is pre-seeded with 5 _ 2 = 3; the
// hand carries the gold Salinda plus the target number 3. The correct sign is -.
const SALINDA_STEP_DICE: [number, number, number] = [5, 2, 6];
const SALINDA_CARD_ID = 'salinda-wild';
const SALINDA_TARGET_ID = 'salinda-target-3';
const SALINDA_HAND: Card[] = [
  { id: 'salinda-num-5', type: 'number', value: 5 },
  { id: SALINDA_CARD_ID, type: 'salinda' },
  { id: SALINDA_TARGET_ID, type: 'number', value: 3 },
  { id: 'salinda-num-7', type: 'number', value: 7 },
  { id: 'salinda-num-9', type: 'number', value: 9 },
];
export const GOLD_ROOM_SALINDA_EXERCISE = {
  dice: SALINDA_STEP_DICE,
  left: 5,
  right: 2,
  op: '-' as Operation,
  result: 3,
  targetId: SALINDA_TARGET_ID,
};

// Substep 3 — wild number card: the board shows the ready equation 6 + 2 = ?; the
// wild card fills the missing 8. The hand never already contains an 8.
const WILD_CARD_ID = 'wild-number';
const WILD_RESULT = 8;
const WILD_HAND: Card[] = [
  { id: 'wild-num-4', type: 'number', value: 4 },
  { id: WILD_CARD_ID, type: 'wild' },
  { id: 'wild-num-7', type: 'number', value: 7 },
  { id: 'wild-num-2', type: 'number', value: 2 },
  { id: 'wild-num-5', type: 'number', value: 5 },
];

// ── Fraction substeps: a CENTER PILE (a discard pile with a number card on top)
// replaces the dice/equation track. Two continuous on-board steps, RANDOMISED each
// play so the learner meets a fresh exercise every time:
//   • fractionAttack  — throw a fraction card onto the pile number to attack.
//   • fractionDefense — under a fraction challenge, either solve it with a number
//                       divisible by the denominator, or roll it over with another
//                       fraction.
// The card IDS below are STABLE (only the card values/fractions vary per round), so
// the step logic never needs to know which fraction was rolled.
const FRAC_ATTACK_HALF_ID = 'frac-attack-fraction'; // the attack fraction card
const FRAC_DEF_NUM_ID = 'frac-def-number'; // the math-solution number card
const FRAC_DEF_THIRD_ID = 'frac-def-roll'; // the roll-over fraction card

// The compact unicode glyph + denominator for each fraction.
const FRACTION_GLYPH: Record<Fraction, string> = { '1/2': '½', '1/3': '⅓', '1/4': '¼', '1/5': '⅕' };
const FRACTION_DENOM: Record<Fraction, number> = { '1/2': 2, '1/3': 3, '1/4': 4, '1/5': 5 };
const ALL_FRACTIONS: Fraction[] = ['1/2', '1/3', '1/4', '1/5'];
const PILE_NUMBER_CHOICES = [12, 14, 15, 16, 18, 20, 21, 24];
const FRACTION_LESSON_HAND_SIZES = [1, 3, 5, 4, 7, 5] as const;

function fracRandInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function fracPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickPileForFraction(fraction: Fraction): number {
  const denom = FRACTION_DENOM[fraction];
  const valid = PILE_NUMBER_CHOICES.filter((value) => value % denom === 0);
  return fracPick(valid);
}

function uniqueNumberDistractors(blocked: number[], count: number): number[] {
  const values: number[] = [];
  while (values.length < count) {
    const value = fracPick(PILE_NUMBER_CHOICES);
    if (!blocked.includes(value) && !values.includes(value)) values.push(value);
  }
  return values;
}

// A single randomised fraction exercise: the attack throw + the defense scenario.
interface FractionRound {
  attackFraction: Fraction;
  attackPile: number;
  attackDummies: [number, number];
  defenseFraction: Fraction; // the live challenge on the pile
  defensePile: number;
  defenseMathNumber: number; // the math solution (a multiple of the denominator)
  defenseDummy: number;
  rollFraction: Fraction; // a DIFFERENT fraction, for the roll-over path
}

export function buildFractionRound(): FractionRound {
  const attackFraction = fracPick(ALL_FRACTIONS);
  const defenseFraction = fracPick(ALL_FRACTIONS);
  const denom = FRACTION_DENOM[defenseFraction];
  const defenseMathNumber = denom * fracRandInt(2, Math.max(2, Math.floor(18 / denom)));
  const rollFraction = fracPick(ALL_FRACTIONS.filter((f) => f !== defenseFraction));
  return {
    attackFraction,
    attackPile: pickPileForFraction(attackFraction),
    attackDummies: [fracRandInt(2, 9), fracRandInt(2, 9)],
    defenseFraction,
    defensePile: pickPileForFraction(defenseFraction),
    defenseMathNumber,
    defenseDummy: fracRandInt(2, 9),
    rollFraction,
  };
}

function buildFractionAttackHand(r: FractionRound): Card[] {
  return [
    { id: 'frac-attack-dummy-1', type: 'number', value: r.attackDummies[0] },
    { id: FRAC_ATTACK_HALF_ID, type: 'fraction', fraction: r.attackFraction },
    { id: 'frac-attack-dummy-2', type: 'number', value: r.attackDummies[1] },
  ];
}

function buildFractionDefenseHand(r: FractionRound): Card[] {
  return [
    { id: FRAC_DEF_NUM_ID, type: 'number', value: r.defenseMathNumber },
    { id: FRAC_DEF_THIRD_ID, type: 'fraction', fraction: r.rollFraction },
    { id: 'frac-def-dummy', type: 'number', value: r.defenseDummy },
  ];
}

type FractionLessonKind = 'attack' | 'defense';

interface FractionLessonStage {
  id: string;
  kind: FractionLessonKind;
  level: 1 | 2 | 3;
  fraction: Fraction;
  pile: number;
  answerId: string;
  validAnswerIds?: string[];
  instructionText?: string;
  hand: Card[];
  defensePath?: 'math' | 'roll';
}

function centeredHand(answer: Card, distractors: Card[], size: number): Card[] {
  if (size <= 1) return [answer];
  const centerIndex = Math.floor(size / 2);
  const picked = distractors.slice(0, size - 1);
  return [...picked.slice(0, centerIndex), answer, ...picked.slice(centerIndex)];
}

function searchHand(answer: Card, distractors: Card[], size: number): Card[] {
  if (size <= 1) return [answer];
  const picked = distractors.slice(0, size - 1);
  return [answer, ...picked];
}

function buildFractionAttackStage(level: 1 | 2 | 3, size: number): FractionLessonStage {
  const fraction = fracPick(ALL_FRACTIONS);
  const pile = pickPileForFraction(fraction);
  const answerId = `frac-attack-${level}-answer`;
  const answer: Card = { id: answerId, type: 'fraction', fraction };
  const otherFractions = ALL_FRACTIONS.filter((candidate) => candidate !== fraction).map((candidate, index) => ({
    id: `frac-attack-${level}-fraction-distractor-${index}`,
    type: 'fraction' as const,
    fraction: candidate,
  }));
  const numberDistractors = uniqueNumberDistractors([pile], 4).map((value, index) => ({
    id: `frac-attack-${level}-num-distractor-${index}`,
    type: 'number' as const,
    value,
  }));
  return {
    id: `fraction-attack-${level}`,
    kind: 'attack',
    level,
    fraction,
    pile,
    answerId,
    hand: level === 3
      ? searchHand(answer, [...otherFractions, ...numberDistractors], size)
      : centeredHand(answer, [...otherFractions, ...numberDistractors], size),
  };
}

function buildFractionDefenseStage(level: 1 | 2 | 3, size: number): FractionLessonStage {
  const answerId = `frac-defense-${level}-answer`;
  if (level === 1) {
    const answer: Card = { id: answerId, type: 'number', value: 12 };
    const distractors: Card[] = [
      { id: 'frac-defense-1-num-5', type: 'number', value: 5 },
      { id: 'frac-defense-1-num-7', type: 'number', value: 7 },
      { id: 'frac-defense-1-num-14', type: 'number', value: 14 },
    ];
    return {
      id: 'fraction-defense-block-basic',
      kind: 'defense',
      level,
      fraction: '1/3',
      pile: 12,
      answerId,
      validAnswerIds: [answerId],
      defensePath: 'math',
      instructionText: 'אותגרת! בחר קלף שמתחלק ב-3 כדי לחסום את ההתקפה.',
      hand: centeredHand(answer, distractors, size),
    };
  }
  if (level === 2) {
    const secondAnswerId = `frac-defense-${level}-second-answer`;
    const answer: Card = { id: answerId, type: 'fraction', fraction: '1/2' };
    const secondAnswer: Card = { id: secondAnswerId, type: 'fraction', fraction: '1/3' };
    const distractors: Card[] = [
      { id: 'frac-defense-2-num-6', type: 'number', value: 6 },
      { id: 'frac-defense-2-num-10', type: 'number', value: 10 },
      { id: 'frac-defense-2-num-14', type: 'number', value: 14 },
      { id: 'frac-defense-2-num-15', type: 'number', value: 15 },
      { id: 'frac-defense-2-num-18', type: 'number', value: 18 },
    ];
    return {
      id: 'fraction-defense-hot-potato',
      kind: 'defense',
      level,
      fraction: '1/4',
      pile: 16,
      answerId,
      validAnswerIds: [answerId, secondAnswerId],
      defensePath: 'roll',
      instructionText: 'אותגרת שוב!',
      hand: searchHand(secondAnswer, [distractors[0], answer, ...distractors.slice(1)], size),
    };
  }
  const mathAnswerId = answerId;
  const rollAnswerId = `frac-defense-${level}-roll-answer`;
  const mathAnswer: Card = { id: mathAnswerId, type: 'number', value: 10 };
  const rollAnswer: Card = { id: rollAnswerId, type: 'fraction', fraction: '1/3' };
  const distractors: Card[] = [
    { id: 'frac-defense-3-num-7', type: 'number', value: 7 },
    { id: 'frac-defense-3-num-12', type: 'number', value: 12 },
    { id: 'frac-defense-3-num-14', type: 'number', value: 14 },
  ];
  return {
    id: 'fraction-defense-final-choice',
    kind: 'defense',
    level,
    fraction: '1/5',
    pile: 20,
    answerId: mathAnswerId,
    validAnswerIds: [mathAnswerId, rollAnswerId],
    instructionText: 'מבחן סופי! אותגרת על ידי ⅕. בחר בעצמך איך להתגונן: חסום עם מספר, או העבר הלאה עם שבר.',
    hand: searchHand(mathAnswer, [rollAnswer, ...distractors], size),
  };
}

function isValidFractionDefenseCard(card: Card, challenge: Fraction): boolean {
  const denom = FRACTION_DENOM[challenge];
  if (card.type === 'fraction') return true;
  return card.type === 'number' && typeof card.value === 'number' && card.value > 0 && card.value % denom === 0;
}

function isValidFractionStageCard(card: Card, stage: FractionLessonStage): boolean {
  if (stage.validAnswerIds) return stage.validAnswerIds.includes(card.id);
  if (stage.kind === 'attack') return card.id === stage.answerId;
  return isValidFractionDefenseCard(card, stage.fraction);
}

export function buildFractionLessonStages(): FractionLessonStage[] {
  return [
    buildFractionAttackStage(1, FRACTION_LESSON_HAND_SIZES[0]),
    buildFractionAttackStage(2, FRACTION_LESSON_HAND_SIZES[1]),
    buildFractionAttackStage(3, FRACTION_LESSON_HAND_SIZES[2]),
    buildFractionDefenseStage(1, FRACTION_LESSON_HAND_SIZES[3]),
    buildFractionDefenseStage(2, FRACTION_LESSON_HAND_SIZES[4]),
    buildFractionDefenseStage(3, FRACTION_LESSON_HAND_SIZES[5]),
  ];
}

// A single valid defense the player can play against a fraction challenge —
// derived from a real card in their hand (never hardcoded).
// Scan the player's CURRENT hand and derive every valid defense against the live
// fraction challenge: a number divisible by the denominator (math solve), or ANY
// other fraction card (roll the challenge over). The defense buttons are built by
// mapping over THIS result, so they always match what the player actually holds —
// e.g. no "Place 8" button unless an 8 (or another multiple) is in hand.
// The fraction module opens on a pure SHOWCASE: every fraction card the game uses
// sits in the fan (numbers excluded) so the learner first just meets the cards.
const FRACTION_SHOWCASE_KINDS: Fraction[] = ['1/2', '1/3', '1/4', '1/5'];
const FRACTION_INTRO_HAND: Card[] = FRACTION_SHOWCASE_KINDS.map((fraction) => ({
  id: `frac-intro-${fraction.replace('/', '-')}`,
  type: 'fraction',
  fraction,
}));

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
// equation. Placed dice dim + show a check so it's clear they're "in". When
// `active` (it's the die the guided step wants next), a soft gold glow pulses
// around it to point the learner at exactly where to tap.
function DiceChip({ value, placed, order, active = false, pulse, onPress }: { value: number; placed: boolean; order: number | null; active?: boolean; pulse?: Animated.Value; onPress: () => void }) {
  const copy = useGoldRoomCopy();
  const glowOpacity = active && pulse ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.85] }) : undefined;
  const glowScale = active && pulse ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.12] }) : undefined;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={interpolateCopy(placed ? copy.removeDie : copy.addDie, { value })}
    >
      <View style={[styles.diceChip, placed && styles.diceChipPlaced, active && styles.diceChipActive]}>
        {active && glowOpacity ? (
          <Animated.View pointerEvents="none" style={[styles.diceChipGlow, { opacity: glowOpacity, transform: [{ scale: glowScale ?? 1 }] }]} />
        ) : null}
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
      <LinearGradient
        colors={['#FFF4B8', '#F8E08E', '#D9A23A', '#8A5A1C']}
        locations={[0, 0.34, 0.72, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.instructionBubble}
      >
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.62)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.instructionSheen}
        />
        <View pointerEvents="none" style={styles.instructionInnerGlow} />
        <Text allowFontScaling={false} style={styles.headerText}>{text}</Text>
      </LinearGradient>
    </View>
  );
}

// ── A matched card flying out of the hand toward the deck — the "discard" beat
// the player earns on a correct equation. The success chime plays LOUD and clear
// here — this is the player's first win, the dopamine moment.
function playEquationTapSfx(volumeOverride = 0.54) {
  void playSfx('place', { cooldownMs: 0, volumeOverride });
}

function FlyingCard({ card, onDone, doneDelayMs = 220, durationMs = 720 }: { card: Card; onDone: () => void; doneDelayMs?: number; durationMs?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let doneTimer: ReturnType<typeof setTimeout> | null = null;
    playEquationTapSfx(0.5);
    const animation = Animated.timing(a, { toValue: 1, duration: durationMs, useNativeDriver: true });
    animation.start(() => {
      void playSfx('success', { cooldownMs: 0, volumeOverride: 0.88 });
      doneTimer = setTimeout(onDone, doneDelayMs);
    });
    return () => {
      animation.stop();
      if (doneTimer) clearTimeout(doneTimer);
    };
  }, [a, doneDelayMs, durationMs, onDone]);
  const translateY = a.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0, -245, -265] });
  const translateX = a.interpolate({ inputRange: [0, 1], outputRange: [0, 8] });
  const rotate = a.interpolate({ inputRange: [0, 0.72, 1], outputRange: ['0deg', '-5deg', '0deg'] });
  const scale = a.interpolate({ inputRange: [0, 0.28, 0.82, 1], outputRange: [1, 1.1, 0.5, 0.42] });
  const opacity = a.interpolate({ inputRange: [0, 0.9, 1], outputRange: [1, 1, 0.96] });
  return (
    <View pointerEvents="none" style={styles.flyingLayer}>
      <Animated.View style={{ opacity, transform: [{ translateX }, { translateY }, { rotate }, { scale }] }}>
        <GameCard card={card} small onPress={undefined} />
      </Animated.View>
    </View>
  );
}

type ConfettiPiece = {
  key: string;
  x: number;
  size: number;
  color: string;
  rotate: string;
  drift: number;
  delay: number;
  duration: number;
  progress: Animated.Value;
};

function FullScreenConfetti({ burstKey }: { burstKey: number }) {
  const { width, height } = useWindowDimensions();
  const piecesRef = useRef<ConfettiPiece[] | null>(null);
  if (!piecesRef.current) {
    const colors = ['#FCD34D', '#F97316', '#22C55E', '#38BDF8', '#EC4899', '#A78BFA', '#FFFFFF'];
    piecesRef.current = Array.from({ length: 54 }, (_, i) => ({
      key: `confetti-${i}`,
      x: Math.random(),
      size: 7 + Math.random() * 9,
      color: colors[i % colors.length],
      rotate: `${Math.round(Math.random() * 180)}deg`,
      drift: -70 + Math.random() * 140,
      delay: Math.round(Math.random() * 520),
      duration: 1650 + Math.round(Math.random() * 900),
      progress: new Animated.Value(0),
    }));
  }

  useEffect(() => {
    const animations = piecesRef.current!.map((piece) => {
      piece.progress.setValue(0);
      return Animated.sequence([
        Animated.delay(piece.delay),
        Animated.timing(piece.progress, {
          toValue: 1,
          duration: piece.duration,
          useNativeDriver: true,
        }),
      ]);
    });
    Animated.stagger(8, animations).start();
  }, [burstKey]);

  return (
    <View pointerEvents="none" style={styles.confettiLayer}>
      {piecesRef.current.map((piece) => {
        const translateY = piece.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-40, height + 80],
        });
        const translateX = piece.progress.interpolate({
          inputRange: [0, 0.55, 1],
          outputRange: [0, piece.drift, piece.drift * 0.55],
        });
        const rotate = piece.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [piece.rotate, `${parseInt(piece.rotate, 10) + 540}deg`],
        });
        const opacity = piece.progress.interpolate({
          inputRange: [0, 0.08, 0.82, 1],
          outputRange: [0, 1, 1, 0],
        });
        return (
          <Animated.View
            key={piece.key}
            style={[
              styles.confettiPiece,
              {
                left: piece.x * width,
                width: piece.size,
                height: piece.size * 1.7,
                backgroundColor: piece.color,
                opacity,
                transform: [{ translateX }, { translateY }, { rotate }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function FirstWinCelebration({ onContinue }: { onContinue: () => void }) {
  const pop = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    setBurstKey((key) => key + 1);
    void playSfx('gameWin', { cooldownMs: 0, volumeOverride: 0.95 });
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 150, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 520, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 520, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pop, pulse]);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.58, 1] });
  return (
    <View style={styles.successOverlay}>
      <FullScreenConfetti burstKey={burstKey} />
      <View style={[styles.successCard, styles.firstWinCard]}>
        <Animated.Text style={[styles.firstWinTrophy, { opacity: pop, transform: [{ scale }] }]}>🏆</Animated.Text>
        <Text style={styles.firstWinTitle}>כל הכבוד!</Text>
        <Text style={styles.firstWinSub}>פתרתם את התרגיל הראשון שלכם!</Text>
        <Animated.View style={[styles.firstWinCta, { transform: [{ scale: pulse }] }]}>
          <GoldButton
            label="המשך  ›"
            onPress={onContinue}
            accessibilityLabel="המשך לשלב הבא"
            fullWidth
            height={62}
            fontSize={24}
          />
        </Animated.View>
      </View>
    </View>
  );
}

// ── Success — the explicit finish. A trophy pops, then a single "סיום"
// returns to the Hub. No Retry/Next/Menu choice overlay.
function SuccessCelebration({ onDone, title, subtitle, ctaLabel }: { onDone?: () => void; title?: string; subtitle?: string; ctaLabel?: string }) {
  const copy = useGoldRoomCopy();
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
  }, [pop]);
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const label = ctaLabel ?? copy.finish;
  return (
    <View style={styles.successOverlay}>
      <View style={styles.successCard}>
        <Animated.Text style={[styles.successTrophy, { opacity: pop, transform: [{ scale }] }]}>🏆</Animated.Text>
        <Text style={styles.successTitle}>{title ?? copy.rewardTitle}</Text>
        <Text style={styles.successSub}>{subtitle ?? copy.successSub}</Text>
        <View style={styles.successCta}>
          <GoldButton label={label} onPress={onDone} accessibilityLabel={label} fullWidth height={56} fontSize={20} />
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

function FlyingSpecialCard({ card, onDone, variant = 'card' }: { card: Card; onDone: () => void; variant?: 'card' | 'salinda' | 'fraction' }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    void playSfx(variant === 'salinda' ? 'complete' : 'success', { cooldownMs: 0, volumeOverride: variant === 'salinda' ? 0.9 : 0.75 });
    const animation = Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true });
    animation.start(onDone);
    return () => animation.stop();
  }, [a, onDone, variant]);

  // The fraction throw flies STRAIGHT UP from the hand and lands ON the center
  // pile (shrinks + settles), on a high-z layer so it's clearly visible over the
  // fan. The sign/salinda throws keep flying up-and-out toward the deck.
  const isFraction = variant === 'fraction';
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [0, isFraction ? -300 : -360] });
  const translateX = a.interpolate({ inputRange: [0, 1], outputRange: [0, variant === 'salinda' ? 96 : isFraction ? 0 : 42] });
  const rotate = a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', variant === 'salinda' ? '28deg' : isFraction ? '6deg' : '14deg'] });
  const scale = a.interpolate({ inputRange: [0, 0.25, 1], outputRange: [1, variant === 'salinda' ? 1.18 : 1.1, isFraction ? 0.52 : 0.66] });
  const opacity = a.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, isFraction ? 0.55 : 0] });

  return (
    <View pointerEvents="none" style={isFraction ? styles.flyingLayerPile : styles.flyingLayer}>
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

// ── The fraction CENTER PILE: a small discard stack with a number card on top.
// A challenge marker (½ / ⅓) rides the top-right corner while an attack is live;
// a green ✓ replaces it once the challenge is solved mathematically. While a
// matching hand card is armed the main action button becomes "שגר"; the pile is
// display-only in this lesson.
function FractionCenterPile({
  base,
  marker,
  cleared,
  resolvedCard,
  glow,
  pulse,
}: {
  base: number;
  marker: Fraction | null;
  cleared: boolean;
  resolvedCard?: Card | null;
  glow: boolean;
  pulse: Animated.Value;
}) {
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.95] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] });
  const topCard: Card = resolvedCard
    ? resolvedCard
    : marker
    ? { id: 'frac-pile-top-challenge', type: 'fraction', fraction: marker }
    : { id: 'frac-pile-top', type: 'number', value: base };
  const inner = (
    <View style={styles.fractionPileWrap}>
      {glow ? (
        <Animated.View pointerEvents="none" style={[styles.fractionPileGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
      ) : null}
      <View style={styles.fractionPileStackBack2} />
      <View style={styles.fractionPileStackBack1} />
      <GameCard card={topCard} small onPress={undefined} />
      {cleared ? (
        <View style={styles.fractionCleared}>
          <Text allowFontScaling={false} style={styles.fractionClearedTxt}>✓</Text>
        </View>
      ) : null}
    </View>
  );
  return inner;
}

function FanFocusHalo({ width, opacity }: { width: number; opacity: Animated.AnimatedInterpolation<number> }) {
  const metrics = useMemo(() => getNativeHandFanMetrics(Platform.OS), []);
  const haloW = Math.round(metrics.cardWidth * metrics.centerScale + 12);
  const haloH = Math.round(metrics.cardHeight * metrics.centerScale + 14);
  const selectedLift = Math.round(4 * metrics.renderScale);
  const haloTop = Math.max(0, Math.round(metrics.cardHeight * 0.14) - selectedLift - 7);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.fanFocusHalo,
        {
          width: haloW,
          height: haloH,
          left: width / 2 - haloW / 2,
          top: haloTop,
          borderRadius: Math.round(haloW * 0.18),
          opacity,
        },
      ]}
    />
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

// The Salinda card holds ALL four signs — the chooser must offer every one, or a
// rigged exercise (e.g. the × round 4 × 3 = 12) becomes impossible to solve.
const SELECTOR_OPS: Operation[] = ['+', '-', 'x', '÷'];

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

// ── The opening showcase: all four signs as a clean 2×2 grid.
function SignShowcaseGrid() {
  return (
    <View style={styles.signGrid}>
      {SIGN_SHOWCASE_OPS.map((op) => (
        <LinearGradient
          key={op}
          colors={['#FFE7A6', '#F5C76B', '#D79B3C']}
          locations={[0, 0.62, 1]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.signGridCell}
        >
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.signGridSheen}
          />
          <OperatorGlyph op={op} color="#3D2A0E" size={op === '÷' ? 44 : 42} />
        </LinearGradient>
      ))}
    </View>
  );
}

// The hand a specials/fraction substep opens with — used both for the initial
// mount (the lesson can start mid-sequence, e.g. the standalone fraction module
// starts at 'fractionAttack') and when stepping forward via goToStep.
function stepForFractionStage(stage: FractionLessonStage): SpecialsStepId {
  return stage.kind === 'attack' ? 'fractionAttack' : 'fractionDefense';
}

function initialHandForStep(step: SpecialsStepId, fractionStages: FractionLessonStage[]): Card[] {
  switch (step) {
    case 'sign':
      return SIGN_HAND;
    case 'salinda':
      return SALINDA_HAND;
    case 'wild':
      return WILD_HAND;
    case 'feraShowcase':
      return WILD_HAND;
    case 'fractionAttack':
      return fractionStages[0].hand;
    case 'fractionDefense':
      return fractionStages[3].hand;
    case 'challengeShowcase':
      return fractionStages[3].hand;
    case 'fractionIntro':
      return FRACTION_INTRO_HAND;
    default:
      return SIGN_INTRO_HAND;
  }
}

function getSpecialsFallbackLaunchCard(step: SpecialsStepId, wildPlaced: boolean): Card | null {
  if (step !== 'wild' || !wildPlaced) return null;
  return { id: WILD_CARD_ID, type: 'number', value: WILD_RESULT };
}

type SpecialsFlowPhase =
  | 'symbolsShowcase'
  | 'symbolsPractice'
  | 'salindaIntro'
  | 'salindaShowcase'
  | 'salindaPractice'
  | 'feraIntro'
  | 'feraShowcase'
  | 'feraPractice';

type SpecialsFlyTarget = 'op' | 'left' | 'right' | 'result';
type SpecialsFlyKind = 'sign' | 'salindaSign' | 'feraNumber';
type SpecialsPendingPlacement = 'symbolMinus' | 'salindaOperator' | 'feraNumber' | null;

interface SpecialsFlowState {
  phase: SpecialsFlowPhase;
  op: Operation | null;
  leftValue: number | null;
  rightValue: number | null;
  rightCard: Card | null;
  busy: boolean;
  pendingPlacement: SpecialsPendingPlacement;
  symbolsDemoDone: boolean;
  salindaDemoDone: boolean;
  salindaIntroLocked: boolean;
  salindaBubblesOpen: boolean;
  salindaSelectorOpen: boolean;
  salindaSelectedOp: Operation | null;
  feraDemoDone: boolean;
  feraShowcaseStarted: boolean;
  feraShowcaseCardUsed: boolean;
  feraPracticeCardUsed: boolean;
  // ── Wild ("פרא") round: the equation is fully formed (left + right = ?) and the
  // wild is LAUNCHED to MATCH the result — it never enters the operand/sign grid. ──
  feraResult: number | null;        // the target result the wild must match
  feraResolvedCard: Card | null;    // the wild once it has landed in the result slot
  feraHand: Card[];                 // rich 5-card hand: 4 decoys (≠ result) + 1 wild
  // ── Wild showcase dice storyboard: 3 dice float in, then auto-fill the two
  // operands (4, 2) and the result auto-computes & DISPLAYS the answer (6). ──
  feraDiceDone: boolean;            // operands have rolled in + result is shown
  feraArmed: boolean;               // wild is selected/armed, awaiting the שגר launch
  showSignSuccess: boolean;         // sign-card lesson celebration overlay is open
  showEndModal: boolean;
}

interface SpecialsFlyToken {
  id: number;
  kind: SpecialsFlyKind;
  label: string;
  target: SpecialsFlyTarget;
}

const SPECIALS_SYMBOLS_SHOWCASE_TEXT =
  'ברוכים הבאים לשלב הסימנים! כדי להיפטר מקלפים, אתם חייבים לשלוט בקלפי סימני הפעולה שיוצרים את התרגיל.';
const SPECIALS_SYMBOLS_PRACTICE_TEXT =
  'עכשיו תורכם! ליחצו על קלף סימן החיסור (-) כדי להשלים את המשוואה בהצלחה.';
const SPECIALS_SALINDA_SHOWCASE_TEXT =
  'הכירו את הג׳וקר שלכם: קלף סלינדה! הוא לא מייצג מספר, אלא מכיל בתוכו את כל ארבעת סימני הפעולה יחד. לחצו על חץ ההמשך כדי לראות את הקסם.';
const SPECIALS_SALINDA_INTRO_SPIN_TEXT = 'הכירו את סלינדה – מלכת המשחק! 👑';
const SPECIALS_SALINDA_INTRO_LOCKED_TEXT =
  'היא לא קלף רגיל, היא מכילה בתוכה את כל ארבעת סימני הפעולה יחד! לחצו על הכפתור כדי לראות איך משתמשים בכוח שלה.';
const SPECIALS_SALINDA_PRACTICE_TEXT =
  'עכשיו תורכם! הביטו בקלף הסלינדה שבמניפה. ביחרו את סימן הכפל (×)!';
const SPECIALS_FERA_INTRO_TEXT =
  'הכירו את הנשק הסודי של המשחק: קלף הפרא! הקלף הזה הוא לוח חלק – הוא יכול להפוך לכל מספר שאתם צריכים כדי להשלים את התרגיל ולנצח.';
const SPECIALS_FERA_SHOWCASE_TEXT =
  "אין לכם את התוצאה ביד? בחרו בקלף הפרא במקום הקלף שחסר לכם, ואז לחצו על 'שגר'!";
const SPECIALS_FERA_READY_TEXT =
  'ראיתם את זה? קלף הפרא השלים את המספר שהיה חסר לכם ופתר את התרגיל!';
const SPECIALS_FERA_PRACTICE_TEXT =
  "התור שלכם! אין לכם את התוצאה ביד — בחרו בקלף הפרא ולחצו על 'שגר' כדי לפתור!";
// Shown the moment the player arms (selects) the wild, before pressing שגר.
const SPECIALS_FERA_ARMED_TEXT = "מצוין! עכשיו לחצו על 'שגר' כדי לשלוח את קלף הפרא ולפתור את התרגיל!";
// Sign-card lesson celebration — fires after the learner places the (−) sign.
const SPECIALS_SIGN_SUCCESS_TITLE = 'כל הכבוד! 🎉';
const SPECIALS_SIGN_SUCCESS_TEXT =
  'עכשיו אתם יודעים איך נפטרים מקלף סימן! פשוט מניחים אותו בתוך התרגיל. קלי קלות! 🎉';

const SPECIALS_TARGET_PROMPT = 'מעולה! עכשיו לחצו על המשבצת המהבהבת במשוואה כדי להציב את הקלף.';

const SPECIALS_SIGN_OPS: Operation[] = ['+', '-', 'x', '÷'];
const SPECIALS_SIGN_CARDS: Card[] = SPECIALS_SIGN_OPS.map((op) => ({
  id: `specials-sign-${op}`,
  type: 'operation',
  operation: op,
}));
const SPECIALS_TOAST_TEXT = 'תנסה שוב';
const SPECIALS_SALINDA_ID = 'specials-practice-salinda';
const SPECIALS_FERA_ID = 'specials-practice-fera';
const SPECIALS_SECOND_SPECIAL_ID = 'specials-practice-second-special';

const SPECIALS_SALINDA_SHOWCASE_HAND: Card[] = [
  { id: 'specials-salinda-show-6', type: 'number', value: 6 },
  { id: 'specials-salinda-show-11', type: 'number', value: 11 },
  { id: 'specials-salinda-show-4', type: 'number', value: 4 },
  { id: SPECIALS_SALINDA_ID, type: 'salinda' },
  { id: 'specials-salinda-show-9', type: 'number', value: 9 },
  { id: 'specials-salinda-show-14', type: 'number', value: 14 },
  { id: 'specials-salinda-show-2', type: 'number', value: 2 },
];

const SPECIALS_SALINDA_PRACTICE_HAND: Card[] = [
  { id: 'specials-salinda-practice-8', type: 'number', value: 8 },
  { id: SPECIALS_SECOND_SPECIAL_ID, type: 'wild' },
  { id: 'specials-salinda-practice-6', type: 'number', value: 6 },
  { id: SPECIALS_SALINDA_ID, type: 'salinda' },
  { id: 'specials-salinda-practice-plus', type: 'operation', operation: '+' },
  { id: 'specials-salinda-practice-12', type: 'number', value: 12 },
  { id: 'specials-salinda-practice-1', type: 'number', value: 1 },
];

const SPECIALS_FERA_INTRO_HAND: Card[] = [
  { id: 'specials-fera-intro-2', type: 'number', value: 2 },
  { id: SPECIALS_FERA_ID, type: 'wild' },
  { id: 'specials-fera-intro-9', type: 'number', value: 9 },
];

const SPECIALS_FERA_PRACTICE_HAND: Card[] = [
  { id: 'specials-fera-practice-7', type: 'number', value: 7 },
  { id: 'specials-fera-practice-1', type: 'number', value: 1 },
  { id: 'specials-fera-practice-12', type: 'number', value: 12 },
  { id: SPECIALS_FERA_ID, type: 'wild' },
  { id: 'specials-fera-practice-5', type: 'number', value: 5 },
  { id: 'specials-fera-practice-8', type: 'number', value: 8 },
  { id: 'specials-fera-practice-3', type: 'number', value: 3 },
];

function generateSpecialsSymbolPracticeExercise(): { left: number; right: number; result: number } {
  const right = 1 + Math.floor(Math.random() * 5);
  const result = 1 + Math.floor(Math.random() * 6);
  return { left: right + result, right, result };
}

function generateSpecialsSalindaPracticeExercise(): { left: number; right: number; result: number } {
  // Salinda demonstrates multiplication — keep the product within the game's
  // ≤25 range so the equation stays valid (e.g. 4 × 5 = 20, never 7 × 6 = 42).
  const pairs: Array<[number, number]> = [];
  for (let l = 2; l <= 9; l++) {
    for (let r = 2; r <= 9; r++) {
      if (l * r <= 25) pairs.push([l, r]);
    }
  }
  const [left, right] = pairs[Math.floor(Math.random() * pairs.length)];
  return { left, right, result: left * right };
}

function generateSpecialsFeraPracticeExercise(): { left: number; right: number; result: number } {
  const left = 3 + Math.floor(Math.random() * 6);
  const right = 2 + Math.floor(Math.random() * 6);
  return { left, right, result: left + right };
}

// A rich, realistic Wild ("פרא") hand: exactly 5 cards — 4 distinct random
// number cards explicitly filtered so NONE equals the round's target result
// (the "No-Solution Trap": only the wild can win) + 1 wild card. The wild is
// seated mid-fan so the spread reads like a real hand across iOS/Android/web.
function buildFeraHand(result: number): Card[] {
  const numbers: number[] = [];
  let guard = 0;
  while (numbers.length < 4 && guard++ < 400) {
    const v = 1 + Math.floor(Math.random() * 25); // regular number cards 1..25
    if (v === result) continue;                   // never equal to the target result
    if (numbers.includes(v)) continue;             // distinct → a fuller-looking fan
    numbers.push(v);
  }
  const cards: Card[] = numbers.map((value, i) => ({ id: `specials-fera-num-${i}-${value}`, type: 'number', value }));
  cards.splice(2, 0, { id: SPECIALS_FERA_ID, type: 'wild' });
  return cards;
}

function opDisplay(op: Operation): string {
  if (op === 'x') return '×';
  if (op === '÷') return '÷';
  return op;
}

function getSpecialsInstruction(state: SpecialsFlowState): string {
  if (state.pendingPlacement) return SPECIALS_TARGET_PROMPT;
  if (state.phase === 'symbolsShowcase') return SPECIALS_SYMBOLS_SHOWCASE_TEXT;
  if (state.phase === 'symbolsPractice') return SPECIALS_SYMBOLS_PRACTICE_TEXT;
  if (state.phase === 'salindaIntro') return state.salindaIntroLocked ? SPECIALS_SALINDA_INTRO_LOCKED_TEXT : SPECIALS_SALINDA_INTRO_SPIN_TEXT;
  if (state.phase === 'salindaShowcase') {
    if (state.salindaSelectorOpen) return 'בחרו את סימן המינוס (−) כדי לפתור את ההדגמה: 5 [?] 2 = 3.';
    if (state.salindaDemoDone) return 'מעולה! סלינדה השלימה את תרגיל המינוס. לחצו על החץ כדי לתרגל בעצמכם.';
    return 'הכירו את קלף סלינדה: הוא מכיל את כל סימני הפעולה. לחצו על קלף סלינדה במניפה כדי לפתוח את בועות הסימנים.';
  }
  if (state.phase === 'salindaPractice') {
    const left = state.leftValue ?? 4;
    const right = state.rightValue ?? 3;
    const result = left * right;
    if (state.salindaSelectorOpen) return `בחרו את סימן הכפל (×) כדי לפתור את התרגול: ${left} [?] ${right} = ${result}.`;
    return `עכשיו תורכם! הביטו בקלף הסלינדה שבמניפה. ביחרו את סימן הכפל (×)!`;
  }
  if (state.phase === 'feraIntro') return SPECIALS_FERA_INTRO_TEXT;
  if (state.phase === 'feraShowcase') {
    if (state.feraDemoDone) return SPECIALS_FERA_READY_TEXT;
    if (state.feraArmed) return SPECIALS_FERA_ARMED_TEXT;
    return SPECIALS_FERA_SHOWCASE_TEXT;
  }
  // feraPractice
  if (state.feraArmed && !state.feraResolvedCard) return SPECIALS_FERA_ARMED_TEXT;
  return SPECIALS_FERA_PRACTICE_TEXT;
}

function getSpecialsEquation(state: SpecialsFlowState): { left: number | null; op: Operation | null; right: number | null; result: number } | null {
  switch (state.phase) {
    case 'symbolsShowcase':
      return { left: 4, op: state.op, right: 2, result: 6 };
    case 'symbolsPractice': {
      const left = state.leftValue ?? 4;
      const right = state.rightValue ?? 2;
      return { left, op: state.op, right, result: left - right };
    }
    case 'salindaIntro':
      return null;
    case 'salindaShowcase':
      return { left: 5, op: state.op, right: 2, result: 3 };
    case 'salindaPractice':
      return { left: state.leftValue ?? 4, op: state.op, right: state.rightValue ?? 3, result: (state.leftValue ?? 4) * (state.rightValue ?? 3) };
    case 'feraIntro':
      return null;
    case 'feraShowcase':
      // Operands are null until the dice storyboard rolls them in (4, then 2).
      return { left: state.leftValue, op: '+' as Operation, right: state.rightValue, result: state.feraResult ?? 6 };
    case 'feraPractice':
      return { left: state.leftValue ?? 6, op: '+' as Operation, right: state.rightValue ?? 4, result: state.feraResult ?? 10 };
  }
}

function BouncyEquationNumber({ value, bounceKey }: { value: number | null; bounceKey: number }) {
  const y = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    y.setValue(-34);
    scale.setValue(0.92);
    Animated.spring(y, { toValue: 0, damping: 8, stiffness: 160, mass: 0.7, useNativeDriver: true }).start();
    Animated.spring(scale, { toValue: 1, damping: 7, stiffness: 180, mass: 0.7, useNativeDriver: true }).start();
  }, [bounceKey, scale, y]);

  return (
    <Animated.View style={[styles.specialsEquationSlot, value === null && styles.specialsEquationSlotEmpty, { transform: [{ translateY: y }, { scale }] }]}>
      {/* An empty operand slot stays blank (no "?") — it's the dashed target the
       *  storyboard die drops into; the digit bounces in once the die lands. */}
      {value === null ? null : (
        <Text allowFontScaling={false} style={styles.specialsEquationText}>
          {value}
        </Text>
      )}
    </Animated.View>
  );
}

function SpecialsEquation({
  left,
  op,
  right,
  rightCard,
  result,
  resultCard,
  resultHidden,
  resultSlotReady,
  bounceKey,
  opSlotReady,
  rightSlotReady,
  pulse,
  onPressOpSlot,
  onPressRightSlot,
}: {
  left: number | null;
  op: Operation | null;
  right: number | null;
  rightCard?: Card | null;
  result: number;
  resultCard?: Card | null;
  resultHidden?: boolean;
  resultSlotReady?: boolean;
  bounceKey: number;
  opSlotReady?: boolean;
  rightSlotReady?: boolean;
  pulse?: Animated.Value;
  onPressOpSlot?: () => void;
  onPressRightSlot?: () => void;
}) {
  const glowOpacity = pulse?.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.92] });
  const glowScale = pulse?.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.16] });
  const renderGlow = () =>
    pulse ? (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.specialsEquationSlotGlow,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale ?? 1 }],
          },
        ]}
      />
    ) : null;

  const opSlot = (
    <View style={[styles.specialsEquationSlot, !op && styles.specialsEquationSlotEmpty, opSlotReady && styles.specialsEquationSlotReady]}>
      {opSlotReady ? renderGlow() : null}
      {op ? (
        <View pointerEvents="none" style={styles.specialsEquationCardInSlot}>
          <GameCard card={{ id: `specials-equation-op-${op}`, type: 'operation', operation: op }} small onPress={undefined} />
        </View>
      ) : (
        <Text allowFontScaling={false} style={styles.specialsQuestionText}>?</Text>
      )}
    </View>
  );
  const rightSlot = (
    <View style={[styles.specialsEquationSlot, (right === null || rightCard) && styles.specialsEquationSlotEmpty, rightSlotReady && styles.specialsEquationSlotReady]}>
      {rightSlotReady ? renderGlow() : null}
      {rightCard ? (
        <View pointerEvents="none" style={styles.specialsEquationCardInSlot}>
          <GameCard card={rightCard} selected small onPress={undefined} />
        </View>
      ) : (
        <Text allowFontScaling={false} style={right === null ? styles.specialsQuestionText : styles.specialsEquationText}>
          {right ?? '?'}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.specialsEquationRow}>
      <BouncyEquationNumber value={left} bounceKey={bounceKey} />
      {opSlotReady && onPressOpSlot ? (
        <Pressable accessibilityRole="button" accessibilityLabel="place operator" onPress={onPressOpSlot}>
          {opSlot}
        </Pressable>
      ) : (
        opSlot
      )}
      {rightSlotReady && onPressRightSlot ? (
        <Pressable accessibilityRole="button" accessibilityLabel="place wild card" onPress={onPressRightSlot}>
          {rightSlot}
        </Pressable>
      ) : rightCard ? (
        rightSlot
      ) : (
        <BouncyEquationNumber value={right} bounceKey={bounceKey} />
      )}
      <Text allowFontScaling={false} style={styles.specialsEquals}>=</Text>
      <View style={[styles.specialsEquationSlot, (resultHidden || resultCard) && styles.specialsEquationSlotEmpty, resultSlotReady && styles.specialsEquationSlotReady]}>
        {resultSlotReady ? renderGlow() : null}
        {resultCard ? (
          <View pointerEvents="none" style={styles.specialsEquationCardInSlot}>
            <GameCard card={resultCard} selected small onPress={undefined} />
          </View>
        ) : resultHidden ? (
          // Result stays blank until both operands roll in; then it auto-computes
          // and the number flashes in (BouncyEquationNumber-style) — never a "?".
          null
        ) : (
          <Text allowFontScaling={false} style={styles.specialsEquationText}>
            {result}
          </Text>
        )}
      </View>
    </View>
  );
}

function SpecialsFeraIntroCard() {
  const pulse = useRef(new Animated.Value(1)).current;
  const intro = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    intro.setValue(0);
    Animated.spring(intro, {
      toValue: 1,
      damping: 9,
      stiffness: 120,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 820, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 820, useNativeDriver: true }),
      ]),
    );
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    floatLoop.start();
    return () => {
      loop.stop();
      floatLoop.stop();
    };
  }, [float, intro, pulse]);

  const introScale = intro.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const introY = intro.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const haloOpacity = pulse.interpolate({ inputRange: [1, 1.06], outputRange: [0.5, 0.92] });

  return (
    <Animated.View
      style={[
        styles.specialsFeraIntroStage,
        {
          opacity: intro,
          transform: [{ translateY: introY }, { scale: introScale }],
        },
      ]}
    >
      <Animated.View style={[styles.specialsFeraIntroHalo, { opacity: haloOpacity, transform: [{ scale: pulse }] }]} />
      <Animated.View style={{ transform: [{ translateY: floatY }, { scale: pulse }] }}>
        <GameCard card={{ id: SPECIALS_FERA_ID, type: 'wild' }} selected />
      </Animated.View>
    </Animated.View>
  );
}

function SpecialsSignDock({ disabled, activeOp, onPick }: { disabled: boolean; activeOp?: Operation | null; onPick: (op: Operation) => void }) {
  const entrances = useRef(SPECIALS_SIGN_OPS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    entrances.forEach((value) => value.setValue(0));
    Animated.stagger(
      90,
      entrances.map((value) =>
        Animated.spring(value, {
          toValue: 1,
          damping: 8,
          stiffness: 170,
          mass: 0.72,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [entrances]);

  return (
    <View style={styles.specialsSignDock}>
      {SPECIALS_SIGN_OPS.map((op, index) => {
        const entrance = entrances[index];
        const translateY = entrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
        const scale = entrance.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.72, 1.07, 1] });
        return (
          <Animated.View key={op} style={{ opacity: entrance, transform: [{ translateY }, { scale }] }}>
            <Pressable
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`בחר קלף סימן ${opDisplay(op)}`}
              onPress={() => onPick(op)}
              style={({ pressed }) => [
                styles.specialsSignButton,
                activeOp === op && styles.specialsSignButtonActive,
                pressed && !disabled && styles.specialsSignButtonPressed,
                disabled && styles.specialsSignButtonDisabled,
              ]}
            >
              <View pointerEvents="none" style={styles.specialsSignFace}>
                <OperatorGlyph op={op} color={activeOp === op ? '#12321D' : '#3D2A0E'} size={op === '÷' ? 42 : 40} />
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

function SpecialsNextArrow({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 520, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 520, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Pressable disabled={disabled} onPress={onPress} accessibilityRole="button" accessibilityLabel="המשך">
      <Animated.View style={[styles.specialsNextArrow, disabled && styles.specialsNextArrowDisabled, { transform: [{ scale: pulse }] }]}>
        <Text allowFontScaling={false} style={styles.specialsNextArrowText}>›</Text>
      </Animated.View>
    </Pressable>
  );
}

function SpecialsToast({ toast }: { toast: { id: number; text: string } | null }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    if (!toast) return;
    opacity.setValue(0);
    y.setValue(14);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    Animated.spring(y, { toValue: 0, damping: 10, stiffness: 160, useNativeDriver: true }).start();
  }, [opacity, toast, y]);

  if (!toast) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.specialsToast, { opacity, transform: [{ translateY: y }] }]}>
      <Text allowFontScaling={false} style={styles.specialsToastText}>{toast.text}</Text>
    </Animated.View>
  );
}

function SpecialsFlyingToken({ token, onDone }: { token: SpecialsFlyToken; onDone: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 720, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onDone();
    });
  }, [onDone, progress, token.id]);

  const targetX = token.target === 'op' ? 0 : token.target === 'left' ? -98 : token.target === 'result' ? 205 : 98;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, targetX] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -222] });
  const scale = progress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, token.kind === 'feraNumber' ? 0.72 : 1.08, 0.38] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', token.kind === 'feraNumber' ? '-6deg' : '8deg'] });
  const opacity = progress.interpolate({ inputRange: [0, 0.9, 1], outputRange: [1, 1, 0.78] });
  const flyingCard: Card =
    token.kind === 'sign'
      ? { id: `specials-flying-sign-${token.label}`, type: 'operation', operation: token.label as Operation }
      : token.kind === 'salindaSign'
      ? { id: `specials-flying-salinda-${token.label}`, type: 'salinda', operation: token.label as Operation }
      : { id: `specials-flying-fera-${token.label}`, type: 'wild', resolvedValue: Number(token.label) };

  return (
    <View pointerEvents="none" style={styles.specialsFlyingLayer}>
      <Animated.View style={[styles.specialsFlyingTokenCard, { opacity, transform: [{ translateX }, { translateY }, { rotate }, { scale }] }]}>
        <GameCard card={flyingCard} selected={token.kind === 'salindaSign'} small onPress={undefined} />
      </Animated.View>
    </View>
  );
}

function SalindaOperatorBubbles({ onPick, disabled = false }: { onPick?: (op: Operation) => void; disabled?: boolean }) {
  return (
    <View pointerEvents={onPick ? 'auto' : 'none'} style={styles.specialsBubbles}>
      {SPECIALS_SIGN_OPS.map((op) => (
        <Pressable
          key={op}
          disabled={disabled || !onPick}
          onPress={() => onPick?.(op)}
          accessibilityRole={onPick ? 'button' : undefined}
          accessibilityLabel={`בחר סימן ${opDisplay(op)}`}
          style={({ pressed }) => [styles.specialsBubble, pressed && styles.specialsBubblePressed]}
        >
          <OperatorGlyph op={op} color="#3D2A0E" size={24} />
        </Pressable>
      ))}
    </View>
  );
}

// Orbit radius (px) of the operator signs around the central Salinda card.
const SALINDA_ORBIT_RADIUS = 132;

function SalindaShowcaseIntro({
  locked,
  onLocked,
  onContinue,
}: {
  locked: boolean;
  onLocked: () => void;
  onContinue: () => void;
}) {
  // Standard RN Animated (no native Reanimated dependency — keeps Expo Go alive).
  const spin = useRef(new Animated.Value(0)).current;
  const lockProgress = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    spin.setValue(0);
    lockProgress.setValue(0);
    flash.setValue(0);
    cardScale.setValue(0.92);

    Animated.spring(cardScale, {
      toValue: 1,
      damping: 9,
      stiffness: 125,
      mass: 1,
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();

    const timer = setTimeout(() => {
      Animated.spring(lockProgress, {
        toValue: 1,
        damping: 9,
        stiffness: 160,
        mass: 1,
        useNativeDriver: true,
      }).start(() => loop.stop());
      Animated.sequence([
        Animated.spring(cardScale, { toValue: 1.08, damping: 7, stiffness: 190, mass: 1, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, damping: 8, stiffness: 150, mass: 1, useNativeDriver: true }),
      ]).start();
      Animated.timing(flash, { toValue: 1, duration: 180, useNativeDriver: true }).start(({ finished }) => {
        if (!finished) return;
        Animated.timing(flash, { toValue: 0, duration: 520, useNativeDriver: true }).start();
        onLocked();
      });
      void playSfx('complete', { cooldownMs: 0, volumeOverride: 0.72 });
    }, 2500);

    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [cardScale, flash, lockProgress, onLocked, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  // lockProgress 0→1 collapses the ring inward (radius→0) and shrinks the signs,
  // matching the original cos/sin orbit's lock-in.
  const ringScale = lockProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.0001] });
  const ringOpacity = lockProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] });
  const flashScale = flash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });

  return (
    <View style={styles.salindaIntroStage}>
      <Animated.View
        pointerEvents="none"
        style={[styles.salindaIntroFlash, { opacity: flash, transform: [{ scale: flashScale }] }]}
      />
      <View style={styles.salindaIntroOrbit}>
        <Animated.View
          pointerEvents="none"
          style={[styles.salindaIntroOrbitRing, { opacity: ringOpacity, transform: [{ rotate }, { scale: ringScale }] }]}
        >
          {SPECIALS_SIGN_OPS.map((op, index) => {
            const baseDeg = (index / SPECIALS_SIGN_OPS.length) * 360;
            return (
              <View
                key={op}
                style={[
                  styles.salindaIntroOrbitSign,
                  { transform: [{ rotate: `${baseDeg}deg` }, { translateY: -SALINDA_ORBIT_RADIUS }, { rotate: `-${baseDeg}deg` }] },
                ]}
              >
                <OperatorGlyph op={op} color="#F8E08E" size={42} />
              </View>
            );
          })}
        </Animated.View>
        <Animated.View style={[styles.salindaIntroCardWrap, { transform: [{ scale: cardScale }] }]}>
          <GameCard card={{ id: SPECIALS_SALINDA_ID, type: 'salinda' }} selected />
        </Animated.View>
      </View>
      {locked ? (
        <View style={styles.salindaIntroCta}>
          <GoldButton label="בואו נראה!" onPress={onContinue} accessibilityLabel="בואו נראה" fullWidth height={56} radius={28} fontSize={21} />
        </View>
      ) : null}
    </View>
  );
}

function SpecialsEndModal({ onFinish }: { onFinish: () => void }) {
  return (
    <View style={styles.successOverlay}>
      <View style={[styles.successCard, styles.specialsEndCard]}>
        <Text style={styles.specialsEndTitle}>היסודות והמיוחדים בידיים שלך! 🎓</Text>
        <Text style={styles.specialsEndBody}>
          עכשיו אתם מבינים את הסוד האמיתי: המשחק הוא לא רק לפתור תרגיל נכון. המשחק הוא לחפש במניפה שלכם בדיוק את הקלף שיציל אתכם... או שיהרוס ליריב את התוכניות ולהיפטר מכל הקלפים!
        </Text>
        <View style={styles.successCta}>
          <GoldButton label="הבנתי" onPress={onFinish} accessibilityLabel="הבנתי" fullWidth height={58} fontSize={22} />
        </View>
      </View>
    </View>
  );
}

function SpecialsFlow({ onComplete, onExit }: { onComplete?: () => void; onExit?: () => void }) {
  const { width: winW } = useWindowDimensions();
  const fanW = Math.min(winW, 480);
  const [state, setState] = useState<SpecialsFlowState>({
    phase: 'symbolsShowcase',
    op: null,
    leftValue: null,
    rightValue: null,
    rightCard: null,
    busy: false,
    pendingPlacement: null,
    symbolsDemoDone: false,
    salindaDemoDone: false,
    salindaIntroLocked: false,
    salindaBubblesOpen: false,
    salindaSelectorOpen: false,
    salindaSelectedOp: null,
    feraDemoDone: false,
    feraShowcaseStarted: false,
    feraShowcaseCardUsed: false,
    feraPracticeCardUsed: false,
    feraResult: null,
    feraResolvedCard: null,
    feraHand: [],
    feraDiceDone: false,
    feraArmed: false,
    showSignSuccess: false,
    showEndModal: false,
  });
  const [flyToken, setFlyToken] = useState<SpecialsFlyToken | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [bounceKey, setBounceKey] = useState(0);
  const slotPulse = useRef(new Animated.Value(0)).current;
  const flyDoneRef = useRef<(() => void) | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const symbolsDemoStarted = useRef(false);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const timer = setTimeout(fn, ms);
    timersRef.current.push(timer);
    return timer;
  }, []);

  const showToast = useCallback(() => {
    setToast({ id: Date.now(), text: SPECIALS_TOAST_TEXT });
    void playSfx('errorSoft', { cooldownMs: 0, volumeOverride: 0.45 });
  }, []);

  const beginFly = useCallback((token: Omit<SpecialsFlyToken, 'id'>, onDone: () => void) => {
    flyDoneRef.current = onDone;
    setFlyToken({ ...token, id: Date.now() });
  }, []);

  const handleFlyDone = useCallback(() => {
    const done = flyDoneRef.current;
    flyDoneRef.current = null;
    setFlyToken(null);
    done?.();
  }, []);

  const bounceEquation = useCallback(() => {
    setBounceKey((key) => key + 1);
  }, []);

  // The result-slot glow during the wild round cues "match THIS number".
  const feraAwaitingMatch =
    (state.phase === 'feraShowcase' || state.phase === 'feraPractice') && !state.feraResolvedCard;
  usePulseLoop(slotPulse, (state.pendingPlacement !== null || feraAwaitingMatch) && !state.busy, 0, 1, 500);

  const moveTo = useCallback((phase: SpecialsFlowPhase) => {
    clearTimers();
    setFlyToken(null);
    flyDoneRef.current = null;
    const symbolExercise = phase === 'symbolsPractice' ? generateSpecialsSymbolPracticeExercise() : null;
    const salindaExercise = phase === 'salindaPractice' ? generateSpecialsSalindaPracticeExercise() : null;
    const feraExercise = phase === 'feraPractice' ? generateSpecialsFeraPracticeExercise() : null;
    // Wild round: a fully-formed equation (left + right = ?) whose result the wild
    // matches. Showcase is a fixed 4 + 2 = 6 demo; practice is randomised.
    const isFeraRound = phase === 'feraShowcase' || phase === 'feraPractice';
    // Showcase operands start EMPTY: the dice storyboard rolls them in (4, then 2)
    // and the result then auto-computes & displays 6. Practice fills immediately.
    const feraLeft = phase === 'feraShowcase' ? null : feraExercise?.left ?? null;
    const feraRight = phase === 'feraShowcase' ? null : feraExercise?.right ?? null;
    const feraResult = phase === 'feraShowcase' ? 6 : feraExercise?.result ?? null;
    setState((current) => ({
      ...current,
      phase,
      op: isFeraRound ? '+' : null,
      leftValue: feraLeft ?? salindaExercise?.left ?? symbolExercise?.left ?? null,
      rightValue: feraRight ?? salindaExercise?.right ?? symbolExercise?.right ?? null,
      rightCard: null,
      busy: false,
      pendingPlacement: null,
      salindaIntroLocked: false,
      salindaBubblesOpen: false,
      salindaSelectorOpen: false,
      salindaSelectedOp: null,
      feraResult: isFeraRound ? feraResult : current.feraResult,
      feraResolvedCard: null,
      feraHand: isFeraRound ? buildFeraHand(feraResult ?? 6) : current.feraHand,
      feraDemoDone: phase === 'feraShowcase' ? false : current.feraDemoDone,
      feraShowcaseStarted: false,
      feraShowcaseCardUsed: false,
      feraPracticeCardUsed: false,
      // Only the showcase plays the dice storyboard; practice is "done" up front.
      feraDiceDone: phase === 'feraShowcase' ? false : true,
      feraArmed: false,
      showSignSuccess: false,
    }));
    bounceEquation();
  }, [bounceEquation, clearTimers]);

  const handleSymbolPick = useCallback((op: Operation) => {
    if (state.busy || state.phase !== 'symbolsPractice') return;
    if (op !== '-') {
      showToast();
      return;
    }
    setState((current) => ({ ...current, op: null, pendingPlacement: 'symbolMinus' }));
    playEquationTapSfx();
  }, [showToast, state.busy, state.phase]);

  const handleSalindaCardTap = useCallback((card: Card) => {
    if (state.busy || (state.phase !== 'salindaPractice' && state.phase !== 'salindaShowcase')) return;
    if (card.id !== SPECIALS_SALINDA_ID || card.type !== 'salinda') {
      showToast();
      return;
    }
    setState((current) => ({ ...current, salindaSelectorOpen: true }));
    void playSfx('meterCelebrateIntro', { cooldownMs: 0, volumeOverride: 0.65 });
  }, [showToast, state.busy, state.phase]);

  const handleSalindaOperatorPick = useCallback((op: Operation) => {
    if (state.busy || (state.phase !== 'salindaPractice' && state.phase !== 'salindaShowcase')) return;
    const expectedOp: Operation = state.phase === 'salindaPractice' ? 'x' : '-';
    if (op !== expectedOp) {
      showToast();
      return;
    }
    setState((current) => ({
      ...current,
      salindaSelectedOp: expectedOp,
      salindaSelectorOpen: false,
      salindaBubblesOpen: false,
      pendingPlacement: 'salindaOperator',
    }));
    void playSfx('complete', { cooldownMs: 0, volumeOverride: 0.55 });
  }, [showToast, state.busy, state.phase]);

  const placePendingSpecial = useCallback(() => {
    if (state.busy || !state.pendingPlacement) return;
    if (state.pendingPlacement === 'symbolMinus' && state.phase === 'symbolsPractice') {
      setState((current) => ({ ...current, busy: true }));
      beginFly({ kind: 'sign', label: '-', target: 'op' }, () => {
        setState((current) => ({ ...current, op: '-', pendingPlacement: null, busy: false }));
        bounceEquation();
        void playSfx('complete', { cooldownMs: 0, volumeOverride: 0.6 });
        // Celebrate the sign-card lesson before moving on to Salinda.
        schedule(() => {
          setState((current) => (current.phase === 'symbolsPractice' ? { ...current, showSignSuccess: true } : current));
          void playSfx('gameWin', { cooldownMs: 0, volumeOverride: 0.85 });
        }, 700);
      });
      return;
    }
    if (state.pendingPlacement === 'salindaOperator' && (state.phase === 'salindaShowcase' || state.phase === 'salindaPractice')) {
      const op = state.salindaSelectedOp ?? (state.phase === 'salindaPractice' ? 'x' : '-');
      setState((current) => ({ ...current, busy: true }));
      beginFly({ kind: 'salindaSign', label: op, target: 'op' }, () => {
        setState((current) => ({
          ...current,
          op,
          pendingPlacement: null,
          busy: false,
          salindaDemoDone: current.phase === 'salindaShowcase' ? true : current.salindaDemoDone,
          salindaSelectedOp: null,
        }));
        bounceEquation();
        void playSfx('complete', { cooldownMs: 0, volumeOverride: 0.62 });
      });
      return;
    }
  }, [beginFly, bounceEquation, moveTo, schedule, state.busy, state.pendingPlacement, state.phase, state.salindaSelectedOp]);

  useEffect(() => {
    if (state.phase !== 'feraShowcase' || state.feraShowcaseStarted) return;
    setState((current) => ({ ...current, feraShowcaseStarted: true }));
    // Dice storyboard: 3 dice float above the table, then die→4 and die→2 drop
    // into the operand slots and the result auto-computes & flashes 6. Only then
    // does the wild step open. Timers are swept by clearTimers() on phase change.
    schedule(() => {
      setState((c) => (c.phase === 'feraShowcase' ? { ...c, leftValue: 4 } : c));
      bounceEquation();
      void playSfx('place', { cooldownMs: 0, volumeOverride: 0.5 });
    }, 750);
    schedule(() => {
      setState((c) => (c.phase === 'feraShowcase' ? { ...c, rightValue: 2 } : c));
      bounceEquation();
      void playSfx('place', { cooldownMs: 0, volumeOverride: 0.5 });
    }, 1550);
    schedule(() => {
      setState((c) => (c.phase === 'feraShowcase' ? { ...c, feraDiceDone: true } : c));
      bounceEquation();
      void playSfx('complete', { cooldownMs: 0, volumeOverride: 0.55 });
    }, 2350);
  }, [bounceEquation, schedule, state.feraShowcaseStarted, state.phase]);

  // ── Phase 1 "Show" demo for the sign-card lesson: on entering symbolsShowcase,
  // auto-place the correct sign (+) into the operator slot of 4 _ 2 = 6 — exactly
  // what the player then does by hand in symbolsPractice. Reuses the same beginFly
  // card-flight + SFX as the practice (no new audio). Marks symbolsDemoDone when it
  // lands, which reveals the "next" arrow. Timers are swept by clearTimers.
  useEffect(() => {
    if (state.phase !== 'symbolsShowcase' || symbolsDemoStarted.current) return;
    symbolsDemoStarted.current = true;
    // Beat 1: "select" the sign card (same tap SFX the fan uses).
    schedule(() => {
      void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.5 });
    }, 650);
    // Beat 2: fly the + into the operator slot, then settle it + reveal the arrow.
    schedule(() => {
      setState((c) => (c.phase === 'symbolsShowcase' ? { ...c, busy: true } : c));
      beginFly({ kind: 'sign', label: '+', target: 'op' }, () => {
        setState((c) => (c.phase === 'symbolsShowcase' ? { ...c, op: '+', busy: false, symbolsDemoDone: true } : c));
        bounceEquation();
        void playSfx('complete', { cooldownMs: 0, volumeOverride: 0.6 });
      });
    }, 1350);
  }, [beginFly, bounceEquation, schedule, state.phase]);

  // Launch the wild to MATCH the result: it flies to the result slot (never into
  // an operand/sign slot) and becomes exactly the target number.
  const launchFera = useCallback(() => {
    if (state.busy || (state.phase !== 'feraShowcase' && state.phase !== 'feraPractice')) return;
    const result = state.feraResult ?? (state.phase === 'feraShowcase' ? 6 : 10);
    setState((current) => ({ ...current, busy: true }));
    playEquationTapSfx();
    beginFly({ kind: 'feraNumber', label: String(result), target: 'result' }, () => {
      setState((current) => ({
        ...current,
        feraArmed: false,
        feraResolvedCard: { id: `specials-resolved-fera-${result}`, type: 'wild', resolvedValue: result },
        feraDemoDone: current.phase === 'feraShowcase' ? true : current.feraDemoDone,
        feraShowcaseCardUsed: current.phase === 'feraShowcase' ? true : current.feraShowcaseCardUsed,
        feraPracticeCardUsed: current.phase === 'feraPractice' ? true : current.feraPracticeCardUsed,
        busy: current.phase === 'feraPractice', // hold input through the win beat
      }));
      bounceEquation();
      void playSfx(state.phase === 'feraPractice' ? 'gameWin' : 'complete', { cooldownMs: 0, volumeOverride: state.phase === 'feraPractice' ? 0.9 : 0.62 });
      if (state.phase === 'feraPractice') {
        schedule(() => {
          setState((current) => ({ ...current, busy: false, showEndModal: true }));
        }, 2000);
      }
    });
  }, [beginFly, bounceEquation, schedule, state.busy, state.feraResult, state.phase]);

  const handleFeraTap = useCallback((card: Card) => {
    if (state.busy || (state.phase !== 'feraPractice' && state.phase !== 'feraShowcase')) return;
    // In the showcase the wild can't be armed until the dice storyboard has rolled
    // the operands in and revealed the result.
    if (state.phase === 'feraShowcase' && !state.feraDiceDone) return;
    if (state.feraArmed) return; // already armed — the launch happens via "שגר".
    // Only the wild can win — the decoy numbers never equal the result, so a tap
    // on one is gently rejected ("try again"). Tapping the wild ARMS it; the player
    // then presses "שגר" to launch it to the result slot.
    if (card.type !== 'wild') {
      showToast();
      return;
    }
    setState((current) => ({ ...current, feraArmed: true }));
    void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.55 });
  }, [showToast, state.busy, state.feraArmed, state.feraDiceDone, state.phase]);

  const handleNext = useCallback(() => {
    if (state.busy) return;
    if (state.phase === 'symbolsShowcase' && state.symbolsDemoDone) {
      moveTo('symbolsPractice');
      return;
    }
    if (state.phase === 'symbolsPractice' && state.op) {
      moveTo('salindaIntro');
      return;
    }
    if (state.phase === 'salindaIntro' && state.salindaIntroLocked) {
      moveTo('salindaPractice');
      return;
    }
    if (state.phase === 'salindaShowcase') {
      if (state.salindaDemoDone) moveTo('salindaPractice');
      return;
    }
    if (state.phase === 'salindaPractice' && state.op) {
      moveTo('feraIntro');
      return;
    }
    if (state.phase === 'feraIntro') {
      moveTo('feraShowcase');
      return;
    }
    if (state.phase === 'feraShowcase' && state.feraDemoDone) {
      moveTo('feraPractice');
    }
  }, [moveTo, state.busy, state.feraDemoDone, state.op, state.phase, state.salindaDemoDone, state.salindaIntroLocked, state.symbolsDemoDone]);

  const handleSalindaIntroLocked = useCallback(() => {
    setState((current) => current.phase === 'salindaIntro' ? { ...current, salindaIntroLocked: true } : current);
  }, []);

  const finishSpecials = useCallback(() => {
    onComplete?.();
    onExit?.();
  }, [onComplete, onExit]);

  // Dismiss the sign-card celebration and continue into the Salinda lesson.
  const dismissSignSuccess = useCallback(() => {
    moveTo('salindaIntro');
  }, [moveTo]);

  const equation = getSpecialsEquation(state);
  const instruction = getSpecialsInstruction(state);
  const showNext =
    state.pendingPlacement === null &&
    ((state.phase === 'symbolsShowcase' && state.symbolsDemoDone) ||
      // symbolsPractice advances via the sign-card celebration overlay, not an arrow.
      (state.phase === 'salindaShowcase' && state.salindaDemoDone) ||
      (state.phase === 'salindaPractice' && state.op !== null) ||
      state.phase === 'feraIntro' ||
      (state.phase === 'feraShowcase' && state.feraDemoDone));
  const hand =
    state.phase === 'symbolsShowcase' || state.phase === 'symbolsPractice'
      ? SPECIALS_SIGN_CARDS
      : state.phase === 'salindaShowcase'
      ? SPECIALS_SALINDA_SHOWCASE_HAND
      : state.phase === 'salindaPractice'
      ? SPECIALS_SALINDA_PRACTICE_HAND
      : state.phase === 'feraShowcase'
      ? state.feraShowcaseCardUsed
        ? state.feraHand.filter((card) => card.type !== 'wild')
        : state.feraHand
      : state.phase === 'feraPractice'
      ? state.feraPracticeCardUsed
        ? state.feraHand.filter((card) => card.type !== 'wild')
        : state.feraHand
      : [];
  const displayHand = useMemo(
    () => hand.map((card) => (card.id === SPECIALS_SALINDA_ID && state.salindaSelectedOp ? { ...card, operation: state.salindaSelectedOp } : card)),
    [hand, state.salindaSelectedOp],
  );
  const selectedIds = useMemo(() => {
    // During the showcase demo, highlight the correct (+) sign until it's placed.
    if (state.phase === 'symbolsShowcase' && state.op === null) {
      const plusCard = SPECIALS_SIGN_CARDS.find((card) => card.operation === '+');
      return plusCard ? new Set([plusCard.id]) : new Set<string>();
    }
    if (state.phase === 'symbolsPractice' && (state.pendingPlacement === 'symbolMinus' || state.op)) {
      const selectedSignCard = SPECIALS_SIGN_CARDS.find((card) => card.operation === (state.op ?? '-'));
      return selectedSignCard ? new Set([selectedSignCard.id]) : new Set<string>();
    }
    if ((state.phase === 'salindaShowcase' || state.phase === 'salindaPractice') && (state.salindaSelectorOpen || state.pendingPlacement === 'salindaOperator' || state.op)) {
      return new Set([SPECIALS_SALINDA_ID]);
    }
    if (state.phase === 'feraIntro' || state.phase === 'feraShowcase' || state.phase === 'feraPractice') {
      return new Set([SPECIALS_FERA_ID]);
    }
    return new Set<string>();
  }, [state.op, state.pendingPlacement, state.phase, state.salindaSelectorOpen]);
  const showFeraIntroCenter = state.phase === 'feraIntro';
  const showSalindaIntroCenter = state.phase === 'salindaIntro';

  return (
    <View style={styles.root}>
      <InstructionBanner text={instruction} />
      {showSalindaIntroCenter ? (
        // Salinda intro — full play area, card centered, "בואו נראה!" CTA self-pinned.
        <View style={styles.specialsIntroCenter}>
          <SalindaShowcaseIntro locked={state.salindaIntroLocked} onLocked={handleSalindaIntroLocked} onContinue={handleNext} />
        </View>
      ) : showFeraIntroCenter ? (
        // The Wild ("פרא") intro card — centered, at the same height as Salinda.
        <View style={styles.specialsIntroCenter}>
          <SpecialsFeraIntroCard />
        </View>
      ) : (
        // ── Deterministic board column. Every band keeps a FIXED height (or reserves
        //    its slot when empty) so the table and the fan sit in the EXACT same spot
        //    in every step; a single flex spacer absorbs all screen-height slack. The
        //    paddingTop clears the absolute instruction banner so nothing hides under
        //    it. (Uses LOCAL styles — the shared playArea/tableZone are untouched.) ──
        <View style={styles.specialsStage}>
          {/* (1) Dice band — reserved in every phase (keeps the table Y identical);
           *     the 3 storyboard dice render only in the fera showcase. */}
          <View style={styles.specialsDiceBand} pointerEvents="none">
            {state.phase === 'feraShowcase' ? (
              <View style={styles.specialsFeraDiceRow}>
                {[
                  { v: 4, used: state.leftValue != null },
                  { v: 2, used: state.rightValue != null },
                  { v: 5, used: false },
                ].map((d, i) => (
                  <View key={i} style={[styles.specialsFeraDie, d.used && styles.specialsFeraDieUsed]}>
                    <GoldDieFace value={d.v} size={42} />
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {/* (2) Table — LOCKED dimensions + vertical position, identical every step. */}
          <View style={styles.specialsTableZone}>
            <Image source={GOLD_TABLE_IMG} resizeMode="contain" style={styles.tableImg} />
            <View style={styles.tableOverlay} pointerEvents="box-none">
              <View style={styles.specialsBoardContent}>
                {equation ? (
                  <SpecialsEquation
                    left={equation.left}
                    op={equation.op}
                    right={equation.right}
                    rightCard={state.rightCard}
                    result={equation.result}
                    resultCard={state.feraResolvedCard}
                    resultHidden={state.phase === 'feraShowcase' && !state.feraDiceDone && !state.feraResolvedCard}
                    resultSlotReady={((state.phase === 'feraShowcase' && state.feraDiceDone) || state.phase === 'feraPractice') && !state.feraResolvedCard && !state.busy}
                    bounceKey={bounceKey}
                    opSlotReady={(state.pendingPlacement === 'symbolMinus' || state.pendingPlacement === 'salindaOperator') && !state.busy}
                    rightSlotReady={state.pendingPlacement === 'feraNumber' && !state.busy}
                    pulse={slotPulse}
                    onPressOpSlot={placePendingSpecial}
                    onPressRightSlot={placePendingSpecial}
                  />
                ) : null}
              </View>
            </View>
          </View>

          {/* (3) Flex spacer — soaks up all slack so the launch slot + fan stay pinned
           *     to the bottom band on any screen height. */}
          <View style={styles.specialsSpacer} pointerEvents="none" />

          {/* (4) Launch slot — a reserved fixed-height gap directly above the fan so
           *     the fan NEVER shifts. The "שגר" button inherits the same GoldButton
           *     config as the tutorial nav buttons and appears here once armed. */}
          <View style={styles.specialsLaunchSlot} pointerEvents="box-none">
            {(state.phase === 'feraShowcase' || state.phase === 'feraPractice') && state.feraArmed && !state.feraResolvedCard ? (
              <GoldButton label="שגר" onPress={launchFera} accessibilityLabel="שגר" fullWidth height={56} fontSize={22} radius={28} />
            ) : null}
          </View>

          {/* (5) Hand fan — pinned to the bottom band. */}
          <View style={[styles.specialsFanWrap, { width: fanW }]}>
            {(state.salindaBubblesOpen || state.salindaSelectorOpen) ? (
              <SalindaOperatorBubbles onPick={state.salindaSelectorOpen ? handleSalindaOperatorPick : undefined} disabled={state.busy} />
            ) : null}
            <HandFan
              cards={displayHand}
              width={fanW}
              selectedIds={selectedIds}
              smoothDrag={state.phase === 'feraShowcase' || state.phase === 'feraPractice'}
              onTapCard={
                state.phase === 'symbolsPractice'
                  ? (card) => {
                      if (card.type === 'operation' && card.operation) handleSymbolPick(card.operation);
                    }
                  : state.phase === 'salindaPractice' || state.phase === 'salindaShowcase'
                  ? handleSalindaCardTap
                  : state.phase === 'feraPractice' || state.phase === 'feraShowcase'
                  ? handleFeraTap
                  : undefined
              }
              canTap={(card) =>
                state.phase === 'symbolsPractice'
                  ? card.type === 'operation' && state.pendingPlacement !== 'symbolMinus'
                  : state.phase === 'salindaPractice' || state.phase === 'salindaShowcase'
                  ? card.id === SPECIALS_SALINDA_ID && state.pendingPlacement !== 'salindaOperator' && !state.op
                  : state.phase === 'feraShowcase'
                  ? state.feraDiceDone && !state.busy && !state.feraShowcaseCardUsed && !state.feraArmed
                  : state.phase === 'feraPractice'
                  ? !state.busy && !state.feraPracticeCardUsed && !state.feraArmed
                  : false
              }
              centerCardId={
                state.phase === 'symbolsShowcase' || state.phase === 'symbolsPractice'
                  ? SPECIALS_SIGN_CARDS.find((card) => card.operation === '-')?.id ?? null
                  : state.phase === 'salindaShowcase' || state.phase === 'salindaPractice'
                  ? SPECIALS_SALINDA_ID
                  : state.phase === 'feraShowcase' || state.phase === 'feraPractice'
                  ? SPECIALS_FERA_ID
                  : null
              }
            />
          </View>
        </View>
      )}

      {showNext ? (
        <View style={styles.specialsArrowWrap}>
          <SpecialsNextArrow onPress={handleNext} disabled={state.busy} />
        </View>
      ) : null}

      {flyToken ? <SpecialsFlyingToken token={flyToken} onDone={handleFlyDone} /> : null}
      <SpecialsToast toast={toast} />
      {state.showSignSuccess ? (
        <SuccessCelebration
          title={SPECIALS_SIGN_SUCCESS_TITLE}
          subtitle={SPECIALS_SIGN_SUCCESS_TEXT}
          ctaLabel="המשך"
          onDone={dismissSignSuccess}
        />
      ) : null}
      {state.showEndModal ? <SpecialsEndModal onFinish={finishSpecials} /> : null}
    </View>
  );
}

function OperatorCardsLesson({
  onComplete,
  onExit,
  startStep = 'signIntro',
}: {
  onComplete?: () => void;
  onExit?: () => void;
  startStep?: SpecialsStepId;
}) {
  const copy = useGoldRoomCopy();
  const { width: winW } = useWindowDimensions();
  const fanW = Math.min(winW, 480);
  const [fractionStages] = useState<FractionLessonStage[]>(buildFractionLessonStages);
  const [fractionStageIndex, setFractionStageIndex] = useState(0);
  const [pendingHotPotatoStage, setPendingHotPotatoStage] = useState<FractionLessonStage | null>(null);
  const [step, setStep] = useState<SpecialsStepId>(startStep);
  // A fresh randomised fraction exercise per mount — every time the learner opens
  // the fraction module they get a different fraction + numbers.
  const [hand, setHand] = useState<Card[]>(() => initialHandForStep(startStep, fractionStages));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [signPlaced, setSignPlaced] = useState(false);
  const [salindaOp, setSalindaOp] = useState<Operation | null>(null);
  const [salindaPlaced, setSalindaPlaced] = useState(false);
  const [salindaModalOpen, setSalindaModalOpen] = useState(false);
  const [wildPlaced, setWildPlaced] = useState(false);
  // Fraction defense path: 'math' = solved with a divisible number, 'roll' =
  // rolled over with another fraction.
  const [fractionPath, setFractionPath] = useState<'math' | 'roll' | null>(null);
  const [resolving, setResolving] = useState(false);
  const [flyingCard, setFlyingCard] = useState<Card | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const slotPulse = useRef(new Animated.Value(0)).current;
  const buttonPulse = useRef(new Animated.Value(1)).current;
  const fanHalo = useRef(new Animated.Value(0)).current;

  const fractionStage = fractionStages[fractionStageIndex] ?? fractionStages[0];
  const selectedCard = useMemo(() => hand.find((card) => card.id === selectedId) ?? null, [hand, selectedId]);
  // In the opening showcase the plus card is highlighted (gold border) as a
  // preview; otherwise the highlight follows the player's current selection.
  const selectedIds = useMemo(
    () => (step === 'signIntro' ? new Set([SIGN_INTRO_PLUS_ID]) : selectedId ? new Set([selectedId]) : new Set<string>()),
    [selectedId, step],
  );
  // Paint the chosen sign onto the Salinda card the moment it's picked, so the
  // fan card visibly "charges" before it's slotted.
  const displayHand = useMemo(
    () => hand.map((card) => (card.id === SALINDA_CARD_ID && salindaOp ? { ...card, operation: salindaOp } : card)),
    [hand, salindaOp],
  );

  const signSlotReady = step === 'sign' && selectedId === SIGN_PLUS_ID && !signPlaced && !resolving;
  const signTargetSelected = step === 'sign' && signPlaced && selectedId === SIGN_TARGET_ID;
  const salindaSlotReady = step === 'salinda' && salindaOp === GOLD_ROOM_SALINDA_EXERCISE.op && !salindaPlaced && !resolving;
  const salindaTargetSelected = step === 'salinda' && salindaPlaced && selectedId === SALINDA_TARGET_ID;
  const wildReady = step === 'wild' && wildPlaced && !resolving;
  // ── Fraction steps. Choosing the matching hand card arms the main "שגר" button.
  const isFractionAttack = step === 'fractionAttack';
  const isFractionDefense = step === 'fractionDefense';
  const isFractionPractice = isFractionAttack || isFractionDefense;
  const fractionAttackReady = isFractionAttack && selectedId === fractionStage.answerId && !resolving;
  const fractionDefenseReady =
    isFractionDefense && selectedCard !== null && isValidFractionStageCard(selectedCard, fractionStage) && !resolving;
  const launchReady = signTargetSelected || salindaTargetSelected || wildReady || fractionAttackReady || fractionDefenseReady;
  // The opening showcase: present every sign card before the practice begins.
  const isIntro = step === 'signIntro' || step === 'fractionIntro';
  // The hand card the learner taps to "charge" the special: a glowing halo cues
  // the sign cards (showcase + substep 1) / Salinda (substep 2) / wild (substep 3).
  const showFanHalo =
    isIntro ||
    (step === 'sign' && !signPlaced && selectedId !== SIGN_PLUS_ID) ||
    (step === 'salinda' && !salindaOp) ||
    (step === 'wild' && !wildPlaced) ||
    (isFractionAttack && !selectedId) ||
    (isFractionDefense && !selectedId);

  // Drives the operator-slot glow (substeps 1-2, while a sign is armed) and the
  // result-slot glow (substep 3, once the wild has filled the missing 8).
  usePulseLoop(slotPulse, signSlotReady || salindaSlotReady || (step === 'wild' && wildPlaced), 0, 1, 520);
  // The central action button stays "awake" (lit + gently pulsing) whenever it is
  // waiting on the learner — including the "בחר קלפים" guidance state — so it never
  // reads as an inert, greyed-out control.
  usePulseLoop(buttonPulse, !resolving, 1, 1.055, 460);
  usePulseLoop(fanHalo, showFanHalo && !resolving, 0, 1, 720);

  const goToStep = useCallback((next: SpecialsStepId) => {
    setStep(next);
    setSelectedId(null);
    setResolving(false);
    setFlyingCard(null);
    setSalindaModalOpen(false);
    setFractionPath(null);
    setSignPlaced(false);
    setSalindaOp(null);
    setSalindaPlaced(false);
    setWildPlaced(false);
    if (next === 'sign') setHand(SIGN_HAND);
    else if (next === 'salinda') setHand(SALINDA_HAND);
    else if (next === 'feraShowcase') setHand(WILD_HAND);
    else if (next === 'wild') setHand(WILD_HAND);
    else if (next === 'challengeShowcase') setHand(fractionStage.hand);
    else if (next === 'fractionAttack' || next === 'fractionDefense') setHand(fractionStage.hand);
  }, [fractionStage.hand]);

  const instructionText = useMemo(() => {
    if (step === 'signIntro') return copy.signCardsShowcase;
    if (step === 'sign') {
      // Gameplay: sharp, actionable prompts (the player already learned the cards).
      //   • a sign is selected (and blinking the slot) → tell them where to place it
      //   • the operator is placed → the existing "now pick the matching card" line
      //   • nothing selected yet → tell them to pick a sign from the fan
      if (signPlaced) return copy.operatorReady;
      if (selectedId === SIGN_PLUS_ID) return copy.signSelectPlace;
      return copy.signSelectPrompt;
    }
    if (step === 'salinda') {
      if (salindaModalOpen) return copy.salindaSeqSelectorBody;
      if (salindaPlaced) return copy.salindaSeqReady;
      return copy.salindaSeqIntro;
    }
    if (step === 'fractionIntro') return copy.fractionShowcase;
    if (step === 'fractionAttack') {
      return interpolateCopy(copy.fractionAttackIntro, {
        fraction: FRACTION_GLYPH[fractionStage.fraction],
        number: fractionStage.pile,
      });
    }
    if (step === 'fractionDefense') {
      if (fractionPath === 'math') return copy.fractionDefenseMathReady;
      if (fractionPath === 'roll') return copy.fractionDefenseRollReady;
      if (fractionStage.instructionText) return fractionStage.instructionText;
      // Title + sub-instruction; the divisible-number hint now lives on the button.
      return `אותגרת!\n${copy.fractionDefensePick}`;
    }
    return wildPlaced ? copy.wildReady : copy.wildIntro;
  }, [copy, fractionPath, fractionStage.fraction, fractionStage.instructionText, fractionStage.pile, salindaModalOpen, salindaPlaced, selectedId, signPlaced, step, wildPlaced]);

  const actionLabel = isIntro ? copy.specialsLetsPractice : launchReady ? copy.launch : copy.chooseCards;

  const canTapCard = useCallback((card: Card) => {
    if (resolving || salindaModalOpen || step === 'signIntro' || step === 'fractionIntro') return false;
    if (step === 'sign') {
      if (!signPlaced) return card.id === SIGN_PLUS_ID;
      return card.id === SIGN_TARGET_ID;
    }
    if (step === 'salinda') {
      if (!salindaOp) return card.id === SALINDA_CARD_ID;
      if (!salindaPlaced) return false;
      return card.id === SALINDA_TARGET_ID;
    }
    if (step === 'fractionAttack') return true;
    if (step === 'fractionDefense') {
      return true;
    }
    return !wildPlaced && card.id === WILD_CARD_ID;
  }, [fractionStage, resolving, salindaModalOpen, salindaOp, salindaPlaced, signPlaced, step, wildPlaced]);

  const tapCard = useCallback((card: Card) => {
    if (!canTapCard(card)) return;
    // Substep 2: tapping the Salinda opens the 4-sign chooser.
    if (step === 'salinda' && card.id === SALINDA_CARD_ID) {
      setSelectedId(card.id);
      setSalindaModalOpen(true);
      void playSfx('meterCelebrateIntro', { cooldownMs: 0, volumeOverride: 0.72 });
      return;
    }
    // Substep 3: tapping the wild resolves it into the missing 8 (in the hand and
    // as the card that will fly out on launch).
    if (step === 'wild' && card.id === WILD_CARD_ID) {
      void playSfx('complete', { cooldownMs: 0, volumeOverride: 0.6 });
      setWildPlaced(true);
      setHand((cards) => cards.map((c) => (c.id === WILD_CARD_ID ? { id: c.id, type: 'number', value: WILD_RESULT } : c)));
      setSelectedId(WILD_CARD_ID);
      return;
    }
    // Substep 1: tapping the plus card arms it (a click), so the empty slot glows.
    if (step === 'sign' && card.id === SIGN_PLUS_ID) {
      setSelectedId(card.id);
      playEquationTapSfx();
      return;
    }
    // Fraction steps: tapping a matching card arms the main "שגר" button.
    if (step === 'fractionAttack') {
      if (isValidFractionStageCard(card, fractionStage)) {
        setSelectedId(card.id);
        playEquationTapSfx();
      } else {
        setSelectedId(null);
        void playSfx('errorSoft', { cooldownMs: 0, volumeOverride: 0.42 });
      }
      return;
    }
    if (step === 'fractionDefense') {
      if (isValidFractionStageCard(card, fractionStage)) {
        setSelectedId(card.id);
        setFractionPath(card.type === 'number' ? 'math' : 'roll');
        playEquationTapSfx();
      } else {
        setSelectedId(null);
        setFractionPath(null);
        void playSfx('errorSoft', { cooldownMs: 0, volumeOverride: 0.42 });
      }
      return;
    }
    setSelectedId((cur) => (cur === card.id ? null : card.id));
  }, [canTapCard, fractionStage, step]);

  const chooseSalindaOperator = useCallback((op: Operation) => {
    // Only subtraction solves 5 - 2 = 3; everything else softly bounces.
    if (op !== GOLD_ROOM_SALINDA_EXERCISE.op) {
      void playSfx('errorSoft', { cooldownMs: 0, volumeOverride: 0.5 });
      return;
    }
    setSalindaOp(GOLD_ROOM_SALINDA_EXERCISE.op);
    setSalindaModalOpen(false);
    void playSfx('complete', { cooldownMs: 0, volumeOverride: 0.55 });
  }, []);

  const placeOperator = useCallback(() => {
    if (signSlotReady) {
      playEquationTapSfx();
      setHand((cards) => cards.filter((card) => card.id !== SIGN_PLUS_ID));
      setSelectedId(null);
      setSignPlaced(true);
      return;
    }
    if (salindaSlotReady) {
      playEquationTapSfx();
      setHand((cards) => cards.filter((card) => card.id !== SALINDA_CARD_ID));
      setSelectedId(null);
      setSalindaPlaced(true);
    }
  }, [salindaSlotReady, signSlotReady]);

  // Fractions launch from the main action button after the player chooses the
  // correct hand card; the center pile is not a tap target.
  const launch = useCallback(() => {
    // In the opening showcase the button just advances into the first practice.
    if (isIntro) {
      void playSfx('transition', { cooldownMs: 0, volumeOverride: 0.4 });
      if (step === 'fractionIntro') setFractionStageIndex(0);
      goToStep(step === 'fractionIntro' ? 'fractionAttack' : 'sign');
      return;
    }
    if (resolving || !launchReady) return;
    const launched = selectedCard ?? getSpecialsFallbackLaunchCard(step, wildPlaced);
    if (!launched) return;
    if (isFractionAttack) playEquationTapSfx();
    setResolving(true);
    setFlyingCard(launched);
    // In the fraction steps the solution card visibly leaves the hand as it flies.
    if (isFractionAttack || isFractionDefense) setHand((cards) => cards.filter((c) => c.id !== launched.id));
  }, [goToStep, isFractionAttack, isFractionDefense, isIntro, launchReady, resolving, selectedCard, step, wildPlaced]);

  // The matched card finished its 700ms flight: advance to the next substep, or —
  // after the wild — mark the task done and show the in-room win celebration.
  // "מיוחדים": sign (+) → Salinda (-) → Wild (+). Fractions: attack → defense.
  const handleFlyingDone = useCallback(() => {
    if (step === 'sign') {
      goToStep('salinda');
    } else if (step === 'salinda') {
      goToStep('feraShowcase');
    } else if (isFractionPractice) {
      const nextIndex = fractionStageIndex + 1;
      if (nextIndex < fractionStages.length) {
        const nextStage = fractionStages[nextIndex];
        setFractionStageIndex(nextIndex);
        if (fractionStage.id === 'fraction-defense-block-basic' && nextStage.id === 'fraction-defense-hot-potato') {
          setPendingHotPotatoStage(nextStage);
          setResolving(false);
          setFlyingCard(null);
          setSelectedId(null);
          setFractionPath(null);
          return;
        }
        setStep(nextStage.id === 'fraction-defense-block-basic' ? 'challengeShowcase' : stepForFractionStage(nextStage));
        setSelectedId(null);
        setResolving(false);
        setFlyingCard(null);
        setFractionPath(null);
        setHand(nextStage.hand);
      } else {
        onComplete?.();
        setShowSuccess(true);
      }
    } else {
      // wild (operators lesson) → finish.
      onComplete?.();
      setShowSuccess(true);
    }
  }, [fractionStage.id, fractionStageIndex, fractionStages, goToStep, isFractionPractice, onComplete, step]);

  const continueFromHotPotatoModal = useCallback(() => {
    const nextStage = pendingHotPotatoStage;
    if (!nextStage) return;
    setPendingHotPotatoStage(null);
    setStep(stepForFractionStage(nextStage));
    setSelectedId(null);
    setResolving(false);
    setFlyingCard(null);
    setFractionPath(null);
    setHand(nextStage.hand);
  }, [pendingHotPotatoStage]);

  const fanScale = fanHalo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const fanHaloOpacity = fanHalo.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.84] });
  const fractionGuidedCenterId = fractionStage.level === 1 ? fractionStage.answerId : null;

  const fanCenterCardId =
    step === 'fractionIntro'
      ? null
      : step === 'signIntro'
      ? SIGN_INTRO_PLUS_ID
      : step === 'sign'
        ? signPlaced
          ? SIGN_TARGET_ID
          : SIGN_PLUS_ID
        : step === 'salinda'
          ? salindaPlaced
            ? SALINDA_TARGET_ID
            : SALINDA_CARD_ID
            : step === 'wild'
              ? WILD_CARD_ID
              : isFractionPractice
              ? selectedId ?? fractionGuidedCenterId
              : null;

  // The opening showcase: all four signs as a 2×2 grid of 3D buttons on the board.
  const showcaseTrack = <SignShowcaseGrid />;

  // The fraction opening showcase: every fraction card laid out as a row on the
  // board, so the learner sees them before the attack/defense practice.
  const fractionShowcaseTrack = (
    <View style={styles.fractionShowcaseRow}>
      {FRACTION_SHOWCASE_KINDS.map((fr) => (
        <View key={fr} style={styles.fractionShowcaseCard}>
          <GameCard card={{ id: `frac-show-${fr}`, type: 'fraction', fraction: fr }} small onPress={undefined} />
        </View>
      ))}
    </View>
  );

  if (step === 'feraShowcase') {
    return <FeraShowcaseScreen onContinue={() => goToStep('wild')} />;
  }
  if (step === 'challengeShowcase') {
    return <ChallengeShowcaseScreen onContinue={() => goToStep('fractionDefense')} />;
  }

  // The center-pile marker: defense starts under the round's live fraction
  // challenge; solving with the divisible number clears it (✓), rolling over swaps
  // the marker to the roll fraction. Attack has no marker (a clean number to throw
  // onto). The pile NUMBER also comes from the random round.
  const pileMarker: Fraction | null = isFractionDefense
    ? fractionPath === 'math'
      ? null
      : fractionPath === 'roll' && selectedCard?.type === 'fraction'
      ? selectedCard.fraction ?? null
      : fractionStage.fraction
    : null;
  const pileCleared = isFractionDefense && fractionPath === 'math';
  const pileBase = fractionStage.pile;
  const resolvedPileCard =
    isFractionDefense && fractionPath === 'math' && selectedCard?.type === 'number'
      ? selectedCard
      : null;

  const track =
    isFractionAttack || isFractionDefense ? (
      <FractionCenterPile
        base={pileBase}
        marker={pileMarker}
        cleared={pileCleared}
        resolvedCard={resolvedPileCard}
        glow={false}
        pulse={slotPulse}
      />
    ) : step === 'fractionIntro' ? (
      fractionShowcaseTrack
    ) : step === 'signIntro' ? (
      showcaseTrack
    ) : step === 'wild' ? (
      <WildEquationTrack left={6} right={2} op="+" result={WILD_RESULT} filled={wildPlaced} pulse={slotPulse} />
    ) : step === 'salinda' ? (
      <SpecialEquationTrack
        left={GOLD_ROOM_SALINDA_EXERCISE.left}
        right={GOLD_ROOM_SALINDA_EXERCISE.right}
        op={GOLD_ROOM_SALINDA_EXERCISE.op}
        result={GOLD_ROOM_SALINDA_EXERCISE.result}
        operatorInserted={salindaPlaced}
        operatorReady={salindaSlotReady}
        pulse={slotPulse}
        onPlaceOperator={placeOperator}
        resultGlow={salindaTargetSelected}
        salindaOperator
      />
    ) : (
      <SpecialEquationTrack
        left={5}
        right={2}
        op="+"
        result={7}
        operatorInserted={signPlaced}
        operatorReady={signSlotReady}
        pulse={slotPulse}
        onPlaceOperator={placeOperator}
        resultGlow={signTargetSelected}
      />
    );

  // Defense action buttons — built by MAPPING over the live hand, so they only ever
  // offer defenses the player actually holds (e.g. no "שבץ 8" without an 8). When no
  // defense exists, a single generic "choose a defense card" button is shown.
  if (pendingHotPotatoStage) return <HotPotatoModal onContinue={continueFromHotPotatoModal} />;
  if (showSuccess) {
    const isEnglish = copy.fractionsTitle === 'Fractions';
    return (
      <SuccessCelebration
        onDone={onExit}
        title={isFractionPractice ? (isEnglish ? 'Fractions cleared!' : 'השברים הושלמו!') : undefined}
        subtitle={
          isFractionPractice
            ? isEnglish
              ? 'You solved the final challenge. Tap Finish to return to the Gold Room.'
              : 'פתרתם את אתגר השברים האחרון. לחצו סיום כדי לחזור לחדר הזהב.'
            : undefined
        }
      />
    );
  }

  if (step === 'salinda') {
    return (
      <SalindaCardFlow
        onExit={onExit ?? (() => undefined)}
        onComplete={() => undefined}
        onContinueNext={() => goToStep('feraShowcase')}
      />
    );
  }

  return (
    <SpecialsBoard
      instruction={instructionText}
      resolving={resolving}
      dice={step === 'sign' ? SIGN_STEP_DICE : undefined}
      track={track}
      button={(
        <Animated.View style={[styles.fixedActionWrap, { transform: [{ scale: buttonPulse }] }]}>
          <GoldButton
            label={actionLabel}
            onPress={launch}
            disabled={!isIntro && !launchReady}
            fullWidth
            height={SEND_BUTTON_HEIGHT}
            radius={SEND_BUTTON_RADIUS}
            raise={SEND_BUTTON_RAISE}
            fontSize={SEND_BUTTON_FONT_SIZE}
            textStyle={styles.fixedActionText}
            accessibilityLabel={actionLabel}
          />
        </Animated.View>
      )}
      fan={(
        <Animated.View style={{ width: fanW, transform: [{ scale: showFanHalo ? fanScale : isFractionPractice ? 1.12 : 1 }] }}>
          {showFanHalo ? <FanFocusHalo width={fanW} opacity={fanHaloOpacity} /> : null}
          <HandFan
            cards={displayHand}
            width={fanW}
            selectedIds={selectedIds}
            // The opening showcase has no tappable cards — run the fan in preview
            // mode (no onTapCard) so it grabs a swipe immediately and the learner
            // can freely browse all four sign cards.
            onTapCard={isIntro ? undefined : tapCard}
            canTap={isIntro ? undefined : canTapCard}
            centerCardId={fanCenterCardId}
          />
        </Animated.View>
      )}
      selector={salindaModalOpen ? (
        <SalindaOperatorSelector
          title={copy.salindaSelectorTitle}
          body={copy.salindaSeqSelectorBody}
          onPick={chooseSalindaOperator}
          onClose={() => setSalindaModalOpen(false)}
        />
      ) : null}
      overlay={flyingCard ? <FlyingSpecialCard card={flyingCard} onDone={handleFlyingDone} variant={isFractionAttack || isFractionDefense ? 'fraction' : 'card'} /> : null}
    />
  );
}
// ── The intro practice as TWO active, build-it-yourself rounds. Nothing is
// pre-filled: the dice land in the pool UNSELECTED and the learner taps the
// first die → the operator → the second die → the matching hand card, in strict
// order. Each step is rigged so only the "correct" next tap responds.
// The mandatory path is plus → minus; the OPTIONAL bonus path is mul → div.
type PracticeStepId = 'plus' | 'minus' | 'mul' | 'div';
const MANDATORY_STEPS = 2; // plus + minus → reward, then the optional choice
interface PracticeStepConfig {
  dice: [number, number, number]; // the three landed dice (two used + one decoy)
  firstIdx: number; // pool index of the first die to tap
  secondIdx: number; // pool index of the second die to tap
  op: Operation; // + / − (mandatory) or × / ÷ (optional bonus)
  result: number;
  targetId: string; // the hand card whose value matches the result
  hand: Card[];
}
const PLUS_TARGET_ID = 'practice-plus-6';
const PLUS_TARGET_9_ID = 'practice-plus-9';
const PLUS_TARGET_11_ID = 'practice-plus-11';
const MINUS_TARGET_ID = 'practice-minus-3';
const MUL_TARGET_ID = 'practice-mul-6';
const DIV_TARGET_ID = 'practice-div-3';
const PENALTY_DRAW_PILE: Card[] = [
  { id: 'discard-helper-penalty-8', type: 'number', value: 8 },
  { id: 'discard-helper-penalty-11', type: 'number', value: 11 },
  { id: 'discard-helper-penalty-14', type: 'number', value: 14 },
  { id: 'discard-helper-penalty-5', type: 'number', value: 5 },
];
const PRACTICE_CONFIG: Record<PracticeStepId, PracticeStepConfig> = {
  plus: {
    dice: [2, 4, 5],
    firstIdx: 0, // 2
    secondIdx: 1, // 4
    op: '+',
    result: 6,
    targetId: PLUS_TARGET_ID,
    hand: [
      { id: PLUS_TARGET_9_ID, type: 'number', value: 9 },
      { id: PLUS_TARGET_ID, type: 'number', value: 6 },
      { id: PLUS_TARGET_11_ID, type: 'number', value: 11 },
      { id: 'practice-plus-3', type: 'number', value: 3 },
      { id: 'practice-plus-12', type: 'number', value: 12 },
      { id: 'practice-plus-15', type: 'number', value: 15 },
      { id: 'practice-plus-8', type: 'number', value: 8 },
    ],
  },
  minus: {
    dice: [5, 2, 1],
    firstIdx: 0, // 5
    secondIdx: 1, // 2
    op: '-',
    result: 3,
    targetId: MINUS_TARGET_ID,
    hand: [
      { id: 'practice-minus-9', type: 'number', value: 9 },
      { id: MINUS_TARGET_ID, type: 'number', value: 3 },
      { id: 'practice-minus-12', type: 'number', value: 12 },
    ],
  },
  // ── Optional bonus path ──
  mul: {
    dice: [3, 2, 5],
    firstIdx: 0, // 3
    secondIdx: 1, // 2
    op: 'x',
    result: 6,
    targetId: MUL_TARGET_ID,
    hand: [
      { id: 'practice-mul-9', type: 'number', value: 9 },
      { id: MUL_TARGET_ID, type: 'number', value: 6 },
      { id: 'practice-mul-4', type: 'number', value: 4 },
      { id: 'practice-mul-12', type: 'number', value: 12 },
    ],
  },
  div: {
    dice: [6, 2, 5],
    firstIdx: 0, // 6
    secondIdx: 1, // 2
    op: '÷',
    result: 3,
    targetId: DIV_TARGET_ID,
    hand: [
      { id: 'practice-div-9', type: 'number', value: 9 },
      { id: DIV_TARGET_ID, type: 'number', value: 3 },
      { id: 'practice-div-12', type: 'number', value: 12 },
    ],
  },
};

// Seeded "possible result" mini-cards per practice step (illustrative, easily editable).
const DISCARD_OPTIONS: Record<PracticeStepId, DiscardOption[]> = {
  plus: [
    { value: 6, equation: '(2 + 4) = 6', dice: [2, 4], targetId: PLUS_TARGET_ID },
    { value: 9, equation: '(4 + 5) = 9', dice: [4, 5], targetId: PLUS_TARGET_9_ID },
    { value: 11, equation: '(2 + 4 + 5) = 11', dice: [2, 4, 5], targetId: PLUS_TARGET_11_ID },
  ],
  minus: [
    { value: 3, equation: '(5 - 2) = 3' },
    { value: 4, equation: '(5 - 2 + 1) = 4' },
  ],
  mul: [
    { value: 6, equation: '3 × 2 = 6' },
    { value: 30, equation: '3 × 2 × 5 = 30' },
  ],
  div: [
    { value: 3, equation: '6 ÷ 2 = 3' },
    { value: 8, equation: '6 ÷ 2 + 5 = 8' },
  ],
};

type LifelineScreen = 'intro' | 'solutions' | 'practice';
type LifelinePlacement = 'idle' | 'targetArmed' | 'cardPicked' | 'slotReady' | 'flying' | 'complete';

interface LifelineState {
  screen: LifelineScreen;
  selectedValue: number | null;
  placement: LifelinePlacement;
  completedMiniExploration: boolean;
}

const LIFELINE_DICE: [number, number, number] = [2, 4, 5];
const LIFELINE_HAND: Card[] = PRACTICE_CONFIG.plus.hand;
const LIFELINE_OPTIONS = DISCARD_OPTIONS.plus;
const LIFELINE_DEFAULT_RED_LABEL = 'לחץ על מיני קלף\nכדי לראות את התרגיל';
const LIFELINE_INTRO_TEXT = 'לא מוצאים תרגיל מתאים לקלפים שלכם? הכפתור הירוק ייתן את התשובה!';
const LIFELINE_SHOWCASE_TEXT = `הכפתור הירוק סרק את המניפה ומצא ${LIFELINE_OPTIONS.length} פתרונות! כל מיני-קלף הוא פתרון אפשרי. לחצו עליו לחשיפת התרגיל.`;
const LIFELINE_SELECTED_TEXT = 'תוכלו להשתמש בתרגיל הזה כדי להיפטר מהקלף!';
const LIFELINE_PRACTICE_TEXT = 'בואו נתרגל! לחצו על מיני-קלף, ראו את התרגיל, והציבו את הקלף המתאים במשוואה!';

// ── The build track for the active practice: [die1][op-slot][die2] = [result].
// Each cell shows "?" until the learner fills it; the operator slot is a tappable,
// glowing target during the "choose operator" sub-step, then locks to the sign.
function BuildEquationTrack({
  first,
  second,
  op,
  result,
  opPlaced,
  opReady,
  resultArmed,
  pulse,
  onPlaceOp,
}: {
  first: number | null;
  second: number | null;
  op: Operation;
  result: number | null;
  opPlaced: boolean;
  opReady: boolean;
  resultArmed?: boolean;
  pulse: Animated.Value;
  onPlaceOp: () => void;
}) {
  const copy = useGoldRoomCopy();
  const placeOpLabel = op === '+' ? copy.placePlusOp : op === '-' ? copy.placeMinusOp : op === 'x' ? copy.placeMulOp : copy.placeDivOp;
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.9] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.1] });
  const opSlot = (
    <View style={[styles.operatorHole, (opReady || opPlaced) && styles.operatorHoleReady]}>
      {opReady ? (
        <Animated.View pointerEvents="none" style={[styles.operatorHoleGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
      ) : null}
      {opPlaced || opReady ? (
        <OperatorGlyph op={op} color={opPlaced ? '#F8E08E' : '#3D2A0E'} size={26} />
      ) : (
        <Text style={styles.operatorHoleHint}>?</Text>
      )}
    </View>
  );
  return (
    <View style={styles.track}>
      <View style={[styles.slot, first === null ? styles.slotEmpty : styles.slotFilled]}>
        <Text style={first === null ? styles.slotHintTxt : styles.slotTxt}>{first === null ? '?' : first}</Text>
      </View>
      {opReady ? (
        <Pressable onPress={onPlaceOp} accessibilityRole="button" accessibilityLabel={placeOpLabel}>
          {opSlot}
        </Pressable>
      ) : (
        opSlot
      )}
      <View style={[styles.slot, second === null ? styles.slotEmpty : styles.slotFilled]}>
        <Text style={second === null ? styles.slotHintTxt : styles.slotTxt}>{second === null ? '?' : second}</Text>
      </View>
      <Text style={styles.equals}>=</Text>
      <View style={[styles.slot, styles.resultSlot, resultArmed && styles.resultSlotGlow]}>
        {resultArmed ? (
          <Animated.View pointerEvents="none" style={[styles.resultGlowRing, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
        ) : null}
        <Text style={result === null ? styles.slotHintTxt : styles.slotTxt}>{result === null ? '?' : result}</Text>
      </View>
    </View>
  );
}

function PreviewEquationBoard({ equation }: { equation: string | null }) {
  return (
    <View style={styles.previewBoard}>
      {equation ? (
        <Text allowFontScaling={false} style={styles.previewEquationText}>
          {equation}
        </Text>
      ) : (
        <View style={styles.previewEmptyEquationRow}>
          <Text allowFontScaling={false} style={styles.previewEquationEmpty}>=</Text>
          <View style={styles.previewQuestionCard}>
            <Text allowFontScaling={false} style={styles.previewQuestionText}>?</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function PreviewDiceRow({ dice }: { dice: number[] }) {
  const visibleDice = dice.length > 0 ? dice : [2, 4, 5];
  return (
    <View style={styles.previewDiceRow}>
      {visibleDice.map((value, index) => (
        <View key={`${value}-${index}`} style={[styles.previewDieSlot, dice.length === 0 && styles.previewDieSlotIdle]}>
          <GoldDieFace value={value} size={42} />
        </View>
      ))}
    </View>
  );
}

function MiniSolutionCard({ value, active, onPress }: { value: number; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`mini ${value}`}>
      <View style={[styles.showcaseMiniCard, active && styles.showcaseMiniCardActive]}>
        <Text allowFontScaling={false} style={styles.showcaseMiniText}>{value}</Text>
      </View>
    </Pressable>
  );
}

function StaticHelperButton({ state, redText }: { state: 'green' | 'red'; redText?: string }) {
  const copy = useGoldRoomCopy();
  const isGreen = state === 'green';
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isGreen) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 720, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.95, duration: 720, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isGreen, pulse]);
  return (
    <Animated.View style={{ transform: [{ scale: isGreen ? pulse : 1 }] }}>
      <LinearGradient
        colors={isGreen ? ['#2D6B48', '#245C3C', '#1C4C30', '#143824'] : ['#A8332A', '#8D2522', '#6F1C1F', '#4F1518']}
        start={{ x: 0.3, y: 0.2 }}
        end={{ x: 0.7, y: 0.9 }}
        style={[styles.showcaseHelperButton, isGreen ? styles.showcaseHelperGreen : styles.showcaseHelperRed]}
      >
        {isGreen ? (
          <>
            <View pointerEvents="none" style={styles.showcaseHelperGlowRing} />
            <Text pointerEvents="none" allowFontScaling={false} style={[styles.showcaseHelperSparkle, styles.showcaseSparkleTopLeft]}>✦</Text>
            <Text pointerEvents="none" allowFontScaling={false} style={[styles.showcaseHelperSparkle, styles.showcaseSparkleTopRight]}>✧</Text>
            <Text pointerEvents="none" allowFontScaling={false} style={[styles.showcaseHelperSparkle, styles.showcaseSparkleBottom]}>✦</Text>
          </>
        ) : null}
        <Text allowFontScaling={false} style={styles.showcaseHelperText}>
          {isGreen ? copy.discardHelperOpen : redText ?? copy.discardHelperTapHint}
        </Text>
      </LinearGradient>
    </Animated.View>
  );
}

function ShowcaseNextArrow({ onPress }: { onPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 520, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 520, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="המשך">
      <Animated.View style={[styles.showcaseNextArrow, { transform: [{ scale: pulse }] }]}>
        <Text allowFontScaling={false} style={styles.showcaseNextArrowText}>›</Text>
      </Animated.View>
    </Pressable>
  );
}

function HelperPointerArrow() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 440, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 440, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const translateY = pulse.interpolate({ inputRange: [0, 1], outputRange: [-3, 5] });
  return (
    <Animated.View pointerEvents="none" style={[styles.helperPointerArrow, { opacity, transform: [{ translateY }] }]}>
      <Text allowFontScaling={false} style={styles.helperPointerArrowText}>↓</Text>
    </Animated.View>
  );
}

function LifelineEquationTrack({
  selectedOption,
  slotReady,
  solved,
  pulse,
  onPressSlot,
}: {
  selectedOption: DiscardOption | null;
  slotReady: boolean;
  solved: boolean;
  pulse: Animated.Value;
  onPressSlot: () => void;
}) {
  const dice = selectedOption?.dice ?? [];
  const left = solved || selectedOption ? dice[0] ?? null : null;
  const right = solved || selectedOption ? dice[1] ?? null : null;
  const result = solved ? selectedOption?.value ?? null : null;
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.9] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.1] });
  const resultSlot = (
    <View style={[styles.slot, styles.resultSlot, slotReady && styles.resultSlotGlow]}>
      {slotReady ? (
        <Animated.View pointerEvents="none" style={[styles.resultGlowRing, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
      ) : null}
      <Text allowFontScaling={false} style={result === null ? styles.slotHintTxt : styles.slotTxt}>
        {result === null ? '?' : result}
      </Text>
    </View>
  );

  return (
    <View style={[styles.track, styles.lifelineTrack]}>
      <Text allowFontScaling={false} style={styles.lifelineParen}>(</Text>
      <View style={[styles.slot, left === null ? styles.slotEmpty : styles.slotFilled]}>
        <Text allowFontScaling={false} style={left === null ? styles.slotHintTxt : styles.slotTxt}>{left === null ? '?' : left}</Text>
      </View>
      <Text allowFontScaling={false} style={styles.lifelineOp}>+</Text>
      <View style={[styles.slot, right === null ? styles.slotEmpty : styles.slotFilled]}>
        <Text allowFontScaling={false} style={right === null ? styles.slotHintTxt : styles.slotTxt}>{right === null ? '?' : right}</Text>
      </View>
      <Text allowFontScaling={false} style={styles.lifelineParen}>)</Text>
      <Text allowFontScaling={false} style={styles.equals}>=</Text>
      {slotReady ? (
        <Pressable onPress={onPressSlot} accessibilityRole="button" accessibilityLabel="הצב קלף במשוואה">
          {resultSlot}
        </Pressable>
      ) : (
        resultSlot
      )}
    </View>
  );
}

export function DiscardHelperShowcase({ onComplete }: { onComplete: () => void }) {
  const { width: winW } = useWindowDimensions();
  const fanW = Math.min(winW, 480);
  const [state, setState] = useState<LifelineState>({
    screen: 'intro',
    selectedValue: null,
    placement: 'idle',
    completedMiniExploration: false,
  });
  const reveal = useRef(new Animated.Value(0)).current;
  const fanFocus = useRef(new Animated.Value(0)).current;
  const slotPulse = useRef(new Animated.Value(0)).current;
  const greenPulse = useRef(new Animated.Value(1)).current;

  const selectedOption = useMemo(
    () => LIFELINE_OPTIONS.find((option) => option.value === state.selectedValue) ?? null,
    [state.selectedValue],
  );
  const selectedIds = useMemo(
    () => (selectedOption?.targetId ? new Set([selectedOption.targetId]) : new Set<string>()),
    [selectedOption?.targetId],
  );
  const slotReady = state.screen === 'practice' && state.placement === 'slotReady';
  const solved = state.placement === 'complete';
  const instruction = state.screen === 'intro'
    ? LIFELINE_INTRO_TEXT
    : state.screen === 'solutions' && selectedOption
    ? LIFELINE_SELECTED_TEXT
    : state.screen === 'solutions'
    ? LIFELINE_SHOWCASE_TEXT
    : LIFELINE_PRACTICE_TEXT;

  useEffect(() => {
    reveal.setValue(0);
    Animated.timing(reveal, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [reveal, state.screen]);

  useEffect(() => {
    if (state.screen !== 'intro') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(greenPulse, { toValue: 1.05, duration: 720, useNativeDriver: true }),
        Animated.timing(greenPulse, { toValue: 0.96, duration: 720, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [greenPulse, state.screen]);

  usePulseLoop(slotPulse, slotReady, 0, 1, 500);

  const focusOption = useCallback(
    (option: DiscardOption) => {
      playEquationTapSfx(0.46);
      fanFocus.setValue(0);
      Animated.timing(fanFocus, { toValue: 1, duration: 420, useNativeDriver: true }).start();
      setState((current) => ({
        ...current,
        selectedValue: option.value,
        placement: current.screen === 'practice' ? 'targetArmed' : 'idle',
        completedMiniExploration: true,
      }));
    },
    [fanFocus],
  );

  const advance = useCallback(() => {
    if (state.screen === 'intro') {
      setState((current) => ({ ...current, screen: 'solutions', selectedValue: null, placement: 'idle' }));
      return;
    }
    if (state.screen === 'solutions' && state.completedMiniExploration) {
      setState({ screen: 'practice', selectedValue: null, placement: 'idle', completedMiniExploration: true });
    }
  }, [state.completedMiniExploration, state.screen]);

  const tapFanCard = useCallback((_card: Card) => {
    // In the lifeline tutorial, hand cards never fly into the equation.
    // The equation must be built only from the dice on the board.
  }, []);

  const greenButton = (
    <Animated.View style={{ transform: [{ scale: state.screen === 'intro' ? greenPulse : 1 }] }}>
      <StaticHelperButton state="green" />
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      <InstructionBanner text={instruction} />
      <View style={[styles.playArea, styles.lifelinePlayArea]}>
        <View style={styles.lifelineHelperAboveTable}>
          {state.screen === 'intro' ? greenButton : (
            <StaticHelperButton state="red" redText={selectedOption?.equation ?? LIFELINE_DEFAULT_RED_LABEL} />
          )}
        </View>
        <View style={styles.tableZone}>
          <Image source={GOLD_TABLE_IMG} resizeMode="contain" style={styles.tableImg} />
          <View style={styles.tableOverlay} pointerEvents="box-none">
            <Animated.View style={[styles.solveZone, styles.lifelineBoardZone, { opacity: reveal }]}>
              <PreviewDiceRow dice={LIFELINE_DICE} />
              {state.screen === 'practice' ? (
                <LifelineEquationTrack
                  selectedOption={selectedOption}
                  slotReady={slotReady}
                  solved={solved}
                  pulse={slotPulse}
                  onPressSlot={() => {}}
                />
              ) : (
                <PreviewEquationBoard equation={null} />
              )}
            </Animated.View>
          </View>
        </View>

        {state.screen !== 'intro' ? (
          <View style={styles.lifelineMiniBelowTable}>
            <View style={styles.showcaseMiniRow}>
              {LIFELINE_OPTIONS.map((option) => (
                <MiniSolutionCard
                  key={option.value}
                  value={option.value}
                  active={option.value === state.selectedValue}
                  onPress={() => focusOption(option)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <Animated.View style={[styles.fanWrap, styles.lifelineFanWrap, { width: fanW, alignSelf: 'center' }]}>
        <HandFan
          cards={LIFELINE_HAND}
          width={fanW}
          selectedIds={new Set<string>()}
          onTapCard={tapFanCard}
          canTap={() => false}
          centerCardId={null}
          playTapSound={false}
        />
      </Animated.View>

      {state.screen !== 'practice' ? (
        <View style={styles.showcaseArrowWrap}>
          <ShowcaseNextArrow onPress={advance} />
        </View>
      ) : null}

      {solved ? (
        <SuccessCelebration
          title="כל הכבוד!"
          subtitle="השתמשתם בגלגל ההצלה, הצבתם את הקלף במשוואה, והשלמתם את האריח."
          onDone={onComplete}
        />
      ) : null}
    </View>
  );
}

type DiceEquationRoundProps = {
  onExit?: () => void;
  onComplete?: () => void;
  mode?: 'practice' | 'operators' | 'fractions' | 'improve';
};

export function DiceEquationRound({ onExit, onComplete, mode = 'practice' }: DiceEquationRoundProps) {
  const copy = useGoldRoomCopy();
  if (mode === 'operators') {
    return <SpecialsFlow onComplete={onComplete} onExit={onExit} />;
  }
  if (mode === 'fractions') {
    return <OperatorCardsLesson startStep="fractionIntro" onComplete={onComplete} onExit={onExit} />;
  }

  // The fan is centered to the ROOM FRAME (capped at 480 on web), not the whole
  // window — without this the hand mis-centers off-frame and feels "stuck".
  const { width: winW } = useWindowDimensions();
  const fanW = Math.min(winW, 480);

  const diceRef = useRef<AnimatedDiceHandle>(null);

  // ── Active build flow state — NOTHING is pre-filled. ──────────────────────
  const [step, setStep] = useState<PracticeStepId>('plus');
  const [substage, setSubstage] = useState<'roll' | 'solve'>('roll');
  const [hand, setHand] = useState<Card[]>(PRACTICE_CONFIG.plus.hand);
  const [drawPile, setDrawPile] = useState<Card[]>(PENALTY_DRAW_PILE);
  const [helpUsageCount, setHelpUsageCount] = useState(0);
  const [discardHelperOpen, setDiscardHelperOpen] = useState(false);
  const [discardPreview, setDiscardPreview] = useState<DiscardOption | null>(null);
  const [placedFirst, setPlacedFirst] = useState(false); // first die tapped into slot 1
  const [opPlaced, setOpPlaced] = useState(false); // operator tapped into the sign slot
  const [placedSecond, setPlacedSecond] = useState(false); // second die tapped into slot 2
  const [selectedId, setSelectedId] = useState<string | null>(null); // chosen hand card

  const [resolving, setResolving] = useState(false); // freezes input during the win
  const [flying, setFlying] = useState<Card | null>(null);
  const [showFirstWinCelebration, setShowFirstWinCelebration] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  // Mandatory (+,−) → reward → optional (×,÷). The reward is granted ONCE the
  // moment the mandatory path ends, BEFORE the choice, guarded so it fires once.
  const [completedExerciseCount, setCompletedExerciseCount] = useState(0);
  const [areCoinsCollected, setAreCoinsCollected] = useState(false);
  const [showChoice, setShowChoice] = useState(false); // the reward + "practice more?" screen

  const shake = useRef(new Animated.Value(0)).current;
  // Cross-fade driver: 0 = dice rolling (solve UI hidden, fan dimmed), 1 = solving.
  const reveal = useRef(new Animated.Value(0)).current;
  // Pulse drivers: the operator-slot glow, the launch-button pulse, the "tap me"
  // glow on the next die, and the halo cueing the matching hand card.
  const slotPulse = useRef(new Animated.Value(0)).current;
  const buttonPulse = useRef(new Animated.Value(1)).current;
  const diePulse = useRef(new Animated.Value(0)).current;
  const cardHalo = useRef(new Animated.Value(0)).current;

  const cfg = PRACTICE_CONFIG[step];
  const selectedIds = useMemo(() => (selectedId ? new Set([selectedId]) : new Set<string>()), [selectedId]);
  const discardPreviewSelectedIds = useMemo(
    () => (mode === 'improve' && discardPreview?.targetId ? new Set([discardPreview.targetId]) : selectedIds),
    [discardPreview?.targetId, mode, selectedIds],
  );
  const fanCenterCardId = mode === 'improve' ? discardPreview?.targetId ?? null : cfg.targetId;
  const selectedCard = useMemo(() => hand.find((c) => c.id === selectedId) ?? null, [hand, selectedId]);

  const firstVal = placedFirst ? cfg.dice[cfg.firstIdx] : null;
  const secondVal = placedSecond ? cfg.dice[cfg.secondIdx] : null;
  const computedResult = useMemo(
    () => (firstVal !== null && secondVal !== null ? applyOperation(firstVal, cfg.op, secondVal) : null),
    [cfg.op, firstVal, secondVal],
  );
  const resultVal = placedSecond ? computedResult : null;
  const opReady = placedFirst && !opPlaced && !resolving;
  const cardPhase = placedSecond && !resolving; // time to pick the matching card
  const targetSelected = selectedId === cfg.targetId;
  const selectedMatchesResult = selectedCard?.type === 'number' && selectedCard.value === resultVal;
  const canCheck = targetSelected && selectedMatchesResult && !resolving;
  // A full, valid equation (e.g. 2 + 4 = 6) exists once the second die lands —
  // the strict order guarantees the first die + operator are already in place.
  const isEquationComplete = placedSecond;
  // The single die the guided step wants the learner to tap next (or -1 = none).
  const activeDieIdx = !placedFirst ? cfg.firstIdx : opPlaced && !placedSecond ? cfg.secondIdx : -1;

  const solving = substage === 'solve';
  const interactive = solving && !resolving;

  useEffect(() => {
    if (mode !== 'improve') return;
    setSubstage('solve');
    reveal.setValue(1);
  }, [mode, reveal]);

  const instructionText = useMemo(() => {
    if (mode === 'improve' && !placedFirst) {
      return discardHelperOpen ? copy.discardHelperMiniCardHelp : copy.discardHelperIntroBody;
    }
    const subs: Record<PracticeStepId, [string, string, string, string]> = {
      plus: [copy.practicePlusSub1, copy.practicePlusSub2, copy.practicePlusSub3, copy.practicePlusSub4],
      minus: [copy.practiceMinusSub1, copy.practiceMinusSub2, copy.practiceMinusSub3, copy.practiceMinusSub4],
      mul: [copy.practiceMulSub1, copy.practiceMulSub2, copy.practiceMulSub3, copy.practiceMulSub4],
      div: [copy.practiceDivSub1, copy.practiceDivSub2, copy.practiceDivSub3, copy.practiceDivSub4],
    };
    const c = subs[step];
    if (!placedFirst) return c[0];
    if (!opPlaced) return c[1];
    if (!placedSecond) return c[2];
    if (!selectedId) return c[3];
    return copy.practiceLaunchHint;
  }, [copy, discardHelperOpen, mode, opPlaced, placedFirst, placedSecond, selectedId, step]);

  usePulseLoop(slotPulse, opReady, 0, 1, 520);
  // Keep the action button "awake" (lit + pulsing) the moment there's something to
  // do with it — i.e. once the equation is built and it reads "בחר קלפים", through
  // to "שגר" — so it never looks like an inert, greyed-out control.
  usePulseLoop(buttonPulse, isEquationComplete && !resolving, 1, 1.055, 460);
  usePulseLoop(diePulse, activeDieIdx >= 0 && solving && !resolving, 0, 1, 640);
  usePulseLoop(cardHalo, cardPhase && !selectedId, 0, 1, 720);

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

  // The dice finished rolling — fade the solve UI in. NO prefill: the dice sit in
  // the pool UNSELECTED and the learner builds the equation themselves.
  const handleRollComplete = useCallback(() => {
    setSubstage('solve');
    Animated.timing(reveal, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [reveal]);

  const drawCard = useCallback(() => {
    setDrawPile((pile) => {
      if (pile.length === 0) return pile;
      const [drawn, ...rest] = pile;
      setHand((current) => [...current, drawn]);
      return rest;
    });
  }, []);

  const handleDiscardHelperOpen = useCallback(() => {
    setHelpUsageCount((count) => {
      if (count >= 2) drawCard();
      return count + 1;
    });
  }, [drawCard]);
  const handleDiscardHelperOpenChange = useCallback((open: boolean) => {
    setDiscardHelperOpen(open);
    if (!open) setDiscardPreview(null);
  }, []);
  const handleDiscardHelperPreview = useCallback((option: DiscardOption) => {
    setDiscardPreview(option);
    setSelectedId(null);
  }, []);

  // Strict tap-tap: only the "correct" next die responds. Slot 1 wants the first
  // die; then the operator must be placed; then slot 2 wants the second die.
  const tapDie = useCallback(
    (idx: number) => {
      if (resolving || !solving) return;
      if (!placedFirst) {
        if (idx === cfg.firstIdx) {
          playEquationTapSfx();
          setPlacedFirst(true);
        }
        return;
      }
      if (!opPlaced) return; // the operator comes next, not another die
      if (!placedSecond) {
        if (idx === cfg.secondIdx) {
          playEquationTapSfx();
          setPlacedSecond(true);
        }
      }
    },
    [cfg.firstIdx, cfg.secondIdx, opPlaced, placedFirst, placedSecond, resolving, solving],
  );

  // Tap the glowing operator slot to drop the sign in.
  const placeOperator = useCallback(() => {
    if (!opReady) return;
    playEquationTapSfx();
    setOpPlaced(true);
  }, [opReady]);

  // Tap a hand card: only the matching target accepts; anything else softly shakes.
  const tapCard = useCallback(
    (card: Card) => {
      if (resolving || !placedSecond) return;
      if (card.id !== cfg.targetId) {
        doShake();
        return;
      }
      setSelectedId((cur) => (cur === card.id ? null : card.id));
    },
    [cfg.targetId, doShake, placedSecond, resolving],
  );

  // Roll a fresh exercise: reset the build state and re-roll the dice for `next`.
  const goToStep = useCallback(
    (next: PracticeStepId) => {
      setStep(next);
      setHand(PRACTICE_CONFIG[next].hand);
      setPlacedFirst(false);
      setOpPlaced(false);
      setPlacedSecond(false);
      setSelectedId(null);
      setDiscardHelperOpen(false);
      setDiscardPreview(null);
      reveal.setValue(0);
      setSubstage('roll');
    },
    [reveal],
  );

  // ── Reward hook: granted the INSTANT the mandatory path (plus + minus) ends,
  // BEFORE the optional choice — VISUAL celebration only (no server award), and
  // guarded by `areCoinsCollected` so it fires exactly once. onComplete marks the
  // lesson done so the victory tile unlocks, regardless of the bonus decision.
  const grantCoins = useCallback(() => {
    void playSfx('complete', { cooldownMs: 0, volumeOverride: 0.95 });
    onComplete?.();
  }, [onComplete]);

  // After the matched card flies out: advance through plus → minus → (reward +
  // choice) → [optional] mul → div → done.
  const finishWin = useCallback(() => {
    setFlying(null);
    setResolving(false);
    setHand((h) => h.filter((c) => c.id !== cfg.targetId));

    const completed = completedExerciseCount + 1;
    setCompletedExerciseCount(completed);
    // Mandatory path complete (plus + minus) → grant the reward once.
    if (completed === MANDATORY_STEPS && !areCoinsCollected) {
      grantCoins();
      setAreCoinsCollected(true);
    }

    if (step === 'plus') {
      setShowFirstWinCelebration(true);
    } else if (step === 'minus') {
      setShowChoice(true); // reward + "want to practice × ÷?" screen
    } else if (step === 'mul') {
      goToStep('div');
    } else {
      // div → the optional path is done.
      setShowSuccess(true);
    }
  }, [areCoinsCollected, cfg.targetId, completedExerciseCount, grantCoins, step]);

  const continueAfterFirstWin = useCallback(() => {
    setShowFirstWinCelebration(false);
    goToStep('minus');
  }, [goToStep]);

  // The choice screen: finish the whole tutorial, or continue to the bonus path.
  const finishMandatory = useCallback(() => {
    setShowChoice(false);
    onExit?.();
  }, [onExit]);
  const continueToBonus = useCallback(() => {
    setShowChoice(false);
    goToStep('mul');
  }, [goToStep]);

  // "בדוק ✓": the equation is rigged-correct by construction, so a tap just flies
  // the matched card out with the success chime, then finishWin advances.
  const handleCheck = useCallback(() => {
    if (!canCheck || !selectedCard) return;
    setResolving(true);
    setSelectedId(null);
    setFlying(selectedCard);
  }, [canCheck, selectedCard]);

  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] });
  const rollOpacity = reveal.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const fanOpacity = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });
  const cardHaloOpacity = cardHalo.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.84] });
  // The central action button walks through three states as the round progresses:
  //   • equation not yet built  → "בחר קוביות"  (disabled)
  //   • equation complete, no card chosen → "בחר קלפים" (enabled — pick a card)
  //   • a card is chosen → "שגר" (enabled, pulsing — launch it)
  const hasSelectedCard = !!selectedId;
  const getButtonState = (): { text: string; disabled: boolean } => {
    if (!isEquationComplete) return { text: copy.chooseDice, disabled: true };
    if (!hasSelectedCard) return { text: copy.chooseCards, disabled: false };
    return { text: copy.launch, disabled: false };
  };
  const buttonState = getButtonState();

  return (
    <View style={styles.root}>
      {/* The instruction bubble — pinned to the very top black space. */}
      <InstructionBanner text={instructionText} />

      <View style={styles.playArea}>
        {mode === 'improve' ? (
          <View style={styles.discardHelperAboveTable}>
            <DiscardHelper
              options={DISCARD_OPTIONS[step]}
              helpUsageCount={helpUsageCount}
              onRequestOpen={handleDiscardHelperOpen}
              onOpenChange={handleDiscardHelperOpenChange}
              onPreviewOption={handleDiscardHelperPreview}
            />
          </View>
        ) : null}
        <View style={styles.tableZone}>
          <Image source={GOLD_TABLE_IMG} resizeMode="contain" style={styles.tableImg} />
          <View style={styles.tableOverlay} pointerEvents="box-none">
            {/* ROLL layer — the rolling dice. ALWAYS mounted; fades out on solve. */}
            {mode !== 'improve' ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rollLayer, { opacity: rollOpacity }]}>
              <AnimatedDice
                key={step}
                ref={diceRef}
                size={58}
                fixedFinalValues={cfg.dice}
                autoRollOnMount
                hideRollButton
                hideSumBadge
                onRollStart={() => {
                  void playSfx('diceRoll', { cooldownMs: 0, volumeOverride: 0.5 });
                }}
                onRollComplete={handleRollComplete}
              />
            </Animated.View> : null}

            {/* SOLVE layer — the landed dice pool (UNSELECTED), the build track and
             *  the action button. ALWAYS mounted; hidden + inert while rolling. */}
            <Animated.View
              pointerEvents={interactive ? 'box-none' : 'none'}
              style={[styles.solveZone, mode === 'improve' && styles.solveZoneImprove, { opacity: reveal, transform: [{ translateX }] }]}
            >
              {/* The landed dice — the next one to tap glows; placed dice show 1/2. */}
              {mode !== 'improve' ? <View style={styles.diceRow}>
                {cfg.dice.map((v, idx) => {
                  const isFirst = placedFirst && idx === cfg.firstIdx;
                  const isSecond = placedSecond && idx === cfg.secondIdx;
                  return (
                    <DiceChip
                      key={idx}
                      value={v}
                      placed={isFirst || isSecond}
                      order={isFirst ? 1 : isSecond ? 2 : null}
                      active={idx === activeDieIdx}
                      pulse={diePulse}
                      onPress={() => tapDie(idx)}
                    />
                  );
                })}
              </View> : null}
              {mode === 'improve' ? (
                <>
                  <PreviewDiceRow dice={discardPreview?.dice ?? []} />
                  <PreviewEquationBoard equation={null} />
                </>
              ) : (
                <>
              <BuildEquationTrack
                first={firstVal}
                second={secondVal}
                op={cfg.op}
                result={resultVal}
                opPlaced={opPlaced}
                opReady={opReady}
                resultArmed={targetSelected}
                pulse={slotPulse}
                onPlaceOp={placeOperator}
              />
              <View style={styles.confirmWrap}>
                <Animated.View style={[styles.checkPulseWrap, { transform: [{ scale: buttonPulse }] }]}>
                  <GoldButton
                    label={buttonState.text}
                    onPress={handleCheck}
                    disabled={buttonState.disabled}
                    fullWidth
                    height={SEND_BUTTON_HEIGHT}
                    radius={SEND_BUTTON_RADIUS}
                    raise={SEND_BUTTON_RAISE}
                    fontSize={SEND_BUTTON_FONT_SIZE}
                    textStyle={styles.fixedActionText}
                    accessibilityLabel={buttonState.text}
                  />
                </Animated.View>
                {/* The "two dice are enough" note appears only once the sum is built. */}
                {placedSecond ? <Text style={styles.confirmHint}>{copy.twoDiceHint}</Text> : null}
              </View>
                </>
              )}
            </Animated.View>
          </View>
        </View>
      </View>

      {/* The hand fan — the TARGET cards. The matching card is centered and, once
       *  the sum is built, a halo cues it. Only that card accepts a tap. */}
      <Animated.View style={[styles.fanWrap, { opacity: fanOpacity, width: fanW, alignSelf: 'center' }]} pointerEvents={interactive ? 'box-none' : 'none'}>
        {cardPhase && !selectedId ? <FanFocusHalo width={fanW} opacity={cardHaloOpacity} /> : null}
        <HandFan
          cards={hand}
          width={fanW}
          selectedIds={discardPreviewSelectedIds}
          onTapCard={mode === 'improve' ? undefined : tapCard}
          canTap={mode === 'improve' ? () => false : () => cardPhase}
          centerCardId={fanCenterCardId}
        />
      </Animated.View>

      {flying ? <FlyingCard card={flying} onDone={finishWin} /> : null}

      {showFirstWinCelebration ? <FirstWinCelebration onContinue={continueAfterFirstWin} /> : null}

      {/* Mandatory complete → coins (visual) + the optional-bonus choice. */}
      {showChoice ? <RewardChoiceOverlay onFinish={finishMandatory} onContinue={continueToBonus} /> : null}

      {showSuccess ? <SuccessCelebration onDone={onExit} /> : null}
    </View>
  );
}

// ── The reward + choice screen shown the moment the mandatory (+,−) path ends:
// a coin celebration, then "finish" vs "also practice × ÷". The coins here are a
// VISUAL flourish — the lesson was already marked complete by grantCoins().
function RewardChoiceOverlay({ onFinish, onContinue }: { onFinish: () => void; onContinue: () => void }) {
  const copy = useGoldRoomCopy();
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    void playSfx('success', { cooldownMs: 0, volumeOverride: 0.9 });
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
  }, [pop]);
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  return (
    <View style={styles.successOverlay}>
      <View style={styles.successCard}>
        <Animated.Text style={[styles.successTrophy, { opacity: pop, transform: [{ scale }] }]}>🪙</Animated.Text>
        <Text style={styles.successTitle}>{copy.rewardChoiceTitle}</Text>
        <Text style={styles.successSub}>{copy.rewardChoiceSub}</Text>
        <View style={styles.rewardChoiceCta}>
          <GoldButton label={copy.rewardChoiceContinue} onPress={onContinue} accessibilityLabel={copy.rewardChoiceContinue} fullWidth height={54} fontSize={18} />
          <GoldButton label={copy.rewardChoiceFinish} onPress={onFinish} accessibilityLabel={copy.rewardChoiceFinish} tone="stone" fullWidth height={48} fontSize={16} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  specialsBoardContent: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  // ── SpecialsFlow deterministic board column (LOCAL — leaves shared playArea/
  //    tableZone untouched). Fixed bands + one flex spacer keep the table and fan
  //    in the exact same spot across every tutorial step, on any screen height. ──
  // paddingTop clears the absolute instruction banner (top:14 + minHeight:96 ≈ 110).
  specialsStage: { flex: 1, width: '100%', alignItems: 'center', paddingTop: 118, paddingHorizontal: 16, paddingBottom: 10 },
  // Reserved in EVERY phase so the table never moves; dice sit at its base near the table.
  specialsDiceBand: { height: 58, alignItems: 'center', justifyContent: 'flex-end', marginBottom: 6 },
  specialsFeraDiceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  specialsFeraDie: { alignItems: 'center', justifyContent: 'center' },
  // A used die stays clearly visible (it just fed an operand) — only gently dimmed.
  specialsFeraDieUsed: { opacity: 0.55 },
  // LOCKED table: fixed max height + aspect → identical size & Y in every step.
  specialsTableZone: { width: '92%', maxWidth: 360, maxHeight: 234, aspectRatio: 1024 / 774, alignItems: 'center', justifyContent: 'center' },
  // Absorbs all leftover height so the launch slot + fan stay pinned to the bottom.
  specialsSpacer: { flex: 1, minHeight: 4 },
  // Reserved gap directly above the fan — the "שגר" CTA lives here when armed so the
  // fan never shifts whether or not the button is present.
  specialsLaunchSlot: { height: 64, width: '100%', maxWidth: 360, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  specialsFanWrap: { alignSelf: 'center', alignItems: 'center' },
  specialsFeraIntroStage: {
    width: 190,
    height: 248,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialsFeraCleanZone: {
    maxWidth: 360,
    aspectRatio: 1,
    borderRadius: 28,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  salindaIntroCleanZone: {
    maxWidth: 420,
    aspectRatio: 0.92,
    borderRadius: 32,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  specialsIntroCenter: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  salindaIntroStage: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  salindaIntroOrbit: {
    width: 330,
    height: 330,
    alignItems: 'center',
    justifyContent: 'center',
  },
  salindaIntroCardWrap: {
    width: 152,
    height: 208,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  salindaIntroOrbitRing: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  salindaIntroOrbitSign: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 16,
    elevation: 14,
    zIndex: 4,
  },
  salindaIntroFlash: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.72,
    shadowRadius: 34,
    elevation: 22,
  },
  salindaIntroCta: {
    position: 'absolute',
    left: 34,
    right: 34,
    bottom: 10,
  },
  specialsFeraIntroHalo: {
    position: 'absolute',
    width: 174,
    height: 228,
    borderRadius: 22,
    backgroundColor: 'rgba(196,181,253,0.08)',
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: '#C4B5FD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.72,
    shadowRadius: 24,
    elevation: 16,
  },
  specialsEquationRow: {
    // The equation MUST read left-to-right (4 + 2 = 6) on every platform. RN
    // strips the CSS `direction` property, and Android's global forceRTL flips a
    // plain `row` to visual RTL (mirroring the equation). Negating the flip with
    // `row-reverse` under isRTL is the only reliable cross-platform LTR lock.
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  specialsEquationSlot: {
    width: 56,
    height: 58,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#6B4516',
    backgroundColor: '#F8E08E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 10,
  },
  specialsEquationSlotEmpty: { borderStyle: 'dashed', backgroundColor: 'rgba(248,224,142,0.2)' },
  specialsEquationSlotReady: {
    borderColor: '#7BE08A',
    backgroundColor: 'rgba(123,224,138,0.18)',
    shadowColor: '#7BE08A',
    shadowOpacity: 0.75,
  },
  specialsEquationSlotGlow: {
    position: 'absolute',
    width: 68,
    height: 70,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#7BE08A',
    backgroundColor: 'rgba(123,224,138,0.24)',
    shadowColor: '#7BE08A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.86,
    shadowRadius: 16,
    elevation: 18,
  },
  specialsEquationCardInSlot: {
    width: 40,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scale: 0.38 }],
  },
  specialsEquationText: { color: '#171006', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  specialsQuestionText: { color: '#F8E08E', fontSize: 30, fontWeight: '900', textAlign: 'center' },
  specialsEquals: { color: '#F8E08E', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  specialsBottomArea: { minHeight: 224, justifyContent: 'flex-end', paddingBottom: 18 },
  specialsSignDock: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 18,
  },
  specialsSignButton: {
    width: 62,
    height: 62,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#6B4516',
    backgroundColor: '#F6D889',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 4,
  },
  specialsSignFace: {
    width: 52,
    height: 52,
    borderRadius: 11,
    backgroundColor: '#FFE7A6',
    borderWidth: 1,
    borderColor: 'rgba(61,42,14,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialsSignButtonActive: { borderColor: '#2E7D43', backgroundColor: '#C9F0B8', shadowColor: '#7BE08A', shadowOpacity: 0.45 },
  specialsSignButtonPressed: { transform: [{ scale: 0.96 }] },
  specialsSignButtonDisabled: { opacity: 0.72 },
  specialsArrowWrap: { position: 'absolute', left: 0, right: 0, bottom: 16, alignItems: 'center', zIndex: 45 },
  specialsNextArrow: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: '#6B4516',
    backgroundColor: '#D9A23A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F8E08E',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 14,
  },
  specialsNextArrowDisabled: { opacity: 0.55 },
  specialsNextArrowText: { color: '#171006', fontSize: 42, fontWeight: '900', lineHeight: 48, marginTop: -2 },
  specialsToast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 112,
    zIndex: 90,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(20,12,4,0.94)',
    borderWidth: 2,
    borderColor: '#F8E08E',
  },
  specialsToastText: { color: '#F8E08E', fontSize: 17, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
  specialsFlyingLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 70,
    zIndex: 70,
  },
  specialsFlyingTokenCard: {
    width: 100,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialsFlyingToken: {
    width: 76,
    height: 76,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#6B4516',
    backgroundColor: '#F8E08E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 16,
    elevation: 18,
  },
  specialsFlyingFera: { backgroundColor: '#DDD6FE', borderColor: '#7C3AED' },
  specialsFlyingTokenText: { color: '#3D2A0E', fontSize: 34, lineHeight: 38, fontWeight: '900', textAlign: 'center' },
  specialsFlyingSalinda: { position: 'absolute', top: 7, left: 10, color: '#2E7D43', fontSize: 15, fontWeight: '900' },
  specialsBubbles: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 142,
    zIndex: 50,
    direction: 'ltr',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  specialsBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#6B4516',
    backgroundColor: '#F8E08E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 14,
  },
  specialsBubblePressed: { transform: [{ scale: 0.92 }] },
  specialsEndCard: { borderColor: '#F8E08E', backgroundColor: 'rgba(20,12,4,0.98)', shadowColor: '#F8E08E', shadowOpacity: 0.42 },
  specialsEndTitle: { ...rtlText, color: '#F8E08E', fontSize: 25, fontWeight: '900', textAlign: 'center', lineHeight: 32 },
  specialsEndBody: {
    ...rtlText,
    color: '#FFF4B8',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 26,
    textAlign: 'center',
    marginTop: 8,
  },

  // Play area — fills the space above the bottom hand. Anchored to the BOTTOM
  // (just above the fan) with a small gap, so the dice/equation sit LOW and well
  // clear of the instruction banner pinned at the top (no overlap).
  // paddingTop reserves the band occupied by the absolutely-positioned
  // InstructionBanner. On tall screens the board is bottom-anchored so this
  // empty top space is invisible; on short iPhones it stops the board from
  // rising into the banner. maxHeight on the table (below) caps its growth so
  // the equation never slides under the explanation.
  playArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingTop: 92, paddingHorizontal: 16, paddingBottom: 18, gap: 12 },
  playAreaImprove: { paddingBottom: 6, gap: 6 },
  lifelinePlayArea: { justifyContent: 'flex-end', paddingBottom: 132, gap: 4 },
  // The table: a sized, semi-transparent surface. Content is overlaid centered
  // ON it, so the dice / equation always sit on the table, not off it.
  tableZone: { width: '94%', maxWidth: 380, maxHeight: 264, aspectRatio: 1024 / 774, alignItems: 'center', justifyContent: 'center' },
  tableZoneImprove: { maxWidth: 390, aspectRatio: 0.78 },
  tableImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.78 },
  tableOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 14, paddingTop: 56 },
  solveZone: { alignItems: 'center', width: '100%', gap: 14 },
  solveZoneImprove: { gap: 7 },
  lifelineBoardZone: { gap: 18 },
  discardHelperAboveTable: { alignItems: 'center', justifyContent: 'center', marginBottom: 2, zIndex: 5 },
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
  // The next die the guided step wants: a bright border + a soft pulsing glow.
  diceChipActive: {
    borderColor: '#F8E08E',
    backgroundColor: 'rgba(244,205,90,0.12)',
  },
  diceChipGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 16,
    backgroundColor: '#F4CD5A',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 12,
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
  lifelineTrack: {
    direction: 'ltr',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  lifelineParen: {
    color: '#F8E08E',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },
  lifelineOp: {
    color: '#F8E08E',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
    textAlign: 'center',
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
  // The opening showcase: all four sign cards in a row on the board.
  signShowcase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  // The opening 2×2 grid of 3D sign buttons.
  signGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    width: 76 * 2 + 16,
    gap: 16,
    paddingVertical: 6,
  },
  signGridCell: {
    width: 76,
    height: 76,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#6B4516',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 4,
  },
  signGridSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '34%' },
  // The fraction center pile — a number card on a small discard stack, with a
  // glow + challenge/roll-over marker on its corner.
  fractionPileWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  fractionPileGlow: {
    position: 'absolute',
    width: 104,
    height: 134,
    borderRadius: 18,
    backgroundColor: '#F4CD5A',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 14,
  },
  fractionPileStackBack1: {
    position: 'absolute',
    width: 62,
    height: 88,
    borderRadius: 10,
    backgroundColor: 'rgba(20,12,4,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(244,205,90,0.5)',
    transform: [{ rotate: '-5deg' }, { translateX: -7 }, { translateY: 4 }],
  },
  fractionPileStackBack2: {
    position: 'absolute',
    width: 62,
    height: 88,
    borderRadius: 10,
    backgroundColor: 'rgba(20,12,4,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(244,205,90,0.35)',
    transform: [{ rotate: '5deg' }, { translateX: 7 }, { translateY: 6 }],
  },
  fractionCleared: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1F6A2E',
    borderWidth: 2,
    borderColor: '#FFF1A8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fractionClearedTxt: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', lineHeight: 22 },
  // The fraction opening showcase — a tight row of the four fraction cards.
  fractionShowcaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  fractionShowcaseCard: {
    transform: [{ scale: 0.62 }],
    marginHorizontal: -6,
  },
  equals: { color: '#F8E08E', fontSize: 20, fontWeight: '900', marginHorizontal: 2 },
  previewBoard: {
    minWidth: 142,
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 0,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  previewEquationText: {
    color: '#F8E08E',
    fontSize: 23,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0,
  },
  previewEquationEmpty: {
    color: '#F4B32B',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0,
  },
  previewEmptyEquationRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  previewQuestionCard: {
    width: 58,
    height: 58,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#C58B28',
    backgroundColor: '#FFF7EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewQuestionText: {
    color: '#0E335C',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
  },
  previewDiceRow: {
    flexDirection: 'row',
    direction: 'ltr',
    gap: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 74,
  },
  previewDieSlot: {
    width: 68,
    height: 68,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#D89D10',
    backgroundColor: '#F7C61D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7A4D00',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 8,
  },
  previewDieSlotIdle: {
    opacity: 0.52,
    borderStyle: 'dashed',
    borderColor: 'rgba(248,224,142,0.38)',
  },
  showcaseHelperSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  lifelineControls: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 104,
  },
  lifelineHelperAboveTable: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -4,
    zIndex: 8,
  },
  lifelineMiniBelowTable: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -10,
    zIndex: 9,
  },
  lifelineGreenLowered: {
    marginTop: 0,
  },
  lifelineActiveGreen: {
    transform: [{ scale: 0.74 }],
    marginVertical: -12,
  },
  lifelineRedLow: {
    marginTop: 0,
    alignItems: 'center',
  },
  showcaseHelperButton: {
    width: 152,
    minHeight: 78,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  showcaseHelperGreen: {
    borderColor: '#F5D45A',
    shadowColor: '#6EE7A8',
    shadowOpacity: 0.42,
    shadowRadius: 16,
    elevation: 12,
  },
  showcaseHelperRed: {
    width: 218,
    minHeight: 82,
    borderRadius: 18,
    borderColor: '#F5D45A',
    shadowColor: '#F8E08E',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 10,
  },
  showcaseHelperText: {
    color: '#FFF1C2',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
    textAlign: 'center',
    writingDirection: 'ltr',
    direction: 'ltr',
  },
  showcaseHelperGlowRing: {
    position: 'absolute',
    left: 3,
    right: 3,
    top: 3,
    bottom: 3,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,226,122,0.95)',
  },
  showcaseHelperSparkle: {
    position: 'absolute',
    color: '#FFF5B8',
    fontSize: 13,
    fontWeight: '900',
    textShadowColor: 'rgba(255,235,120,0.75)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  showcaseSparkleTopLeft: { top: 8, left: 11 },
  showcaseSparkleTopRight: { top: 10, right: 12 },
  showcaseSparkleBottom: { bottom: 9, left: 18, fontSize: 11 },
  helperPointerArrow: {
    position: 'absolute',
    top: -36,
    zIndex: 4,
  },
  helperPointerArrowText: {
    color: '#F8E08E',
    fontSize: 34,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  showcaseMiniRow: {
    flexDirection: 'row',
    direction: 'ltr',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  showcaseMiniCard: {
    width: 46,
    height: 54,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#42A5F5',
    backgroundColor: '#F8F4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  showcaseMiniCardActive: {
    borderColor: '#7BE08A',
    shadowColor: '#7BE08A',
    shadowOpacity: 0.75,
    shadowRadius: 12,
    elevation: 10,
  },
  showcaseMiniText: {
    color: '#0B63A3',
    fontSize: 20,
    fontWeight: '900',
  },
  showcaseArrowWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    alignItems: 'center',
    zIndex: 30,
  },
  showcaseNextArrow: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: '#6B4516',
    backgroundColor: '#D9A23A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F8E08E',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 14,
  },
  showcaseNextArrowText: {
    color: '#171006',
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 48,
    marginTop: -2,
  },
  confirmWrap: { alignSelf: 'stretch', alignItems: 'center', marginTop: 2 },
  checkPulseWrap: { alignSelf: 'center', width: SEND_BUTTON_WIDTH, borderRadius: SEND_BUTTON_RADIUS },
  fixedActionWrap: { alignSelf: 'center', width: SEND_BUTTON_WIDTH, borderRadius: SEND_BUTTON_RADIUS },
  fixedActionText: { textAlign: 'center' as const },
  // Stacked dynamic defense action buttons (one per valid defense in the hand).
  confirmHint: { ...rtlText, color: 'rgba(244,205,90,0.65)', fontSize: 14.5, fontWeight: '700', alignSelf: 'stretch', marginTop: 8 },

  // Hand fan — anchored low at the bottom of the screen, swipeable; only a small
  // safe-area gap below it (clear of the iPhone home indicator).
  fanWrap: { alignItems: 'center', paddingBottom: 28 },
  lifelineFanWrap: { paddingBottom: 16 },
  fanFocusHalo: {
    position: 'absolute',
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
    alignItems: 'stretch',
    gap: 12,
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 18,
  },
  selectorTitle: {
    ...rtlText,
    color: '#F8E08E',
    fontSize: 22,
    fontWeight: '900',
  },
  selectorBody: {
    ...rtlText,
    color: '#F5E6BF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 23,
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
  // The fraction throw rides ABOVE the fan (high z) so the card is clearly seen
  // flying onto the center pile.
  flyingLayerPile: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 120, zIndex: 60 },

  // The instruction bubble — pinned to the very TOP black space (Y ≈ 10–25),
  // full width, well clear of the centered dice table.
  instructionWrap: { position: 'absolute', top: 14, left: 14, right: 14, zIndex: 15 },
  instructionBubble: {
    minHeight: 96,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#6B4516',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#F4CD5A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 10,
  },
  instructionSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
  },
  instructionInnerGlow: {
    position: 'absolute',
    left: 1,
    right: 1,
    top: 1,
    bottom: 1,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerText: {
    writingDirection: 'rtl',
    textAlign: 'center',
    color: '#171006',
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 29,
    textShadowColor: 'rgba(255,255,255,0.38)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },

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
    alignItems: 'stretch',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 14,
  },
  firstWinCard: {
    maxWidth: 440,
    borderColor: '#F8E08E',
    backgroundColor: 'rgba(20,12,4,0.98)',
    shadowColor: '#F8E08E',
    shadowOpacity: 0.42,
    paddingVertical: 34,
    zIndex: 22,
    elevation: 22,
  },
  firstWinTrophy: {
    fontSize: 72,
    textAlign: 'center',
    textShadowColor: 'rgba(252,211,77,0.65)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  firstWinTitle: {
    ...rtlText,
    color: '#F8E08E',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
  },
  firstWinSub: {
    ...rtlText,
    color: '#FFF4B8',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 30,
    textAlign: 'center',
    marginBottom: 12,
  },
  firstWinCta: { alignSelf: 'stretch', marginTop: 10 },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 21,
    overflow: 'hidden',
  },
  confettiPiece: {
    position: 'absolute',
    top: 0,
    borderRadius: 2,
  },
  successTrophy: { fontSize: 56, textAlign: 'center' },
  successTitle: { ...rtlText, color: '#7BE08A', fontSize: 26, fontWeight: '900' },
  successSub: { ...rtlText, color: '#D8C49A', fontSize: 15, fontWeight: '600', lineHeight: 22, marginBottom: 6 },
  successCta: { alignSelf: 'stretch', marginTop: 6 },
  rewardChoiceCta: { alignSelf: 'stretch', marginTop: 10, gap: 10 },
});

export default DiceEquationRound;
