import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { GoldButton } from '../../components/GoldButton';
import HandFan from '../../components/HandFan';
import type { Card } from '../../components/CardDesign';
import { DiceEquationRound } from './DiceEquationRound';

const INTRO_BUTTON_WIDTH = 180;
const INTRO_BUTTON_HEIGHT = 30;
const INTRO_BUTTON_RADIUS = 12;
const INTRO_BUTTON_RAISE = 5;
const INTRO_BUTTON_FONT_SIZE = 13;

const INTRO_HAND: Card[] = [
  { id: 'sign-intro-num-5', type: 'number', value: 5 },
  { id: 'sign-intro-plus', type: 'operation', operation: '+' },
  { id: 'sign-intro-minus', type: 'operation', operation: '-' },
  { id: 'sign-intro-num-3', type: 'number', value: 3 },
  { id: 'sign-intro-num-9', type: 'number', value: 9 },
];

function SignCardsIntro({ onStart }: { onStart: () => void }) {
  const { width: winW } = useWindowDimensions();
  const fanW = Math.min(winW, 480);
  const pulse = useRef(new Animated.Value(0)).current;
  const selectedIds = useMemo(() => new Set(['sign-intro-plus', 'sign-intro-minus']), []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 760, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 760, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.9] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });
  const fanScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });

  return (
    <View style={styles.root}>
      <View style={styles.dimBoard} pointerEvents="none" />
      <View style={styles.copyWrap}>
        <Text style={styles.introText}>
          הכירו את משני המשחק! קלפי הסימן (+ / -) הם חומרי גלם מטורפים. הם מאפשרים לכם לשנות את חוקי המשוואה על הלוח, להנדס תרגילים יצירתיים ולהיפטר מקלפים מהמניפה שלכם!
        </Text>
      </View>

      <View style={styles.spotlightWrap} pointerEvents="none">
        <Animated.View style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />
      </View>

      <View style={styles.fanWrap}>
        <Animated.View style={{ transform: [{ scale: fanScale }] }}>
          <HandFan
            cards={INTRO_HAND}
            width={fanW}
            selectedIds={selectedIds}
            centerCardId="sign-intro-minus"
            canTap={() => false}
          />
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
  const [readyToPractice, setReadyToPractice] = React.useState(false);

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
    backgroundColor: 'rgba(0,0,0,0.36)',
  },
  copyWrap: {
    position: 'absolute',
    top: 22,
    left: 18,
    right: 18,
    zIndex: 4,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: 'rgba(20,12,4,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(244,205,90,0.38)',
  },
  introText: { color: '#F8E08E', fontSize: 17, fontWeight: '800', lineHeight: 25, textAlign: 'right' },
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
    width: 330,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#2E7D43',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 26,
    elevation: 18,
  },
  fanWrap: { position: 'absolute', left: 0, right: 0, bottom: 46, alignItems: 'center', zIndex: 3 },
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