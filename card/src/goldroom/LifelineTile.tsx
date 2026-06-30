import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, I18nManager, Image, Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import HandFan from '../../components/HandFan';
import type { Card } from '../../components/CardDesign';
import { GoldButton } from '../../components/GoldButton';
import { playSfx } from '../audio/sfx';
import { useAuthOptional } from '../hooks/useAuth';
import { SALINDA_TUTORIAL_REWARDS } from '../../shared/salindaEconomy';

const GOLD_TABLE_IMG = require('../../assets/table_golden_nobg.png');

const GOLD_GRADIENT = ['#FFF4B8', '#F8E08E', '#D9A23A', '#8A5A1C'] as const;
const GREEN_GRADIENT = ['#37A66A', '#247C4A', '#145B32'] as const;
const RED_GRADIENT = ['#D54B3D', '#A72E26', '#741B1B'] as const;
const DARK_GRADIENT = ['#050505', '#130D06', '#241407', '#050505'] as const;

const LTR_ROW: 'row' | 'row-reverse' = I18nManager.isRTL ? 'row-reverse' : 'row';

type LifelineStage =
  | 'intro'
  | 'solutions'
  | 'practice'
  | 'launchReady'
  | 'parenPractice'
  | 'complete';

// The operand slots are filled from the dice; the operator slot is toggled IN
// PLACE inside the equation (no separate operator card row). The RESULT is never
// a drop target — it is COMPUTED from the operands + operator.
type EquationStep = 'left' | 'op' | 'right';
type Operator = '+' | '-' | '*' | '/';

// The inline operator toggle cycles through these in order. Data stays +/- for
// now, but the full set is here so the toggle teaches the whole sign palette.
const OPERATORS: Operator[] = ['+', '-', '*', '/'];
const PAREN_GROUPS: ParenGroup[] = ['left', 'right'];

type LifelineOption = {
  value: number;
  equation: string;
  op: Operator;
  left: number;
  right: number;
  result: number;
  targetId: string;
};

type EquationValues = { left: number | null; op: Operator | null; right: number | null };
type ParensBuildValues = {
  first: number | null;
  op1: Operator | null;
  second: number | null;
  op2: Operator | null;
  third: number | null;
};
type ParenGroup = 'right' | 'left';
type ParensExercise = {
  target: number;
  values: readonly [number, number, number];
  op1: Operator;
  op2: Operator;
  correctGroup: ParenGroup;
};
type BasicRound = {
  diceValues: readonly [number, number, number];
  fanCards: Card[];
  options: LifelineOption[];
};

const LIFELINE_REWARD_COINS = SALINDA_TUTORIAL_REWARDS.basic;
const LIFELINE_REWARD_SOURCE = 'gold_room_lifeline_tile';
const LIFELINE_REWARD_IDEMPOTENCY_KEY = 'gold_room_lifeline_tile_v1';
const LIFELINE_MAX_RESULT = 25;

// Every parentheses exercise REQUIRES the shift: the board evaluates with ×
// precedence, so the no-parens value is a+(b×c). The target is (a+b)×c — reachable
// only by wrapping (a+b) — so the player MUST move the parentheses from (b×c) to
// (a+b). correctGroup is therefore always 'left'.
//   e.g. board starts 2 + (3 × 4) = 14  →  shift to  (2 + 3) × 4 = 20  (target 20)
// Exercises are generated randomly each round (see buildRandomParensExercise); this
// curated pair is only a safety fallback if the generator can't find a clean one.
const PARENS_ROUND_COUNT = 2;
const PARENS_EXERCISES: readonly ParensExercise[] = [
  { target: 20, values: [2, 3, 4], op1: '+', op2: '*', correctGroup: 'left' },
  { target: 21, values: [2, 5, 3], op1: '+', op2: '*', correctGroup: 'left' },
];
const DEFAULT_PARENS_EXERCISE: ParensExercise = PARENS_EXERCISES[0];

function displayOperator(op: Operator): string {
  return op === '*' ? '×' : op === '/' ? '÷' : op;
}

// Wrap a math string in Unicode isolates so it ALWAYS renders strictly
// left-to-right (e.g. "(2 + 3) × 4 = 20"), even inside an RTL (Hebrew) layout.
// Without this the bidi algorithm reorders the tokens and mirrors the
// parentheses, so the equation reads backwards on the device.
const LTR_ISOLATE = String.fromCharCode(0x2066); // LEFT-TO-RIGHT ISOLATE
const POP_ISOLATE = String.fromCharCode(0x2069); // POP DIRECTIONAL ISOLATE
function forceLtr(text: string): string {
  return `${LTR_ISOLATE}${text}${POP_ISOLATE}`;
}

function parensExpression(exercise: ParensExercise, group: ParenGroup): string {
  const [a, b, c] = exercise.values;
  const op1 = displayOperator(exercise.op1);
  const op2 = displayOperator(exercise.op2);
  return group === 'left' ? `(${a} ${op1} ${b}) ${op2} ${c}` : `${a} ${op1} (${b} ${op2} ${c})`;
}

function parensEquation(exercise: ParensExercise, group: ParenGroup): string {
  const result = computeParensResult(exercise, group);
  return `${parensExpression(exercise, group)} = ${result ?? '?'}`;
}

function basicEquation(option: LifelineOption): string {
  return `${option.left} ${displayOperator(option.op)} ${option.right} = ${option.result}`;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function uniqueRandomValues(count: number, min: number, max: number, blocked = new Set<number>()): number[] {
  const values = new Set<number>();
  let guard = 0;
  while (values.size < count && guard < 200) {
    const next = randomInt(min, max);
    if (!blocked.has(next)) values.add(next);
    guard += 1;
  }
  return [...values];
}

function buildRandomBasicRound(): BasicRound {
  const diceValues = uniqueRandomValues(3, 2, 9) as [number, number, number];
  const candidates = new Map<number, Omit<LifelineOption, 'targetId' | 'equation'>>();

  for (const left of diceValues) {
    for (const right of diceValues) {
      if (left === right) continue;
      const plus = left + right;
      if (plus <= 20 && !candidates.has(plus)) {
        candidates.set(plus, { value: plus, op: '+', left, right, result: plus });
      }
      const minus = left - right;
      if (minus > 0 && !candidates.has(minus)) {
        candidates.set(minus, { value: minus, op: '-', left, right, result: minus });
      }
    }
  }

  const picked = shuffle([...candidates.values()]).slice(0, 3);
  const fallback = [
    { value: diceValues[0] + diceValues[1], op: '+' as Operator, left: diceValues[0], right: diceValues[1], result: diceValues[0] + diceValues[1] },
    { value: diceValues[1] + diceValues[2], op: '+' as Operator, left: diceValues[1], right: diceValues[2], result: diceValues[1] + diceValues[2] },
    { value: Math.abs(diceValues[0] - diceValues[2]), op: '-' as Operator, left: Math.max(diceValues[0], diceValues[2]), right: Math.min(diceValues[0], diceValues[2]), result: Math.abs(diceValues[0] - diceValues[2]) },
  ].filter((option) => option.result > 0 && option.result <= 20);
  const baseOptions = picked.length >= 3 ? picked : shuffle([...picked, ...fallback]).slice(0, 3);
  const optionValues = new Set(baseOptions.map((option) => option.value));
  const fanValues = [...optionValues, ...uniqueRandomValues(5 - optionValues.size, 1, 20, optionValues.size ? optionValues : new Set())].slice(0, 5);
  const fanCards = shuffle(fanValues).map((value) => ({ id: `lifeline-hand-${value}`, type: 'number' as const, value }));
  const options = baseOptions.map((option) => ({
    ...option,
    equation: basicEquation({ ...option, equation: '', targetId: `lifeline-hand-${option.value}` }),
    targetId: `lifeline-hand-${option.value}`,
  }));

  return { diceValues, fanCards, options };
}

// Random exercise of the form (a + b) × c [State A, wrong] → a + (b × c) [State B,
// correct = target]. Guaranteed to REQUIRE a right-shift: target ≠ the left-wrap
// value (true whenever a ≥ 1 and c ≥ 2). Dice are kept distinct so the placement
// tray never shows two identical tiles.
function buildRandomParensExercise(): ParensExercise {
  for (let guard = 0; guard < 200; guard += 1) {
    const a = randomInt(2, 5);
    const b = randomInt(2, 6);
    const c = randomInt(2, 5);
    if (a === b || a === c || b === c) continue;
    // The board evaluates with × precedence, so "no parens" already gives a+(b×c).
    // The target is the OTHER value, (a+b)×c — reachable ONLY by wrapping (a+b), so
    // the parentheses are genuinely REQUIRED (the two are never equal for a,c ≥ 2).
    const naturalValue = a + b * c; // a + (b × c) — what the board shows without help
    const target = (a + b) * c; // (a + b) × c — the goal; needs the parens shifted left
    if (target === naturalValue) continue; // safety; never true for these ranges
    if (target > LIFELINE_MAX_RESULT || naturalValue > LIFELINE_MAX_RESULT) continue;
    const exercise: ParensExercise = { target, values: [a, b, c] as [number, number, number], op1: '+', op2: '*', correctGroup: 'left' };
    const startingGroup = wrongStartingParenGroup(exercise);
    if (computeParensResult(exercise, exercise.correctGroup) !== target) continue;
    if (computeParensResult(exercise, startingGroup) === target) continue;
    return exercise;
  }
  return DEFAULT_PARENS_EXERCISE;
}

const EMPTY_EQUATION: EquationValues = { left: null, op: null, right: null };
const EMPTY_PARENS_BUILD: ParensBuildValues = { first: null, op1: null, second: null, op2: null, third: null };

const COPY = {
  intro: 'לא מוצאים תרגיל מתאים לקלפים שלכם? הכפתור הירוק ייתן את התשובה!',
  solutions:
    'הכפתור הירוק סרק את המניפה ומצא 3 פתרונות! כל מיני-קלף הוא פתרון אפשרי. לחצו עליו לחשיפת התרגיל.',
  selected: 'תוכלו להשתמש בתרגיל הזה כדי להיפטר מהקלף! לחצו "המשך" כדי לתרגל.',
  practiceLeft: 'מצוין! הציבו את הקובייה המתאימה במשבצת הריקה הראשונה.',
  practiceOp: 'עכשיו לחצו על משבצת הסימן שבמשוואה ובחרו את הפעולה הנכונה.',
  practiceRight: 'יופי! הציבו את הקובייה השנייה כדי להשלים את התרגיל.',
  launchReady: 'המשוואה מוכנה! הקישו על הקלף שהתוצאה שלו מתאימה, ואז לחצו שגר.',
  firstNumber: 'הניחו את המספר הראשון במשוואה',
  parensPractice: 'בחר קלף שגר',
  parensHint: 'לחץ על הכפתור כדי להזיז את מיקום הסוגריים',
  // Shown after a round is solved: between rounds vs. on the very last round.
  tryAnother: 'כל הכבוד! בוא ננסה עוד תרגיל',
  finalContinue: 'כל הכבוד! לחץ על המשך',
  successTitle: 'כל הכבוד הצלחנו',
  successBody: 'השלמתם את גלגל ההצלה וקיבלתם את תגמול חדר הזהב.',
  redLine1: 'לחצו על מיני קלפים',
  redLine2: 'כדי לקבל את התרגיל',
};

// The next thing the player must do, in strict order: place left operand → pick
// the operator → place right operand. Returns null once the case is solved.
function nextStep(values: EquationValues, option: LifelineOption | null): EquationStep | null {
  if (!option) return null;
  if (values.left == null) return 'left';
  if (values.op !== option.op) return 'op';
  if (values.right == null) return 'right';
  return null;
}

function cycleOperator(current: Operator | null): Operator {
  if (current == null) return OPERATORS[0];
  const index = OPERATORS.indexOf(current);
  return OPERATORS[(index + 1) % OPERATORS.length];
}

function applyOperator(a: number, op: Operator, b: number): number | null {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return b === 0 ? null : a / b;
    default:
      return null;
  }
}

// The computed result — auto-fills from the operands + selected operator once all
// three are present. The player never drops a third die into the result box.
function computeResult(values: EquationValues): number | null {
  if (values.left == null || values.op == null || values.right == null) return null;
  return applyOperator(values.left, values.op, values.right);
}

function computeParensResult(exercise: ParensExercise, group: ParenGroup): number | null {
  const [a, b, c] = exercise.values;
  if (group === 'left') {
    const grouped = applyOperator(a, exercise.op1, b);
    return grouped == null ? null : applyOperator(grouped, exercise.op2, c);
  }
  const grouped = applyOperator(b, exercise.op2, c);
  return grouped == null ? null : applyOperator(a, exercise.op1, grouped);
}

function operatorPrecedence(op: Operator): number {
  return op === '*' || op === '/' ? 2 : 1;
}

function computeNoParensResult(exercise: ParensExercise): number | null {
  const [a, b, c] = exercise.values;
  if (operatorPrecedence(exercise.op1) >= operatorPrecedence(exercise.op2)) {
    const grouped = applyOperator(a, exercise.op1, b);
    return grouped == null ? null : applyOperator(grouped, exercise.op2, c);
  }
  const grouped = applyOperator(b, exercise.op2, c);
  return grouped == null ? null : applyOperator(a, exercise.op1, grouped);
}

function isParensBuildComplete(build: ParensBuildValues): boolean {
  return build.first != null && build.op1 != null && build.second != null && build.op2 != null && build.third != null;
}

function computeBuildNoParensResult(build: ParensBuildValues): number | null {
  if (!isParensBuildComplete(build)) return null;
  const first = build.first as number;
  const second = build.second as number;
  const third = build.third as number;
  const op1 = build.op1 as Operator;
  const op2 = build.op2 as Operator;
  if (operatorPrecedence(op1) >= operatorPrecedence(op2)) {
    const grouped = applyOperator(first, op1, second);
    return grouped == null ? null : applyOperator(grouped, op2, third);
  }
  const grouped = applyOperator(second, op2, third);
  return grouped == null ? null : applyOperator(first, op1, grouped);
}

function computeBuildParensResult(build: ParensBuildValues, group: ParenGroup): number | null {
  if (!isParensBuildComplete(build)) return null;
  const first = build.first as number;
  const second = build.second as number;
  const third = build.third as number;
  const op1 = build.op1 as Operator;
  const op2 = build.op2 as Operator;
  if (group === 'left') {
    const grouped = applyOperator(first, op1, second);
    return grouped == null ? null : applyOperator(grouped, op2, third);
  }
  const grouped = applyOperator(second, op2, third);
  return grouped == null ? null : applyOperator(first, op1, grouped);
}

function buildMatchesExercise(build: ParensBuildValues, exercise: ParensExercise): boolean {
  const [a, b, c] = exercise.values;
  return build.first === a && build.op1 === exercise.op1 && build.second === b && build.op2 === exercise.op2 && build.third === c;
}

function wrongStartingParenGroup(exercise: ParensExercise): ParenGroup {
  const noParensResult = computeNoParensResult(exercise);
  const noParensGroup = PAREN_GROUPS.find((group) => computeParensResult(exercise, group) === noParensResult);
  if (noParensGroup && noParensGroup !== exercise.correctGroup) return noParensGroup;
  return exercise.correctGroup === 'left' ? 'right' : 'left';
}

function isComplete(values: EquationValues, option: LifelineOption | null): boolean {
  if (!option) return false;
  return values.left === option.left && values.op === option.op && values.right === option.right;
}

function InstructionBanner({ text }: { text: string }) {
  return (
    <View pointerEvents="none" style={styles.bannerPin}>
      <LinearGradient colors={GOLD_GRADIENT} locations={[0, 0.34, 0.72, 1]} style={styles.banner}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.58)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.bannerSheen}
        />
        <Text allowFontScaling={false} style={styles.bannerText}>
          {text}
        </Text>
      </LinearGradient>
    </View>
  );
}

function RoundGreenButton({ onPress, active }: { onPress: () => void; active: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: active ? 1.06 : 1.03,
          duration: 680,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: active ? 0.97 : 1,
          duration: 680,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="גלגל הצלה">
      <Animated.View style={[styles.greenOuterRing, { transform: [{ scale: pulse }] }]}>
        <LinearGradient colors={GREEN_GRADIENT} style={styles.greenButton}>
          <View pointerEvents="none" style={styles.greenInnerRing} />
          <Text allowFontScaling={false} style={styles.greenText}>
            גלגל
          </Text>
          <Text allowFontScaling={false} style={styles.greenText}>
            הצלה
          </Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

function RedExerciseButton({
  option,
  mode,
  parenGroup,
  parensExercise,
  parensLabel,
  basicLabel,
}: {
  option: LifelineOption | null;
  mode: 'basic' | 'parens';
  parenGroup: ParenGroup;
  parensExercise: ParensExercise;
  parensLabel?: string;
  basicLabel?: string;
}) {
  return (
    <LinearGradient colors={RED_GRADIENT} style={styles.redButton}>
      {mode === 'parens' ? (
        <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62} style={styles.mathText}>
          {parensLabel ?? parensEquation(parensExercise, parenGroup)}
        </Text>
      ) : option ? (
        <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.mathText}>
          {basicLabel ?? basicEquation(option)}
        </Text>
      ) : (
        <>
          <Text allowFontScaling={false} style={styles.redDefaultText}>
            {COPY.redLine1}
          </Text>
          <Text allowFontScaling={false} style={styles.redDefaultText}>
            {COPY.redLine2}
          </Text>
        </>
      )}
    </LinearGradient>
  );
}

function DiceButton({
  value,
  enabled,
  onPress,
}: {
  value: number;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!enabled} accessibilityRole="button" accessibilityLabel={`קוביה ${value}`}>
      <View style={[styles.diceCube, enabled && styles.diceCubeEnabled]}>
        <Text allowFontScaling={false} style={styles.diceText}>
          {value}
        </Text>
      </View>
    </Pressable>
  );
}

function DiceRow({
  diceValues,
  option,
  values,
  stage,
  onPressDie,
}: {
  diceValues: readonly number[];
  option: LifelineOption | null;
  values: EquationValues;
  stage: LifelineStage;
  onPressDie: (value: number) => void;
}) {
  const step = stage === 'practice' ? nextStep(values, option) : null;
  const expected = option && step === 'left' ? option.left : option && step === 'right' ? option.right : null;
  // Step B: a die placed into the equation VANISHES from the board entirely —
  // we filter out any value already living in a slot, leaving only the flat
  // number text inside the slot. minHeight keeps the table layout from jumping
  // as dice disappear.
  const usedValues = [values.left, values.right].filter((v): v is number => v != null);
  const visibleDice = diceValues.filter((value) => !usedValues.includes(value));

  return (
    <View style={styles.diceRow}>
      {visibleDice.map((value) => (
        <DiceButton key={value} value={value} enabled={expected != null && value === expected} onPress={() => onPressDie(value)} />
      ))}
    </View>
  );
}

// A single dashed operand box. Pulses while it is the active drop target.
function OperandSlot({ value, active }: { value: number | null; active: boolean }) {
  const glow = useSlotGlow(active);
  return (
    <View style={[styles.slotBox, value != null && styles.slotBoxFilled]}>
      {active ? <Animated.View pointerEvents="none" style={[styles.slotGlow, glow]} /> : null}
      <Text allowFontScaling={false} style={value == null ? styles.slotHint : styles.slotText}>
        {value == null ? '' : value}
      </Text>
    </View>
  );
}

// The inline operator slot. Tap to cycle +, -, *, / until it matches the
// exercise. Locks (green, non-tappable) once the correct sign is chosen.
function OperatorSlot({
  op,
  active,
  locked,
  onPress,
}: {
  op: Operator | null;
  active: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  const glow = useSlotGlow(active);
  return (
    <Pressable onPress={onPress} disabled={!active} accessibilityRole="button" accessibilityLabel="בחירת סימן" hitSlop={10}>
      <View style={[styles.opSlot, active && styles.opSlotActive, locked && styles.opSlotLocked]}>
        {active ? <Animated.View pointerEvents="none" style={[styles.slotGlow, glow]} /> : null}
        <Text allowFontScaling={false} style={op == null ? styles.opSlotHint : styles.opSlotText}>
          {op == null ? '' : displayOperator(op)}
        </Text>
      </View>
    </Pressable>
  );
}

// Shared pulsing-glow animation for active slots.
function useSlotGlow(active: boolean) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);
  return {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.9] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }],
  };
}

function EquationBoard({
  option,
  values,
  step,
  result,
  onPressOperator,
}: {
  option: LifelineOption | null;
  values: EquationValues;
  step: EquationStep | null;
  result: number | null;
  onPressOperator: () => void;
}) {
  if (!option) {
    return (
      <View style={styles.equationTrack}>
        <OperandSlot value={null} active={false} />
        <OperatorSlot op={null} active={false} locked={false} onPress={onPressOperator} />
        <OperandSlot value={null} active={false} />
        <Text allowFontScaling={false} style={styles.operatorText}>
          =
        </Text>
        <View style={[styles.slotBox, styles.resultSlot]}>
          <Text allowFontScaling={false} style={styles.slotHint}>
            {''}
          </Text>
        </View>
      </View>
    );
  }

  const opLocked = values.op === option.op;

  // The equation is rendered from an ORDERED element list inside an LTR-forced
  // row. Keeping it as discrete, individually-keyed elements (rather than one
  // mirrored string) is what both fixes RTL and leaves room to drop draggable
  // parenthesis elements into this same track in a future update.
  return (
    <View style={styles.equationTrack}>
      <OperandSlot value={values.left} active={step === 'left'} />
      <OperatorSlot op={values.op} active={step === 'op'} locked={opLocked} onPress={onPressOperator} />
      <OperandSlot value={values.right} active={step === 'right'} />
      <Text allowFontScaling={false} style={styles.operatorText}>
        =
      </Text>
      <View style={[styles.slotBox, styles.resultSlot, result != null && styles.slotBoxFilled]}>
        <Text allowFontScaling={false} style={result == null ? styles.slotHint : styles.slotText}>
          {result == null ? '' : result}
        </Text>
      </View>
    </View>
  );
}

function useOrangeGlow(active: boolean) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 460, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 460, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);
  return {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.42, 1] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.1] }) }],
  };
}

function ParensMark({
  children,
  active,
  disabled,
  compact = false,
  onPress,
}: {
  children: string;
  active: boolean;
  disabled: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  const glow = useOrangeGlow(active && !disabled);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="change parentheses position"
    >
      <View style={[styles.parensMark, compact && { height: 50 }, active && styles.parensMarkActive, disabled && styles.parensMarkDisabled]}>
        {active ? <Animated.View pointerEvents="none" style={[styles.parensMarkGlow, glow]} /> : null}
        <Text
          allowFontScaling={false}
          style={[styles.parensMarkText, active && styles.parensMarkTextActive, compact && { fontSize: active ? 46 : 42, lineHeight: active ? 50 : 46 }]}
        >
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

function ParenthesesBoard({
  exercise,
  group,
  build,
  showParens,
  compact = false,
  onPressDie,
  onPressOp,
  onToggleGroup,
}: {
  exercise: ParensExercise;
  group: ParenGroup;
  build: ParensBuildValues;
  showParens: boolean;
  compact?: boolean;
  onPressDie: (value: number) => void;
  onPressOp: (slot: 'op1' | 'op2') => void;
  onToggleGroup: () => void;
}) {
  const complete = isParensBuildComplete(build);
  const result = showParens ? computeBuildParensResult(build, group) : computeBuildNoParensResult(build);
  const solved = complete && showParens && result === exercise.target;
  const [a, b, c] = exercise.values;
  const usedValues = [build.first, build.second, build.third].filter((value): value is number => value != null);
  const visibleDice = exercise.values.filter((value, index) => !usedValues.includes(value) || exercise.values.indexOf(value) !== index);
  const nextNumber =
    build.first == null
      ? a
      : build.op1 === exercise.op1 && build.second == null
        ? b
        : build.op2 === exercise.op2 && build.third == null
          ? c
          : null;
  const op1Locked = build.op1 === exercise.op1;
  const op2Locked = build.op2 === exercise.op2;

  return (
    <View style={[styles.parensBoard, compact && { gap: 6 }]}>
      <View style={[styles.parensDiceTray, compact && { minHeight: 44, gap: 10 }]}>
        {visibleDice.map((value, index) => {
          const enabled = nextNumber === value;
          return (
            <Pressable
              key={`paren-die-${index}-${value}`}
              onPress={() => onPressDie(value)}
              disabled={!enabled}
              accessibilityRole="button"
              accessibilityLabel={`place ${value}`}
              hitSlop={8}
            >
              <View style={[styles.parensNumberTile, compact && { width: 44, height: 44 }, enabled && styles.diceCubeEnabled]}>
                <Text allowFontScaling={false} style={styles.parensNumberText}>
                  {value}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.parensSlotTrack, compact && { minHeight: 54, paddingVertical: 6 }, complete && solved && styles.parensWorkSurfaceSolved]}>
        {showParens ? (
          <ParensMark active={group === 'left'} disabled={false} compact={compact} onPress={onToggleGroup}>
            (
          </ParensMark>
        ) : (
          <View style={[styles.parensMarkPlaceholder, compact && { height: 50 }]} />
        )}
        <OperandSlot value={build.first} active={build.first == null} />
        <OperatorSlot op={build.op1} active={build.first != null && !op1Locked} locked={op1Locked} onPress={() => onPressOp('op1')} />
        {showParens ? (
          <ParensMark active={group === 'right'} disabled={false} compact={compact} onPress={onToggleGroup}>
            (
          </ParensMark>
        ) : (
          <View style={[styles.parensMarkPlaceholder, compact && { height: 50 }]} />
        )}
        <OperandSlot value={build.second} active={op1Locked && build.second == null} />
        {showParens ? (
          <ParensMark active={group === 'left'} disabled={false} compact={compact} onPress={onToggleGroup}>
            )
          </ParensMark>
        ) : (
          <View style={[styles.parensMarkPlaceholder, compact && { height: 50 }]} />
        )}
        <OperatorSlot op={build.op2} active={build.second != null && !op2Locked} locked={op2Locked} onPress={() => onPressOp('op2')} />
        <OperandSlot value={build.third} active={op2Locked && build.third == null} />
        {showParens ? (
          <ParensMark active={group === 'right'} disabled={false} compact={compact} onPress={onToggleGroup}>
            )
          </ParensMark>
        ) : (
          <View style={[styles.parensMarkPlaceholder, compact && { height: 50 }]} />
        )}
        <Text allowFontScaling={false} style={styles.operatorText}>
          =
        </Text>
        <View style={[styles.slotBox, styles.resultSlot, result != null && styles.slotBoxFilled, solved && styles.parensResultSolved]}>
          <Text allowFontScaling={false} style={result == null ? styles.slotHint : styles.slotText}>
            {result == null ? '' : result}
          </Text>
        </View>
      </View>

    </View>
  );
}

function NativeOrangeParensButton({
  group,
  exercise,
  visible,
  disabled,
  solved,
  onPress,
  pulse,
  blink,
}: {
  group: ParenGroup;
  exercise: ParensExercise;
  visible: boolean;
  disabled: boolean;
  solved: boolean;
  onPress: () => void;
  // Driven by the PARENT so its click handler can kill the loop synchronously.
  pulse: Animated.Value;
  blink: Animated.Value;
}) {
  const [a, b, c] = exercise.values;
  const o1 = displayOperator(exercise.op1);
  const o2 = displayOperator(exercise.op2);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="swap parentheses"
      hitSlop={12}
    >
      <Animated.View
        style={[
          styles.nativeParensButton,
          !visible && styles.nativeParensButtonHidden,
          disabled && styles.nativeParensButtonDisabled,
          solved && styles.nativeParensButtonSolved,
          { opacity: visible ? blink : 0, transform: [{ scale: pulse }] },
        ]}
      >
        <View style={styles.nativeParensIcon}>
          {group === 'right' ? (
            <>
              <Text allowFontScaling={false} style={styles.nativeParensDigit}>
                {a}{' '}
              </Text>
              <Text allowFontScaling={false} style={styles.nativeParensBrace}>
                (
              </Text>
              <Text allowFontScaling={false} style={styles.nativeParensDigit}>
                {b}{o2}{c}
              </Text>
              <Text allowFontScaling={false} style={styles.nativeParensBrace}>
                )
              </Text>
            </>
          ) : (
            <>
              <Text allowFontScaling={false} style={styles.nativeParensBrace}>
                (
              </Text>
              <Text allowFontScaling={false} style={styles.nativeParensDigit}>
                {a}{o1}{b}
              </Text>
              <Text allowFontScaling={false} style={styles.nativeParensBrace}>
                )
              </Text>
              <Text allowFontScaling={false} style={styles.nativeParensDigit}>
                {' '}{c}
              </Text>
            </>
          )}
        </View>
        <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={styles.nativeParensLabel}>
          שינוי מיקום הסוגריים
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function MiniCards({
  options,
  selectedValue,
  parensTarget,
  showParensCard,
  onSelect,
}: {
  options: LifelineOption[];
  selectedValue: number | null;
  parensTarget: number;
  showParensCard: boolean;
  onSelect: (option: LifelineOption) => void;
}) {
  return (
    <View style={styles.miniRow}>
      {(showParensCard ? [] : options).map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onSelect(option)}
          accessibilityRole="button"
          accessibilityLabel={`פתרון ${option.value}`}
        >
          <View style={[styles.miniCard, selectedValue === option.value && styles.miniCardActive]}>
            <Text allowFontScaling={false} style={styles.miniCardText}>
              {option.value}
            </Text>
          </View>
        </Pressable>
      ))}
      {showParensCard ? (
        <View style={[styles.miniCard, styles.miniCardActive]}>
          <Text allowFontScaling={false} style={styles.miniCardText}>
            {parensTarget}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function CompletionModal({
  onComplete,
  rewardCoins,
  totalCoins,
  rewardStatus,
}: {
  onComplete: () => void;
  rewardCoins: number;
  totalCoins: number;
  rewardStatus: 'idle' | 'awarding' | 'awarded' | 'error';
}) {
  const pop = useRef(new Animated.Value(0)).current;
  const coinBurst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(coinBurst, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(coinBurst, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [coinBurst, pop]);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1] });
  const coinPositions = [
    { x: -58, y: -34 },
    { x: 54, y: -40 },
    { x: -74, y: 18 },
    { x: 72, y: 14 },
    { x: 0, y: -58 },
  ];

  return (
    <View style={styles.completeOverlay}>
      <Animated.View style={[styles.completeCard, { transform: [{ scale }] }]}>
        <Text allowFontScaling={false} style={styles.completeIcon}>
          ✓
        </Text>
        <Text allowFontScaling={false} style={styles.completeTitle}>
          {COPY.successTitle}
        </Text>
        <View style={styles.coinRewardStage}>
          {coinPositions.map((pos, index) => {
            const translateX = coinBurst.interpolate({ inputRange: [0, 1], outputRange: [0, pos.x] });
            const translateY = coinBurst.interpolate({ inputRange: [0, 1], outputRange: [0, pos.y] });
            const opacity = coinBurst.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 1, 0.18] });
            const coinScale = coinBurst.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.4, 1.1, 0.82] });
            return (
              <Animated.Text
                key={`lifeline-coin-${index}`}
                allowFontScaling={false}
                style={[
                  styles.rewardCoin,
                  {
                    opacity,
                    transform: [{ translateX }, { translateY }, { scale: coinScale }],
                  },
                ]}
              >
                🪙
              </Animated.Text>
            );
          })}
          <Text allowFontScaling={false} style={styles.coinRewardText}>
            +{rewardCoins}
          </Text>
          <Text allowFontScaling={false} style={styles.coinRewardLabel}>
            מטבעות
          </Text>
        </View>
        <View style={styles.shopReminderBox}>
          <Text allowFontScaling={false} style={styles.shopReminderIcon}>
            🛒
          </Text>
          <Text allowFontScaling={false} style={styles.shopReminderText}>
            כבר צברת {totalCoins} מטבעות! תוכל להשתמש בהם בחנות.
          </Text>
        </View>
        {rewardStatus === 'error' ? (
          <Text allowFontScaling={false} style={styles.rewardErrorText}>
            המטבעות יוצגו עכשיו, וננסה לסנכרן את היתרה שוב בהמשך.
          </Text>
        ) : null}
        <Text allowFontScaling={false} style={styles.completePrompt}>
          עכשיו אפשר לבחור קלף ולשגר.
        </Text>
        <GoldButton label="סיום" onPress={onComplete} fullWidth height={54} fontSize={20} />
      </Animated.View>
    </View>
  );
}

function LaunchCardFlight({ value, progress }: { value: number; progress: Animated.Value }) {
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -360] });
  const scale = progress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, 0.82, 0.38] });
  const opacity = progress.interpolate({ inputRange: [0, 0.78, 1], outputRange: [1, 1, 0] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-10deg'] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.launchCardFlight,
        {
          opacity,
          transform: [{ translateY }, { scale }, { rotate }],
        },
      ]}
    >
      <View style={styles.launchCard}>
        <Text allowFontScaling={false} style={styles.launchCardText}>
          {value}
        </Text>
      </View>
    </Animated.View>
  );
}

export function LifelineTile({ onComplete }: { onComplete: () => void }) {
  const { width, height } = useWindowDimensions();
  // The iPhone mobile-web viewport is only ~390×664 (browser chrome eats the rest).
  // On such short screens the parentheses board + mini-card + fan can't all sit at
  // their tall-screen positions, so we switch to a compact, lifted layout.
  const isShort = height < 720;
  const auth = useAuthOptional();
  const basicRound = useMemo(() => buildRandomBasicRound(), []);
  // Capped tighter than the usual min(width,480): the Lifeline tile stacks a lot
  // vertically (banner + button + table + mini-cards + fan), so a smaller fan
  // keeps the whole hand on-screen even on the short iPhone browser safe-area.
  // Smaller fan footprint frees vertical room for an ENLARGED table without
  // overflowing the short iPhone-web safe-area (≈664px) — the worst-case height.
  const fanWidth = Math.min(width, 256);
  const [stage, setStage] = useState<LifelineStage>('intro');
  const [selectedValue, setSelectedValue] = useState<number | null>(null);
  const [equationValues, setEquationValues] = useState<EquationValues>(EMPTY_EQUATION);
  const [launchCardSelected, setLaunchCardSelected] = useState(false);
  const [launchingValue, setLaunchingValue] = useState<number | null>(null);
  const [parensExercise, setParensExercise] = useState<ParensExercise>(() => buildRandomParensExercise());
  const [parenGroup, setParenGroup] = useState<ParenGroup>('right');
  const [parensBuild, setParensBuild] = useState<ParensBuildValues>(EMPTY_PARENS_BUILD);
  const [parenApplied, setParenApplied] = useState(false);
  // Which parentheses exercise we're on (index into PARENS_EXERCISES), and whether
  // the current round has been solved (showing the "next exercise" / "הבנתי" CTA).
  const [parensRoundIndex, setParensRoundIndex] = useState(0);
  const [parensRoundSolved, setParensRoundSolved] = useState(false);
  // Hard lock engaged during the SOLVED_HOLD window — swallows every table/dice/
  // button tap so nothing can interrupt the 1.5s "visual register" pause.
  const [isBoardLocked, setIsBoardLocked] = useState(false);
  const [rewardAwarded, setRewardAwarded] = useState(false);
  const [rewardStatus, setRewardStatus] = useState<'idle' | 'awarding' | 'awarded' | 'error'>('idle');
  const [rewardTotalBalance, setRewardTotalBalance] = useState<number | null>(null);
  const boardFade = useRef(new Animated.Value(1)).current;
  const launchProgress = useRef(new Animated.Value(0)).current;
  // Orange "shift" button pulse/blink live in the PARENT so the click handler can
  // synchronously .stop() the loop (the kill-switch). The SOLVED_HOLD timeout is
  // likewise held in a ref so it can be cleared on unmount.
  const parenPulse = useRef(new Animated.Value(1)).current;
  const parenBlink = useRef(new Animated.Value(1)).current;
  const parenPulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const solvedHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedOption = useMemo(
    () => basicRound.options.find((option) => option.value === selectedValue) ?? null,
    [basicRound.options, selectedValue],
  );
  const selectedIds = useMemo(() => {
    const ids = new Set<string>();
    if (launchCardSelected && selectedOption) ids.add(selectedOption.targetId);
    return ids;
  }, [launchCardSelected, selectedOption]);
  const step = stage === 'practice' ? nextStep(equationValues, selectedOption) : null;
  const computedResult = computeResult(equationValues);
  const solved = isComplete(equationValues, selectedOption);
  const parensComplete = isParensBuildComplete(parensBuild) && buildMatchesExercise(parensBuild, parensExercise);
  // The board shows the parentheses in the CURRENT group (default = the wrong LEFT
  // wrap). A mismatch is when that displayed grouping misses the target — exactly
  // when the orange "shift" button must blink. Solved once the shift lands on it.
  const parensDisplayedResult = computeBuildParensResult(parensBuild, parenGroup);
  const parensMismatch = parensComplete && !parenApplied && parensDisplayedResult !== parensExercise.target;
  const isLastParensRound = parensRoundIndex >= PARENS_ROUND_COUNT - 1;
  // The Red Banner shows the FULL solved exercise of the selected mini-card — the
  // GOAL the player copies onto the board — forced strictly LTR so it never reads
  // backwards on a mobile RTL layout. e.g. parens goal: "(2 + 3) × 4 = 20". The
  // board starts at the wrong wrap "2 + (3 × 4) = 14" and is shifted to match it.
  const basicDisplayLabel = useMemo(
    () => (selectedOption ? forceLtr(basicEquation(selectedOption)) : undefined),
    [selectedOption],
  );
  const parensDisplayLabel = useMemo(
    () => forceLtr(parensEquation(parensExercise, parensExercise.correctGroup)),
    [parensExercise],
  );
  const projectedRewardBalance = rewardTotalBalance ?? Math.max(0, Math.floor(Number(auth?.profile?.total_coins ?? 0) || 0));
  const instruction =
    stage === 'intro'
      ? COPY.intro
      : stage === 'solutions'
        ? selectedOption
          ? COPY.selected
          : COPY.solutions
        : stage === 'launchReady'
          ? COPY.launchReady
          : stage === 'parenPractice'
            ? parensRoundSolved
              ? isLastParensRound
                ? COPY.finalContinue
                : COPY.tryAnother
              : isBoardLocked
                ? COPY.successTitle
                : parensMismatch
                  ? COPY.parensHint
                  : COPY.firstNumber
            : stage === 'practice' && equationValues.left == null
              ? COPY.firstNumber
            : step === 'left'
                ? COPY.practiceLeft
                : step === 'op'
                  ? COPY.practiceOp
                  : step === 'right'
                    ? COPY.practiceRight
                    : COPY.selected;

  useEffect(() => {
    if (stage !== 'practice' || !solved) return;
    void playSfx('success', { cooldownMs: 0, volumeOverride: 0.72 });
    setLaunchCardSelected(false);
    setStage('launchReady');
  }, [solved, stage]);

  // Drive the orange "shift" button's pulse/blink while a shift is required. The
  // loop instance is held in a ref so handleParenShift can KILL it synchronously on
  // the first click (no zombie animation leak).
  const parenShiftPending = stage === 'parenPractice' && parensMismatch && !isBoardLocked;
  useEffect(() => {
    if (!parenShiftPending) {
      parenPulseLoopRef.current?.stop();
      parenPulseLoopRef.current = null;
      parenPulse.setValue(1);
      parenBlink.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(parenPulse, { toValue: 1.1, duration: 430, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(parenPulse, { toValue: 1, duration: 430, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(parenBlink, { toValue: 0.62, duration: 430, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(parenBlink, { toValue: 1, duration: 430, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ]),
    );
    parenPulseLoopRef.current = loop;
    loop.start();
    return () => {
      loop.stop();
      parenPulseLoopRef.current = null;
    };
  }, [parenBlink, parenPulse, parenShiftPending]);

  // Safety law: guarantee the SOLVED_HOLD timer can never fire after unmount.
  useEffect(() => {
    return () => {
      if (solvedHoldTimerRef.current) {
        clearTimeout(solvedHoldTimerRef.current);
        solvedHoldTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (stage !== 'complete' || rewardAwarded) return;
    let cancelled = false;
    setRewardAwarded(true);
    setRewardStatus('awarding');
    const startingBalance = Math.max(0, Math.floor(Number(auth?.profile?.total_coins ?? 0) || 0));
    void (async () => {
      const result = await (auth?.awardCoins?.(
        LIFELINE_REWARD_COINS,
        LIFELINE_REWARD_SOURCE,
        LIFELINE_REWARD_IDEMPOTENCY_KEY,
      ) ?? Promise.resolve<'ok' | 'error'>('error'));
      if (cancelled) return;
      if (result === 'ok') {
        setRewardTotalBalance(startingBalance + LIFELINE_REWARD_COINS);
        setRewardStatus('awarded');
        void playSfx('meterCelebrateCoins', { cooldownMs: 0, volumeOverride: 0.8 });
      } else {
        setRewardTotalBalance(startingBalance);
        setRewardStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, rewardAwarded, stage]);

  const fadeBoard = useCallback(() => {
    boardFade.setValue(0);
    Animated.timing(boardFade, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [boardFade]);

  // Load a FRESH random parentheses exercise for the given round on a clean board.
  // The exercise is generated once here so the board, banner and starting (wrong)
  // wrap all reference the SAME values.
  const loadParensRound = useCallback((roundIndex: number) => {
    const exercise = buildRandomParensExercise();
    setParensRoundIndex(roundIndex);
    setParensExercise(exercise);
    setParenGroup(wrongStartingParenGroup(exercise));
    setParensBuild(EMPTY_PARENS_BUILD);
    setParenApplied(false);
    setParensRoundSolved(false);
    setIsBoardLocked(false);
  }, []);

  const openSolutions = useCallback(() => {
    void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.5 });
    setStage('solutions');
    setSelectedValue(null);
    setEquationValues(EMPTY_EQUATION);
    setLaunchCardSelected(false);
    loadParensRound(0);
    setRewardAwarded(false);
    setRewardStatus('idle');
    setRewardTotalBalance(null);
    fadeBoard();
  }, [fadeBoard, loadParensRound]);

  const selectMini = useCallback((option: LifelineOption) => {
    void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.52 });
    setSelectedValue(option.value);
    setEquationValues(EMPTY_EQUATION);
    setLaunchCardSelected(false);
    if (stage === 'solutions') {
      setStage('practice');
      fadeBoard();
    }
  }, [fadeBoard, stage]);

  const startPractice = useCallback(() => {
    setStage('practice');
    setEquationValues(EMPTY_EQUATION);
    setLaunchCardSelected(false);
    fadeBoard();
  }, [fadeBoard]);

  const launchFirstCard = useCallback(() => {
    if (!launchCardSelected || !selectedOption || launchingValue != null) return;
    void playSfx('combo', { cooldownMs: 0, volumeOverride: 0.68 });
    setLaunchingValue(selectedOption.value);
    launchProgress.setValue(0);
    Animated.timing(launchProgress, {
      toValue: 1,
      duration: 720,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setLaunchingValue(null);
      setLaunchCardSelected(false);
      setStage('parenPractice');
      loadParensRound(0);
      fadeBoard();
    });
  }, [fadeBoard, launchCardSelected, launchProgress, launchingValue, loadParensRound, selectedOption]);

  const startParensPractice = useCallback(() => {
    void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.5 });
    setStage('parenPractice');
    setSelectedValue(null);
    loadParensRound(0);
    fadeBoard();
  }, [fadeBoard, loadParensRound]);

  const pressDie = useCallback(
    (value: number) => {
      if (stage !== 'practice' || !selectedOption) return;
      const current = nextStep(equationValues, selectedOption);
      if (current !== 'left' && current !== 'right') return;
      const expected = current === 'left' ? selectedOption.left : selectedOption.right;
      if (value !== expected) return;
      void playSfx('place', { cooldownMs: 0, volumeOverride: 0.56 });
      setEquationValues((prev) => ({ ...prev, [current]: value }));
    },
    [equationValues, selectedOption, stage],
  );

  const pressOperator = useCallback(() => {
    if (stage !== 'practice' || !selectedOption) return;
    if (nextStep(equationValues, selectedOption) !== 'op') return;
    void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.5 });
    setEquationValues((prev) => ({ ...prev, op: cycleOperator(prev.op) }));
  }, [equationValues, selectedOption, stage]);

  // ── The orange "shift parentheses" click — a strict 4-step SOLVED_HOLD timeline.
  //    Replaces the old fire-and-forget toggle that cut to the modal instantly and
  //    left the pulse loop running as a zombie animation.
  const handleParenShift = useCallback(() => {
    if (stage !== 'parenPractice' || isBoardLocked || !parensMismatch) return;

    // STEP 1 — KILL-SWITCH: stop the pulsing loop on the very first line, then snap
    // the button back to a static, solid state. No zombie animation can survive.
    parenPulseLoopRef.current?.stop();
    parenPulseLoopRef.current = null;
    parenPulse.setValue(1);
    parenBlink.setValue(1);

    // STEP 2 — LOCK & REFLECT: shift the parentheses to the correct (right) wrap so
    // the board + Red Banner both mirror "2 + (3 × 4) = 14", and hard-lock the board
    // so any further tap on the table / dice / button is swallowed.
    setParenGroup(parensExercise.correctGroup);
    setParenApplied(true);
    setIsBoardLocked(true);
    void playSfx('gameWin', { cooldownMs: 0, volumeOverride: 0.9 });

    // STEP 3 — VISUAL REGISTER: hold the corrected equation still for 1,500ms so the
    // player can actually read it. The timer is stored in a ref and cleared on
    // unmount (see the cleanup effect) so it can never fire on a dead component.
    if (solvedHoldTimerRef.current) clearTimeout(solvedHoldTimerRef.current);
    solvedHoldTimerRef.current = setTimeout(() => {
      solvedHoldTimerRef.current = null;
      // STEP 4 — REVEAL THE CTA: after the read-pause, surface the round-review
      // prompt. A non-final round shows "בוא ננסה עוד תרגיל" + arrow → next round;
      // the final round shows "הבנתי" → 'complete' (modal + +75 coins + shop text).
      setParensRoundSolved(true);
    }, 1500);
  }, [isBoardLocked, parenBlink, parenPulse, parensExercise.correctGroup, parensMismatch, stage]);

  // "בוא ננסה עוד תרגיל" → load the next parentheses exercise on a fresh board.
  const advanceParensRound = useCallback(() => {
    void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.5 });
    loadParensRound(parensRoundIndex + 1);
    fadeBoard();
  }, [fadeBoard, loadParensRound, parensRoundIndex]);

  // Final "הבנתי" → fire the success modal + +75 coin payout + return to the room.
  const finishParensLesson = useCallback(() => {
    void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.5 });
    setStage('complete');
  }, []);

  const pressParenDie = useCallback(
    (value: number) => {
      if (stage !== 'parenPractice' || isBoardLocked) return;
      const [a, b, c] = parensExercise.values;
      const expected =
        parensBuild.first == null
          ? a
          : parensBuild.op1 === parensExercise.op1 && parensBuild.second == null
            ? b
            : parensBuild.op2 === parensExercise.op2 && parensBuild.third == null
              ? c
              : null;
      if (value !== expected) return;
      void playSfx('place', { cooldownMs: 0, volumeOverride: 0.56 });
      setParensBuild((current) => {
        if (current.first == null) return { ...current, first: value };
        if (current.second == null && current.op1 === parensExercise.op1) return { ...current, second: value };
        if (current.third == null && current.op2 === parensExercise.op2) return { ...current, third: value };
        return current;
      });
    },
    [isBoardLocked, parensBuild.first, parensBuild.op1, parensBuild.op2, parensBuild.second, parensBuild.third, parensExercise.op1, parensExercise.op2, parensExercise.values, stage],
  );

  const pressParenOperator = useCallback(
    (slot: 'op1' | 'op2') => {
      if (stage !== 'parenPractice' || isBoardLocked) return;
      if (slot === 'op1' && parensBuild.first == null) return;
      if (slot === 'op2' && parensBuild.second == null) return;
      void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.5 });
      setParensBuild((current) => ({ ...current, [slot]: cycleOperator(current[slot]) }));
    },
    [isBoardLocked, parensBuild.first, parensBuild.second, stage],
  );

  const tapFanCard = useCallback(
    (card: Card) => {
      if (stage !== 'launchReady' || !selectedOption || card.id !== selectedOption.targetId) return;
      void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.5 });
      setLaunchCardSelected(true);
    },
    [selectedOption, stage],
  );

  const canTapFanCard = useCallback(
    (card: Card) => stage === 'launchReady' && !!selectedOption && card.id === selectedOption.targetId,
    [selectedOption, stage],
  );

  // The single bottom "המשך" CTA is revealed only once a mini-card is selected
  // (Step A) — it drives the move into practice. Intro advances via the green
  // button itself, so no CTA clutters the intro screen.
  const continueAction =
    stage === 'solutions' && selectedOption
      ? startPractice
      : stage === 'launchReady' && launchCardSelected
        ? launchFirstCard
        : stage === 'parenPractice' && parensRoundSolved
          ? isLastParensRound
            ? finishParensLesson
            : advanceParensRound
          : null;
  const continueLabel =
    stage === 'launchReady'
      ? 'שגר  ›'
      : stage === 'parenPractice' && parensRoundSolved && isLastParensRound
        ? 'הבנתי'
        : 'המשך  ›';

  return (
    <SafeAreaView style={styles.root}>
      <LinearGradient colors={DARK_GRADIENT} locations={[0, 0.38, 0.72, 1]} style={StyleSheet.absoluteFill} />
      <InstructionBanner text={instruction} />

      {/* Strict top-to-bottom column. Each zone owns a fixed band EXCEPT the
       *  table, which carries flex:1 + a rigid minHeight: it absorbs all slack so
       *  there is no dead gap, grows/shrinks deterministically, and pins the
       *  mini-cards directly above the fan on every screen height. */}
      <View style={[styles.column, isShort && { paddingTop: 48, paddingBottom: 232 }]} pointerEvents="box-none">
        {/* (1) Action zone — green helper (intro) or red exercise button, held
         *      clear of the banner by a real top margin. The practice band is
         *      shorter (the red button is smaller than the green ring) so the
         *      enlarged table + mini-cards + fan all fit the short safe-area. */}
        <View style={[styles.actionZone, stage !== 'intro' && styles.actionZonePractice, isShort && stage !== 'intro' && { minHeight: 60, marginTop: 4 }]}>
          {stage === 'intro' ? (
            <RoundGreenButton onPress={openSolutions} active={false} />
          ) : (
            <RedExerciseButton
              option={selectedOption}
              mode={stage === 'parenPractice' ? 'parens' : 'basic'}
              parenGroup={parenGroup}
              parensExercise={parensExercise}
              parensLabel={parensDisplayLabel}
              basicLabel={basicDisplayLabel}
            />
          )}
        </View>

        {stage === 'parenPractice' && (parensMismatch || (isBoardLocked && !parensRoundSolved)) ? (
          <View style={styles.parensButtonZone} pointerEvents="box-none">
            <NativeOrangeParensButton
              group={parenGroup}
              exercise={parensExercise}
              visible={parensMismatch || isBoardLocked}
              disabled={isBoardLocked || !parensMismatch}
              solved={isBoardLocked}
              onPress={handleParenShift}
              pulse={parenPulse}
              blink={parenBlink}
            />
          </View>
        ) : null}

        {/* (2) Table — enlarged, rigid, and the home of BOTH the dice and the
         *      equation. Dice sit on the upper surface; the equation rests below
         *      them, all framed by the golden table image. */}
        <Animated.View style={[styles.tableZone, isShort && { maxWidth: 286, marginTop: -6, marginBottom: 2 }, { opacity: boardFade }]}>
          <Image source={GOLD_TABLE_IMG} resizeMode="contain" style={styles.tableImage} />
          <View style={styles.tableContent} pointerEvents="box-none">
            {stage === 'parenPractice' ? (
              <ParenthesesBoard
                exercise={parensExercise}
                group={parenGroup}
                build={parensBuild}
                showParens={parensComplete}
                compact={isShort}
                onPressDie={pressParenDie}
                onPressOp={pressParenOperator}
                onToggleGroup={handleParenShift}
              />
            ) : (
              <>
                <DiceRow
                  diceValues={basicRound.diceValues}
                  option={selectedOption}
                  values={equationValues}
                  stage={stage}
                  onPressDie={pressDie}
                />
                <EquationBoard
                  option={selectedOption}
                  values={equationValues}
                  step={step}
                  result={computedResult}
                  onPressOperator={pressOperator}
                />
              </>
            )}
          </View>
        </Animated.View>

        {/* (3) Mini-cards — dedicated band directly above the fan, below table. */}
        <View style={[styles.miniZone, isShort && { bottom: 196 }]} pointerEvents="box-none">
          {stage !== 'intro' ? (
            <MiniCards
              options={basicRound.options}
              selectedValue={selectedValue}
              parensTarget={parensExercise.target}
              showParensCard={stage === 'parenPractice'}
              onSelect={selectMini}
            />
          ) : null}
        </View>

      </View>

      <View style={[styles.fanDock, isShort && { bottom: 6 }]} pointerEvents="box-none">
        <View style={[styles.fanWrap, { width: fanWidth }, isShort && { transform: [{ scale: 0.84 }] }]} pointerEvents="box-none">
          <HandFan
            cards={basicRound.fanCards}
            width={fanWidth}
            selectedIds={selectedIds}
            centerCardId={selectedOption?.targetId ?? null}
            onTapCard={tapFanCard}
            canTap={canTapFanCard}
            playTapSound={false}
          />
        </View>
      </View>

      {launchingValue != null ? <LaunchCardFlight value={launchingValue} progress={launchProgress} /> : null}

      {continueAction ? (
        <View style={styles.ctaBar} pointerEvents="box-none">
          <GoldButton
            label={continueLabel}
            onPress={continueAction}
            accessibilityLabel={continueLabel}
            fullWidth
            height={56}
            fontSize={22}
          />
        </View>
      ) : null}

      {stage === 'complete' ? (
        <CompletionModal
          onComplete={onComplete}
          rewardCoins={LIFELINE_REWARD_COINS}
          totalCoins={projectedRewardBalance}
          rewardStatus={rewardStatus}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  bannerPin: {
    position: 'absolute',
    top: 8,
    left: 10,
    right: 10,
    zIndex: 40,
    alignItems: 'center',
  },
  banner: {
    width: '100%',
    maxWidth: 430,
    minHeight: 74,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#8A5A1C',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.42,
    shadowRadius: 12,
    elevation: 10,
  },
  bannerSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
  },
  bannerText: {
    color: '#241706',
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  // Full-height column. paddingTop clears the banner; paddingBottom clears the
  // bottom CTA bar. The table keeps the same locked dimensions as Specials.
  column: {
    flex: 1,
    paddingTop: 90,
    paddingBottom: 318,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  // (1) Action band — generous top margin off the banner (intro = tall green ring).
  actionZone: {
    width: '100%',
    maxWidth: 392,
    minHeight: 108,
    marginTop: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Practice/solutions show the shorter red button → reclaim ~18px for the table.
  actionZonePractice: {
    minHeight: 90,
  },
  parensButtonZone: {
    width: '100%',
    minHeight: 46,
    marginTop: -2,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  greenOuterRing: {
    width: 104,
    height: 104,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#FFF2A8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,244,184,0.16)',
    shadowColor: '#75E6A0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.48,
    shadowRadius: 12,
    elevation: 12,
  },
  greenButton: {
    width: 92,
    height: 92,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#143824',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  greenInnerRing: {
    position: 'absolute',
    left: 5,
    right: 5,
    top: 5,
    bottom: 5,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.56)',
  },
  greenText: {
    color: '#FFF7C9',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  redButton: {
    width: '78%',
    maxWidth: 310,
    minHeight: 88,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F8E08E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 10,
  },
  redDefaultText: {
    color: '#FFF4CF',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  redEquationRow: {
    flexDirection: LTR_ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  redEquationText: {
    color: '#FFF4CF',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'ltr',
  },
  mathText: {
    color: '#FFF4CF',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  // (2) Table — same locked size recipe as the Specials screens.
  tableZone: {
    width: '96%',
    maxWidth: 390,
    aspectRatio: 1024 / 774,
    marginTop: -4,
    marginBottom: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.82,
  },
  tableContent: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 34,
  },
  diceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    minHeight: 62,
  },
  diceCube: {
    width: 56,
    height: 56,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#D89D10',
    backgroundColor: '#F7C61D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceCubeEnabled: {
    borderColor: '#7BE08A',
    backgroundColor: 'rgba(123,224,138,0.16)',
    shadowColor: '#7BE08A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.74,
    shadowRadius: 12,
    elevation: 13,
  },
  diceText: {
    color: '#1A1207',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyEquationRow: {
    flexDirection: LTR_ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 58,
  },
  emptyEquals: {
    color: '#F4B32B',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
  },
  emptyResultCard: {
    width: 58,
    height: 58,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#C58B28',
    backgroundColor: '#FFF7EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyResultText: {
    color: '#0E335C',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
  },
  equationTrack: {
    flexDirection: LTR_ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(248,224,142,0.36)',
    backgroundColor: 'rgba(20,12,4,0.62)',
  },
  parenText: {
    color: '#F8E08E',
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '900',
  },
  parensBoard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    width: '100%',
  },
  parensWorkSurfaceSolved: {
    borderColor: '#7BE08A',
    backgroundColor: 'rgba(123,224,138,0.14)',
  },
  parensDiceTray: {
    flexDirection: LTR_ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    minHeight: 58,
    zIndex: 5,
  },
  parensNumberTile: {
    width: 54,
    height: 54,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#D89D10',
    backgroundColor: '#F7C61D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parensNumberTilePlaced: {
    opacity: 0.58,
    backgroundColor: 'rgba(247,198,29,0.42)',
    borderColor: 'rgba(248,224,142,0.6)',
  },
  parensNumberText: {
    color: '#1A1207',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
    writingDirection: 'ltr',
  },
  parensSlotTrack: {
    flexDirection: LTR_ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    width: '98%',
    minHeight: 74,
    paddingHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(248,224,142,0.36)',
    backgroundColor: 'rgba(20,12,4,0.62)',
  },
  parensOperatorText: {
    color: '#F8E08E',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'ltr',
  },
  parensMark: {
    width: 24,
    height: 68,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.24,
  },
  parensMarkPlaceholder: {
    width: 24,
    height: 68,
  },
  parensMarkActive: {
    opacity: 1,
    borderColor: '#FDBA74',
    backgroundColor: 'rgba(249,115,22,0.22)',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 16,
  },
  parensMarkDisabled: {
    opacity: 0.34,
  },
  parensMarkGlow: {
    position: 'absolute',
    width: 32,
    height: 76,
    borderRadius: 19,
    borderWidth: 3,
    borderColor: '#FDBA74',
    backgroundColor: 'rgba(249,115,22,0.28)',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 16,
    elevation: 18,
  },
  parensMarkText: {
    color: '#F8E08E',
    fontSize: 58,
    lineHeight: 64,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'ltr',
  },
  parensMarkTextActive: {
    color: '#FFEDD5',
    fontSize: 66,
    lineHeight: 70,
    textShadowColor: '#F97316',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  parensOpSlot: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#F97316',
    backgroundColor: 'rgba(249,115,22,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parensOpSlotActive: {
    borderStyle: 'solid',
    borderColor: '#FED7AA',
    backgroundColor: 'rgba(249,115,22,0.34)',
  },
  parensOpSlotFilled: {
    borderStyle: 'solid',
    borderColor: '#7BE08A',
    backgroundColor: 'rgba(123,224,138,0.16)',
  },
  parensOpSlotHint: {
    color: '#FED7AA',
    fontSize: 23,
    lineHeight: 27,
    fontWeight: '900',
  },
  parensOpSlotText: {
    color: '#F8E08E',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
  },
  parensResultSolved: {
    borderColor: '#7BE08A',
    backgroundColor: 'rgba(123,224,138,0.18)',
  },
  nativeParensButton: {
    flexDirection: LTR_ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minWidth: 258,
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#B45309',
    backgroundColor: '#F97316',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  nativeParensButtonDisabled: {
    opacity: 0.42,
  },
  nativeParensButtonHidden: {
    opacity: 0,
  },
  nativeParensButtonSolved: {
    borderColor: '#7BE08A',
    backgroundColor: '#22A35A',
  },
  nativeParensIcon: {
    flexDirection: LTR_ROW,
    alignItems: 'center',
  },
  nativeParensDigit: {
    color: '#FFF',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
    writingDirection: 'ltr',
  },
  nativeParensBrace: {
    color: '#FED7AA',
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '900',
    writingDirection: 'ltr',
  },
  nativeParensLabel: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    maxWidth: 154,
    flexShrink: 1,
    writingDirection: 'rtl',
  },
  operatorText: {
    color: '#F8E08E',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  slotBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(248,224,142,0.48)',
    backgroundColor: 'rgba(255,243,201,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultSlot: {
    borderColor: 'rgba(248,224,142,0.72)',
  },
  slotBoxFilled: {
    borderStyle: 'solid',
    borderColor: '#F8E08E',
    backgroundColor: 'rgba(248,224,142,0.14)',
  },
  // Operator slot mirrors the operand box but reads as a tappable control.
  opSlot: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,204,128,0.78)',
    backgroundColor: 'rgba(249,115,22,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  opSlotActive: {
    borderStyle: 'solid',
    borderColor: '#FDBA74',
    backgroundColor: 'rgba(249,115,22,0.23)',
  },
  opSlotLocked: {
    borderStyle: 'solid',
    borderColor: '#7BE08A',
    backgroundColor: 'rgba(123,224,138,0.16)',
  },
  opSlotText: {
    color: '#F8E08E',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
  },
  opSlotHint: {
    color: 'rgba(248,224,142,0.55)',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
  },
  slotGlow: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(123,224,138,0.28)',
    borderWidth: 2,
    borderColor: '#7BE08A',
    shadowColor: '#7BE08A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.86,
    shadowRadius: 12,
    elevation: 16,
  },
  slotHint: {
    color: 'rgba(248,224,142,0.45)',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  slotText: {
    color: '#F8E08E',
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '900',
  },
  // (3) Mini-cards band — fixed like Specials' launch slot: above the fan,
  // not attached to the fan, and not affected by table/content height.
  miniZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 292,
    width: '100%',
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
  },
  miniRow: {
    maxWidth: 320,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 10,
  },
  miniCard: {
    width: 40,
    height: 48,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#F8E08E',
    backgroundColor: '#F8F4EA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 6,
  },
  miniCardActive: {
    borderColor: '#7BE08A',
    shadowColor: '#7BE08A',
    shadowOpacity: 0.72,
    shadowRadius: 10,
    elevation: 12,
  },
  miniCardText: {
    color: '#2F2009',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  fanDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 42,
    zIndex: 12,
    alignItems: 'center',
  },
  // (4) Hand fan — fixed bottom dock, matching the stable Specials practice fan.
  fanWrap: {
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 8,
  },
  launchCardFlight: {
    position: 'absolute',
    left: '50%',
    bottom: 132,
    marginLeft: -34,
    zIndex: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchCard: {
    width: 68,
    height: 84,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#7BE08A',
    backgroundColor: '#F8F4EA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7BE08A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.82,
    shadowRadius: 15,
    elevation: 18,
  },
  launchCardText: {
    color: '#2F2009',
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '900',
    textAlign: 'center',
  },
  ctaBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    zIndex: 50,
    alignItems: 'center',
  },
  completeOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    backgroundColor: 'rgba(8,5,2,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  completeCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#7BE08A',
    backgroundColor: 'rgba(17,12,4,0.97)',
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'stretch',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 16,
  },
  completeIcon: {
    color: '#7BE08A',
    fontSize: 54,
    lineHeight: 58,
    fontWeight: '900',
    textAlign: 'center',
  },
  completeTitle: {
    color: '#F8E08E',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  coinRewardStage: {
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  rewardCoin: {
    position: 'absolute',
    color: '#FFD95A',
    fontSize: 28,
    lineHeight: 32,
    textAlign: 'center',
  },
  coinRewardText: {
    color: '#FFD95A',
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(255,217,90,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    writingDirection: 'ltr',
  },
  coinRewardLabel: {
    color: '#FFF4CF',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  shopReminderBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(255,217,90,0.72)',
    backgroundColor: 'rgba(255,217,90,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 2,
  },
  shopReminderIcon: {
    fontSize: 22,
    lineHeight: 26,
  },
  shopReminderText: {
    flex: 1,
    color: '#FFE58A',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  rewardErrorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  completePrompt: {
    color: '#FFF4CF',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
    paddingVertical: 2,
  },
  completeBody: {
    display: 'none',
  },
  completeRewardBody: {
    color: '#FFF4CF',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: 6,
  },
});

export default LifelineTile;
