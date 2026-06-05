import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GoldButton } from '../../components/GoldButton';
import { GameCard, type Card } from '../../components/CardDesign';
import { playSfx } from '../audio/sfx';

const rtlText = {
  writingDirection: 'rtl' as const,
  textAlign: 'right' as const,
};

type VictorySecretIntroScreenProps = {
  onStart: () => void;
};

const HERO_CARDS: Card[] = [
  { id: 'victory-secret-hero-16', type: 'number', value: 16 },
  { id: 'victory-secret-hero-wild', type: 'wild' },
  { id: 'victory-secret-hero-4', type: 'number', value: 4 },
];

const PARTICLES = Array.from({ length: 16 }, (_, index) => ({
  id: `victory-particle-${index}`,
  left: `${8 + ((index * 23) % 84)}%` as `${number}%`,
  top: `${8 + ((index * 37) % 78)}%` as `${number}%`,
  size: 3 + (index % 4),
  delay: index * 130,
}));

export function VictorySecretIntroScreen({ onStart }: VictorySecretIntroScreenProps) {
  const breath = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const particlePulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const particleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(particlePulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(particlePulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    breathLoop.start();
    particleLoop.start();
    return () => {
      breathLoop.stop();
      particleLoop.stop();
    };
  }, [breath, particlePulse]);

  const heroScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.055] });
  const heroGlow = breath.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.88] });
  const particleOpacity = particlePulse.interpolate({ inputRange: [0, 1], outputRange: [0.24, 0.72] });
  const particleScale = particlePulse.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1.28] });

  const heroTransforms = useMemo(
    () => [
      { rotate: '-10deg', translateX: -68, translateY: 14 },
      { rotate: '0deg', translateX: 0, translateY: -10 },
      { rotate: '10deg', translateX: 68, translateY: 14 },
    ],
    [],
  );

  const handleStart = useCallback(() => {
    void playSfx('combo', { cooldownMs: 0, volumeOverride: 0.58 });
    Animated.timing(fade, {
      toValue: 0,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onStart();
    });
  }, [fade, onStart]);

  return (
    <Animated.View style={[styles.root, { opacity: fade }]}>
      <LinearGradient colors={['#050505', '#140F07', '#050505']} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.backLight} />
      {PARTICLES.map((particle) => (
        <Animated.View
          key={particle.id}
          style={[
            styles.particle,
            {
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
              borderRadius: particle.size / 2,
              opacity: particleOpacity,
              transform: [{ scale: particleScale }],
            },
          ]}
        />
      ))}

      <View style={styles.content}>
        <Animated.View style={[styles.hero, { opacity: heroGlow, transform: [{ scale: heroScale }] }]}>
          <View style={styles.heroAura} />
          <Text style={styles.trophy} accessibilityLabel="גביע">🏆</Text>
          <View style={styles.heroCards}>
            {HERO_CARDS.map((card, index) => (
              <View
                key={card.id}
                style={[
                  styles.heroCard,
                  {
                    transform: [
                      { translateX: heroTransforms[index].translateX },
                      { translateY: heroTransforms[index].translateY },
                      { rotate: heroTransforms[index].rotate },
                      { scale: 0.55 },
                    ],
                  },
                ]}
              >
                <GameCard card={card} small />
              </View>
            ))}
          </View>
        </Animated.View>

        <View style={styles.copyBlock}>
          <Text style={styles.title}>סוד הניצחון</Text>
          <Text style={styles.subtitle}>
            כאן לומדים לחשוב כמו מקצוענים. גלה את השילובים הסודיים שיחריבו את היד של היריב ויביאו לך את הניצחון!
          </Text>
        </View>
      </View>

      <View style={styles.ctaWrap}>
        <GoldButton label="בוא ננצח!" onPress={handleStart} accessibilityLabel="בוא ננצח!" fullWidth height={58} fontSize={22} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  backLight: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    top: '16%',
    height: 260,
    borderRadius: 150,
    backgroundColor: 'transparent',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 0,
  },
  particle: {
    position: 'absolute',
    backgroundColor: '#F8E08E',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingBottom: 110,
  },
  hero: {
    width: 250,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  heroAura: {
    position: 'absolute',
    width: 206,
    height: 206,
    borderRadius: 103,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  trophy: {
    fontSize: 76,
    textAlign: 'center',
    textShadowColor: 'rgba(248,224,142,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
    transform: [{ translateY: -42 }],
    zIndex: 1,
  },
  heroCards: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 2,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  heroCard: {
    position: 'absolute',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  copyBlock: {
    width: '100%',
    maxWidth: 390,
    alignItems: 'stretch',
  },
  title: {
    ...rtlText,
    color: '#F8E08E',
    fontSize: 38,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    ...rtlText,
    color: '#F5E6BF',
    fontSize: 17,
    lineHeight: 27,
    fontWeight: '700',
    marginTop: 16,
  },
  ctaWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 34,
  },
});
