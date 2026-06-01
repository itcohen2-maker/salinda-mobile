// ============================================================
// GoldButton.tsx — wood-grain 3D gold action button.
// A gold "plank" that sits raised on a black stand and presses
// down when tapped. Pure RN (Pressable + expo-linear-gradient),
// no canvas/WebView. Matches the CHOSEN design (Downloads/
// "כפתורי זהב.html", variant "01 · תלת-ממד"):
//   • black stand underneath + drop shadow
//   • 5-stop metallic gold fill (light top → deep bottom)
//   • VERTICAL wood-grain fibers over the gold
//   • concave "saddle" highlight (bright top + reflection low)
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
  /** Visual palette: 'gold' (primary action, default) or 'stone' (gray secondary). */
  tone?: 'gold' | 'stone';
}

// Two tonal palettes for the same 3D plank: the chosen "gold" language and a
// neutral "stone" (gray) variant for secondary actions (Back / Skip / Exit).
const FILL_LOCATIONS = [0, 0.18, 0.5, 0.82, 1] as const;

interface Tone {
  fill: readonly [string, string, ...string[]];
  border: string;
  text: string;
  textShadow: string;
  grainDark: string; // 'r,g,b' base for the vertical fibers
  grainLight: string;
  grainOpacity: number;
}

const TONES: Record<'gold' | 'stone', Tone> = {
  gold: {
    fill: ['#F8E08E', '#F0C659', '#D9A23A', '#C08A2C', '#8A5A1C'],
    border: '#8A5A1C',
    text: '#5E3A10',
    textShadow: 'rgba(248,224,142,0.55)',
    grainDark: '94,58,16',
    grainLight: '248,224,142',
    grainOpacity: 0.85,
  },
  stone: {
    fill: ['#ECEEF2', '#CFD3DA', '#ABB1BC', '#888E9A', '#565B66'],
    border: '#3C4049',
    text: '#2A2D34',
    textShadow: 'rgba(255,255,255,0.5)',
    grainDark: '30,33,40',
    grainLight: '236,238,243',
    grainOpacity: 0.5,
  },
};

// Build a repeating VERTICAL wood-grain pattern as a horizontal gradient
// (start→end across X). One tile mirrors the CSS repeating-linear-gradient
// from the chosen design (every ~17px). We tile it a fixed number of times
// so the fiber density looks right at any button width.
function buildWoodGrain(tiles: number, dark: string, light: string): { colors: readonly [string, string, ...string[]]; locations: readonly [number, number, ...number[]] } {
  const stopFracs = [0, 1 / 17, 3 / 17, 5 / 17, 8 / 17, 11 / 17, 13 / 17, 1];
  const stopColors = [
    `rgba(${dark},0)`,
    `rgba(${dark},0.42)`,
    `rgba(${dark},0.05)`,
    `rgba(${light},0.34)`,
    `rgba(${dark},0)`,
    `rgba(${dark},0.30)`,
    `rgba(${light},0.18)`,
    `rgba(${dark},0)`,
  ];
  const colors: string[] = [];
  const locations: number[] = [];
  for (let k = 0; k < tiles; k++) {
    for (let j = 0; j < stopFracs.length; j++) {
      // Skip the duplicate boundary stop (tile start == previous tile end).
      if (k > 0 && j === 0) continue;
      colors.push(stopColors[j]);
      locations.push((k + stopFracs[j]) / tiles);
    }
  }
  // expo-linear-gradient needs strictly increasing locations in [0,1].
  for (let i = 1; i < locations.length; i++) {
    if (locations[i] <= locations[i - 1]) locations[i] = locations[i - 1] + 0.0001;
  }
  locations[0] = 0;
  locations[locations.length - 1] = 1;
  return {
    colors: colors as [string, string, ...string[]],
    locations: locations as [number, number, ...number[]],
  };
}

const WOOD: Record<'gold' | 'stone', ReturnType<typeof buildWoodGrain>> = {
  gold: buildWoodGrain(14, TONES.gold.grainDark, TONES.gold.grainLight),
  stone: buildWoodGrain(14, TONES.stone.grainDark, TONES.stone.grainLight),
};

export function GoldButton({
  label,
  onPress,
  disabled = false,
  fullWidth = false,
  height = 58,
  radius = 20,
  raise = 10,
  fontSize = 20,
  style,
  textStyle,
  testID,
  accessibilityLabel,
  tone = 'gold',
}: GoldButtonProps) {
  const t = TONES[tone];
  const wood = WOOD[tone];
  // 0 = raised (resting), 1 = pressed in.
  const press = useRef(new Animated.Value(0)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(press, { toValue: 1, friction: 9, tension: 220, useNativeDriver: true }).start();
  }, [press]);

  const handlePressOut = useCallback(() => {
    Animated.spring(press, { toValue: 0, friction: 6, tension: 200, useNativeDriver: true }).start();
  }, [press]);

  // The face slides down to nearly meet the base, shrinking the visible
  // thickness from `raise` to ~3px — reads as a physical press.
  const translateY = press.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, raise - 3)] });

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
        {/* Black stand — the base the gold plank sits on (with drop shadow). */}
        <LinearGradient
          pointerEvents="none"
          colors={['#26262C', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: raise,
            bottom: 0,
            borderRadius: radius,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.45,
            shadowRadius: 14,
            elevation: 10,
          }}
        />
        {/* Gold face — floats above the base, presses down on tap. */}
        <Animated.View style={{ marginBottom: raise, transform: [{ translateY }] }}>
          <LinearGradient
            colors={t.fill}
            locations={FILL_LOCATIONS}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              minHeight: height,
              borderRadius: radius,
              borderWidth: 1,
              borderColor: t.border,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 14,
              paddingHorizontal: 26,
            }}
          >
            {/* Vertical wood-grain fibers across the gold. */}
            <LinearGradient
              pointerEvents="none"
              colors={wood.colors}
              locations={wood.locations}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[StyleSheet.absoluteFill, { borderRadius: radius, opacity: t.grainOpacity }]}
            />
            {/* Concave "saddle" highlight: bright at top, soft reflection low. */}
            <LinearGradient
              pointerEvents="none"
              colors={[
                'rgba(255,255,255,0.55)',
                'rgba(255,255,255,0)',
                'rgba(255,255,255,0)',
                'rgba(255,250,235,0.32)',
                'rgba(255,255,255,0)',
              ] as const}
              locations={[0, 0.3, 0.62, 0.86, 1] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
            />
            <Text
              allowFontScaling={false}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
              numberOfLines={1}
              style={[
                {
                  color: t.text,
                  fontSize,
                  lineHeight: fontSize + 4,
                  fontWeight: '900',
                  textAlign: 'center',
                  textShadowColor: t.textShadow,
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
