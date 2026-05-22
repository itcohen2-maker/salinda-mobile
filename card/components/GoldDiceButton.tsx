import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

interface GoldDiceButtonProps {
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  width?: number;
  style?: any;
  testID?: string;
}

const BTN_W = 160;
const BTN_H = 58;

const DICE_PIPS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

function DieFace({
  size,
  value,
  pipColor,
  style,
}: {
  size: number;
  value: number;
  pipColor: string;
  style?: any;
}) {
  const pipSize = Math.max(3, Math.round(size * 0.16));
  const edge = Math.max(4, Math.round(size * 0.18));
  const center = Math.round((size - pipSize) / 2);
  const far = size - pipSize - edge;
  const positions = [edge, center, far];

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.max(8, Math.round(size * 0.24)),
          backgroundColor: '#FFFDF8',
          borderWidth: 2,
          borderColor: '#E5B63E',
          shadowColor: '#8A5B0C',
          shadowOpacity: 0.24,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 2,
          left: 3,
          right: 3,
          height: Math.max(6, Math.round(size * 0.28)),
          borderRadius: Math.max(6, Math.round(size * 0.2)),
          backgroundColor: 'rgba(255,255,255,0.72)',
        }}
      />
      {DICE_PIPS[value]?.map(([x, y], index) => (
        <View
          key={`${value}-${index}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: positions[x],
            top: positions[y],
            width: pipSize,
            height: pipSize,
            borderRadius: pipSize / 2,
            backgroundColor: pipColor,
          }}
        />
      ))}
    </View>
  );
}

function Sparkle({
  size,
  style,
}: {
  size: number;
  style?: any;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#FFF4B3',
          shadowColor: '#FFE48D',
          shadowOpacity: 0.65,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    />
  );
}

export function GoldDiceButton({ onPress, disabled = false, width, size, style, testID }: GoldDiceButtonProps) {
  const w = width ?? BTN_W;
  const h = size ?? BTN_H;

  const pressAnim = useRef(new Animated.Value(1)).current;
  const driftAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const sheenAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (disabled) {
      driftAnim.stopAnimation();
      glowAnim.stopAnimation();
      sheenAnim.stopAnimation();
      driftAnim.setValue(0);
      glowAnim.setValue(0);
      sheenAnim.setValue(0);
      return;
    }

    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(driftAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(driftAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 760,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 760,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const sheenLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sheenAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sheenAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(900),
      ]),
    );

    driftLoop.start();
    glowLoop.start();
    sheenLoop.start();

    return () => {
      driftLoop.stop();
      glowLoop.stop();
      sheenLoop.stop();
    };
  }, [disabled, driftAnim, glowAnim, sheenAnim]);

  const handlePressIn = useCallback(() => {
    Animated.spring(pressAnim, {
      toValue: 0.94,
      friction: 8,
      tension: 190,
      useNativeDriver: true,
    }).start();
  }, [pressAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(pressAnim, {
      toValue: 1,
      friction: 5,
      tension: 180,
      useNativeDriver: true,
    }).start();
  }, [pressAnim]);

  return (
    <View style={[{ width: w, alignSelf: 'center', alignItems: 'center' }, style]}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: h * 0.4,
          width: w * 0.8,
          height: h * 0.6,
          borderRadius: h,
          backgroundColor: 'rgba(232,184,48,0.25)',
          opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.24, 0.4] }),
          transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.06] }) }],
        }}
      />
      <Pressable
        testID={testID}
        android_disableSound
        onPress={disabled ? undefined : onPress}
        onPressIn={disabled ? undefined : handlePressIn}
        onPressOut={disabled ? undefined : handlePressOut}
      >
        <Animated.View
          style={[
            styles.buttonFrame,
            {
              width: w,
              height: h,
              opacity: disabled ? 0.35 : 1,
              transform: [{ scale: pressAnim }],
            },
          ]}
        >
          <View style={[styles.depthLayer, { top: 5, height: h, backgroundColor: '#6B4A08' }]} />
          <View style={[styles.depthLayer, { top: 7, height: h, backgroundColor: '#503508' }]} />
          <View style={[styles.depthLayer, { top: 9, height: h, backgroundColor: '#3A2505' }]} />

          <View style={styles.faceFill}>
            <View style={styles.faceCore} />
            <View style={styles.faceShade} />
            <View style={styles.topGloss} />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.sheen,
                {
                  transform: [
                    {
                      translateX: sheenAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-w * 0.75, w * 0.95],
                      }),
                    },
                    { rotate: '-14deg' },
                  ],
                },
              ]}
            />

            <Animated.View
              pointerEvents="none"
              style={[
                styles.clusterGlow,
                {
                  opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.36] }),
                  transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.05] }) }],
                },
              ]}
            />

            <Animated.View
              style={[
                styles.mainDie,
                {
                  transform: [
                    { translateY: driftAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
                    { rotate: driftAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-8deg', '1deg', '-8deg'] }) },
                  ],
                },
              ]}
            >
              <DieFace size={24} value={5} pipColor="#2563EB" />
            </Animated.View>

            <Animated.View
              style={[
                styles.midDie,
                {
                  transform: [
                    { translateY: driftAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }) },
                    { rotate: driftAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['8deg', '0deg', '8deg'] }) },
                    { scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.08] }) },
                  ],
                },
              ]}
            >
              <DieFace size={18} value={3} pipColor="#16A34A" />
            </Animated.View>

            <Animated.View
              style={[
                styles.smallDie,
                {
                  transform: [
                    { translateY: driftAnim.interpolate({ inputRange: [0, 1], outputRange: [2, -2] }) },
                    { rotate: driftAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '10deg', '0deg'] }) },
                  ],
                },
              ]}
            >
              <DieFace size={14} value={1} pipColor="#DC2626" />
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[
                styles.sparkleTop,
                {
                  opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.95] }),
                  transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.15] }) }],
                },
              ]}
            >
              <Sparkle size={5} />
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[
                styles.sparkleBottom,
                {
                  opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.8] }),
                  transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.05] }) }],
                },
              ]}
            >
              <Sparkle size={4} />
            </Animated.View>

            <Animated.View
              style={[
                styles.labelWrap,
                {
                  transform: [{ translateY: driftAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) }],
                },
              ]}
            >
              <Text style={styles.label}>גלגל קוביות</Text>
            </Animated.View>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonFrame: {
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6B4A08',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
      },
      android: { elevation: 12 },
      web: {
        shadowColor: '#6B4A08',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.42,
        shadowRadius: 8,
      },
    }),
  },
  depthLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 12,
  },
  faceFill: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  faceCore: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#D8A11E',
  },
  faceShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(121, 76, 5, 0.14)',
  },
  topGloss: {
    position: 'absolute',
    top: 2,
    left: 6,
    right: 10,
    height: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 244, 196, 0.38)',
  },
  sheen: {
    position: 'absolute',
    top: -12,
    bottom: -12,
    width: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  clusterGlow: {
    position: 'absolute',
    left: 10,
    top: 8,
    width: 62,
    bottom: 4,
    borderRadius: 22,
    backgroundColor: 'rgba(255,244,190,0.14)',
  },
  mainDie: {
    position: 'absolute',
    left: 14,
    top: 10,
  },
  midDie: {
    position: 'absolute',
    left: 36,
    top: 22,
  },
  smallDie: {
    position: 'absolute',
    left: 52,
    top: 11,
  },
  sparkleTop: {
    position: 'absolute',
    left: 60,
    top: 8,
  },
  sparkleBottom: {
    position: 'absolute',
    left: 22,
    top: 38,
  },
  labelWrap: {
    position: 'absolute',
    top: 0,
    right: 12,
    bottom: 0,
    left: 72,
    justifyContent: 'center',
  },
  label: {
    color: '#FFF7E0',
    fontWeight: '900',
    fontSize: 15,
    textAlign: 'center',
    textShadowColor: 'rgba(91,62,8,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
