import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  I18nManager,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import HandFan from '../../components/HandFan';
import type { Card } from '../../components/CardDesign';
import { GoldButton } from '../../components/GoldButton';
import { playSfx } from '../audio/sfx';

const GOLD_TABLE_IMG = require('../../assets/table_golden_nobg.png');

const GOLD_GRADIENT = ['#FFF4B8', '#F8E08E', '#D9A23A', '#8A5A1C'] as const;
const GREEN_GRADIENT = ['#37A66A', '#247C4A', '#145B32'] as const;
const RED_GRADIENT = ['#D54B3D', '#A72E26', '#741B1B'] as const;
const DARK_GRADIENT = ['#050505', '#130D06', '#241407', '#050505'] as const;

// React Native flips `flexDirection: 'row'` to visually right-to-left whenever the
// app is in forced-RTL (this Hebrew build is). It also ignores the CSS `direction`
// property entirely. So to keep a math row reading LEFT-TO-RIGHT in both layout
// modes, we pick the flex direction explicitly: row-reverse under RTL cancels the
// flip and restores LTR child order; plain row under LTR. This is the single
// reliable fix for the "equation rendered backwards" bug on Android/iOS/web.
const LTR_ROW: 'row' | 'row-reverse' = I18nManager.isRTL ? 'row-reverse' : 'row';

type LifelineStage = 'intro' | 'solutions' | 'practice' | 'complete';

// The operand slots are filled from the dice; the operator slot is toggled IN
// PLACE inside the equation (no separate operator card row). The RESULT is never
// a drop target — it is COMPUTED from the operands + operator.
type EquationStep = 'left' | 'op' | 'right';
type Operator = '+' | '-' | '*' | '/';

// The inline operator toggle cycles through these in order. Data stays +/- for
// now, but the full set is here so the toggle teaches the whole sign palette.
const OPERATORS: Operator[] = ['+', '-', '*', '/'];

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

const FIXED_DICE_VALUES = [5, 4, 9] as const;

const FAN_CARDS: Card[] = [
  { id: 'lifeline-hand-3', type: 'number', value: 3 },
  { id: 'lifeline-hand-5', type: 'number', value: 5 },
  { id: 'lifeline-hand-9', type: 'number', value: 9 },
  { id: 'lifeline-hand-4', type: 'number', value: 4 },
  { id: 'lifeline-hand-12', type: 'number', value: 12 },
];

const LIFELINE_OPTIONS: LifelineOption[] = [
  { value: 9, equation: '9 = (5 + 4)', op: '+', left: 5, right: 4, result: 9, targetId: 'lifeline-hand-9' },
  { value: 5, equation: '5 = (9 - 4)', op: '-', left: 9, right: 4, result: 5, targetId: 'lifeline-hand-5' },
  { value: 4, equation: '4 = (9 - 5)', op: '-', left: 9, right: 5, result: 4, targetId: 'lifeline-hand-4' },
];

const EMPTY_EQUATION: EquationValues = { left: null, op: null, right: null };

const COPY = {
  intro: 'לא מוצאים תרגיל מתאים לקלפים שלכם? הכפתור הירוק ייתן את התשובה!',
  solutions:
    'הכפתור הירוק סרק את המניפה ומצא 3 פתרונות! כל מיני-קלף הוא פתרון אפשרי. לחצו עליו לחשיפת התרגיל.',
  selected: 'תוכלו להשתמש בתרגיל הזה כדי להיפטר מהקלף! לחצו "המשך" כדי לתרגל.',
  practiceLeft: 'מצוין! הציבו את הקובייה המתאימה במשבצת הריקה הראשונה.',
  practiceOp: 'עכשיו לחצו על משבצת הסימן שבמשוואה ובחרו את הפעולה הנכונה.',
  practiceRight: 'יופי! הציבו את הקובייה השנייה כדי להשלים את התרגיל.',
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

function RedExerciseButton({ option }: { option: LifelineOption | null }) {
  return (
    <LinearGradient colors={RED_GRADIENT} style={styles.redButton}>
      {option ? (
        // The exercise (e.g. "9 = (5 + 4)") is rendered as DISCRETE, explicitly
        // ordered tokens inside an LTR-forced row, so Hebrew/RTL can never mirror
        // the brackets/operators into an illegible, backwards equation.
        <View style={styles.redEquationRow}>
          {[String(option.result), '=', '(', String(option.left), option.op, String(option.right), ')'].map((tok, i) => (
            <Text key={`eq-${i}`} allowFontScaling={false} style={styles.redEquationText}>
              {tok}
            </Text>
          ))}
        </View>
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
  option,
  values,
  stage,
  onPressDie,
}: {
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
  const visibleDice = FIXED_DICE_VALUES.filter((value) => !usedValues.includes(value));

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
        {value == null ? '?' : value}
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
    <Pressable onPress={onPress} disabled={!active} accessibilityRole="button" accessibilityLabel="בחירת סימן">
      <View style={[styles.opSlot, active && styles.opSlotActive, locked && styles.opSlotLocked]}>
        {active ? <Animated.View pointerEvents="none" style={[styles.slotGlow, glow]} /> : null}
        <Text allowFontScaling={false} style={op == null ? styles.opSlotHint : styles.opSlotText}>
          {op == null ? '±' : op}
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
      <View style={styles.emptyEquationRow}>
        <Text allowFontScaling={false} style={styles.emptyEquals}>
          =
        </Text>
        <View style={styles.emptyResultCard}>
          <Text allowFontScaling={false} style={styles.emptyResultText}>
            ?
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
      <Text allowFontScaling={false} style={styles.parenText}>
        (
      </Text>
      <OperandSlot value={values.left} active={step === 'left'} />
      <OperatorSlot op={values.op} active={step === 'op'} locked={opLocked} onPress={onPressOperator} />
      <OperandSlot value={values.right} active={step === 'right'} />
      <Text allowFontScaling={false} style={styles.parenText}>
        )
      </Text>
      <Text allowFontScaling={false} style={styles.operatorText}>
        =
      </Text>
      <View style={[styles.slotBox, styles.resultSlot, result != null && styles.slotBoxFilled]}>
        <Text allowFontScaling={false} style={result == null ? styles.slotHint : styles.slotText}>
          {result == null ? '?' : result}
        </Text>
      </View>
    </View>
  );
}

function MiniCards({
  selectedValue,
  onSelect,
}: {
  selectedValue: number | null;
  onSelect: (option: LifelineOption) => void;
}) {
  return (
    <View style={styles.miniRow}>
      {LIFELINE_OPTIONS.map((option) => (
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
    </View>
  );
}

function CompletionModal({ onComplete }: { onComplete: () => void }) {
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
  }, [pop]);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1] });

  return (
    <View style={styles.completeOverlay}>
      <Animated.View style={[styles.completeCard, { transform: [{ scale }] }]}>
        <Text allowFontScaling={false} style={styles.completeIcon}>
          ✓
        </Text>
        <Text allowFontScaling={false} style={styles.completeTitle}>
          כל הכבוד!
        </Text>
        <Text allowFontScaling={false} style={styles.completeBody}>
          מילאתם את המשוואה מהקוביות בלבד והשלמתם את גלגל ההצלה.
        </Text>
        <GoldButton label="סיום" onPress={onComplete} fullWidth height={54} fontSize={20} />
      </Animated.View>
    </View>
  );
}

export function LifelineTile({ onComplete }: { onComplete: () => void }) {
  const { width } = useWindowDimensions();
  // Capped tighter than the usual min(width,480): the Lifeline tile stacks a lot
  // vertically (banner + button + table + mini-cards + fan), so a smaller fan
  // keeps the whole hand on-screen even on the short iPhone browser safe-area.
  const fanWidth = Math.min(width, 290);
  const [stage, setStage] = useState<LifelineStage>('intro');
  const [selectedValue, setSelectedValue] = useState<number | null>(null);
  const [equationValues, setEquationValues] = useState<EquationValues>(EMPTY_EQUATION);
  const boardFade = useRef(new Animated.Value(1)).current;
  const fanPulse = useRef(new Animated.Value(0)).current;

  const selectedOption = useMemo(
    () => LIFELINE_OPTIONS.find((option) => option.value === selectedValue) ?? null,
    [selectedValue],
  );
  const selectedIds = useMemo(() => new Set<string>(), []);
  const step = stage === 'practice' ? nextStep(equationValues, selectedOption) : null;
  const computedResult = computeResult(equationValues);
  const solved = isComplete(equationValues, selectedOption);
  const instruction =
    stage === 'intro'
      ? COPY.intro
      : stage === 'solutions'
        ? selectedOption
          ? COPY.selected
          : COPY.solutions
        : step === 'left'
          ? COPY.practiceLeft
          : step === 'op'
            ? COPY.practiceOp
            : step === 'right'
              ? COPY.practiceRight
              : COPY.selected;

  useEffect(() => {
    if (!selectedOption) return;
    fanPulse.setValue(0);
    Animated.timing(fanPulse, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fanPulse, selectedOption]);

  useEffect(() => {
    if (stage !== 'practice' || !solved) return;
    void playSfx('gameWin', { cooldownMs: 0, volumeOverride: 0.9 });
    setStage('complete');
  }, [solved, stage]);

  const fadeBoard = useCallback(() => {
    boardFade.setValue(0);
    Animated.timing(boardFade, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [boardFade]);

  const openSolutions = useCallback(() => {
    void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.5 });
    setStage('solutions');
    setSelectedValue(null);
    setEquationValues(EMPTY_EQUATION);
    fadeBoard();
  }, [fadeBoard]);

  const selectMini = useCallback((option: LifelineOption) => {
    void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.52 });
    setSelectedValue(option.value);
    setEquationValues(EMPTY_EQUATION);
  }, []);

  const startPractice = useCallback(() => {
    setStage('practice');
    setEquationValues(EMPTY_EQUATION);
    fadeBoard();
  }, [fadeBoard]);

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

  const fanScale = fanPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
  const fanTranslate = fanPulse.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });

  // The single bottom "המשך" CTA is revealed only once a mini-card is selected
  // (Step A) — it drives the move into practice. Intro advances via the green
  // button itself, so no CTA clutters the intro screen.
  const continueAction = stage === 'solutions' && selectedOption ? startPractice : null;

  return (
    <View style={styles.root}>
      <LinearGradient colors={DARK_GRADIENT} locations={[0, 0.38, 0.72, 1]} style={StyleSheet.absoluteFill} />
      <InstructionBanner text={instruction} />

      {/* Strict top-to-bottom column. Each zone owns a fixed band EXCEPT the
       *  table, which carries flex:1 + a rigid minHeight: it absorbs all slack so
       *  there is no dead gap, grows/shrinks deterministically, and pins the
       *  mini-cards directly above the fan on every screen height. */}
      <View style={styles.column} pointerEvents="box-none">
        {/* (1) Action zone — green helper (intro) or red exercise button, held
         *      clear of the banner by a real top margin. */}
        <View style={styles.actionZone}>
          {stage === 'intro' ? (
            <RoundGreenButton onPress={openSolutions} active={false} />
          ) : (
            <RedExerciseButton option={selectedOption} />
          )}
        </View>

        {/* (2) Table — enlarged, rigid, and the home of BOTH the dice and the
         *      equation. Dice sit on the upper surface; the equation rests below
         *      them, all framed by the golden table image. */}
        <Animated.View style={[styles.tableZone, { opacity: boardFade }]}>
          <Image source={GOLD_TABLE_IMG} resizeMode="contain" style={styles.tableImage} />
          <View style={styles.tableContent} pointerEvents="box-none">
            <DiceRow option={selectedOption} values={equationValues} stage={stage} onPressDie={pressDie} />
            <EquationBoard
              option={selectedOption}
              values={equationValues}
              step={step}
              result={computedResult}
              onPressOperator={pressOperator}
            />
          </View>
        </Animated.View>

        {/* (3) Mini-cards — dedicated band directly above the fan, below table. */}
        <View style={styles.miniZone} pointerEvents="box-none">
          {stage !== 'intro' ? <MiniCards selectedValue={selectedValue} onSelect={selectMini} /> : null}
        </View>

        {/* (4) Hand fan — anchored at the bottom of the column. */}
        <Animated.View
          style={[styles.fanWrap, { width: fanWidth, transform: [{ translateY: fanTranslate }, { scale: fanScale }] }]}
          pointerEvents="box-none"
        >
          <HandFan
            cards={FAN_CARDS}
            width={fanWidth}
            selectedIds={selectedIds}
            centerCardId={null}
            canTap={() => false}
            playTapSound={false}
          />
        </Animated.View>
      </View>

      {continueAction ? (
        <View style={styles.ctaBar} pointerEvents="box-none">
          <GoldButton
            label="המשך  ›"
            onPress={continueAction}
            accessibilityLabel="המשך"
            fullWidth
            height={56}
            fontSize={22}
          />
        </View>
      ) : null}

      {stage === 'complete' ? <CompletionModal onComplete={onComplete} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
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
  // bottom CTA bar. The table zone inside carries the flex weight.
  column: {
    flex: 1,
    paddingTop: 94,
    paddingBottom: 72,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  // (1) Action band — fixed height, generous top margin off the banner.
  actionZone: {
    width: '100%',
    maxWidth: 392,
    minHeight: 108,
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 246,
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
  // (2) Table — flex:1 soaks up all slack (kills the dead gap) but never drops
  // below minHeight; capped so it stays a believable table, not a giant slab.
  tableZone: {
    flex: 1,
    width: '100%',
    maxWidth: 340,
    minHeight: 196,
    maxHeight: 300,
    marginTop: 10,
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
  operatorText: {
    color: '#F8E08E',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  slotBox: {
    width: 46,
    height: 46,
    borderRadius: 11,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(248,224,142,0.48)',
    backgroundColor: 'rgba(255,243,201,0.04)',
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
    width: 44,
    height: 44,
    borderRadius: 11,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(248,224,142,0.6)',
    backgroundColor: 'rgba(255,243,201,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  opSlotActive: {
    borderStyle: 'solid',
    borderColor: '#F8E08E',
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
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  // (3) Mini-cards band — fixed height, sits between the table and the fan.
  miniZone: {
    width: '100%',
    minHeight: 58,
    marginTop: 8,
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
  // (4) Hand fan — bottom of the column.
  fanWrap: {
    alignSelf: 'center',
    alignItems: 'center',
    marginTop: 6,
    zIndex: 8,
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
  completeBody: {
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
