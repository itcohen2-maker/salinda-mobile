import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GoldButton } from '../../components/GoldButton';
import { GameCard, type Card } from '../../components/CardDesign';
import { playSfx } from '../audio/sfx';

type ChallengeShowcaseScreenProps = {
  onContinue: () => void;
};

type ShowcaseScene = 'block' | 'roll' | 'finished';
type ScenePhase = 'intro' | 'challenge' | 'answer' | 'success';

const CHALLENGE_THIRD: Card = { id: 'challenge-showcase-third', type: 'fraction', fraction: '1/3' };
const BLOCK_TWELVE: Card = { id: 'challenge-showcase-12', type: 'number', value: 12 };
const ROLL_HALF: Card = { id: 'challenge-showcase-half', type: 'fraction', fraction: '1/2' };
const SHOWCASE_SCENES: ShowcaseScene[] = ['block', 'roll', 'finished'];
const GOLD = ['#FFF4B8', '#F8E08E', '#D9A23A', '#8A5A1C'] as const;

export function ChallengeShowcaseScreen({ onContinue }: ChallengeShowcaseScreenProps) {
  const [scene, setScene] = useState<ShowcaseScene>('block');
  const [phase, setPhase] = useState<ScenePhase>('intro');
  const [replayToken, setReplayToken] = useState(0);
  const sceneOpacity = useRef(new Animated.Value(1)).current;
  const challengeDrop = useRef(new Animated.Value(0)).current;
  const answerJump = useRef(new Animated.Value(0)).current;
  const successPop = useRef(new Animated.Value(0)).current;
  const finalPop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    sceneOpacity.setValue(1);
    challengeDrop.setValue(0);
    answerJump.setValue(0);
    successPop.setValue(0);
    finalPop.setValue(0);
    setPhase(scene === 'finished' ? 'success' : 'intro');

    if (scene === 'finished') {
      void playSfx('complete', { cooldownMs: 0, volumeOverride: 0.65 });
      Animated.spring(finalPop, {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }).start();
    } else {
      timers.push(
        setTimeout(() => {
          setPhase('challenge');
          void playSfx('combo', { cooldownMs: 0, volumeOverride: 0.48 });
          Animated.timing(challengeDrop, {
            toValue: 1,
            duration: 520,
            easing: Easing.out(Easing.back(1.05)),
            useNativeDriver: true,
          }).start();
        }, 220),
      );

      timers.push(
        setTimeout(() => {
          setPhase('answer');
          void playSfx('place', { cooldownMs: 0, volumeOverride: 0.54 });
          Animated.timing(answerJump, {
            toValue: 1,
            duration: 560,
            easing: Easing.out(Easing.back(1.15)),
            useNativeDriver: true,
          }).start();
        }, 1150),
      );

      timers.push(
        setTimeout(() => {
          setPhase('success');
          void playSfx(scene === 'block' ? 'success' : 'transition', { cooldownMs: 0, volumeOverride: 0.62 });
          Animated.spring(successPop, {
            toValue: 1,
            friction: 5,
            tension: 130,
            useNativeDriver: true,
          }).start();
        }, 1880),
      );
    }

    return () => {
      timers.forEach(clearTimeout);
      challengeDrop.stopAnimation();
      answerJump.stopAnimation();
      successPop.stopAnimation();
      sceneOpacity.stopAnimation();
      finalPop.stopAnimation();
    };
  }, [answerJump, challengeDrop, finalPop, replayToken, scene, sceneOpacity, successPop]);

  const challengeStyle = useMemo(
    () => ({
      opacity: challengeDrop.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 1] }),
      transform: [
        { translateY: challengeDrop.interpolate({ inputRange: [0, 1], outputRange: [-170, 0] }) },
        { scale: challengeDrop.interpolate({ inputRange: [0, 0.78, 1], outputRange: [0.72, 1.08, 1] }) },
        { rotate: challengeDrop.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] }) },
      ],
    }),
    [challengeDrop],
  );

  const answerStyle = useMemo(
    () => ({
      opacity: answerJump.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 1] }),
      transform: [
        { translateY: answerJump.interpolate({ inputRange: [0, 1], outputRange: [180, -6] }) },
        { translateX: answerJump.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
        { scale: answerJump.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.72, 1.08, 0.9] }) },
      ],
    }),
    [answerJump],
  );

  const successStyle = useMemo(
    () => ({
      opacity: successPop,
      transform: [{ scale: successPop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
    }),
    [successPop],
  );

  const finalStyle = useMemo(
    () => ({
      opacity: finalPop,
      transform: [
        { translateY: finalPop.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
        { scale: finalPop.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) },
      ],
    }),
    [finalPop],
  );

  const sceneCopy =
    scene === 'roll'
      ? {
          option: 'אפשרות 2: גלגול האתגר הלאה',
          body: 'אין מספר מתאים? אפשר להניח שבר אחר ולהעביר את האתגר.',
          success: 'האתגר עבר הלאה',
          answer: ROLL_HALF,
        }
      : {
          option: 'אפשרות 1: חסימה עם מספר מתחלק',
          body: 'קלף 12 מתחלק ב-3, ולכן הוא חוסם את 1/3.',
          success: 'חסימה מוצלחת',
          answer: BLOCK_TWELVE,
        };

  const handleContinue = useCallback(() => {
    void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.44 });
    onContinue();
  }, [onContinue]);

  const handleReplay = useCallback(() => {
    void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.42 });
    if (scene === 'finished') {
      setScene('block');
    }
    setReplayToken((value) => value + 1);
  }, [scene]);

  const sceneIndex = SHOWCASE_SCENES.indexOf(scene);
  const canGoBack = sceneIndex > 0;
  const canGoNext = sceneIndex < SHOWCASE_SCENES.length - 1;
  const goBack = useCallback(() => {
    if (!canGoBack) return;
    void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.42 });
    setScene(SHOWCASE_SCENES[sceneIndex - 1]);
  }, [canGoBack, sceneIndex]);
  const goNext = useCallback(() => {
    if (!canGoNext) return;
    void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.42 });
    setScene(SHOWCASE_SCENES[sceneIndex + 1]);
  }, [canGoNext, sceneIndex]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#070502', '#171007', '#070502']} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.roomHalo} />
      <View pointerEvents="none" style={styles.goldRoomFrame}>
        <View style={styles.roomColumn} />
        <View style={styles.roomColumn} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>אותגרת!</Text>
        <Text style={styles.subtitle}>כך מגנים מפני קלף שבר</Text>
      </View>

      {scene !== 'finished' ? (
        <Animated.View style={[styles.scene, { opacity: sceneOpacity }]}>
          <View style={styles.copyBlock}>
            <Text style={styles.optionText}>{sceneCopy.option}</Text>
            <Text style={styles.bodyText}>{sceneCopy.body}</Text>
          </View>

          <View style={styles.board}>
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0)', 'rgba(138,90,28,0.18)']}
              style={styles.boardSheen}
            />
            <View style={styles.cardStack}>
              <Animated.View style={[styles.challengeCard, challengeStyle]}>
                <GameCard card={CHALLENGE_THIRD} small />
              </Animated.View>
              {phase === 'answer' || phase === 'success' ? (
                <Animated.View style={[styles.answerCard, answerStyle]}>
                  <GameCard card={sceneCopy.answer} small />
                </Animated.View>
              ) : null}
              {phase === 'success' ? (
                <Animated.View style={[styles.successBadge, successStyle]}>
                  <Text style={styles.successIcon}>{scene === 'block' ? '✓' : '↗'}</Text>
                </Animated.View>
              ) : null}
            </View>
            {phase === 'success' ? <Text style={styles.successText}>{sceneCopy.success}</Text> : null}
          </View>

          <Pressable onPress={handleReplay} accessibilityRole="button" accessibilityLabel="הראה לי שוב את האנימציה">
            <LinearGradient colors={GOLD} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.replayButton}>
              <Text style={styles.replayText}>הראה לי שוב</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.finalScene, finalStyle]}>
          <Text style={styles.finalTitle}>עכשיו אתם יודעים להתגונן</Text>
          <Text style={styles.finalBody}>חוסמים עם מספר מתחלק, או מגלגלים הלאה עם שבר אחר.</Text>
          <View style={styles.finalCards} pointerEvents="none">
            <View style={styles.finalCardSide}><GameCard card={BLOCK_TWELVE} small /></View>
            <View style={styles.finalCardCenter}><GameCard card={CHALLENGE_THIRD} small /></View>
            <View style={styles.finalCardSide}><GameCard card={ROLL_HALF} small /></View>
          </View>
          <Pressable onPress={handleReplay} accessibilityRole="button" accessibilityLabel="הראה לי שוב את האנימציה">
            <LinearGradient colors={GOLD} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.replayButton}>
              <Text style={styles.replayText}>הראה לי שוב</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      )}

      {scene === 'finished' ? (
        <View style={styles.ctaWrap}>
          <GoldButton label="הבנתי, בוא נתגונן!" onPress={handleContinue} accessibilityLabel="הבנתי, בוא נתגונן" fullWidth height={56} fontSize={20} />
        </View>
      ) : null}

      <View style={styles.navWrap} pointerEvents="box-none">
        <Pressable onPress={goBack} disabled={!canGoBack} accessibilityRole="button" accessibilityLabel="הדגמת אתגר קודמת">
          <View style={[styles.arrowButton, !canGoBack && styles.arrowButtonDisabled]}>
            <Text allowFontScaling={false} style={styles.arrowText}>{'<'}</Text>
          </View>
        </Pressable>
        <View style={styles.stepDots} pointerEvents="none">
          {SHOWCASE_SCENES.map((item) => (
            <View key={item} style={[styles.stepDot, item === scene && styles.stepDotActive]} />
          ))}
        </View>
        <Pressable onPress={goNext} disabled={!canGoNext} accessibilityRole="button" accessibilityLabel="הדגמת אתגר הבאה">
          <View style={[styles.arrowButton, !canGoNext && styles.arrowButtonDisabled]}>
            <Text allowFontScaling={false} style={styles.arrowText}>{'>'}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const rtlText = {
  writingDirection: (I18nManager.isRTL ? 'rtl' : 'rtl') as 'rtl',
  textAlign: 'center' as const,
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    direction: 'rtl',
  } as any,
  roomHalo: {
    position: 'absolute',
    left: '9%',
    right: '9%',
    top: '14%',
    height: '58%',
    borderRadius: 220,
    backgroundColor: 'rgba(248,224,142,0.12)',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 36,
    elevation: 10,
  },
  goldRoomFrame: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 110,
  },
  roomColumn: {
    width: 16,
    height: '62%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,244,184,0.26)',
    backgroundColor: 'rgba(138,90,28,0.22)',
  },
  header: {
    paddingTop: 26,
    paddingHorizontal: 26,
    alignItems: 'center',
  },
  title: {
    ...rtlText,
    color: '#FFF1A8',
    fontSize: 36,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    ...rtlText,
    color: '#F5E6BF',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '800',
    marginTop: 6,
  },
  scene: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBlock: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 20,
  },
  optionText: {
    ...rtlText,
    color: '#F8E08E',
    fontSize: 24,
    lineHeight: 33,
    fontWeight: '900',
  },
  bodyText: {
    ...rtlText,
    color: '#F5E6BF',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  board: {
    width: '100%',
    minHeight: 306,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#8A5A1C',
    backgroundColor: 'rgba(20,12,4,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 12,
  },
  boardSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '58%',
  },
  cardStack: {
    width: 190,
    height: 214,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeCard: {
    position: 'absolute',
  },
  answerCard: {
    position: 'absolute',
    zIndex: 3,
  },
  successBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: '#D8FFDF',
    backgroundColor: '#2E7D43',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
    shadowColor: '#7BE08A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 14,
  },
  successIcon: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 36,
  },
  successText: {
    ...rtlText,
    color: '#C8F7CE',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 8,
  },
  replayButton: {
    minWidth: 168,
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,243,201,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.36,
    shadowRadius: 10,
    elevation: 8,
  },
  replayText: {
    color: '#2B1D08',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  finalScene: {
    flex: 1,
    paddingHorizontal: 26,
    paddingBottom: 106,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalTitle: {
    ...rtlText,
    alignSelf: 'stretch',
    color: '#F8E08E',
    fontSize: 30,
    lineHeight: 40,
    fontWeight: '900',
  },
  finalBody: {
    ...rtlText,
    alignSelf: 'stretch',
    color: '#F5E6BF',
    fontSize: 19,
    lineHeight: 30,
    fontWeight: '800',
    marginTop: 10,
  },
  finalCards: {
    marginTop: 34,
    width: 250,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row-reverse',
  },
  finalCardCenter: {
    transform: [{ scale: 0.82 }],
    zIndex: 3,
  },
  finalCardSide: {
    transform: [{ scale: 0.62 }],
    marginHorizontal: -12,
    opacity: 0.9,
  },
  ctaWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 76,
  },
  navWrap: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 16,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrowButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(248,224,142,0.86)',
    backgroundColor: 'rgba(16,19,29,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  arrowButtonDisabled: {
    opacity: 0.28,
  },
  arrowText: {
    color: '#FFF1A8',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
  },
  stepDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(248,224,142,0.32)',
  },
  stepDotActive: {
    width: 22,
    backgroundColor: '#F8E08E',
  },
});

export default ChallengeShowcaseScreen;
