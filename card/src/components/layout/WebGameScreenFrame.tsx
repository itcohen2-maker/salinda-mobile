import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

type WebGameScreenFrameProps = {
  children: ReactNode;
  width: number;
  frameHeight?: number;
  contentScale?: number;
  testID?: string;
  outerStyle?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
};

export function WebGameScreenFrame({
  children,
  width,
  frameHeight,
  contentScale,
  testID,
  outerStyle,
  innerStyle,
}: WebGameScreenFrameProps) {
  if (Platform.OS !== 'web') {
    return (
      <View testID={testID} style={[styles.inner, { width }, innerStyle]}>
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
    return (
      <View style={[styles.outer, outerStyle]}>
        <View
          testID={testID}
          style={[styles.scaledSlot, { width: width * safeScale, height: safeFrameHeight * safeScale }]}
        >
          <View
            style={[
              styles.scaledContent,
              innerStyle,
              {
                width,
                height: safeFrameHeight,
                transform: [{ scale: safeScale }],
              },
              { transformOrigin: 'top center' } as any,
            ]}
          >
            {children}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.outer, outerStyle]}>
      <View testID={testID} style={[styles.gameColumn, { width, maxWidth: '100%' as any }, innerStyle]}>
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
    justifyContent: 'center',
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
