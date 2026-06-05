import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GoldButton } from '../../components/GoldButton';
import { GameCard, type Card } from '../../components/CardDesign';
import { playSfx } from '../audio/sfx';

const rtlText = {
  writingDirection: 'rtl' as const,
  textAlign: 'right' as const,
};

type FeraShowcaseScreenProps = {
  onStart?: () => void;
  onContinue?: () => void;
};

type DemoStep = 0 | 1 | 2 | 3 | 'finished';

type DemoExercise = {
  label: string;
  left: string;
  middle: string;
  right: string;
  resolved: string;
  hint: string;
};

const FERA_CARD: Card = { id: 'fera-showcase-wild', type: 'wild' };

const DEMOS: DemoExercise[] = [
  { label: 'חיבור', left: '5 +', middle: '', right: '= 8', resolved: '3', hint: 'משלים את החסר' },
  { label: 'כפל', left: '4 × 3', middle: '', right: '=', resolved: '12', hint: 'מוצא את התוצאה' },
  { label: 'שברים', left: '16 ÷', middle: '', right: '= 4', resolved: '4', hint: 'מגן גם בשברים' },
];

export function FeraShowcaseScreen({ onStart, onContinue }: FeraShowcaseScreenProps) {
  const [step, setStep] = useState<DemoStep>(0);
  const [slotResolved, setSlotResolved] = useState(false);
  const [animating, setAnimating] = useState(false);
  const fly = useRef(new Animated.Value(0)).current;
  const sceneOpacity = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const finalPop = useRef(new Animated.Value(0)).current;
  const autoStarted = useRef(false);
  const resolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const demo = typeof step === 'number' && step > 0 ? DEMOS[step - 1] : null;

  useEffect(() => {
    return () => {
      if (resolveTimer.current) clearTimeout(resolveTimer.current);
      fly.stopAnimation();
      glow.stopAnimation();
      sceneOpacity.stopAnimation();
      finalPop.stopAnimation();
    };
  }, [finalPop, fly, glow, sceneOpacity]);

  const runDemo = useCallback(
    (nextStep: 1 | 2 | 3) => {
      if (resolveTimer.current) clearTimeout(resolveTimer.current);
      setAnimating(true);
      setStep(nextStep);
      setSlotResolved(false);
      fly.setValue(0);
      glow.setValue(0);
      sceneOpacity.setValue(1);
      void playSfx('place', { cooldownMs: 0, volumeOverride: 0.4 });
      resolveTimer.current = setTimeout(() => setSlotResolved(true), 760);
      Animated.sequence([
        Animated.timing(fly, {
          toValue: 1,
          duration: 760,
          easing: Easing.out(Easing.back(0.95)),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setAnimating(false);
      });
    },
    [fly, glow, sceneOpacity],
  );

  const showFinishedState = useCallback(() => {
    if (resolveTimer.current) clearTimeout(resolveTimer.current);
    setAnimating(true);
    setStep('finished');
    setSlotResolved(false);
    finalPop.setValue(0);
    void playSfx('combo', { cooldownMs: 0, volumeOverride: 0.58 });
    Animated.spring(finalPop, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setAnimating(false);
    });
  }, [finalPop]);

  const handleNextDemo = useCallback(() => {
    if (animating) return;
    if (step === 0) runDemo(1);
    else if (step === 1) runDemo(2);
    else if (step === 2) runDemo(3);
    else if (step === 3) showFinishedState();
  }, [animating, runDemo, showFinishedState, step]);

  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    runDemo(1);
  }, [runDemo]);

  const flyStyle = useMemo(
    () => ({
      opacity: fly.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 1] }),
      transform: [
        { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [158, -58] }) },
        { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [-34, 0] }) },
        { scale: fly.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.68, 1.08, 0.42] }) },
      ],
    }),
    [fly],
  );

  const slotGlowStyle = useMemo(
    () => ({
      opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.9] }),
      transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.18] }) }],
    }),
    [glow],
  );

  const finalCardStyle = useMemo(
    () => ({
      opacity: finalPop,
      transform: [
        { scale: finalPop.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1.1] }) },
        { translateY: finalPop.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
      ],
    }),
    [finalPop],
  );

  const handleStart = useCallback(() => {
    void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.45 });
    (onStart ?? onContinue)?.();
  }, [onContinue, onStart]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#2E1065', '#7C3AED', '#F59E0B', '#FFF7CC']} locations={[0, 0.42, 0.76, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <Text style={styles.title}>הכירו את הפרא!</Text>
        <Text style={styles.subtitle}>{step === 'finished' ? 'הקלף החזק ביותר במשחק. הוא מתאים לכל תרגיל!' : 'הקלף שפותר הכל...'}</Text>
      </View>

      <View style={styles.stage}>
        {demo ? (
          <Animated.View style={[styles.demoCard, { opacity: sceneOpacity }]}>
            <Text style={styles.demoLabel}>{demo.label}</Text>
            <View style={styles.equationRow}>
              <Text style={styles.equationText}>{demo.left}</Text>
              <View style={styles.slot}>
                <Animated.View pointerEvents="none" style={[styles.slotGlow, slotGlowStyle]} />
                {slotResolved ? <Text style={styles.resolvedText}>{demo.resolved}</Text> : <Text style={styles.slotText}>?</Text>}
              </View>
              <Text style={styles.equationText}>{demo.right}</Text>
            </View>
            <Text style={styles.demoHint}>{demo.hint}</Text>
            <Animated.View style={[styles.flyingFera, flyStyle]}>
              <GameCard card={FERA_CARD} small />
            </Animated.View>
          </Animated.View>
        ) : null}

        {!demo && step !== 'finished' ? (
          <View style={styles.staticFallback}>
            <View style={styles.staticCardWrap}>
              <GameCard card={FERA_CARD} small />
            </View>
            <View style={styles.fallbackEquation}>
              <Text style={styles.equationText}>5 +</Text>
              <View style={styles.slot}>
                <Text style={styles.slotText}>?</Text>
              </View>
              <Text style={styles.equationText}>= 8</Text>
            </View>
          </View>
        ) : null}

        {step === 'finished' ? (
          <Animated.View style={[styles.finalCard, finalCardStyle]}>
            <GameCard card={FERA_CARD} small />
          </Animated.View>
        ) : null}
      </View>

      {step === 'finished' ? (
        <View style={styles.ctaWrap}>
          <GoldButton label="הבנתי, בוא נתרגל!" onPress={handleStart} accessibilityLabel="הבנתי, בוא נתרגל!" fullWidth height={56} fontSize={20} />
        </View>
      ) : null}

      {step !== 'finished' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="הדגמה הבאה"
          disabled={animating}
          onPress={handleNextDemo}
          style={({ pressed }) => [
            styles.nextArrow,
            animating && styles.nextArrowDisabled,
            pressed && !animating && styles.nextArrowPressed,
          ]}
        >
          <Text style={styles.nextArrowText}>›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  header: {
    paddingTop: 26,
    paddingHorizontal: 24,
    alignItems: 'flex-end',
  },
  title: {
    ...rtlText,
    color: '#F8E08E',
    fontSize: 30,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    ...rtlText,
    color: '#F5E6BF',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '800',
    marginTop: 10,
  },
  stage: {
    flex: 1,
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingBottom: 92,
  },
  staticFallback: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staticCardWrap: {
    marginBottom: 28,
    transform: [{ scale: 1.2 }],
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 18,
    elevation: 16,
  },
  fallbackEquation: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  demoCard: {
    width: '100%',
    maxWidth: 390,
    minHeight: 250,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,247,204,0.72)',
    backgroundColor: 'rgba(255,247,204,0.18)',
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  demoLabel: {
    ...rtlText,
    color: 'rgba(248,224,142,0.76)',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 14,
  },
  equationRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  equationText: {
    color: '#FFF1A8',
    fontSize: 32,
    fontWeight: '900',
    writingDirection: 'ltr',
    textAlign: 'center',
  },
  slot: {
    width: 70,
    height: 70,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#B58CFF',
    backgroundColor: 'rgba(139,92,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotGlow: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 18,
    backgroundColor: 'rgba(123,224,138,0.22)',
    shadowColor: '#7BE08A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.82,
    shadowRadius: 14,
    elevation: 12,
  },
  slotText: {
    color: '#F5E6BF',
    fontSize: 30,
    fontWeight: '900',
  },
  resolvedText: {
    color: '#C8F7CE',
    fontSize: 28,
    fontWeight: '900',
    writingDirection: 'ltr',
    textAlign: 'center',
  },
  demoHint: {
    ...rtlText,
    color: '#C8F7CE',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 18,
  },
  flyingFera: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -50,
    marginTop: -70,
  },
  finalCard: {
    transform: [{ scale: 1.1 }],
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 18,
    elevation: 16,
  },
  nextArrow: {
    position: 'absolute',
    right: 24,
    bottom: 38,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(248,224,142,0.72)',
    backgroundColor: 'rgba(248,224,142,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextArrowPressed: {
    transform: [{ scale: 0.94 }],
    backgroundColor: 'rgba(248,224,142,0.28)',
  },
  nextArrowDisabled: {
    opacity: 0.42,
  },
  nextArrowText: {
    color: '#F8E08E',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: -2,
  },
  ctaWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 34,
  },
});
