// BetaWelcomeScreen.tsx
// Auto-flipping welcome card for the Salinda beta.
// Front = card back (green felt + gold "Salinda"), flips after 600ms to a
// cream message side with the project GoldButton.
//
// Rendered as a full-screen overlay (see PlayModeChoiceScreen in index.tsx).
// Shown once on first launch (gated by AsyncStorage 'HAS_SEEN_BETA_WELCOME');
// on dismiss it fades out and the host opens the in-room "gold" tutorial.
//
// The flip animation, Hebrew copy and felt/gold tokens are lifted verbatim
// from card-back.png — do not restyle them.

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
// Authentic project gold button (named export). Same component GoldRoomScreen /
// SalindaCardFlow use, so fonts, press animation and gold gradient stay identical.
import { GoldButton } from './GoldButton';

// ---------- Design tokens (lifted from card-back.png + Salinda mockups) ----------
const GOLD_FRAME = ['#855917', '#e8c661', '#a57020', '#efc75a', '#f3d57a', '#b8862e'] as const;
const GOLD_FRAME_LOCS = [0, 0.22, 0.45, 0.62, 0.82, 1] as const;
const FELT = ['#1f5a3a', '#0f3621', '#08200f'] as const;       // deep green felt
const GOLD_TEXT = '#f3d57a';
const CREAM_TOP = '#fbf7ec';
const CREAM_BOT = '#efe6d2';
const INK = '#2a2118';

const FLIP_DELAY = 600;     // ms before the card flips
const FLIP_DURATION = 900;  // ms flip animation
const FADE_OUT = 360;       // ms screen fade on dismiss

// Card geometry — playing-card ratio (2.5 : 3.5) as a baseline. The card is
// allowed to grow taller than the strict ratio (capped to the screen) so the
// Hebrew copy never overflows: on native the system font renders the RTL lines
// taller than the web fallback, so a fixed 1.4 ratio clipped the title. Combined
// with the TOP-ANCHORED layout in `messageFill`, the title can never be cut off.
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = Math.min(340, SCREEN_W - 48);
const CARD_H = Math.min(SCREEN_H - 40, Math.round(Math.max(CARD_W * 1.4, 540)));
// Content scales with card width so the message side keeps the SAME fill ratio
// on every surface — on a narrower card (small Android / mobile web) fixed-px
// text would otherwise overflow and the button would clip the signoff.
const S = Math.min(1, CARD_W / 340);
const r = (n: number) => Math.round(n * S);

type Props = {
  visible: boolean;
  /** Called after the dismiss fade-out completes. */
  onDismiss: () => void;
};

export default function BetaWelcomeScreen({ visible, onDismiss }: Props) {
  // 0 = showing front (card back), 1 = showing message side
  const flip = useRef(new Animated.Value(0)).current;
  // whole-screen fade for the dismissal exit
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      Animated.timing(flip, {
        toValue: 1,
        duration: FLIP_DURATION,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, FLIP_DELAY);
    return () => clearTimeout(t);
  }, [flip, visible]);

  if (!visible) return null;

  // Front rotates 0 -> 180, back rotates 180 -> 360. backfaceVisibility hides
  // whichever face is turned away, so only one is ever visible.
  const frontRotate = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const handleDismiss = () => {
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: FADE_OUT,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      // Host (PlayModeChoiceScreen) records the one-shot flag and opens the
      // in-room gold tutorial.
      onDismiss();
    });
  };

  return (
    <Animated.View style={[styles.screen, { opacity: screenOpacity }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.cardWrap}>
        {/* FRONT — card back: green felt + gold frame + "Salinda" */}
        <Animated.View
          style={[
            styles.face,
            { transform: [{ perspective: 1200 }, { rotateY: frontRotate }] },
          ]}
        >
          <GoldFrame>
            <LinearGradient
              colors={FELT}
              start={{ x: 0.3, y: 0.2 }}
              end={{ x: 0.85, y: 1 }}
              style={styles.feltFill}
            >
              <Text style={styles.salinda}>Salinda</Text>
            </LinearGradient>
          </GoldFrame>
        </Animated.View>

        {/* BACK — cream message side + GoldButton */}
        <Animated.View
          style={[
            styles.face,
            styles.faceBack,
            { transform: [{ perspective: 1200 }, { rotateY: backRotate }] },
          ]}
        >
          <GoldFrame>
            <LinearGradient
              colors={[CREAM_TOP, CREAM_BOT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.messageFill}
            >
              <View style={styles.messageBody}>
                <Text style={styles.title}>ברוכים הבאים לבטא של סלינדה! 🃏</Text>

                <Text style={styles.paragraph}>
                  איזה כיף שאתם כאן! המשחק נמצא כרגע בשלבי פיתוח והרצה, ואתם
                  מהראשונים שזוכים לשחק בו.
                </Text>

                <Text style={styles.paragraph}>
                  נתקלתם בבאג? יש לכם רעיון לשיפור? נשמח מאוד לקבל מכם פידבק כדי
                  להפוך את המשחק למושלם.
                </Text>

                <Text style={styles.signoff}>תודה רבה ותיהנו!</Text>
              </View>

              {/* Flexible spacer keeps the button pinned to the bottom while the
                  copy stays anchored to the top (so the title is never clipped). */}
              <View style={styles.spacer} />

              <View style={styles.buttonRow}>
                {/* Authentic project gold button — keeps fonts/press/gradient consistent */}
                <GoldButton
                  label="הבנתי, בואו נלמד לשחק! 🎓"
                  onPress={handleDismiss}
                  fullWidth
                  fontSize={r(18)}
                  height={r(56)}
                />
              </View>
            </LinearGradient>
          </GoldFrame>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ---------- Shared gold border frame (matches card-back.png) ----------
function GoldFrame({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={GOLD_FRAME}
      locations={GOLD_FRAME_LOCS}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.frame}
    >
      {/* subtle inner bevel highlight */}
      <View style={styles.frameBevel} />
      <View style={styles.frameInner}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    // Full-screen overlay above the lobby.
    ...StyleSheet.absoluteFillObject,
    zIndex: 40000,
    elevation: 40000,
    backgroundColor: '#0a0d14',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cardWrap: {
    width: CARD_W,
    height: CARD_H,
  },
  face: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    backfaceVisibility: 'hidden',
  },
  faceBack: {
    // back starts pre-rotated so it sits behind the front
  },

  // ----- gold frame -----
  frame: {
    flex: 1,
    borderRadius: 18,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 12,
  },
  frameBevel: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,236,170,0.55)',
  },
  frameInner: {
    flex: 1,
    borderRadius: 9,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(90,60,12,0.6)',
  },

  // ----- front (felt) -----
  feltFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  salinda: {
    fontSize: Math.round(CARD_W * 0.16),
    color: GOLD_TEXT,
    fontStyle: 'italic',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    // No branded serif is registered in this app (only Fredoka, a sans), so we
    // keep the platform serif fallback for the "Salinda" wordmark.
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontWeight: '700',
  },

  // ----- back (message) -----
  messageFill: {
    flex: 1,
    paddingHorizontal: r(20),
    paddingTop: r(26),
    paddingBottom: r(20),
    // Top-anchored: the title sits at the very top of the cream area and can
    // never be clipped by vertical overflow (overflow would push the bottom
    // spacer/button down, not cut the title off the top).
    justifyContent: 'flex-start',
  },
  messageBody: {
    // No flex/centering — the copy flows from the top so the title is pinned.
    flexShrink: 0,
  },
  spacer: {
    flex: 1,
    minHeight: r(8),
  },
  title: {
    fontSize: r(21),
    fontWeight: '800',
    color: INK,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: r(16),
    lineHeight: r(30),
  },
  paragraph: {
    fontSize: r(15.5),
    color: '#4a3f30',
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: r(25),
    marginBottom: r(14),
  },
  signoff: {
    fontSize: r(16),
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: r(4),
  },
  buttonRow: {
    alignItems: 'stretch',
  },
});
