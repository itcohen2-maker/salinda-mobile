import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GoldButton } from '../../components/GoldButton';
import { GameCard, type Card, type Operation } from '../../components/CardDesign';
import HandFan from '../../components/HandFan';
import OperatorGlyph from '../components/ui/OperatorGlyph';
import { playSfx } from '../audio/sfx';

const GOLD = ['#FFF4B8', '#F8E08E', '#D9A23A', '#8A5A1C'] as const;
const TABLE = require('../../assets/table_golden_nobg.png');

const rtlText = {
  writingDirection: 'rtl' as const,
  textAlign: 'right' as const,
};

const SALINDA_SHOWCASE_CARD: Card = { id: 'salinda-showcase-card', type: 'salinda' };
const PRACTICE_CORRECT_SALINDA_ID = 'salinda-practice-correct';
const PRACTICE_DECOY_SALINDA_ID = 'salinda-practice-decoy';
const CORRECT_OP: Operation = '-';
const OPS: Operation[] = ['+', '-', 'x', '\u00F7'];
const SALINDA_SHOWCASE_ANIMATION_DELAY_MS = 1500;
const SALINDA_SHOWCASE_FLY_DURATION_MS = 1200;
const SALINDA_PRACTICE_FLY_DURATION_MS = 1200;

export const SALINDA_PRACTICE_HAND: Card[] = [
  { id: 'salinda-practice-num-8', type: 'number', value: 8 },
  { id: PRACTICE_DECOY_SALINDA_ID, type: 'salinda', operation: '+' },
  { id: 'salinda-practice-num-6', type: 'number', value: 6 },
  { id: PRACTICE_CORRECT_SALINDA_ID, type: 'salinda' },
  { id: 'salinda-practice-num-12', type: 'number', value: 12 },
  { id: 'salinda-practice-num-3', type: 'number', value: 3 },
  { id: 'salinda-practice-num-9', type: 'number', value: 9 },
];

type ShowcaseStep = 1 | 2 | 3;
type PracticeState = 'idle' | 'options' | 'flying' | 'solved';

type SalindaCardFlowProps = {
  onExit: () => void;
  onComplete: () => void;
  onContinueNext: () => void;
};

function usePulse(active = true, min = 1, max = 1.08, duration = 560) {
  const pulse = useRef(new Animated.Value(min)).current;
  useEffect(() => {
    if (!active) {
      pulse.stopAnimation();
      pulse.setValue(min);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: max, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: min, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, duration, max, min, pulse]);
  return pulse;
}

function isCorrectEquationOperator(op: Operation): boolean {
  // Board equation: 5 [ ? ] 2 = 3. Only subtraction keeps the exercise valid.
  return op === CORRECT_OP && 5 - 2 === 3;
}

function InstructionPlank({ text }: { text: string }) {
  return (
    <View style={styles.instructionWrap} pointerEvents="none">
      <LinearGradient colors={GOLD} locations={[0, 0.34, 0.72, 1]} style={styles.instructionBubble}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.62)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.sheen}
        />
        <View pointerEvents="none" style={styles.innerGlow} />
        <Text allowFontScaling={false} style={styles.instructionText}>{text}</Text>
      </LinearGradient>
    </View>
  );
}

function TryAgainToast({ visible }: { visible: boolean }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) {
      Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }).start();
      return;
    }
    Animated.sequence([
      Animated.timing(fade, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.delay(780),
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [fade, visible]);
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      <Text style={styles.toastText}>תנסה שוב</Text>
    </Animated.View>
  );
}

function EquationTrack({
  inserted = false,
}: {
  inserted?: boolean;
}) {
  return (
    <View style={styles.track}>
      <NumberSlot value="5" />
      <View style={[styles.opSlot, inserted && styles.opSlotSolved]}>
        {inserted ? <OperatorGlyph op="-" color="#3D2A0E" size={30} /> : <Text style={styles.question}>?</Text>}
      </View>
      <NumberSlot value="2" />
      <Text style={styles.equals}>=</Text>
      <NumberSlot value="3" result />
    </View>
  );
}

function NumberSlot({ value, result = false }: { value: string; result?: boolean }) {
  return (
    <View style={[styles.numSlot, result && styles.resultSlot]}>
      <Text style={styles.numText}>{value}</Text>
    </View>
  );
}

function OperatorBubble({ op, onPress, active = false, compact = false }: { op: Operation; onPress?: () => void; active?: boolean; compact?: boolean }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`בחר סימן ${op}`}>
      <LinearGradient colors={GOLD} locations={[0, 0.34, 0.7, 1]} style={[compact ? styles.opBubbleCompact : styles.opBubble, active && styles.opBubbleActive]}>
        <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} style={styles.bubbleSheen} />
        <OperatorGlyph op={op} color="#3D2A0E" size={compact ? 24 : 32} />
      </LinearGradient>
    </Pressable>
  );
}

function ShowcaseSalindaCard({ selected = false, pulsing = false }: { selected?: boolean; pulsing?: boolean }) {
  const pulse = usePulse(pulsing, 1, 1.07, 500);
  return (
    <Animated.View style={[styles.singleCardWrap, { transform: [{ scale: pulsing ? pulse : 1 }] }]}>
      {pulsing ? <View pointerEvents="none" style={styles.cardHalo} /> : null}
      <GameCard card={SALINDA_SHOWCASE_CARD} selected={selected} small />
    </Animated.View>
  );
}

function PointerArrow({ target }: { target: 'card' | 'minus' }) {
  const pulse = usePulse(true, 0.96, 1.05, 520);
  return (
    <Animated.View style={[target === 'card' ? styles.arrowToCard : styles.arrowToMinus, { transform: [{ scale: pulse }] }]}>
      <Text style={styles.arrowText}>{target === 'card' ? '↓' : '↙'}</Text>
    </Animated.View>
  );
}

function FlyingOperator({ progress, mode = 'showcase' }: { progress: Animated.Value; mode?: 'showcase' | 'practice' }) {
  const startY = mode === 'practice' ? 166 : 130;
  const startX = mode === 'practice' ? -18 : -110;
  const flyStyle = useMemo(
    () => ({
      opacity: progress.interpolate({ inputRange: [0, 0.04, 1], outputRange: [1, 1, 1] }),
      transform: [
        { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [startX, 0] }) },
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [startY, 0] }) },
        { scale: progress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1.02, 1.2, 0.95] }) },
      ],
    }),
    [progress, startX, startY],
  );
  return (
    <Animated.View pointerEvents="none" style={[styles.flyingOperator, flyStyle]}>
      <OperatorBubble op="-" compact />
    </Animated.View>
  );
}

function SalindaCardShowcase({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<ShowcaseStep>(1);
  const open = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  const [minusInserted, setMinusInserted] = useState(false);

  useEffect(() => {
    open.stopAnimation();
    fly.stopAnimation();
    let flyTimer: ReturnType<typeof setTimeout> | null = null;
    if (step === 2) {
      open.setValue(0);
      void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.52 });
      Animated.spring(open, { toValue: 1, friction: 6, tension: 110, useNativeDriver: true }).start();
    }
    if (step === 3) {
      fly.setValue(0);
      setMinusInserted(false);
      flyTimer = setTimeout(() => {
        void playSfx('complete', { cooldownMs: 0, volumeOverride: 0.58 });
        Animated.timing(fly, {
          toValue: 1,
          duration: SALINDA_SHOWCASE_FLY_DURATION_MS,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            setMinusInserted(true);
            void playSfx('success', { cooldownMs: 0, volumeOverride: 0.78 });
          }
        });
      }, SALINDA_SHOWCASE_ANIMATION_DELAY_MS);
    }
    return () => {
      if (flyTimer) clearTimeout(flyTimer);
    };
  }, [fly, open, step]);

  const copy =
    step === 1
      ? 'הכירו את קלף סלינדה! הוא מכיל את כל סימני הפעולה יחד. לחצו על קלף סלינדה כדי לפתוח אותו.'
      : step === 2
      ? 'הקלף נפתח! עכשיו צריך לבחור את הסימן שישלים את המשוואה בצורה נכונה. לחצו על סימן המינוס.'
      : 'בום! הסימן נכנס למשוואה והתרגיל מוכן. לחצו על חץ ההמשך כדי לתרגל בעצמכם!';

  const advance = useCallback(() => {
    if (step < 3) setStep((cur) => (cur + 1) as ShowcaseStep);
    else onDone();
  }, [onDone, step]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#070502', '#151008', '#070502']} style={StyleSheet.absoluteFill} />
      <InstructionPlank text={copy} />
      <View style={styles.boardArea}>
        <View style={styles.tableZone}>
          <Animated.Image source={TABLE} resizeMode="contain" style={styles.tableImg} />
          <EquationTrack inserted={minusInserted} />
          {step === 3 && !minusInserted ? <FlyingOperator progress={fly} /> : null}
        </View>
      </View>
      <View style={styles.showcaseOptionsLayer} pointerEvents="none">
        {step === 2
          ? OPS.map((op, i) => {
              const x = [-76, -26, 26, 76][i];
              const y = [-40, -78, -78, -40][i];
              return (
                <Animated.View
                  key={op}
                  style={[
                    styles.optionFromCard,
                    {
                      opacity: open,
                      transform: [
                        { translateX: open.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
                        { translateY: open.interpolate({ inputRange: [0, 1], outputRange: [0, y] }) },
                        { scale: open.interpolate({ inputRange: [0, 1], outputRange: [0.58, 1] }) },
                      ],
                    },
                  ]}
                >
                  <OperatorBubble op={op} active={op === '-'} />
                </Animated.View>
              );
            })
          : null}
      </View>
      {step === 1 ? <PointerArrow target="card" /> : null}
      {step === 2 ? <PointerArrow target="minus" /> : null}
      <View style={styles.singleFanArea}>
        <ShowcaseSalindaCard selected={step > 1} pulsing={step === 1} />
      </View>
      {step !== 3 || minusInserted ? (
        <Pressable onPress={advance} accessibilityRole="button" accessibilityLabel="המשך" style={({ pressed }) => [styles.nextArrow, pressed && styles.nextArrowPressed]}>
          <Text style={styles.nextArrowText}>›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SalindaPractice({ onSolved }: { onSolved: () => void }) {
  const { width: winW } = useWindowDimensions();
  const fanW = Math.min(winW, 480);
  const [hand, setHand] = useState<Card[]>(SALINDA_PRACTICE_HAND);
  const [state, setState] = useState<PracticeState>('idle');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [wrongFlash, setWrongFlash] = useState<Operation | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const [inserted, setInserted] = useState(false);
  const fly = useRef(new Animated.Value(0)).current;
  const optionsPop = useRef(new Animated.Value(0)).current;
  const fanPulse = usePulse(state === 'idle', 1, 1.035, 650);

  const selectedIds = useMemo(() => (selectedCardId ? new Set([selectedCardId]) : new Set<string>()), [selectedCardId]);

  const showError = useCallback(() => {
    setToastKey((key) => key + 1);
    void playSfx('errorSoft', { cooldownMs: 0, volumeOverride: 0.48 });
  }, []);

  useEffect(() => {
    if (state !== 'options') {
      optionsPop.setValue(0);
      return;
    }
    Animated.spring(optionsPop, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();
  }, [optionsPop, state]);

  const canTapCard = useCallback((card: Card) => state === 'idle' || (state === 'options' && card.id !== selectedCardId), [selectedCardId, state]);

  const tapCard = useCallback(
    (card: Card) => {
      if (state === 'flying' || state === 'solved') return;
      if (card.id !== PRACTICE_CORRECT_SALINDA_ID) {
        setSelectedCardId(null);
        setState('idle');
        showError();
        return;
      }
      setSelectedCardId(card.id);
      setState('options');
      void playSfx('meterCelebrateIntro', { cooldownMs: 0, volumeOverride: 0.68 });
    },
    [showError, state],
  );

  const pickOp = useCallback(
    (op: Operation) => {
      if (state !== 'options' || selectedCardId !== PRACTICE_CORRECT_SALINDA_ID) {
        showError();
        return;
      }
      if (!isCorrectEquationOperator(op)) {
        setWrongFlash(op);
        showError();
        setTimeout(() => setWrongFlash(null), 300);
        return;
      }

      setState('flying');
      fly.setValue(0);
      void playSfx('complete', { cooldownMs: 0, volumeOverride: 0.6 });
      Animated.timing(fly, {
        toValue: 1,
        duration: SALINDA_PRACTICE_FLY_DURATION_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setInserted(true);
        setState('solved');
        setHand((cards) => cards.filter((card) => card.id !== PRACTICE_CORRECT_SALINDA_ID));
        void playSfx('gameWin', { cooldownMs: 0, volumeOverride: 0.88 });
        onSolved();
      });
    },
    [fly, onSolved, selectedCardId, showError, state],
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#070502', '#151008', '#070502']} style={StyleSheet.absoluteFill} />
      <InstructionPlank text={'עכשיו תורכם! 😎 הביטו בקלף הסלינדה שבמניפה ובואו נבנה לו תרגיל שיתאים לו. לחצו על קלף הסלינדה, בחרו בסימן החיסור (-) כדי להשלים את המשוואה ולהיפטר מהקלף!'} />
      <TryAgainToast key={toastKey} visible={toastKey > 0} />
      <View style={styles.boardArea}>
        <View style={styles.tableZone}>
          <Animated.Image source={TABLE} resizeMode="contain" style={styles.tableImg} />
          <EquationTrack inserted={inserted} />
          {state === 'flying' ? <FlyingOperator progress={fly} mode="practice" /> : null}
        </View>
      </View>
      {state === 'options' ? (
        <Animated.View
          style={[
            styles.practiceOptions,
            {
              opacity: optionsPop,
              transform: [{ scale: optionsPop.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }],
            },
          ]}
        >
          {OPS.map((op) => (
            <View key={op} style={wrongFlash === op ? styles.wrongOp : undefined}>
              <OperatorBubble op={op} onPress={() => pickOp(op)} active={op === '-'} />
            </View>
          ))}
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.fanArea, { width: fanW, transform: [{ scale: state === 'idle' ? fanPulse : 1 }] }]} pointerEvents={state === 'flying' || state === 'solved' ? 'none' : 'box-none'}>
        {state === 'idle' ? <View pointerEvents="none" style={styles.fanHalo} /> : null}
        <HandFan
          cards={hand}
          width={fanW}
          selectedIds={selectedIds}
          onTapCard={tapCard}
          canTap={canTapCard}
        />
      </Animated.View>
    </View>
  );
}

function InstructionEndModal({ onContinueNext, onBackRoom }: { onContinueNext: () => void; onBackRoom: () => void }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 130, useNativeDriver: true }).start();
  }, [pop]);
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  return (
    <View style={styles.modalOverlay}>
      <Animated.View style={[styles.modalCard, { opacity: pop, transform: [{ scale }] }]}>
        <LinearGradient colors={GOLD} locations={[0, 0.32, 0.68, 1]} style={StyleSheet.absoluteFill} />
        <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.58)', 'rgba(255,255,255,0)']} style={styles.modalSheen} />
        <Text style={styles.modalTitle}>היסודות בידיים שלך! 🎓</Text>
        <Text style={styles.modalBody}>
          עכשיו אתם מבינים את הסוד האמיתי: המשחק הוא לא רק לפתור תרגיל נכון. המשחק הוא לחפש במניפה שלכם בדיוק את הקלף שיציל אתכם... או שיהרוס ליריב את התוכניות!
        </Text>
        <View style={styles.modalButtons}>
          <GoldButton label={"המשך ל'מיוחדים'"} onPress={onContinueNext} accessibilityLabel={"המשך ל'מיוחדים'"} fullWidth height={54} fontSize={18} />
          <GoldButton label="חזרה לחדר הזהב" onPress={onBackRoom} accessibilityLabel="חזרה לחדר הזהב" tone="stone" fullWidth height={48} fontSize={16} />
        </View>
      </Animated.View>
    </View>
  );
}

export function SalindaCardFlow({ onExit, onComplete, onContinueNext }: SalindaCardFlowProps) {
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<'showcase' | 'practice'>('showcase');
  const [showEnd, setShowEnd] = useState(false);

  const finishPractice = useCallback(() => {
    onComplete();
    setShowEnd(true);
  }, [onComplete]);

  const continueNext = useCallback(() => {
    setShowEnd(false);
    onContinueNext();
  }, [onContinueNext]);

  return (
    <View style={[styles.root, { maxWidth: Math.min(width, 480), alignSelf: 'center', width: '100%' }]}>
      {mode === 'showcase' ? <SalindaCardShowcase onDone={() => setMode('practice')} /> : <SalindaPractice onSolved={finishPractice} />}
      {showEnd ? <InstructionEndModal onContinueNext={continueNext} onBackRoom={onExit} /> : null}
    </View>
  );
}

export default SalindaCardFlow;

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  instructionWrap: { position: 'absolute', top: 14, left: 14, right: 14, zIndex: 12 },
  instructionBubble: {
    minHeight: 104,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6B4516',
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#F4CD5A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 10,
  },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '48%' },
  innerGlow: { position: 'absolute', left: 1, right: 1, top: 1, bottom: 1, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  instructionText: {
    writingDirection: 'rtl',
    textAlign: 'center',
    color: '#171006',
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '900',
    textShadowColor: 'rgba(255,255,255,0.38)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  toast: {
    position: 'absolute',
    top: 128,
    alignSelf: 'center',
    zIndex: 30,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FFB4AB',
    backgroundColor: 'rgba(97,24,24,0.96)',
    paddingHorizontal: 22,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 12,
  },
  toastText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 112, paddingBottom: 218, paddingHorizontal: 16 },
  tableZone: { width: '96%', maxWidth: 390, aspectRatio: 1024 / 774, alignItems: 'center', justifyContent: 'center' },
  tableImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.55 },
  track: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(20,12,4,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(244,205,90,0.38)',
  },
  numSlot: {
    minWidth: 48,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,205,90,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(244,205,90,0.68)',
  },
  resultSlot: { backgroundColor: 'rgba(123,224,138,0.13)', borderColor: 'rgba(123,224,138,0.72)' },
  numText: { color: '#F8E08E', fontSize: 22, fontWeight: '900', writingDirection: 'ltr', textAlign: 'center' },
  opSlot: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(244,205,90,0.55)',
    backgroundColor: 'rgba(255,243,201,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  opSlotSolved: { borderStyle: 'solid', borderColor: '#F8E08E', backgroundColor: 'rgba(244,205,90,0.28)' },
  question: { color: 'rgba(244,205,90,0.65)', fontSize: 24, fontWeight: '900' },
  equals: { color: '#F8E08E', fontSize: 22, fontWeight: '900', marginHorizontal: 2 },
  flyingOperator: { position: 'absolute', zIndex: 20 },
  singleFanArea: { position: 'absolute', left: 0, right: 0, bottom: 34, alignItems: 'center', zIndex: 8 },
  fanArea: { position: 'absolute', left: 0, right: 0, bottom: 16, alignItems: 'center', zIndex: 8 },
  singleCardWrap: { alignItems: 'center', justifyContent: 'center' },
  cardHalo: {
    position: 'absolute',
    width: 126,
    height: 166,
    borderRadius: 20,
    backgroundColor: 'rgba(248,224,142,0.24)',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 18,
    elevation: 16,
  },
  fanHalo: {
    position: 'absolute',
    top: 28,
    width: 124,
    height: 166,
    borderRadius: 20,
    backgroundColor: 'rgba(248,224,142,0.16)',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 18,
    elevation: 14,
  },
  showcaseOptionsLayer: { position: 'absolute', left: 0, right: 0, bottom: 156, alignItems: 'center', zIndex: 9 },
  optionFromCard: { position: 'absolute' },
  opBubble: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: '#FFF1A8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 7,
    elevation: 8,
  },
  opBubbleCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFF1A8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  opBubbleActive: {
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.92,
    shadowRadius: 13,
    elevation: 13,
  },
  bubbleSheen: { position: 'absolute', left: 0, right: 0, top: 0, height: '46%' },
  arrowToCard: { position: 'absolute', bottom: 198, alignSelf: 'center', zIndex: 11 },
  arrowToMinus: { position: 'absolute', bottom: 246, alignSelf: 'center', marginLeft: 46, zIndex: 11 },
  arrowText: {
    color: '#FFF4B8',
    fontSize: 54,
    lineHeight: 58,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  nextArrow: {
    position: 'absolute',
    right: 24,
    bottom: 38,
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: 'rgba(248,224,142,0.72)',
    backgroundColor: 'rgba(248,224,142,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  nextArrowPressed: { transform: [{ scale: 0.94 }], backgroundColor: 'rgba(248,224,142,0.28)' },
  nextArrowText: { color: '#F8E08E', fontSize: 36, lineHeight: 40, fontWeight: '900', textAlign: 'center', marginTop: -2 },
  practiceOptions: {
    position: 'absolute',
    left: 26,
    right: 26,
    bottom: 224,
    zIndex: 14,
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  wrongOp: { transform: [{ translateY: 4 }], opacity: 0.55 },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,5,2,0.84)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 40,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#8A5A1C',
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'stretch',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 18,
  },
  modalSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '46%' },
  modalTitle: { ...rtlText, color: '#2B1D08', fontSize: 27, lineHeight: 34, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  modalBody: { ...rtlText, color: '#3D2A0E', fontSize: 17, lineHeight: 26, fontWeight: '800' },
  modalButtons: { marginTop: 22, gap: 10 },
});
