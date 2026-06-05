import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { AppLocale } from '../../shared/i18n';
import { displayFontFamily } from '../theme/fonts';

type FeraIntroScreenProps = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  onContinue: () => void;
  locale?: AppLocale;
  bottomOffset?: number;
};

const WILD_STAR = '★';

export function FeraIntroScreen({
  title,
  subtitle,
  ctaLabel,
  onContinue,
  locale = 'he',
  bottomOffset = 34,
}: FeraIntroScreenProps) {
  const { width, height } = useWindowDimensions();
  const [exiting, setExiting] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.68)).current;
  const cardLift = useRef(new Animated.Value(18)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;

  const isHebrew = locale === 'he';
  const cardWidth = Math.min(width * 0.48, height * 0.26, 188);
  const cardHeight = cardWidth * 1.38;
  const titleFont = Math.min(30, Math.max(23, width * 0.075));
  const subtitleFont = Math.min(18, Math.max(15, width * 0.043));

  const textBaseStyle = useMemo(
    () => ({
      writingDirection: isHebrew ? 'rtl' as const : 'ltr' as const,
      fontFamily: displayFontFamily(title),
    }),
    [isHebrew, title],
  );

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          speed: 10,
          bounciness: 7,
          useNativeDriver: true,
        }),
        Animated.timing(cardLift, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 1250,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 1250,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [cardLift, cardScale, glowPulse, overlayOpacity, textOpacity]);

  const handleContinue = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 1.08,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onContinue();
    });
  }, [cardScale, exiting, onContinue, overlayOpacity]);

  const auraScale = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.08],
  });
  const auraOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0.82],
  });

  return (
    <Animated.View
      pointerEvents="auto"
      style={[styles.root, { opacity: overlayOpacity }]}
      testID="fera-intro-screen"
    >
      <LinearGradient
        colors={['#FFF7CC', '#FDE68A', '#C084FC', '#7C3AED']}
        locations={[0, 0.34, 0.72, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.82, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.vignette} />

      <View style={styles.content}>
        <Animated.View style={[styles.copy, { opacity: textOpacity }]}>
          <Text
            style={[
              styles.title,
              textBaseStyle,
              { fontSize: titleFont, lineHeight: titleFont + 6 },
            ]}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={2}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.subtitle,
              textBaseStyle,
              { fontSize: subtitleFont, lineHeight: subtitleFont + 7 },
            ]}
            adjustsFontSizeToFit
            minimumFontScale={0.86}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        </Animated.View>

        <View style={[styles.cardStage, { width: cardWidth * 1.95, height: cardHeight * 1.45 }]}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.aura,
              {
                width: cardWidth * 1.62,
                height: cardWidth * 1.62,
                borderRadius: cardWidth,
                opacity: auraOpacity,
                transform: [{ scale: auraScale }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.cardWrap,
              {
                width: cardWidth,
                height: cardHeight,
                transform: [{ translateY: cardLift }, { scale: cardScale }],
              },
            ]}
          >
            <LinearGradient
              colors={['#FDE68A', '#C084FC', '#7C3AED', '#4C1D95']}
              start={{ x: 0.08, y: 0 }}
              end={{ x: 0.92, y: 1 }}
              style={styles.cardBorder}
            >
              <LinearGradient
                colors={['#F5F3FF', '#DDD6FE', '#A78BFA', '#5B21B6']}
                locations={[0, 0.38, 0.72, 1]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
                style={styles.cardFace}
              >
                <View style={styles.cardShine} />
                <Text style={styles.cardCorner}>{WILD_STAR}</Text>
                <Text style={[styles.star, { fontSize: cardWidth * 0.44 }]}>{WILD_STAR}</Text>
                <Text style={[styles.range, { fontSize: cardWidth * 0.12 }]}>0-25</Text>
                <Text style={[styles.feraLabel, { fontSize: cardWidth * 0.1 }]}>FERA</Text>
              </LinearGradient>
            </LinearGradient>
          </Animated.View>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        disabled={exiting}
        onPress={handleContinue}
        style={({ pressed }) => [
          styles.ctaWrap,
          { bottom: bottomOffset },
          pressed && !exiting ? styles.ctaPressed : null,
        ]}
      >
        <LinearGradient
          colors={['#FDE68A', '#F59E0B', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cta}
        >
          <Text
            style={[styles.ctaText, textBaseStyle]}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
            numberOfLines={1}
          >
            {ctaLabel}
          </Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9250,
    alignItems: 'center',
    overflow: 'hidden',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderWidth: 18,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingBottom: 78,
    paddingTop: 18,
  },
  copy: {
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    color: '#3B0764',
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  subtitle: {
    marginTop: 8,
    color: '#4C1D95',
    fontWeight: '800',
    textAlign: 'center',
  },
  cardStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  aura: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    ...Platform.select({
      ios: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
      },
      android: { elevation: 0 },
    }),
  },
  cardWrap: {
    borderRadius: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#A78BFA',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.86,
        shadowRadius: 24,
      },
      android: { elevation: 18 },
    }),
  },
  cardBorder: {
    flex: 1,
    borderRadius: 22,
    padding: 4,
  },
  cardFace: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardShine: {
    position: 'absolute',
    top: -34,
    left: 18,
    right: 18,
    height: 86,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.46)',
  },
  cardCorner: {
    position: 'absolute',
    top: 12,
    left: 14,
    color: '#6D28D9',
    fontSize: 24,
    fontWeight: '900',
  },
  star: {
    color: '#4C1D95',
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  range: {
    marginTop: 2,
    color: '#5B21B6',
    fontWeight: '900',
    letterSpacing: 0,
  },
  feraLabel: {
    position: 'absolute',
    bottom: 14,
    color: '#FDE68A',
    fontWeight: '900',
    letterSpacing: 0,
  },
  ctaWrap: {
    position: 'absolute',
    left: 22,
    right: 22,
    alignItems: 'center',
    zIndex: 9260,
  },
  ctaPressed: {
    transform: [{ scale: 0.98 }],
  },
  cta: {
    width: '100%',
    maxWidth: 360,
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.36)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.72,
        shadowRadius: 16,
      },
      android: { elevation: 14 },
    }),
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.32)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
