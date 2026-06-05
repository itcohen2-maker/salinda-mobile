// ============================================================
// HappyBubble — bouncy, lively speech bubble. Spring-pop on
// mount + gentle scale loop. Used by the tutorial and by big
// "positive moment" notifications (game-over win, welcome,
// etc.). Keep this minimal and stateless.
// ============================================================

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type HappyBubbleTone = 'demo' | 'turn' | 'celebrate' | 'welcome' | 'buttonRed' | 'buttonOrange' | 'goldRoomDark';

// Shared tutorial instruction surface. Keep every tone on the same rich
// gold language so Tutorial and Gold Room banners feel like one system.
const GOLD_POLISHED = {
  gradient: ['#FFF2B8', '#E9B84C', '#9B641E'] as const,
  bg: '#E0A43D', // solid representative gold — used for the speech tail's fill
  border: '#8A5A1C',
  text: '#1B1205',
};

const GOLD_ROOM_DARK = {
  gradient: GOLD_POLISHED.gradient,
  bg: GOLD_POLISHED.bg,
  border: GOLD_POLISHED.border,
  text: GOLD_POLISHED.text,
};

type HappyBubblePalette = {
  gradient: readonly [string, string, ...string[]];
  bg: string;
  border: string;
  text: string;
};

const TONE_STYLES: Record<HappyBubbleTone, HappyBubblePalette> = {
  demo: GOLD_POLISHED,
  turn: GOLD_POLISHED,
  celebrate: GOLD_POLISHED,
  welcome: GOLD_POLISHED,
  buttonRed: GOLD_POLISHED,
  buttonOrange: GOLD_POLISHED,
  goldRoomDark: GOLD_ROOM_DARK,
};

type Props = {
  text: string;
  tone?: HappyBubbleTone;
  /** Optional title rendered above `text` in a larger, bolder style */
  title?: string;
  /** Optional style override for the title text only. */
  titleStyleOverride?: StyleProp<TextStyle>;
  /** Show the tail */
  withTail?: boolean;
  /** Tail size — 'small' is the default speech-tail; 'big' is a chunky
   *  attention-grabbing arrow useful for drawing the eye to a UI region. */
  arrowSize?: 'small' | 'big';
  /** When true the tail points UP and appears above the bubble body. */
  tailTop?: boolean;
  /** Override max width — defaults to 88% of parent */
  maxWidth?: number | string;
  /** Optional minimum width for framed, mockup-style bubbles. */
  minWidth?: number | string;
  /** `compact` shrinks padding, font, and border for a less intrusive bubble. */
  size?: 'normal' | 'compact';
  /** Optional style override for the body text only. */
  textStyleOverride?: StyleProp<TextStyle>;
};

export function HappyBubble({
  text,
  tone = 'demo',
  title,
  titleStyleOverride,
  withTail = true,
  arrowSize = 'small',
  tailTop = false,
  maxWidth = '88%',
  minWidth,
  size = 'normal',
  textStyleOverride,
}: Props): React.ReactElement {
  const compact = size === 'compact';
  const scale = useRef(new Animated.Value(0)).current;
  // Pop in once, then stay still.
  useEffect(() => {
    scale.setValue(0);
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 110, useNativeDriver: true }).start();
  }, [text, title, scale]);

  const palette = TONE_STYLES[tone];
  const noPointerEvents = Platform.OS === 'web' ? ({ pointerEvents: 'none' } as any) : null;
  const isMockupGold = tone === 'goldRoomDark';
  const bubbleRadius = isMockupGold ? 18 : compact ? 18 : 28;

  return (
    <View pointerEvents="none" style={[{ alignItems: 'center' }, noPointerEvents]}>
      {withTail && tailTop ? (
        <View pointerEvents="none" style={[{ marginBottom: -2, width: 0, height: 0, borderLeftWidth: 12, borderRightWidth: 12, borderBottomWidth: 14, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: palette.border }, noPointerEvents]} />
      ) : null}
      <Animated.View
        pointerEvents="none"
        style={{
          borderRadius: bubbleRadius,
          maxWidth: maxWidth as number,
          minWidth: minWidth as number | undefined,
          transform: [{ scale }],
          // Outer drop shadow lives here (overflow stays visible so it renders).
          shadowColor: '#000',
          shadowOffset: { width: 0, height: isMockupGold ? 12 : 8 },
          shadowOpacity: isMockupGold ? 0.42 : 0.36,
          shadowRadius: isMockupGold ? 18 : 14,
          elevation: isMockupGold ? 18 : 12,
        }}
      >
        <LinearGradient
          colors={palette.gradient}
          locations={[0, 0.3, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[
            {
              borderColor: palette.border,
              borderWidth: isMockupGold ? 3 : compact ? 2 : 3,
              paddingHorizontal: isMockupGold ? 22 : compact ? 14 : 22,
              paddingVertical: isMockupGold ? 16 : compact ? 8 : 14,
              borderRadius: bubbleRadius,
              overflow: 'hidden',
              alignItems: 'center',
            },
            // On web: tell iOS Safari not to intercept horizontal touch gestures
            // on the bubble. Without this, iOS fires pointercancel on horizontal
            // swipes even when the bubble sits above the fan, which kills fan drag.
            Platform.OS === 'web' && ({ touchAction: 'pan-y', pointerEvents: 'none' } as any),
          ]}
        >
          {/* Glossy sheen across the upper half — the "polished" highlight that
              gives the gold its metallic, three-dimensional volume. */}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '48%' }}
          />
          {title ? (
            <Text
              pointerEvents="none"
              style={[
                {
                  color: palette.text,
                  fontSize: compact ? 16 : 22,
                  fontWeight: '900',
                  textAlign: 'center',
                  marginBottom: 4,
                  textShadowColor: 'rgba(255,248,220,0.55)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 1,
                },
                noPointerEvents,
                titleStyleOverride,
                { color: palette.text },
              ]}
            >
              {title}
            </Text>
          ) : null}
          <Text
            pointerEvents="none"
            style={[
              {
                color: palette.text,
                fontSize: isMockupGold ? 18 : compact ? 14 : 18,
                lineHeight: isMockupGold ? 27 : compact ? 18 : undefined,
                fontWeight: isMockupGold ? '900' : '800',
                textAlign: 'center',
                textShadowColor: isMockupGold ? 'rgba(255,248,220,0.45)' : undefined,
                textShadowOffset: isMockupGold ? { width: 0, height: 1 } : undefined,
                textShadowRadius: isMockupGold ? 1 : undefined,
              },
              noPointerEvents,
              textStyleOverride,
              { color: palette.text },
            ]}
          >
            {text}
          </Text>
        </LinearGradient>
      </Animated.View>
      {withTail && !tailTop ? (
        arrowSize === 'big' ? (
          <Animated.View pointerEvents="none" style={[{ marginTop: -2, alignItems: 'center', transform: [{ scale }] }, noPointerEvents]}>
            {/* Outer (border) triangle */}
            <View
              pointerEvents="none"
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: 28,
                borderRightWidth: 28,
                borderTopWidth: 36,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderTopColor: palette.border,
                ...noPointerEvents,
              }}
            />
            {/* Inner fill triangle, slightly smaller, overlaid for a clean filled look */}
            <View
              pointerEvents="none"
              style={{
                marginTop: -36,
                width: 0,
                height: 0,
                borderLeftWidth: 22,
                borderRightWidth: 22,
                borderTopWidth: 28,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderTopColor: palette.bg,
                ...noPointerEvents,
              }}
            />
          </Animated.View>
        ) : (
          <View
            pointerEvents="none"
            style={{
              marginTop: -2,
              width: 0,
              height: 0,
              borderLeftWidth: 12,
              borderRightWidth: 12,
              borderTopWidth: 14,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: palette.border,
              ...noPointerEvents,
            }}
          />
        )
      ) : null}
    </View>
  );
}
