import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { GoldButton } from '../../components/GoldButton';
import { GameCard, type Card } from '../../components/CardDesign';
import { DiceEquationRound } from './DiceEquationRound';

const INTRO_TEXT = 'הכירו את קלפי הסימן + / -. הציבו אותם בתרגיל וכך תיפטרו מהם';
const INTRO_BUTTON_WIDTH = 180;
const INTRO_BUTTON_HEIGHT = 50;
const INTRO_BUTTON_RADIUS = 12;
const INTRO_BUTTON_RAISE = 5;
const INTRO_BUTTON_FONT_SIZE = 22;

const INTRO_HAND: Card[] = [
  { id: 'sign-intro-plus', type: 'operation', operation: '+' },
  { id: 'sign-intro-minus', type: 'operation', operation: '-' },
];

function SignCardsIntro({ onStart }: { onStart: () => void }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const open = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(open, { toValue: 1, friction: 7, tension: 110, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 760, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 760, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      open.stopAnimation();
    };
  }, [open, pulse]);

  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.72] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.08] });
  const fanScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  const plusX = open.interpolate({ inputRange: [0, 1], outputRange: [0, -58] });
  const minusX = open.interpolate({ inputRange: [0, 1], outputRange: [0, 58] });
  const plusRotate = open.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-10deg'] });
  const minusRotate = open.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '10deg'] });
  const cardLift = open.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <View style={styles.root}>
      <View style={styles.dimBoard} pointerEvents="none" />

      <View style={styles.copyWrap}>
        <Text allowFontScaling={false} style={styles.introText}>
          {INTRO_TEXT}
        </Text>
      </View>

      <View style={styles.spotlightWrap} pointerEvents="none">
        <Animated.View style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />
      </View>

      <View style={styles.fanWrap}>
        <Animated.View pointerEvents="none" style={[styles.signFan, { transform: [{ scale: fanScale }] }]}>
          <Animated.View
            style={[
              styles.signCard,
              styles.signCardLeft,
              { transform: [{ translateX: plusX }, { translateY: cardLift }, { rotate: plusRotate }] },
            ]}
          >
            <GameCard card={INTRO_HAND[0]} selected small onPress={undefined} />
          </Animated.View>
          <Animated.View
            style={[
              styles.signCard,
              styles.signCardRight,
              { transform: [{ translateX: minusX }, { translateY: cardLift }, { rotate: minusRotate }] },
            ]}
          >
            <GameCard card={INTRO_HAND[1]} selected small onPress={undefined} />
          </Animated.View>
        </Animated.View>
      </View>

      <View style={styles.buttonWrap}>
        <GoldButton
          label="הבנתי, בוא נתרגל!"
          onPress={onStart}
          fullWidth
          height={INTRO_BUTTON_HEIGHT}
          radius={INTRO_BUTTON_RADIUS}
          raise={INTRO_BUTTON_RAISE}
          fontSize={INTRO_BUTTON_FONT_SIZE}
          textStyle={styles.buttonText}
          accessibilityLabel="הבנתי, בוא נתרגל!"
        />
      </View>
    </View>
  );
}

export default function SpecialCardsIntro({ onDone }: { onDone?: () => void }) {
  const [readyToPractice, setReadyToPractice] = useState(false);

  if (readyToPractice) {
    return <DiceEquationRound mode="operators" onComplete={onDone} />;
  }

  return <SignCardsIntro onStart={() => setReadyToPractice(true)} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dimBoard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '58%',
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  copyWrap: {
    position: 'absolute',
    top: 34,
    left: 22,
    right: 22,
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: 'rgba(20,12,4,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(244,205,90,0.32)',
  },
  introText: {
    color: '#F8E08E',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 25,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  spotlightWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 86,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    width: 260,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#2E7D43',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 22,
    elevation: 16,
  },
  fanWrap: { position: 'absolute', left: 0, right: 0, bottom: 56, alignItems: 'center', zIndex: 3 },
  signFan: {
    width: 250,
    height: 178,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signCard: {
    position: 'absolute',
    width: 100,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signCardLeft: { zIndex: 2 },
  signCardRight: { zIndex: 3 },
  buttonWrap: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    width: INTRO_BUTTON_WIDTH,
    borderRadius: INTRO_BUTTON_RADIUS,
    zIndex: 5,
  },
  buttonText: { textAlign: 'center' as const },
});
