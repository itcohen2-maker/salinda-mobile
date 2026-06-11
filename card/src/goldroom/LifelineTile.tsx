import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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

type LifelineStage = 'intro' | 'solutions' | 'practice' | 'complete';
type EquationSlot = 'left' | 'right' | 'result';

type LifelineOption = {
  value: number;
  equation: string;
  op: '+' | '-';
  left: number;
  right: number;
  result: number;
  targetId: string;
};

type EquationValues = Record<EquationSlot, number | null>;

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

const EMPTY_EQUATION: EquationValues = { left: null, right: null, result: null };

const COPY = {
  intro: 'לא מוצאים תרגיל מתאים לקלפים שלכם? הכפתור הירוק ייתן את התשובה!',
  solutions:
    'הכפתור הירוק סרק את המניפה ומצא 3 פתרונות! כל מיני-קלף הוא פתרון אפשרי. לחצו עליו לחשיפת התרגיל.',
  selected: 'תוכלו להשתמש בתרגיל הזה כדי להיפטר מהקלף!',
  practice: 'בואו נתרגל! לחצו על מיני-קלף, ואז הציבו את המספרים במשוואה בעזרת הקוביות בלבד.',
  redLine1: 'לחצו על מיני קלפים',
  redLine2: 'כדי לקבל את התרגיל',
};

function nextSlot(values: EquationValues): EquationSlot | null {
  if (values.left == null) return 'left';
  if (values.right == null) return 'right';
  if (values.result == null) return 'result';
  return null;
}

function expectedValue(option: LifelineOption, slot: EquationSlot): number {
  if (slot === 'left') return option.left;
  if (slot === 'right') return option.right;
  return option.result;
}

function isComplete(values: EquationValues, option: LifelineOption | null): boolean {
  if (!option) return false;
  return values.left === option.left && values.right === option.right && values.result === option.result;
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
        // STRICT LTR row: forces the equation (e.g. "9 = (5 + 4)") to render
        // left-to-right so Hebrew Android's RTL base direction can never mirror
        // the brackets/operators. direction:'ltr' on both the row and the text.
        <View style={styles.redEquationRow}>
          <Text allowFontScaling={false} style={styles.redEquationText}>
            {option.equation}
          </Text>
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
  used,
  onPress,
}: {
  value: number;
  enabled: boolean;
  used: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!enabled} accessibilityRole="button" accessibilityLabel={`קוביה ${value}`}>
      <View style={[styles.diceCube, enabled && styles.diceCubeEnabled, used && styles.diceCubeUsed]}>
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
  const slot = nextSlot(values);
  const expected = option && slot ? expectedValue(option, slot) : null;
  const enabled = stage === 'practice' && !!option && slot != null;

  return (
    <View style={styles.diceRow}>
      {FIXED_DICE_VALUES.map((value) => (
        <DiceButton
          key={value}
          value={value}
          enabled={enabled && value === expected}
          used={Object.values(values).includes(value)}
          onPress={() => onPressDie(value)}
        />
      ))}
    </View>
  );
}

function EquationBoard({
  option,
  values,
  activeSlot,
}: {
  option: LifelineOption | null;
  values: EquationValues;
  activeSlot: EquationSlot | null;
}) {
  if (!option) {
    return (
      <View style={styles.emptyEquationRow}>
        <Text allowFontScaling={false} style={styles.emptyEquals}>=</Text>
        <View style={styles.emptyResultCard}>
          <Text allowFontScaling={false} style={styles.emptyResultText}>?</Text>
        </View>
      </View>
    );
  }
  const op = option?.op ?? '+';

  return (
    <View style={styles.equationTrack}>
      <Text allowFontScaling={false} style={styles.parenText}>
        (
      </Text>
      <EquationSlotBox value={values.left} active={activeSlot === 'left'} />
      <Text allowFontScaling={false} style={styles.operatorText}>
        {op}
      </Text>
      <EquationSlotBox value={values.right} active={activeSlot === 'right'} />
      <Text allowFontScaling={false} style={styles.parenText}>
        )
      </Text>
      <Text allowFontScaling={false} style={styles.operatorText}>
        =
      </Text>
      <EquationSlotBox value={values.result} active={activeSlot === 'result'} result />
    </View>
  );
}

function EquationSlotBox({ value, active, result }: { value: number | null; active: boolean; result?: boolean }) {
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

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.9] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });

  return (
    <View style={[styles.equationSlot, result && styles.resultSlot, value != null && styles.equationSlotFilled]}>
      {active ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.slotGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
        />
      ) : null}
      <Text allowFontScaling={false} style={value == null ? styles.slotHint : styles.slotText}>
        {value == null ? '?' : value}
      </Text>
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
  const fanWidth = Math.min(width, 480);
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
  const activeSlot = stage === 'practice' && selectedOption ? nextSlot(equationValues) : null;
  const solved = isComplete(equationValues, selectedOption);
  const instruction =
    stage === 'intro'
      ? COPY.intro
      : stage === 'solutions' && selectedOption
        ? COPY.selected
        : stage === 'solutions'
          ? COPY.solutions
          : COPY.practice;

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
      const slot = nextSlot(equationValues);
      if (!slot) return;
      const expected = expectedValue(selectedOption, slot);
      if (value !== expected) return;
      void playSfx('place', { cooldownMs: 0, volumeOverride: 0.56 });
      setEquationValues((current) => ({ ...current, [slot]: value }));
    },
    [equationValues, selectedOption, stage],
  );

  const fanScale = fanPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const fanTranslate = fanPulse.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  // The single bottom "המשך" CTA — like the roll button in the real game. Drives
  // the same stage advance the (removed) floating arrow used to.
  const continueAction =
    stage === 'intro'
      ? openSolutions
      : stage === 'solutions' && selectedOption
        ? startPractice
        : null;

  return (
    <View style={styles.root}>
      <LinearGradient colors={DARK_GRADIENT} locations={[0, 0.38, 0.72, 1]} style={StyleSheet.absoluteFill} />
      <InstructionBanner text={instruction} />

      {/* Fixed TOP-ANCHORED stack — NOT vertically centred. A plain flex column
       *  (helper button → dice → table → mini-cards) so each element keeps its
       *  own band and can never overlap the one beneath it. No flex:1 child, so
       *  nothing gets squashed. Pinned tight under the banner. */}
      <View style={styles.upperStack} pointerEvents="box-none">
        {/* (1) Helper button — pinned high, tight beneath the banner, fully clear
         *      above the table board. */}
        <View style={styles.topActions}>
          {stage === 'intro' ? (
            <RoundGreenButton onPress={openSolutions} active={false} />
          ) : (
            <RedExerciseButton option={selectedOption} />
          )}
        </View>

        {/* (3) Dice — distinct ELEVATED elements ABOVE the table board; lifted
         *      out of the table so they never touch its borders/surface. */}
        <View style={styles.diceDock}>
          <DiceRow option={selectedOption} values={equationValues} stage={stage} onPressDie={pressDie} />
        </View>

        {/* Table board — now frames the EQUATION ONLY (dice removed from it). */}
        <Animated.View style={[styles.tableWrap, { opacity: boardFade }]}>
          <Image source={GOLD_TABLE_IMG} resizeMode="contain" style={styles.tableImage} />
          <View style={styles.tableContent}>
            <EquationBoard option={selectedOption} values={equationValues} activeSlot={activeSlot} />
          </View>
        </Animated.View>

        {/* (4) Mini-cards — tight dock row directly under the table, bridging the
         *      table bottom and the fan top. zIndex above the fan so they are
         *      never hidden behind it. */}
        {stage !== 'intro' ? (
          <View style={styles.miniDock} pointerEvents="box-none">
            <MiniCards selectedValue={selectedValue} onSelect={selectMini} />
          </View>
        ) : null}
      </View>

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
  // Top-anchored stack (see render). flex-start column, fixed gap, no flex:1
  // child — guarantees button/dice/table/mini-cards each keep their band.
  upperStack: {
    position: 'absolute',
    top: 90,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
    zIndex: 10,
  },
  topActions: {
    width: '100%',
    maxWidth: 392,
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
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
    width: 218,
    height: 84,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F8E08E',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 10,
  },
  redDefaultText: {
    color: '#FFF4CF',
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  redEquationRow: {
    width: '100%',
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'center',
  },
  redEquationText: {
    color: '#FFF4CF',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'ltr',
    direction: 'ltr',
  },
  // Dock that holds the dice ABOVE the table. Own band in the flex column so the
  // dice are visually separate, elevated elements — never on the table surface.
  diceDock: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
  },
  // Table is now shorter: it only frames the equation (dice were lifted out), so
  // the board stays compact and leaves room for the dice above + mini-cards below.
  tableWrap: {
    width: '100%',
    maxWidth: 318,
    maxHeight: 170,
    aspectRatio: 1024 / 774,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.78,
  },
  tableContent: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  diceRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    minHeight: 74,
  },
  diceCube: {
    width: 66,
    height: 66,
    borderRadius: 14,
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
  diceCubeUsed: {
    opacity: 0.62,
  },
  diceText: {
    color: '#1A1207',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyEquationRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 62,
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
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 58,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(248,224,142,0.36)',
    backgroundColor: 'rgba(20,12,4,0.58)',
  },
  parenText: {
    color: '#F8E08E',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '900',
  },
  operatorText: {
    color: '#F8E08E',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  equationSlot: {
    width: 43,
    height: 43,
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
  equationSlotFilled: {
    borderStyle: 'solid',
    borderColor: '#F8E08E',
    backgroundColor: 'rgba(248,224,142,0.14)',
  },
  slotGlow: {
    position: 'absolute',
    width: 50,
    height: 50,
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
  // Mini-cards now flow in the column directly under the table. zIndex keeps the
  // dock above the (lower-z) fan so the cards are never hidden behind the hand.
  miniDock: {
    alignItems: 'center',
    zIndex: 25,
  },
  miniRow: {
    maxWidth: 320,
    minHeight: 48,
    flexDirection: 'row',
    direction: 'ltr',
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
  fanWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 82,
    alignSelf: 'center',
    alignItems: 'center',
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
