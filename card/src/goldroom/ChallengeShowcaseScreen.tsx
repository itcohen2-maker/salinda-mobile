import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, I18nManager, StyleSheet, Text, View } from 'react-native';
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

export function ChallengeShowcaseScreen({ onContinue }: ChallengeShowcaseScreenProps) {
  const [scene, setScene] = useState<ShowcaseScene>('block');
  const [phase, setPhase] = useState<ScenePhase>('intro');
  const sceneOpacity = useRef(new Animated.Value(1)).current;
  const challengeDrop = useRef(new Animated.Value(0)).current;
  const answerJump = useRef(new Animated.Value(0)).current;
  const successPop = useRef(new Animated.Value(0)).current;
  const finalPop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    const resetSceneValues = () => {
      sceneOpacity.setValue(1);
      challengeDrop.setValue(0);
      answerJump.setValue(0);
      successPop.setValue(0);
    };

    const playScene = (nextScene: Exclude<ShowcaseScene, 'finished'>, offset: number) => {
      timers.push(
        setTimeout(() => {
          setScene(nextScene);
          setPhase('intro');
          resetSceneValues();
        }, offset),
      );

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
        }, offset + 280),
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
        }, offset + 1320),
      );

      timers.push(
        setTimeout(() => {
          setPhase('success');
          void playSfx(nextScene === 'block' ? 'success' : 'transition', { cooldownMs: 0, volumeOverride: 0.62 });
          Animated.spring(successPop, {
            toValue: 1,
            friction: 5,
            tension: 130,
            useNativeDriver: true,
          }).start();
        }, offset + 2100),
      );

      timers.push(
        setTimeout(() => {
          Animated.timing(sceneOpacity, {
            toValue: 0,
            duration: 300,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }).start();
        }, offset + 2920),
      );
    };

    playScene('block', 120);
    playScene('roll', 3380);
    timers.push(
      setTimeout(() => {
        setScene('finished');
        setPhase('success');
        void playSfx('complete', { cooldownMs: 0, volumeOverride: 0.65 });
        Animated.spring(finalPop, {
          toValue: 1,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }).start();
      }, 6780),
    );

    return () => {
      timers.forEach(clearTimeout);
      challengeDrop.stopAnimation();
      answerJump.stopAnimation();
      successPop.stopAnimation();
      sceneOpacity.stopAnimation();
      finalPop.stopAnimation();
    };
  }, [answerJump, challengeDrop, finalPop, sceneOpacity, successPop]);

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
          body: 'קלף 12 מתחלק ב-3, ולכן הוא חוסם את ⅓.',
          success: 'חסימה מוצלחת',
          answer: BLOCK_TWELVE,
        };

  const handleContinue = useCallback(() => {
    void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.44 });
    onContinue();
  }, [onContinue]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#050609', '#111521', '#050609']} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.dangerGlow} />

      <View style={styles.header}>
        <Text style={styles.title}>אותגרת! ⚔️</Text>
        <Text style={styles.subtitle}>כך מגנים מפני קלף שבר</Text>
      </View>

      {scene !== 'finished' ? (
        <Animated.View style={[styles.scene, { opacity: sceneOpacity }]}>
          <View style={styles.copyBlock}>
            <Text style={styles.optionText}>{sceneCopy.option}</Text>
            <Text style={styles.bodyText}>{sceneCopy.body}</Text>
          </View>

          <View style={styles.board}>
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
        </Animated.View>
      )}

      {scene === 'finished' ? (
        <View style={styles.ctaWrap}>
          <GoldButton label="הבנתי, בוא נתגונן!" onPress={handleContinue} accessibilityLabel="הבנתי, בוא נתגונן" fullWidth height={56} fontSize={20} />
        </View>
      ) : null}
    </View>
  );
}

const rtlText = {
  writingDirection: (I18nManager.isRTL ? 'rtl' : 'rtl') as 'rtl',
  textAlign: 'right' as const,
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    direction: 'rtl',
  } as any,
  dangerGlow: {
    position: 'absolute',
    top: '22%',
    right: '-22%',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(179,38,30,0.14)',
    shadowColor: '#B3261E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 38,
    elevation: 12,
  },
  header: {
    paddingTop: 26,
    paddingHorizontal: 26,
    alignItems: 'flex-end',
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
    color: '#E8EDF7',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '800',
    marginTop: 6,
  },
  scene: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 96,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  copyBlock: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    marginBottom: 22,
  },
  optionText: {
    ...rtlText,
    color: '#F8E08E',
    fontSize: 25,
    lineHeight: 34,
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
    minHeight: 300,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(248,224,142,0.28)',
    backgroundColor: 'rgba(9,12,19,0.74)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardStack: {
    width: 180,
    height: 210,
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
    bottom: 34,
  },
});

export default ChallengeShowcaseScreen;
