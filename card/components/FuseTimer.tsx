import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, Dimensions, StyleSheet, Platform, Vibration } from 'react-native';
import Svg, { Circle, Rect, Path, Defs, LinearGradient, Stop, RadialGradient, G, ClipPath } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FUSE_TOTAL_W = Math.min(SCREEN_WIDTH - 48, 320);
const FUSE_H = 80;
const FUSE_Y = 40;
const CORD_THICK = 8;
const BRAID_REPEAT = 14;

// --- Mini-explosion config (terminal blast at tip end, x: 0 / left edge) ---
const EXPLOSION_DURATION = 1500;
const EXPLOSION_CORE = 45; // final core diameter (px)
const PARTICLE_COUNT = 9;
const PARTICLE_COLORS = ['#FFE000', '#FF5500', '#FFFFFF'];

function interpolateColor(t: number): string {
  if (t <= 0.33) {
    const s = t / 0.33;
    return `rgb(${Math.round(34 + (125 - 34) * s)},${Math.round(197 + (234 - 197) * s)},${Math.round(94 + (179 - 94) * s)})`;
  }
  if (t <= 0.66) {
    const s = (t - 0.33) / 0.33;
    return `rgb(${Math.round(125 + (251 - 125) * s)},${Math.round(234 + (191 - 234) * s)},${Math.round(179 + (36 - 179) * s)})`;
  }
  const s = (t - 0.66) / 0.34;
  return `rgb(${Math.round(251 + (239 - 251) * s)},${Math.round(191 + (68 - 191) * s)},${Math.round(36 + (68 - 36) * s)})`;
}

function braidPath(startX: number, endX: number, cy: number, amplitude: number, phase: number): string {
  const pts: string[] = [];
  let x = startX;
  let up = phase % 2 === 0;
  pts.push(`M${x} ${cy}`);
  while (x < endX) {
    const nextX = Math.min(x + BRAID_REPEAT / 2, endX);
    pts.push(`L${nextX} ${up ? cy - amplitude : cy + amplitude}`);
    x = nextX;
    up = !up;
  }
  return pts.join(' ');
}

type FuseViewProps = {
  totalW: number;
  remainW: number;
  tipColor: string;
  showFull: boolean;
  isRunning: boolean;
};

function FuseView({ totalW, remainW, tipColor, showFull, isRunning }: FuseViewProps) {
  const ropeW = showFull ? totalW : remainW;
  const tipX = showFull ? totalW : remainW;

  return (
    <Svg width={totalW} height={FUSE_H} style={styles.fuseSvg}>
      <Defs>
        <LinearGradient id="ropeGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
          <Stop offset="40%" stopColor={tipColor} stopOpacity="1" />
          <Stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
        </LinearGradient>
        <RadialGradient id="emberGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFEE44" stopOpacity="1" />
          <Stop offset="45%" stopColor="#FF8800" stopOpacity="0.7" />
          <Stop offset="100%" stopColor="#FF4400" stopOpacity="0" />
        </RadialGradient>
        <ClipPath id="fuseClip">
          <Rect x={0} y={FUSE_Y - CORD_THICK - 4} width={totalW} height={(CORD_THICK + 4) * 2} />
        </ClipPath>
      </Defs>
      {ropeW > 1 && (
        <G>
          <Rect x={0} y={FUSE_Y - CORD_THICK / 2 + 3} width={ropeW} height={CORD_THICK} rx={CORD_THICK / 2} fill="rgba(0,0,0,0.4)" />
          <Rect x={0} y={FUSE_Y - CORD_THICK / 2} width={ropeW} height={CORD_THICK} rx={CORD_THICK / 2} fill="url(#ropeGrad)" />
          <Path d={braidPath(0, ropeW, FUSE_Y, CORD_THICK / 2 - 1, 0)} stroke="rgba(255,255,255,0.22)" strokeWidth={2} fill="none" clipPath="url(#fuseClip)" />
          <Path d={braidPath(0, ropeW, FUSE_Y, CORD_THICK / 2 - 1, 1)} stroke="rgba(0,0,0,0.28)" strokeWidth={2} fill="none" clipPath="url(#fuseClip)" />
          <Rect x={0} y={FUSE_Y - CORD_THICK / 2} width={ropeW} height={2} rx={1} fill="rgba(255,255,255,0.25)" />
        </G>
      )}
      {!showFull && tipX > 2 && tipX < totalW && (
        <G>
          <Circle cx={tipX} cy={FUSE_Y} r={20} fill="url(#emberGlow)" opacity={0.5} />
          <Circle cx={tipX} cy={FUSE_Y} r={6} fill="#FFDD00" />
          <Circle cx={tipX} cy={FUSE_Y} r={3} fill="#FFFFFF" />
        </G>
      )}
    </Svg>
  );
}

type FlameProps = { tipX: number; delay: number; color: string; size: number; dx?: number };
function FlameTongue({ tipX, delay, color, size, dx = 0 }: FlameProps) {
  const scaleY = useRef(new Animated.Value(0.3)).current;
  const scaleX = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    const animate = () => {
      if (!alive) return;
      const dur = 350 + Math.random() * 250;
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleY, { toValue: 0.6 + Math.random() * 0.4, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(scaleY, { toValue: 0.2 + Math.random() * 0.3, duration: dur * 0.6, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(scaleX, { toValue: 0.5 + Math.random() * 0.4, duration: dur * 0.7, useNativeDriver: true }),
          Animated.timing(scaleX, { toValue: 0.4 + Math.random() * 0.3, duration: dur * 0.7, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.85 + Math.random() * 0.15, duration: 80, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.3 + Math.random() * 0.4, duration: dur, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(translateY, { toValue: -(size * 0.3), duration: dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0, duration: dur * 0.4, useNativeDriver: true }),
        ]),
      ]).start(() => { if (alive) animate(); });
    };
    const t = setTimeout(animate, delay);
    return () => { alive = false; clearTimeout(t); };
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: tipX - size / 2 + dx,
        top: FUSE_Y - size - 2,
        width: size,
        height: size * 1.5,
        borderRadius: size / 2,
        borderBottomLeftRadius: size * 0.35,
        borderBottomRightRadius: size * 0.35,
        backgroundColor: color,
        opacity,
        transform: [{ scaleY }, { scaleX }, { translateY }],
      }}
    />
  );
}

export interface FuseTimerProps {
  totalTime: number;
  secsLeft: number;
  running: boolean;
}

type ExplosionParticle = {
  tx: Animated.Value;
  ty: Animated.Value;
  op: Animated.Value;
  color: string;
  size: number;
};

export default function FuseTimer({ totalTime, secsLeft, running }: FuseTimerProps) {
  const [, setTick] = useState(0);
  const segmentStartTimeRef = useRef<number>(Date.now());
  const segmentStartRemainingRef = useRef<number>(secsLeft);
  const fuseShake = useRef(new Animated.Value(0)).current;

  const spark1Y = useRef(new Animated.Value(0)).current;
  const spark1X = useRef(new Animated.Value(0)).current;
  const spark1O = useRef(new Animated.Value(0)).current;
  const spark2Y = useRef(new Animated.Value(0)).current;
  const spark2X = useRef(new Animated.Value(0)).current;
  const spark2O = useRef(new Animated.Value(0)).current;
  const spark3Y = useRef(new Animated.Value(0)).current;
  const spark3X = useRef(new Animated.Value(0)).current;
  const spark3O = useRef(new Animated.Value(0)).current;
  const spark4Y = useRef(new Animated.Value(0)).current;
  const spark4X = useRef(new Animated.Value(0)).current;
  const spark4O = useRef(new Animated.Value(0)).current;
  const spark5Y = useRef(new Animated.Value(0)).current;
  const spark5X = useRef(new Animated.Value(0)).current;
  const spark5O = useRef(new Animated.Value(0)).current;
  const finishedPlayedRef = useRef(false);

  // --- Terminal mini-explosion state + animated values ---
  const [showExplosion, setShowExplosion] = useState(false);
  const coreScale = useRef(new Animated.Value(0)).current;
  const coreOpacity = useRef(new Animated.Value(0)).current;
  const explosionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 9 ember particles created once; their angle/distance are randomized at each blast.
  const explosionParticles = useRef<ExplosionParticle[]>(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      tx: new Animated.Value(0),
      ty: new Animated.Value(0),
      op: new Animated.Value(0),
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      size: 3 + (i % 3), // 3 / 4 / 5 px mix
    }))
  ).current;

  const fuseW = FUSE_TOTAL_W;
  let visualRemaining: number;
  if (running && totalTime > 0) {
    const elapsed = (Date.now() - segmentStartTimeRef.current) / 1000;
    visualRemaining = Math.max(0, segmentStartRemainingRef.current - elapsed);
  } else {
    visualRemaining = secsLeft;
  }
  const progress = totalTime > 0 ? 1 - visualRemaining / totalTime : 0;
  const remainW = (1 - progress) * fuseW;
  const tipColor = interpolateColor(progress);
  const showFull = totalTime === 0;
  const tipAbsX = remainW;

  useEffect(() => {
    segmentStartTimeRef.current = Date.now();
    segmentStartRemainingRef.current = secsLeft;
  }, [secsLeft, running]);

  useEffect(() => {
    if (!running) { return; }
    const rafRef = setInterval(() => setTick((n) => n + 1), 16);
    return () => clearInterval(rafRef);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    let active = true;
    const animateSpark = (
      y: Animated.Value, x: Animated.Value, o: Animated.Value,
      delay: number, dx: number, dy: number, dur: number
    ) => {
      setTimeout(() => {
        const loop = () => {
          if (!active) return;
          y.setValue(0); x.setValue(0); o.setValue(0);
          Animated.parallel([
            Animated.timing(y, { toValue: dy + (Math.random() - 0.5) * 8, duration: dur + Math.random() * 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(x, { toValue: dx + (Math.random() - 0.5) * 12, duration: dur, useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(o, { toValue: 1, duration: 60, useNativeDriver: true }),
              Animated.timing(o, { toValue: 0, duration: dur - 60, useNativeDriver: true }),
            ]),
          ]).start(() => { if (active) setTimeout(loop, 50 + Math.random() * 150); });
        };
        loop();
      }, delay);
    };
    animateSpark(spark1Y, spark1X, spark1O, 0, -9, -28, 380);
    animateSpark(spark2Y, spark2X, spark2O, 80, 12, -20, 320);
    animateSpark(spark3Y, spark3X, spark3O, 40, -3, -36, 440);
    animateSpark(spark4Y, spark4X, spark4O, 160, 6, -16, 280);
    animateSpark(spark5Y, spark5X, spark5O, 200, -14, -22, 360);
    return () => { active = false; };
  }, [running]);

  useEffect(() => {
    if (!running || secsLeft !== 0) return;
    if (finishedPlayedRef.current) return;
    finishedPlayedRef.current = true;

    // Existing shake
    Animated.sequence([
      Animated.timing(fuseShake, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(fuseShake, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(fuseShake, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(fuseShake, { toValue: -6, duration: 40, useNativeDriver: true }),
      Animated.timing(fuseShake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();

    // --- NEW: 1500ms mini-explosion + radial ember burst at the tip end (x: 0) ---
    Vibration.vibrate([0, 80]);
    setShowExplosion(true);

    // Bursting fire core: rapid elastic pop-in -> brief hold -> graceful fade to scale 0.
    coreScale.setValue(0);
    coreOpacity.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(coreScale, { toValue: 1, duration: 220, easing: Easing.out(Easing.back(2.2)), useNativeDriver: true }),
        Animated.delay(360),
        Animated.timing(coreScale, { toValue: 0, duration: EXPLOSION_DURATION - 580, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(coreOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.delay(480),
        Animated.timing(coreOpacity, { toValue: 0, duration: EXPLOSION_DURATION - 600, useNativeDriver: true }),
      ]),
    ]).start();

    // Spark / ember burst: each particle shoots out in a random radial direction,
    // using correlated translateX/translateY (cos/sin of the same angle), fading over 1500ms.
    explosionParticles.forEach((p, i) => {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
      const dist = 32 + Math.random() * 40;
      p.tx.setValue(0);
      p.ty.setValue(0);
      p.op.setValue(0);
      Animated.parallel([
        Animated.timing(p.tx, { toValue: Math.cos(angle) * dist, duration: EXPLOSION_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(p.ty, { toValue: Math.sin(angle) * dist, duration: EXPLOSION_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(p.op, { toValue: 1, duration: 60, useNativeDriver: true }),
          Animated.timing(p.op, { toValue: 0, duration: EXPLOSION_DURATION - 60, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ]).start();
    });

    // Turn the explosion off after exactly 1500ms.
    if (explosionTimerRef.current) clearTimeout(explosionTimerRef.current);
    explosionTimerRef.current = setTimeout(() => {
      setShowExplosion(false);
      explosionTimerRef.current = null;
    }, EXPLOSION_DURATION);

    // Cleanup: clear the timer and stop animations if the timer resets / unmounts mid-blast.
    return () => {
      if (explosionTimerRef.current) {
        clearTimeout(explosionTimerRef.current);
        explosionTimerRef.current = null;
      }
      coreScale.stopAnimation();
      coreOpacity.stopAnimation();
      explosionParticles.forEach((p) => {
        p.tx.stopAnimation();
        p.ty.stopAnimation();
        p.op.stopAnimation();
      });
    };
  }, [secsLeft, running]);

  useEffect(() => {
    if (secsLeft > 0) {
      finishedPlayedRef.current = false;
      // Reset the explosion when the timer is restarted / topped up.
      if (explosionTimerRef.current) {
        clearTimeout(explosionTimerRef.current);
        explosionTimerRef.current = null;
      }
      setShowExplosion(false);
      coreScale.setValue(0);
      coreOpacity.setValue(0);
      explosionParticles.forEach((p) => {
        p.tx.setValue(0);
        p.ty.setValue(0);
        p.op.setValue(0);
      });
    }
  }, [secsLeft]);

  return (
    <View style={[styles.wrap, { direction: 'ltr' } as any]}>
      <Animated.View style={[styles.svgWrap, { width: fuseW }, { transform: [{ translateX: fuseShake }] }]}>
        <FuseView totalW={fuseW} remainW={remainW} tipColor={tipColor} showFull={showFull} isRunning={running} />
        {running && !showFull && tipAbsX > 4 && tipAbsX < fuseW - 4 && (
          <>
            <FlameTongue tipX={tipAbsX} delay={0} color="#FF5500" size={11} />
            <FlameTongue tipX={tipAbsX} delay={80} color="#FF8C00" size={8} dx={-2} />
            <FlameTongue tipX={tipAbsX} delay={140} color="#FFE000" size={5} dx={1} />
          </>
        )}
        {running && !showFull && tipAbsX > 4 && (
          <>
            <Animated.View style={[styles.spark, { backgroundColor: '#FFE000', width: 5, height: 5, left: tipAbsX - 2, top: FUSE_Y - 2, transform: [{ translateX: spark1X }, { translateY: spark1Y }], opacity: spark1O }]} />
            <Animated.View style={[styles.spark, { backgroundColor: '#FF8800', width: 4, height: 4, left: tipAbsX - 2, top: FUSE_Y - 2, transform: [{ translateX: spark2X }, { translateY: spark2Y }], opacity: spark2O }]} />
            <Animated.View style={[styles.spark, { backgroundColor: '#FFFFFF', width: 3, height: 3, left: tipAbsX - 1, top: FUSE_Y - 1, transform: [{ translateX: spark3X }, { translateY: spark3Y }], opacity: spark3O }]} />
            <Animated.View style={[styles.spark, { backgroundColor: '#FFAA00', width: 4, height: 4, left: tipAbsX - 2, top: FUSE_Y - 2, transform: [{ translateX: spark4X }, { translateY: spark4Y }], opacity: spark4O }]} />
            <Animated.View style={[styles.spark, { backgroundColor: '#FF6600', width: 3, height: 3, left: tipAbsX - 1, top: FUSE_Y - 1, transform: [{ translateX: spark5X }, { translateY: spark5Y }], opacity: spark5O }]} />
          </>
        )}

        {/* --- NEW: terminal mini-explosion + radial ember burst, rendered at the tip end (x: 0, y: FUSE_Y) --- */}
        {showExplosion && (
          <View pointerEvents="none" style={styles.explosionLayer}>
            {/* Bursting fire core */}
            <Animated.View
              style={[
                styles.explosionCore,
                {
                  left: -EXPLOSION_CORE / 2,
                  top: FUSE_Y - EXPLOSION_CORE / 2,
                  opacity: coreOpacity,
                  transform: [{ scale: coreScale }],
                },
              ]}
            >
              <View style={styles.explosionCoreInner} />
            </Animated.View>
            {/* Ember / spark particles */}
            {explosionParticles.map((p, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.explosionParticle,
                  {
                    width: p.size,
                    height: p.size,
                    borderRadius: p.size / 2,
                    backgroundColor: p.color,
                    left: -p.size / 2,
                    top: FUSE_Y - p.size / 2,
                    opacity: p.op,
                    transform: [{ translateX: p.tx }, { translateY: p.ty }],
                  },
                ]}
              />
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  svgWrap: { position: 'relative', height: FUSE_H },
  fuseSvg: {},
  spark: { position: 'absolute', borderRadius: 2.5 },
  explosionLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 9 },
  explosionCore: {
    position: 'absolute',
    width: EXPLOSION_CORE,
    height: EXPLOSION_CORE,
    borderRadius: EXPLOSION_CORE / 2,
    backgroundColor: '#FF4400',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6A00',
    shadowOpacity: 0.9,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  explosionCoreInner: {
    width: EXPLOSION_CORE * 0.5,
    height: EXPLOSION_CORE * 0.5,
    borderRadius: (EXPLOSION_CORE * 0.5) / 2,
    backgroundColor: '#FFDD00',
  },
  explosionParticle: { position: 'absolute' },
});
