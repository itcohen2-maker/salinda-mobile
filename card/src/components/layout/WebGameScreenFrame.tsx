import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';

type WebGameScreenFrameProps = {
  children: ReactNode;
  width: number;
  frameHeight?: number;
  contentScale?: number;
  snapToTop?: boolean;
  testID?: string;
  outerStyle?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  containerPointerEvents?: ViewProps['pointerEvents'];
};

export function WebGameScreenFrame({
  children,
  width,
  frameHeight,
  contentScale,
  snapToTop = false,
  testID,
  outerStyle,
  innerStyle,
  containerPointerEvents,
}: WebGameScreenFrameProps) {
  if (Platform.OS !== 'web') {
    return (
      <View pointerEvents={containerPointerEvents} testID={testID} style={[styles.inner, { width }, innerStyle]}>
        {children}
      </View>
    );
  }

  const safeFrameHeight =
    typeof frameHeight === 'number' && Number.isFinite(frameHeight)
      ? frameHeight
      : null;
  const safeScale =
    typeof contentScale === 'number' && Number.isFinite(contentScale)
      ? Math.max(0.5, Math.min(1, contentScale))
      : 1;

  if (safeFrameHeight != null) {
    const visualHeight = safeFrameHeight * safeScale;
    // Only apply CSS transform when actual scaling is needed. A transform:scale(1)
    // is a visual no-op but promotes the element to a separate GPU compositing
    // layer in iOS Safari and Chrome Android. This causes the game canvas and
    // its absolute-positioned children (buttons) to move independently from
    // the page during pull-to-refresh, making them appear "detached".
    const needsScale = safeScale < 1;
    return (
      <View pointerEvents={containerPointerEvents} style={[styles.outer, outerStyle]}>
        <View
          pointerEvents={containerPointerEvents}
          testID={testID}
          style={[
            styles.scaledSlot,
            {
              width: width * safeScale,
              height: visualHeight,
              // On portrait mobile web, snap to the top so the iOS Safari URL
              // bar cannot hide the bottom of the game canvas. On desktop the
              // auto margins center the canvas in the taller browser window.
              marginTop: snapToTop ? 0 : ('auto' as any),
              marginBottom: snapToTop ? 0 : ('auto' as any),
            },
          ]}
        >
          <View
            pointerEvents={containerPointerEvents}
            style={[
              styles.scaledContent,
              innerStyle,
              {
                width,
                height: safeFrameHeight,
                ...(needsScale ? { transform: [{ scale: safeScale }] } : {}),
              },
              ...(needsScale ? [{ transformOrigin: 'top center' } as any] : []),
            ]}
          >
            {children}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View pointerEvents={containerPointerEvents} style={[styles.outer, outerStyle]}>
      <View pointerEvents={containerPointerEvents} testID={testID} style={[styles.gameColumn, { width, maxWidth: '100%' as any }, innerStyle]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: '100%' as any,
    alignItems: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  gameColumn: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  scaledSlot: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  scaledContent: {
    overflow: 'hidden',
  },
  inner: {
    flex: 1,
    maxWidth: '100%' as any,
    minHeight: 0,
    overflow: 'visible',
  },
});
