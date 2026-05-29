// ============================================================
// GoldButton.tsx — polished 3D gold action button.
// A gold "plate" that sits raised on a dark base and presses
// down when tapped. Pure RN (Pressable + expo-linear-gradient),
// no canvas/WebView. Matches the "polished gold (D)" language:
// smooth metallic sheen, light top → deep bottom, no wood grain.
// ============================================================

import React, { useCallback, useRef } from 'react';
import {
  Animated,
  Pressable,
  Text,
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GoldButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Stretch to the full width of the parent. */
  fullWidth?: boolean;
  /** Height of the gold face (px). Default 58. */
  height?: number;
  /** Corner radius (px). Default 22. */
  radius?: number;
  /** How far the face floats above the dark base (px) = the 3D thickness. */
  raise?: number;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

// Gold tones sampled from the physical gold plank that inspired the redesign.
const GOLD = ['#F8E08E', '#F0C659', '#D9A23A', '#8A5A1C'] as const;

export function GoldButton({
  label,
  onPress,
  disabled = false,
  fullWidth = false,
  height = 58,
  radius = 22,
  raise = 8,
  fontSize = 20,
  style,
  textStyle,
  testID,
  accessibilityLabel,
}: GoldButtonProps) {
  // 0 = raised (resting), 1 = pressed in.
  const press = useRef(new Animated.Value(0)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(press, { toValue: 1, friction: 9, tension: 220, useNativeDriver: true }).start();
  }, [press]);

  const handlePressOut = useCallback(() => {
    Animated.spring(press, { toValue: 0, friction: 6, tension: 200, useNativeDriver: true }).start();
  }, [press]);

  // The face slides down to nearly meet the base, shrinking the visible
  // thickness from `raise` to ~2px — reads as a physical press.
  const translateY = press.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, raise - 2)] });

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      onPressIn={disabled ? undefined : handlePressIn}
      onPressOut={disabled ? undefined : handlePressOut}
      style={[fullWidth ? styles.stretch : styles.center, { opacity: disabled ? 0.5 : 1 }, style]}
    >
      <View style={fullWidth ? styles.stretch : undefined}>
        {/* Dark base — the "stand" the gold plate sits on. */}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: raise, bottom: 0, borderRadius: radius, backgroundColor: '#23170A' }}
        />
        {/* Gold face — floats above the base, presses down on tap. */}
        <Animated.View style={{ marginBottom: raise, transform: [{ translateY }] }}>
          <LinearGradient
            colors={GOLD}
            locations={[0, 0.18, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              minHeight: height,
              borderRadius: radius,
              borderWidth: 2,
              borderColor: '#8A5A1C',
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 14,
              paddingHorizontal: 26,
            }}
          >
            {/* Glossy sheen across the upper half. */}
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '52%' }}
            />
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                {
                  color: '#5E3A10',
                  fontSize,
                  lineHeight: fontSize + 4,
                  fontWeight: '900',
                  textAlign: 'center',
                  textShadowColor: 'rgba(248,224,142,0.6)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 1,
                },
                textStyle,
              ]}
            >
              {label}
            </Text>
          </LinearGradient>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignSelf: 'center' },
  stretch: { alignSelf: 'stretch' },
});
