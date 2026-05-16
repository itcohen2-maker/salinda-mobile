import React, { useEffect, useRef, ReactNode } from 'react';
import { View, Image, StyleSheet, Animated, Easing, ImageSourcePropType } from 'react-native';

const CARD_BACK = require('../../assets/card-back-salinda-preview.png');

type Props = {
  frontSource?: ImageSourcePropType;
  front?: ReactNode;
  width?: number;
  speed?: number;
  backLabel?: string;
  active?: boolean;
};

function CardFace({
  width,
  height,
  source,
  children,
}: {
  width: number;
  height: number;
  source?: ImageSourcePropType;
  children?: ReactNode;
}) {
  if (source) {
    return (
      <View style={{ width, height, borderRadius: 14, backgroundColor: '#FFFFFF' }}>
        <Image source={source} style={{ width: '100%', height: '100%' }} resizeMode="contain" fadeDuration={0} />
      </View>
    );
  }
  return <>{children}</>;
}

export function SpinningCard({
  frontSource,
  front,
  width = 110,
  speed = 40,
  backLabel = 'Salinda',
  active = true,
}: Props) {
  void backLabel;
  const height = Math.round(width * (3.5 / 2.5));
  const spinAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      spinAnim.stopAnimation();
      floatAnim.stopAnimation();
      spinAnim.setValue(0);
      floatAnim.setValue(0);
      return;
    }

    const msPerRev = Math.max(9000, Math.round((360 / Math.max(speed, 1)) * 1000));

    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: msPerRev,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -4,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 4,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    spinLoop.start();
    floatLoop.start();
    return () => {
      spinLoop.stop();
      floatLoop.stop();
    };
  }, [active, floatAnim, spinAnim, speed]);

  const perspective = width * 18;
  const frontOpacity = spinAnim.interpolate({
    inputRange: [0, 0.249, 0.25, 0.749, 0.75, 1],
    outputRange: [1, 1, 0, 0, 1, 1],
  });
  const backOpacity = spinAnim.interpolate({
    inputRange: [0, 0.249, 0.25, 0.749, 0.75, 1],
    outputRange: [0, 0, 1, 1, 0, 0],
  });
  const frontRotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const backRotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '540deg'],
  });

  return (
    <Animated.View style={{ width, height, transform: [{ translateY: floatAnim }], overflow: 'visible' }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: backOpacity,
            backfaceVisibility: 'hidden',
            transform: [{ perspective }, { rotateY: backRotate }],
          },
        ]}
      >
        <View style={{ width, height, borderRadius: 14 }}>
          <Image source={CARD_BACK} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        </View>
      </Animated.View>

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: frontOpacity,
            backfaceVisibility: 'hidden',
            transform: [{ perspective }, { rotateY: frontRotate }],
          },
        ]}
      >
        <CardFace width={width} height={height} source={frontSource}>
          {front}
        </CardFace>
      </Animated.View>
    </Animated.View>
  );
}
