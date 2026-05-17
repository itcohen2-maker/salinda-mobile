import React, { useEffect } from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { SlindaCoin } from '../../components/SlindaCoin';
import { playSfx } from '../../src/audio/sfx';

type Props = {
  amount: number;
  title: string;
  body: string;
  badge?: string;
  continueLabel?: string;
  onContinue?: () => void;
  pulseKey?: string | number | null;
  variant?: 'inline' | 'hero';
  size?: 'regular' | 'mini';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function CoinAwardCelebrationCard({
  amount,
  title,
  body,
  badge,
  continueLabel = 'Continue',
  onContinue,
  pulseKey,
  variant = 'hero',
  size = 'regular',
  style,
  testID,
}: Props) {
  const { width, height } = useWindowDimensions();
  const inline = variant === 'inline';
  const mini = size === 'mini';
  const compact = mini || inline || height < 860 || width < 430;
  const tight = mini || inline || height < 760 || width < 390;
  useEffect(() => {
    void playSfx('meterCelebrateCoins');
  }, []);
  const coinOrbSize = mini ? 30 : inline ? (tight ? 92 : 106) : tight ? 112 : compact ? 126 : 142;
  const coinSize = mini ? 28 : inline ? (tight ? 54 : 64) : tight ? 68 : compact ? 78 : 90;
  const amountText = amount > 0 ? `+${amount}` : '0';
  const coinShellTestID = testID ? `${testID}-coin-shell` : undefined;
  const titleRowTestID = testID ? `${testID}-title-row` : undefined;
  const coinNode = (
    <View
      testID={coinShellTestID}
      style={[
        styles.coinOrb,
        mini ? styles.coinOrbMini : null,
        mini ? styles.coinOrbMiniTransparent : null,
        { width: coinOrbSize, height: coinOrbSize, borderRadius: coinOrbSize / 2 },
      ]}
    >
      {!mini ? (
        <LinearGradient
          colors={['rgba(250, 204, 21, 0.34)', 'rgba(250, 204, 21, 0.12)']}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.8, y: 0.9 }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
      <SlindaCoin size={coinSize} pulseKey={pulseKey} spin />
    </View>
  );

  return (
    <View
      testID={testID}
      style={[
        styles.shell,
        inline ? styles.shellInline : styles.shellHero,
        compact ? styles.shellCompact : null,
        tight ? styles.shellTight : null,
        mini ? styles.shellMini : null,
        style,
      ]}
    >
      <LinearGradient
        colors={inline ? ['rgba(16, 59, 43, 0.96)', 'rgba(13, 38, 65, 0.94)'] : ['rgba(18, 62, 44, 0.98)', 'rgba(14, 37, 66, 0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.glow, inline ? styles.glowInline : null, mini ? styles.glowMini : null]} />
      {badge ? (
        <View style={[styles.badgeWrap, compact ? styles.badgeWrapCompact : null, mini ? styles.badgeWrapMini : null]}>
          <Text style={[styles.badgeText, compact ? styles.badgeTextCompact : null, mini ? styles.badgeTextMini : null]}>{badge}</Text>
        </View>
      ) : null}
      {mini ? (
        <View testID={titleRowTestID} style={styles.titleRowMini}>
          {coinNode}
          <Text
            numberOfLines={2}
            style={[styles.title, compact ? styles.titleCompact : null, tight ? styles.titleTight : null, mini ? styles.titleMini : null, styles.titleMiniRowText]}
          >
            {title}
          </Text>
        </View>
      ) : (
        <>
          {coinNode}
          <Text style={[styles.title, compact ? styles.titleCompact : null, tight ? styles.titleTight : null, mini ? styles.titleMini : null]}>
            {title}
          </Text>
        </>
      )}
      <Text style={[styles.amount, compact ? styles.amountCompact : null, tight ? styles.amountTight : null, mini ? styles.amountMini : null]}>
        {amountText}
      </Text>
      <Text
        numberOfLines={mini ? 2 : undefined}
        style={[styles.body, compact ? styles.bodyCompact : null, mini ? styles.bodyMini : null]}
      >
        {body}
      </Text>
      {onContinue ? (
        <TouchableOpacity
          onPress={onContinue}
          style={[
            styles.cta,
            compact ? styles.ctaCompact : null,
            mini ? styles.ctaMini : null,
            Platform.OS === 'android' ? styles.ctaAndroid : null,
          ]}
        >
          <Text style={[styles.ctaText, compact ? styles.ctaTextCompact : null, mini ? styles.ctaTextMini : null]}>{continueLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#123527',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 12,
  },
  shellHero: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  shellInline: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  shellCompact: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  shellTight: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  shellMini: {
    maxWidth: 236,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  glow: {
    position: 'absolute',
    top: -48,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
  },
  glowInline: {
    top: -56,
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  glowMini: {
    top: -18,
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(250, 204, 21, 0.04)',
  },
  badgeWrap: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(250, 204, 21, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(253, 224, 71, 0.26)',
    marginBottom: 12,
  },
  badgeWrapCompact: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeWrapMini: {
    marginBottom: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  badgeTextCompact: {
    fontSize: 11,
  },
  badgeTextMini: {
    fontSize: 9,
  },
  coinOrb: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(253, 224, 71, 0.22)',
    backgroundColor: 'rgba(250, 204, 21, 0.08)',
  },
  coinOrbMini: {
    marginBottom: 0,
    marginHorizontal: 0,
  },
  coinOrbMiniTransparent: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  titleRowMini: {
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 2,
  },
  title: {
    color: '#FEFCE8',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 24,
    lineHeight: 28,
  },
  titleTight: {
    fontSize: 22,
    lineHeight: 26,
  },
  titleMini: {
    fontSize: 17,
    lineHeight: 20,
  },
  titleMiniRowText: {
    flexShrink: 1,
    maxWidth: 150,
  },
  amount: {
    color: '#FCD34D',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 8,
  },
  amountCompact: {
    fontSize: 26,
    lineHeight: 30,
    marginTop: 6,
  },
  amountTight: {
    fontSize: 24,
    lineHeight: 28,
  },
  amountMini: {
    fontSize: 18,
    lineHeight: 22,
    marginTop: 3,
  },
  body: {
    color: '#DBEAFE',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
  },
  bodyCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  bodyMini: {
    maxWidth: 188,
    fontSize: 10,
    lineHeight: 13,
    marginTop: 5,
  },
  cta: {
    minWidth: 152,
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 13,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5B321',
  },
  ctaCompact: {
    minWidth: 140,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 14,
  },
  ctaMini: {
    minWidth: 112,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 10,
  },
  ctaAndroid: {
    elevation: 6,
  },
  ctaText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '900',
  },
  ctaTextCompact: {
    fontSize: 15,
  },
  ctaTextMini: {
    fontSize: 13,
  },
});
