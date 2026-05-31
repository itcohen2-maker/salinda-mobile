// ============================================================
// GoldRoomScreen — "חדר הזהב"
// A brand-new, ADMIN-ONLY onboarding center in its own separate
// entry. Full-screen overlay (RN Modal) that floats ABOVE the live
// app and changes nothing in the existing screens.
//
// Structure — Hub → Task (implemented with the app's own patterns,
// no react-navigation; the app uses a custom router):
//   • TrainingHub  — a list of gold "training task" cards.
//   • TrainingTask — a task's step flow (spotlight tutorial).
//
// Task flow architecture (per UX brief — low cognitive load,
// action-focused, progressive disclosure):
//   • Linear step counter (1..N).
//   • Steps 1..N-1 advance with "המשך"; the last turns into "סיום"
//     and returns to the Hub. Back + Skip are always available.
//   • Numbers mirror the real rules: start with 7 cards, win
//     ("Golden Rule") at exactly 2 cards.
//   • Visual focus layer (Spotlight): the screen dims and highlights
//     the relevant UX region per step. Targets are screen fractions
//     so they can be swapped for measured element rects once this
//     runs over a real game board — no structural change.
// ============================================================

import React, { useState, useCallback, useRef } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet, Platform, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GoldButton } from '../../components/GoldButton';
import { useTrainingProgress } from './useTrainingProgress';
import { DiceEquationRound } from './DiceEquationRound';
import SpecialCardsIntro from './SpecialCardsIntro';
import HandFan from '../../components/HandFan';
import { type Card } from '../../components/CardDesign';
import { useAuthOptional } from '../hooks/useAuth';
import { SALINDA_COIN_SOURCES, SALINDA_GOLD_ROOM_REWARD } from '../../shared/salindaEconomy';

interface GoldRoomScreenProps {
  visible: boolean;
  onClose: () => void;
  // Launches the REAL live-practice tutorial engine (the existing
  // InteractiveTutorialScreen) over the actual game board. When provided,
  // the "basics" task runs real practice instead of the placeholder spotlight.
  onStartLiveTutorial?: () => void;
}

type CardAnchor = 'top' | 'bottom' | 'center';

// Spotlight target, as fractions (0..1) of the screen.
interface Spot {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Step {
  tag?: string; // small eyebrow label above the title; omit when it would duplicate the title
  title: string;
  body: string;
  spot?: Spot; // undefined → full dim, centered card (intro / goal)
  cardAnchor: CardAnchor;
  // Which mock-board element to reveal behind the spotlight for this step.
  // 'deck' = corner pile of card backs (הערימה); 'fan' = the 7-card hand (המניפה).
  mock?: 'deck' | 'fan';
}

interface Task {
  id: string;
  badge: string;
  title: string;
  desc: string;
  steps?: Step[]; // undefined → "coming soon" (locked card)
  // Interactive tasks open a custom in-room experience (e.g. the dice/equation
  // practice round) instead of the linear spotlight step flow. An interactive
  // task is unlocked even though it has no `steps`.
  interactive?: boolean;
  // The one-time "collect coins" reward tile. Stays locked until every task id
  // in REWARD_REQUIREMENTS is complete; tapping it then grants the reward once.
  reward?: boolean;
}

// The foundational tasks the learner must finish before the coin reward
// unlocks. Fractions and the (still-locked) jokers task are NOT required.
const REWARD_REQUIREMENTS = ['basics', 'equation-practice', 'operations'] as const;

// ---- Task: "יסודות המשחק" (the basics) ----
const BASICS_STEPS: Step[] = [
  {
    tag: 'חדר הזהב',
    title: 'ברוך הבא! 🪙',
    body: 'בוא נלמד לשחק תוך דקה. יש רק שני דברים שצריך להכיר — הערימה והמניפה. קדימה!',
    cardAnchor: 'center',
  },
  {
    tag: 'הערימה',
    title: 'ערימת הקלפים 🂠',
    body: 'ערימת הקלפים — זהו הבנק של המשחק, שנמצא כאן למעלה בפינה.',
    spot: { top: 0.12, left: 0.48, width: 0.44, height: 0.22 },
    cardAnchor: 'bottom',
    mock: 'deck',
  },
  {
    title: 'המניפה 🃏',
    body: 'המניפה — היד שלך. מתחילים את המשחק עם 7 קלפים. החליקו לצדדים כדי לעבור ביניהם.',
    // No spot → full dim; a full, raised hand fan of real cards sits at the
    // bottom — swipe sideways to browse, like the live hand.
    mock: 'fan',
    cardAnchor: 'top',
  },
  {
    title: 'חוק הזהב ✨',
    body: 'המטרה: להישאר עם 2 קלפים בדיוק! בונים משוואה, פוגעים בתוצאה, ונפטרים מה-5 הנותרים. מי שמגיע ראשון ל-2 קלפים מנצח!',
    cardAnchor: 'center',
  },
];

// ---- The Hub's task catalog ----
const TASKS: Task[] = [
  { id: 'basics', badge: '🪙', title: 'היסודות', desc: 'הערימה, המניפה, וחוק הזהב — תוך דקה.', steps: BASICS_STEPS },
  { id: 'equation-practice', badge: '🎲', title: 'תרגול', desc: 'בחר קלף, הטל קוביות, ובנה משוואה.', interactive: true },
  { id: 'operations', badge: '⚡', title: 'מיוחדים', desc: 'הנשק הסודי — היפטר מקלפים במהירות.', interactive: true },
  { id: 'fractions', badge: '½', title: 'שברים', desc: 'איך משחקים עם קלפי שברים.' },
  { id: 'jokers', badge: '🃏', title: 'ג׳וקרים', desc: 'הקלף שמשנה את כללי המשחק.' },
  { id: 'coin-collection', badge: '🪙', title: 'מטבעות', desc: 'סיים את הלמידה ואסוף את המענק.', reward: true },
];

// Gold tones sampled from the physical gold plank — "polished D" language.
const GOLD = ['#F8E08E', '#F0C659', '#D9A23A', '#8A5A1C'] as const;
const DIM = 'rgba(8,5,2,0.84)';

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel="יציאה">
      <LinearGradient colors={GOLD} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.closeBtn}>
        <Text style={styles.closeText}>✕</Text>
      </LinearGradient>
    </Pressable>
  );
}

// The live game's branded card back — so the deck/fan mock reads as the
// real game (same art, 5:7 cards).
const CARD_BACK_IMG = require('../../assets/card-back-salinda-preview.png');
const CARD_RATIO = 5 / 7; // width / height, matches the physical card

// Layered offsets (from the live DrawPile) so the deck reads as a real,
// slightly-messy stack rather than one flat rectangle.
const PILE_ROTATIONS = [
  { rotate: '-3deg', tx: -3, ty: 4 },
  { rotate: '2deg', tx: 3, ty: 2 },
  { rotate: '-1deg', tx: -1, ty: 1 },
  { rotate: '0deg', tx: 0, ty: 0 },
];

const cardBackStyle = (w: number, h: number) => ({
  position: 'absolute' as const,
  width: w,
  height: h,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: 'rgba(0,0,0,0.35)',
});

// The deck (הערימה) — a corner pile of branded card backs, sized to fill the
// spotlight box at the real 5:7 ratio.
function MockDeck({ boxH }: { boxH: number }) {
  const cardH = Math.min(boxH * 0.92, 150);
  const cardW = cardH * CARD_RATIO;
  return (
    <View style={{ width: cardW + 12, height: cardH + 12, alignItems: 'center', justifyContent: 'center' }}>
      {PILE_ROTATIONS.map((r, i) => (
        <Image
          key={i}
          source={CARD_BACK_IMG}
          resizeMode="cover"
          style={[cardBackStyle(cardW, cardH), { transform: [{ rotate: r.rotate }, { translateX: r.tx }, { translateY: r.ty }] }]}
        />
      ))}
    </View>
  );
}

// A friendly demo hand of 7 real number cards (faces up), so the learner sees
// an actual hand — not card backs. Stable across renders (no reshuffle).
const DEMO_HAND: Card[] = [5, 2, 8, 1, 6, 3, 7].map((value, i): Card => ({
  id: `demo-hand-${i}`,
  type: 'number',
  value,
}));

// The hand (המניפה) — the SAME shared HandFan as the live game / practice, shown
// fully RAISED into view (not peeking from the edge) with the 7 demo cards
// face-up. Swipe sideways to browse; tapping gives the premium card feedback.
function DemoHandFan({ W }: { W: number }) {
  return (
    <View style={styles.demoFanWrap} pointerEvents="box-none">
      <HandFan cards={DEMO_HAND} width={W} onTapCard={() => {}} />
    </View>
  );
}

// Mock game board drawn BEHIND the spotlight: only the deck this step
// highlights is rendered, framed exactly by the cutout (same fraction math as
// Spotlight), so the pile sits inside the highlighted box on every device.
// (The hand fan is a separate interactive layer drawn ABOVE the dim.)
function MockBoard({ spot, W, H, kind }: { spot?: Spot; W: number; H: number; kind?: 'deck' | 'fan' }) {
  if (!spot || kind !== 'deck' || !W || !H) return null;
  const t = spot.top * H;
  const l = spot.left * W;
  const w = spot.width * W;
  const h = spot.height * H;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', top: t, left: l, width: w, height: h, alignItems: 'center', justifyContent: 'center' }}>
        <MockDeck boxH={h} />
      </View>
    </View>
  );
}

// Dark mask with a clear, glowing cutout over the target (four dim strips +
// a glow ring — no SVG masking, works on web + native). Sizes are fractions
// of the rendered container (passed in), not the window, so it stays aligned
// inside the capped phone frame on web.
function Spotlight({ spot, W, H }: { spot?: Spot; W: number; H: number }) {
  if (!spot) {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} />;
  }
  const t = spot.top * H;
  const l = spot.left * W;
  const w = spot.width * W;
  const h = spot.height * H;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: t, backgroundColor: DIM }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: t + h, bottom: 0, backgroundColor: DIM }} />
      <View style={{ position: 'absolute', top: t, height: h, left: 0, width: l, backgroundColor: DIM }} />
      <View style={{ position: 'absolute', top: t, height: h, left: l + w, right: 0, backgroundColor: DIM }} />
    </View>
  );
}

// ---- Hub: list of training tasks ----
// Grid tile (2-per-row). Gold-themed; completed shows a green ✓ badge.
function GoldTaskCard({ task, done, eligible, onPress }: { task: Task; done: boolean; eligible: boolean; onPress: () => void }) {
  // The reward tile is locked until eligible (all required tasks done) and,
  // once collected, shows a settled "collected" state instead of "coming soon".
  const locked = task.reward ? !eligible && !done : !task.steps && !task.interactive;
  const state = task.reward
    ? done
      ? 'נאסף ✓'
      : eligible
        ? 'אסוף ›'
        : '🔒 סיים ללמוד'
    : locked
      ? '🔒 בקרוב'
      : done
        ? 'הושלם ✓'
        : 'התחל ›';
  const a11ySuffix = task.reward
    ? done
      ? ' (נאסף)'
      : eligible
        ? ' (זמין לאיסוף)'
        : ' (נעול — סיים את הלמידה)'
    : done
      ? ' (הושלם)'
      : locked
        ? ' (בקרוב)'
        : '';
  return (
    <Pressable
      disabled={locked}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${task.title}${a11ySuffix}`}
      accessibilityState={{ disabled: locked }}
      style={[styles.tile, { opacity: locked ? 0.6 : 1 }]}
    >
      <LinearGradient colors={GOLD} locations={[0, 0.3, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.tileFace}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.sheen}
        />
        {done ? (
          <View style={styles.tileCheck}>
            <Text style={styles.tileCheckText}>✓</Text>
          </View>
        ) : null}
        <Text style={styles.tileBadge}>{task.badge}</Text>
        <Text style={styles.tileTitle} numberOfLines={1}>
          {task.title}
        </Text>
        <Text style={[styles.tileState, done && styles.tileStateDone]}>{state}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function TrainingHub({
  tasks,
  isComplete,
  onSelect,
  onCollectReward,
  onClose,
}: {
  tasks: Task[];
  isComplete: (id: string) => boolean;
  onSelect: (id: string) => void;
  onCollectReward: () => void;
  onClose: () => void;
}) {
  const doneCount = tasks.filter((tk) => tk.steps && isComplete(tk.id)).length;
  const totalUnlocked = tasks.filter((tk) => tk.steps).length;
  // The reward unlocks only once ALL required foundational tasks are complete.
  const rewardEligible = REWARD_REQUIREMENTS.every((id) => isComplete(id));
  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} />
      <View style={styles.topbar}>
        <Text style={styles.hubHeader}>חדר הזהב 🪙</Text>
        <CloseButton onPress={onClose} />
      </View>
      <ScrollView contentContainerStyle={styles.hubScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.hubSub}>בחר משימת אימון · הושלמו {doneCount}/{totalUnlocked}</Text>
        <View style={styles.grid}>
          {tasks.map((task) => (
            <GoldTaskCard
              key={task.id}
              task={task}
              done={isComplete(task.id)}
              eligible={task.reward ? rewardEligible : true}
              onPress={() => {
                if (task.reward) {
                  if (rewardEligible && !isComplete(task.id)) onCollectReward();
                } else if (task.steps || task.interactive) {
                  onSelect(task.id);
                }
              }}
            />
          ))}
        </View>
      </ScrollView>

      {/* Admin/dev layer tracker — quick status line, dev builds only. */}
      {__DEV__ ? (
        <View pointerEvents="none" style={styles.tracker}>
          <Text style={styles.trackerText}>
            UI: Hub · Progress {doneCount}/{totalUnlocked} · Sync: AsyncReady ✓
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ---- Task: a single step flow ----
function TrainingTask({
  steps,
  onExit,
  onComplete,
  onClose,
}: {
  steps: Step[];
  onExit: () => void;
  onComplete: () => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const handleBack = useCallback(() => {
    setIndex((i) => {
      if (i > 0) return i - 1;
      onExit(); // step 1 → back to the Hub (without marking complete)
      return i;
    });
  }, [onExit]);

  const handleNext = useCallback(() => {
    if (isLast) onComplete(); // "סיום" → mark done + back to the Hub
    else setIndex((i) => Math.min(steps.length - 1, i + 1));
  }, [isLast, onComplete, steps.length]);

  const anchorStyle =
    step.cardAnchor === 'top' ? styles.cardTop : step.cardAnchor === 'bottom' ? styles.cardBottom : styles.cardCenter;

  return (
    <View
      style={styles.root}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <MockBoard spot={step.spot} W={size.w} H={size.h} kind={step.mock} />
      <Spotlight spot={step.spot} W={size.w} H={size.h} />
      {step.mock === 'fan' && size.w > 0 ? <DemoHandFan W={size.w} /> : null}

      <View style={styles.topbar}>
        <GoldButton label="דלג ›" onPress={onExit} accessibilityLabel="חזרה לחדר הזהב" tone="stone" height={38} fontSize={14} radius={12} raise={6} />
        <CloseButton onPress={onClose} />
      </View>

      <View style={[styles.cardLayer, anchorStyle]} pointerEvents="box-none">
        <View style={styles.cardWidth}>
          <LinearGradient colors={GOLD} locations={[0, 0.3, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.plank}>
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.sheen}
            />
            {step.tag ? <Text style={styles.stepTag}>{step.tag}</Text> : null}
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>
          </LinearGradient>

          <View style={styles.dots}>
            {steps.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>

          <View style={styles.controls}>
            <GoldButton label="‹ חזור" onPress={handleBack} accessibilityLabel={index > 0 ? 'חזור' : 'חזרה לחדר הזהב'} tone="stone" fontSize={16} />
            <View style={styles.nextWrap}>
              <GoldButton label={isLast ? 'סיום' : 'המשך ›'} onPress={handleNext} fullWidth />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export function GoldRoomScreen({ visible, onClose, onStartLiveTutorial }: GoldRoomScreenProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const { isComplete, markComplete } = useTrainingProgress();
  // Optional so the room can render outside an <AuthProvider> (e.g. previews);
  // in the live app awardCoins is always available.
  const auth = useAuthOptional();
  const [collecting, setCollecting] = useState(false);
  const [rewardShown, setRewardShown] = useState(false); // success celebration overlay
  const [collectError, setCollectError] = useState(false);

  const close = useCallback(() => {
    setActiveTaskId(null);
    setRewardShown(false);
    setCollectError(false);
    onClose();
  }, [onClose]);

  // Collect the one-time reward. Server-side award_coins is itself single-grant
  // per (player, source), so the coins are safe even if local state is cleared;
  // we only mark the tile collected + celebrate once the award actually lands.
  const handleCollectReward = useCallback(async () => {
    if (collecting || isComplete('coin-collection')) return;
    setCollecting(true);
    setCollectError(false);
    const res = await (auth?.awardCoins?.(SALINDA_GOLD_ROOM_REWARD, SALINDA_COIN_SOURCES.gold_room_complete) ??
      Promise.resolve<'ok' | 'error'>('error'));
    setCollecting(false);
    if (res === 'ok') {
      markComplete('coin-collection');
      setRewardShown(true);
    } else {
      setCollectError(true);
    }
  }, [auth, collecting, isComplete, markComplete]);

  // Selecting a task. "basics" launches the REAL live-practice tutorial
  // (measured highlights over the real board) when wired; everything else
  // falls back to the in-room step flow.
  const handleSelect = useCallback(
    (id: string) => {
      if (id === 'basics' && onStartLiveTutorial) {
        close();
        onStartLiveTutorial();
        return;
      }
      setActiveTaskId(id);
    },
    [close, onStartLiveTutorial],
  );

  const activeTask = TASKS.find((tk) => tk.id === activeTaskId);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      {/* On a wide desktop browser, frame the room to a phone-like width and
          center it so the layout (tiles, top bar, exit button) doesn't smear
          across the screen. On native this is a no-op full-screen view. */}
      <View style={styles.backdrop}>
        <View style={styles.frame}>
          {activeTask && activeTask.interactive ? (
            <View style={styles.root}>
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} />
              <View style={styles.topbar}>
                <GoldButton label="‹ חזרה" onPress={() => setActiveTaskId(null)} accessibilityLabel="חזרה לחדר הזהב" tone="stone" height={38} fontSize={14} radius={12} raise={6} />
                <CloseButton onPress={close} />
              </View>
              <View style={styles.interactiveBody}>
                {activeTask.id === 'operations' ? (
                  <SpecialCardsIntro
                    onDone={() => {
                      markComplete(activeTask.id);
                      setActiveTaskId(null);
                    }}
                  />
                ) : (
                  <DiceEquationRound
                    onExit={() => setActiveTaskId(null)}
                    onComplete={() => markComplete('equation-practice')}
                  />
                )}
              </View>
            </View>
          ) : activeTask && activeTask.steps ? (
            <TrainingTask
              key={activeTask.id}
              steps={activeTask.steps}
              onExit={() => setActiveTaskId(null)}
              onComplete={() => {
                markComplete(activeTask.id);
                setActiveTaskId(null);
              }}
              onClose={close}
            />
          ) : (
            <TrainingHub
              tasks={TASKS}
              isComplete={isComplete}
              onSelect={handleSelect}
              onCollectReward={handleCollectReward}
              onClose={close}
            />
          )}

          {/* One-time reward celebration — sits above the Hub once the coins land. */}
          {rewardShown ? (
            <View style={styles.rewardOverlay}>
              <View style={styles.rewardCard}>
                <Text style={styles.rewardBadge}>🪙</Text>
                <Text style={styles.rewardTitle}>כל הכבוד!</Text>
                <Text style={styles.rewardSub}>קיבלת {SALINDA_GOLD_ROOM_REWARD} מטבעות על סיום הלמידה.</Text>
                <View style={styles.rewardBtnWrap}>
                  <GoldButton label="מעולה!" onPress={() => setRewardShown(false)} accessibilityLabel="סגור" fullWidth height={54} fontSize={19} />
                </View>
              </View>
            </View>
          ) : null}

          {/* Award failed (e.g. offline) — let the learner retry; nothing was marked. */}
          {collectError ? (
            <View style={styles.rewardOverlay}>
              <View style={styles.rewardCard}>
                <Text style={styles.rewardBadge}>📡</Text>
                <Text style={styles.rewardTitle}>אופס…</Text>
                <Text style={styles.rewardSub}>לא הצלחנו לזכות אותך כרגע. נסה שוב בעוד רגע.</Text>
                <View style={styles.rewardBtnWrap}>
                  <GoldButton label="נסה שוב" onPress={handleCollectReward} accessibilityLabel="נסה שוב" fullWidth height={50} fontSize={17} />
                  <GoldButton label="סגור" onPress={() => setCollectError(false)} accessibilityLabel="סגור" tone="stone" fullWidth height={44} fontSize={15} />
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Phone-like frame: full screen on native; centered, capped width on web
  // so the room doesn't stretch across a wide browser window.
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
    ...(Platform.OS === 'web' ? { alignItems: 'center' } : null),
  },
  frame: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { maxWidth: 480 } : null),
  },
  root: { flex: 1 },
  interactiveBody: { flex: 1, paddingTop: 96 },
  topbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 44,
    paddingHorizontal: 22,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  closeBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(255,243,201,0.5)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#3A2A10', fontSize: 20, fontWeight: '900', lineHeight: 22 },

  // Hub
  hubHeader: { color: '#F4CD5A', fontSize: 22, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  hubScroll: { paddingTop: 104, paddingHorizontal: 22, paddingBottom: 40 },
  hubSub: { color: '#C9B07A', fontSize: 14, fontWeight: '700', textAlign: 'right', marginBottom: 16 },

  // 2-column grid of gold tiles
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { width: '48%', marginBottom: 14 },
  tileFace: {
    minHeight: 132,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#8A5A1C',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  tileBadge: { fontSize: 36 },
  tileTitle: { color: '#2B1D08', fontSize: 16, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  tileState: { color: '#5E3A10', fontSize: 12.5, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  tileStateDone: { color: '#1F6A2E' },
  tileCheck: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1F6A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileCheckText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', lineHeight: 16 },

  // dev layer tracker
  tracker: { position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: 'rgba(244,205,90,0.16)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(244,205,90,0.3)' },
  trackerText: { color: '#F4CD5A', fontSize: 11, fontWeight: '700', textAlign: 'center' },

  // Task card layer
  cardLayer: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 22, alignItems: 'center' },
  cardCenter: { top: 0, bottom: 0, justifyContent: 'center' },
  cardTop: { top: 96 },
  cardBottom: { bottom: 28 },
  cardWidth: { width: '100%', maxWidth: 420 },

  plank: {
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#8A5A1C',
    overflow: 'hidden',
    paddingHorizontal: 26,
    paddingVertical: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '46%' },
  stepTag: { color: '#5E3A10', fontSize: 13, fontWeight: '800', letterSpacing: 1, opacity: 0.7, textAlign: 'right' },
  title: { color: '#2B1D08', fontSize: 25, fontWeight: '900', marginTop: 6, marginBottom: 12, textAlign: 'right' },
  body: { color: '#3D2A0E', fontSize: 16, lineHeight: 24, fontWeight: '600', textAlign: 'right' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 18, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,243,201,0.35)' },
  dotActive: { width: 22, backgroundColor: '#F4CD5A' },
  controls: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  nextWrap: { flex: 1 },

  // The demo hand (המניפה step) — raised fully into view near the bottom edge,
  // centered, swipeable. box-none so swipes reach the fan but the dim shows.
  demoFanWrap: { position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center' },

  // Reward / error overlay (coin collection)
  rewardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,5,2,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 30,
  },
  rewardCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#8A5A1C',
    backgroundColor: 'rgba(17,12,4,0.96)',
    paddingHorizontal: 26,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 14,
  },
  rewardBadge: { fontSize: 48 },
  rewardTitle: { color: '#F4CD5A', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  rewardSub: { color: '#D8C49A', fontSize: 16, fontWeight: '600', textAlign: 'center', lineHeight: 24, marginBottom: 6 },
  rewardBtnWrap: { alignSelf: 'stretch', marginTop: 8, gap: 10 },
});
