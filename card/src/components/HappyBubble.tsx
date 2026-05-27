// ============================================================
// HappyBubble — bouncy, lively speech bubble. Spring-pop on
// mount + gentle scale loop. Used by the tutorial and by big
// "positive moment" notifications (game-over win, welcome,
// etc.). Keep this minimal and stateless.
// ============================================================

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Text, View, type StyleProp, type TextStyle } from 'react-native';

export type HappyBubbleTone = 'demo' | 'turn' | 'celebrate' | 'welcome' | 'buttonRed' | 'buttonOrange';

const TONE_STYLES: Record<HappyBubbleTone, { bg: string; border: string; text: string }> = {
  // No brown anywhere. Demo uses a fresh sky/teal palette so the bubble
  // reads as a friendly hint, not a parchment / coffee notice.
  demo:      { bg: '#E0F2FE', border: '#0EA5E9', text: '#0C4A6E' },
  turn:      { bg: '#DBEAFE', border: '#2563EB', text: '#1E3A8A' },
  celebrate: { bg: '#FCE7F3', border: '#DB2777', text: '#831843' },
  welcome:   { bg: '#DCFCE7', border: '#16A34A', text: '#14532D' },
  buttonRed: { bg: '#FEE2E2', border: '#DC2626', text: '#7F1D1D' },
  buttonOrange: { bg: '#FFEDD5', border: '#EA580C', text: '#9A3412' },
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

  return (
    <View pointerEvents="none" style={[{ alignItems: 'center' }, noPointerEvents]}>
      {withTail && tailTop ? (
        <View pointerEvents="none" style={[{ marginBottom: -2, width: 0, height: 0, borderLeftWidth: 12, borderRightWidth: 12, borderBottomWidth: 14, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: palette.border }, noPointerEvents]} />
      ) : null}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            backgroundColor: palette.bg,
            borderColor: palette.border,
            borderWidth: compact ? 2 : 3,
            paddingHorizontal: compact ? 14 : 22,
            paddingVertical: compact ? 8 : 14,
            borderRadius: compact ? 18 : 28,
            maxWidth: maxWidth as number,
            transform: [{ scale }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 8,
          },
          // On web: tell iOS Safari not to intercept horizontal touch gestures
          // on the bubble. Without this, iOS fires pointercancel on horizontal
          // swipes even when the bubble sits above the fan, which kills fan drag.
          Platform.OS === 'web' && ({ touchAction: 'pan-y', pointerEvents: 'none' } as any),
        ]}
      >
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
              },
              noPointerEvents,
              titleStyleOverride,
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
              fontSize: compact ? 14 : 18,
              lineHeight: compact ? 18 : undefined,
              fontWeight: '800',
              textAlign: 'center',
            },
            noPointerEvents,
            textStyleOverride,
          ]}
        >
          {text}
        </Text>
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
