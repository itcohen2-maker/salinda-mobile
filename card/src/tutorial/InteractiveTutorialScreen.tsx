// ============================================================
// InteractiveTutorialScreen.tsx ג€” Watch-and-mimic tutorial host.
// Boots a vs-bot game underneath (using the existing tutorial
// hand rigging), then floats cheerful speech bubbles narrating
// the bot demo and the user's turn. No mockup overlays ג€” the
// real game UI does all the heavy lifting; we just talk.
// ============================================================

import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { getWebGameLayout } from '../theme/webLayout';
import { getNativeGameLayout } from '../theme/nativeGameLayout';
import { useWebViewportSize } from '../hooks/useWebViewportSize';
import { WebGameScreenFrame } from '../components/layout/WebGameScreenFrame';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio, InterruptionModeAndroid } from 'expo-av';
import { useLocale } from '../i18n/LocaleContext';
import OperatorGlyph from '../components/ui/OperatorGlyph';
import { HappyBubble, type HappyBubbleTone } from '../components/HappyBubble';
import { GoldDieFace } from '../../AnimatedDice';
import { GoldDiceButton } from '../../components/GoldDiceButton';
import { initializeSfx, isSfxMuted, setSfxMuted } from '../audio/sfx';
import { getAudioLoadStatus, getAudioReplayStatus } from '../audio/playbackStatus';
import { SlindaCoin } from '../../components/SlindaCoin';
import { generateTutorialHand } from './generateTutorialHand';
import { supabase } from '../lib/supabase';


const diceRollSound = require('../../assets/dice_roll.mp3');

async function playDiceRollSound() {
  if (isSfxMuted()) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
    const { sound } = await Audio.Sound.createAsync(diceRollSound, getAudioLoadStatus());
    // Re-check mute AFTER the async load ג€” the learner might have hit the
    // mute button while createAsync was in flight. Without this second
    // check the dice sound would leak through despite a muted app.
    if (isSfxMuted()) {
      sound.unloadAsync().catch(() => {});
      return;
    }
    await sound.replayAsync(getAudioReplayStatus());
    sound.setOnPlaybackStatusUpdate((s) => {
      const status = s as { didJustFinish?: boolean };
      if (status.didJustFinish) sound.unloadAsync().catch(() => {});
    });
  } catch {
    // No dice sound available ג€” fail silently.
  }
}
import {
  type MimicAction,
  type MimicState,
  INITIAL_MIMIC_STATE,
  mimicReducer,
  MIMIC_FIRST_FRACTION_LESSON_INDEX,
  MIMIC_LAST_CORE_LESSON_INDEX,
  MIMIC_PARENS_LESSON_INDEX,
  MIMIC_IDENTICAL_LESSON_INDEX,
  MIMIC_SINGLE_IDENTICAL_LESSON_INDEX,
  MIMIC_MULTI_PLAY_LESSON_INDEX,
} from './MimicEngine';
import type { Card, Fraction } from '../../shared/types';
import { SALINDA_TUTORIAL_REWARDS } from '../../shared/salindaEconomy';
import { createBotDemonstrator } from './BotDemonstrator';
import { isL6WildTutorialSelectionReady } from './l6WildSelection';
import { tutorialBus, type LayoutRect } from './tutorialBus';
import { LESSONS } from './lessons';
import {
  getTutorialRewardOutcome,
  type TutorialRewardOutcome,
} from './tutorialRewards';
import { getScreenSafeTop } from '../theme/screenInsets';

const LESSON_SHAPES = LESSONS.map((l) => ({ id: l.id, stepCount: l.steps.length }));

const CELEBRATE_MS = 900;
const LESSON_DONE_MS = 1400;
const HIDDEN_TUTORIAL_LAYERS = new Set([15, 16, 17, 18]);
const TUTORIAL_WILD_STAR = '★';

const L6_DICE_POOL = [
  { d1: 2, d2: 3, d3: 5 },
  { d1: 1, d2: 3, d3: 4 },
  { d1: 2, d2: 4, d3: 6 },
  { d1: 1, d2: 2, d3: 5 },
  { d1: 3, d2: 4, d3: 5 },
] as const;

type L6PossibleResultsSetup = {
  dice: { die1: number; die2: number; die3: number };
  target: number;
  equationDisplay: string;
  playerHand: Card[];
  botHand: Card[];
};

function buildL6PossibleResultsSetup(): L6PossibleResultsSetup {
  const pick = L6_DICE_POOL[Math.floor(Math.random() * L6_DICE_POOL.length)];
  const ts = Date.now();
  const s12 = pick.d1 + pick.d2;
  const s13 = pick.d1 + pick.d3;
  const s23 = pick.d2 + pick.d3;
  const s123 = pick.d1 + pick.d2 + pick.d3;
  const resultValues = [s12, s13, s23, s123];
  const resultSet = new Set(resultValues);
  const distractors = [1, 2, 4, 6, 7, 8, 9, 10, 11, 12]
    .filter((value) => !resultSet.has(value))
    .slice(0, 3);
  const playerHand: Card[] = [
    ...distractors.map((value, idx) => ({
      id: `tut-l6-extra-${idx}-${value}-${ts}`,
      type: 'number' as const,
      value,
    })),
    ...resultValues.map((value, idx) => ({
      id: `tut-l6-result-${idx}-${value}-${ts}`,
      type: 'number' as const,
      value,
    })),
  ];
  const botHand: Card[] = playerHand.map((card, idx) => ({ ...card, id: `bot-${card.id}-${idx}` }));
  const target = pick.d1 + pick.d2;
  return {
    dice: { die1: pick.d1, die2: pick.d2, die3: pick.d3 },
    target,
    equationDisplay: `${pick.d1} + ${pick.d2} = ${target}`,
    playerHand,
    botHand,
  };
}

function TutorialWildMiniCard({ maxNumber }: { maxNumber: 12 | 25 }) {
  const w = 66;
  const h = 92;
  return (
    <View
      style={{
        width: w,
        height: h,
        borderRadius: 12,
        ...Platform.select({
          ios: { shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 12 },
          android: { elevation: 8 },
        }),
      }}
    >
      <LinearGradient
        colors={['#7C3AED', '#5B21B6', '#4C1D95', '#6D28D9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: w, height: h, borderRadius: 12, padding: 3 }}
      >
        <View style={{ flex: 1, borderRadius: 9, overflow: 'hidden' }}>
          <LinearGradient
            colors={['#EDE9FE', '#DDD6FE', '#C4B5FD']}
            locations={[0, 0.5, 1]}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View
            style={{
              position: 'absolute',
              top: -(h * 0.12),
              left: w * 0.1,
              width: w * 0.8,
              height: h * 0.4,
              borderRadius: w,
              backgroundColor: 'rgba(255,255,255,0.5)',
            }}
          />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#5B21B6', textAlign: 'center' }}>
              {TUTORIAL_WILD_STAR}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#6D28D9', marginTop: 2 }}>
              {maxNumber === 12 ? '0–12' : '0–25'}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

function getHiddenLayerAdvanceAction(phase: MimicState['phase']): MimicAction | null {
  switch (phase) {
    case 'intro':
      return { type: 'DISMISS_INTRO' };
    case 'bot-demo':
      return { type: 'BOT_DEMO_DONE' };
    case 'await-mimic':
      return { type: 'OUTCOME_MATCHED' };
    case 'celebrate':
      return { type: 'CELEBRATE_DONE' };
    default:
      return null;
  }
}

// Pool of parens exercises: all use op1=minus, op2=minus.
// parensLeft = (d1-d2)-d3, parensRight = d1-(d2-d3) = target.
const L7_EXERCISE_POOL: { d1: number; d2: number; d3: number; target: number }[] = [
  { d1: 6, d2: 2, d3: 1, target: 5 },
  { d1: 5, d2: 2, d3: 1, target: 4 },
  { d1: 6, d2: 3, d3: 2, target: 5 },
  { d1: 5, d2: 3, d3: 1, target: 3 },
  { d1: 6, d2: 3, d3: 1, target: 4 },
  { d1: 4, d2: 2, d3: 1, target: 3 },
];

function buildL7ChipEquation(ex: { d1: number; d2: number; d3: number; target: number }) {
  return `${ex.d1} - (${ex.d2} - ${ex.d3}) = ${ex.target}`;
}

const FRAC_KINDS: Fraction[] = ['1/2', '1/3'];

/** Scripted board for each optional-fractions tutorial step (see lesson-06). */
function buildFractionTutorialSetup(stepIndex: number, ts: number) {
  const dice = { die1: 2, die2: 3, die3: 5 };
  const discard12: Card = { id: `tut-frac-disc12-${ts}`, type: 'number', value: 12 };
  const half: Card = { id: `tut-frac-half-${ts}`, type: 'fraction', fraction: '1/2' };
  const third: Card = { id: `tut-frac-third-${ts}`, type: 'fraction', fraction: '1/3' };
  const botMirror = (hand: Card[]) => hand.map((c, i) => ({ ...c, id: `bot-${c.id}-${i}` }));

  if (stepIndex === 0) {
    // Step 0 (frac-intro): spotlight intro screen ג€” fractions last in hand so
    // they appear prominent/front in the fan. Sign card adds visual variety.
    // Pile = 5 (prime) so accidental fraction taps are blocked by the intercept.
    const discard5: Card = { id: `tut-frac-disc5-${ts}`, type: 'number', value: 5 };
    const signPlus: Card = { id: `tut-sign-plus-${ts}`, type: 'operation', operation: '+' };
    const ph: Card[] = [{ id: `tut-n4-${ts}`, type: 'number', value: 4 }, { id: `tut-n8-${ts}`, type: 'number', value: 8 }, signPlus, third, half];
    return {
      type: 'TUTORIAL_FRACTION_SETUP' as const,
      slice: {
        currentPlayerIndex: 1,
        phase: 'building' as const,
        hands: [botMirror(ph), ph],
        discardPile: [discard5],
        dice,
        pendingFractionTarget: null,
        fractionPenalty: 0,
        fractionAttackResolved: false,
        showFractions: true,
        fractionKinds: [...FRAC_KINDS],
      },
    };
  }
  if (stepIndex === 1) {
    // Step 1 (attack-half): random even number NOT divisible by 3.
    const halfOpts = [4, 8, 10, 14, 16, 20, 22];
    const halfVal = halfOpts[Math.floor(Math.random() * halfOpts.length)];
    const discard8: Card = { id: `tut-frac-disc8-${ts}`, type: 'number', value: halfVal };
    // half last ג†' appears at the front (prominent) of the fan
    const ph: Card[] = [third, { id: `tut-n5-${ts}`, type: 'number', value: 5 }, { id: `tut-n7-${ts}`, type: 'number', value: 7 }, { id: `tut-n8-${ts}`, type: 'number', value: 8 }, half];
    return {
      type: 'TUTORIAL_FRACTION_SETUP' as const,
      slice: {
        currentPlayerIndex: 1,
        phase: 'building' as const,
        hands: [botMirror(ph), ph],
        discardPile: [discard8],
        dice,
        pendingFractionTarget: null,
        fractionPenalty: 0,
        fractionAttackResolved: false,
        showFractions: true,
        fractionKinds: [...FRAC_KINDS],
      },
    };
  }
  if (stepIndex === 2) {
    // Step 2 (attack-third): random odd multiple of 3 (not divisible by 2).
    const thirdOpts = [9, 15, 21];
    const thirdVal = thirdOpts[Math.floor(Math.random() * thirdOpts.length)];
    const discard9: Card = { id: `tut-frac-disc9-${ts}`, type: 'number', value: thirdVal };
    const ph: Card[] = [half, third, { id: `tut-n4-${ts}`, type: 'number', value: 4 }, { id: `tut-n6-${ts}`, type: 'number', value: 6 }, { id: `tut-n9-${ts}`, type: 'number', value: 9 }];
    return {
      type: 'TUTORIAL_FRACTION_SETUP' as const,
      slice: {
        currentPlayerIndex: 1,
        phase: 'building' as const,
        hands: [botMirror(ph), ph],
        discardPile: [discard9],
        dice,
        pendingFractionTarget: null,
        fractionPenalty: 0,
        fractionAttackResolved: false,
        showFractions: true,
        fractionKinds: [...FRAC_KINDS],
      },
    };
  }
  if (stepIndex === 3) {
    const fracOnPile: Card = { id: `tut-frac-pile-half-${ts}`, type: 'fraction', fraction: '1/2' };
    // Mix: 4 and 8 are valid (÷2), 5 and 7 are invalid distractors.
    const ph: Card[] = [
      { id: `tut-d5-${ts}`, type: 'number', value: 5 },
      half,
      { id: `tut-d4-${ts}`, type: 'number', value: 4 },
      { id: `tut-d7-${ts}`, type: 'number', value: 7 },
      third,
      { id: `tut-d8-${ts}`, type: 'number', value: 8 },
    ];
    return {
      type: 'TUTORIAL_FRACTION_SETUP' as const,
      slice: {
        currentPlayerIndex: 1,
        phase: 'pre-roll' as const,
        hands: [botMirror(ph), ph],
        discardPile: [discard12, fracOnPile],
        dice,
        pendingFractionTarget: 2,
        fractionPenalty: 2,
        fractionAttackResolved: false,
        showFractions: true,
        fractionKinds: [...FRAC_KINDS],
      },
    };
  }
  if (stepIndex === 4) {
    const fracOnPile: Card = { id: `tut-frac-pile-third-${ts}`, type: 'fraction', fraction: '1/3' };
    // Mix: 9 and 6 are valid (÷3), 5 and 8 are invalid distractors.
    const ph: Card[] = [
      { id: `tut-d8b-${ts}`, type: 'number', value: 8 },
      third,
      { id: `tut-d9-${ts}`, type: 'number', value: 9 },
      { id: `tut-d5b-${ts}`, type: 'number', value: 5 },
      half,
      { id: `tut-d6b-${ts}`, type: 'number', value: 6 },
    ];
    return {
      type: 'TUTORIAL_FRACTION_SETUP' as const,
      slice: {
        currentPlayerIndex: 1,
        phase: 'pre-roll' as const,
        hands: [botMirror(ph), ph],
        discardPile: [discard12, fracOnPile],
        dice,
        pendingFractionTarget: 3,
        fractionPenalty: 3,
        fractionAttackResolved: false,
        showFractions: true,
        fractionKinds: [...FRAC_KINDS],
      },
    };
  }
  if (stepIndex === 5) {
    // Bonus step: fraction cards + number distractors. Only fraction tap completes the step.
    const fracOnPile: Card = { id: `tut-frac-pile-half-b-${ts}`, type: 'fraction', fraction: '1/2' };
    const ph: Card[] = [
      { id: `tut-b3-${ts}`, type: 'number', value: 3 },
      half,
      { id: `tut-b7-${ts}`, type: 'number', value: 7 },
      third,
      { id: `tut-b5-${ts}`, type: 'number', value: 5 },
      { id: `tut-b9-${ts}`, type: 'number', value: 9 },
      { id: `tut-b11-${ts}`, type: 'number', value: 11 },
    ];
    return {
      type: 'TUTORIAL_FRACTION_SETUP' as const,
      slice: {
        currentPlayerIndex: 1,
        phase: 'pre-roll' as const,
        hands: [botMirror(ph), ph],
        discardPile: [discard12, fracOnPile],
        dice,
        pendingFractionTarget: 2,
        fractionPenalty: 2,
        fractionAttackResolved: false,
        showFractions: true,
        fractionKinds: [...FRAC_KINDS],
      },
    };
  }
  return {
    type: 'TUTORIAL_FRACTION_SETUP' as const,
    slice: {
      currentPlayerIndex: 1,
      phase: 'building' as const,
      hands: [[], []],
      discardPile: [discard12],
      dice,
      pendingFractionTarget: null,
      fractionPenalty: 0,
      fractionAttackResolved: false,
      showFractions: true,
      fractionKinds: [...FRAC_KINDS],
    },
  };
}

/** Board rig for lesson 9 (mini copy).
 *  Building state with all operators, mini-strip available, red chip hidden
 *  until the learner taps a mini card. */
function buildMiniCopyTutorialSetup(ts: number) {
  // Pile: value 5 ג€” matches the most common parens-right result (6גˆ'(2גˆ'1)=5).
  const pileTop: Card = { id: `tut-l9-top-${ts}`, type: 'number', value: 5 };
  // Hand: each likely equation result has BOTH a single card AND a 2-card combo.
  //   result 5: card 5 alone  OR  2+3=5
  //   result 7: card 7 alone  OR  3+4=7
  //   result 9: card 9 alone  OR  4+5=9 / 2+7=9
  //   result 3: card 3 alone  OR  2+1 (covered by 2 and 3)
  const hand: Card[] = [
    { id: `tut-l9-num-5-${ts}`, type: 'number', value: 5 },
    { id: `tut-l9-num-2-${ts}`, type: 'number', value: 2 },
    { id: `tut-l9-num-3-${ts}`, type: 'number', value: 3 },
    { id: `tut-l9-num-7-${ts}`, type: 'number', value: 7 },
    { id: `tut-l9-num-4-${ts}`, type: 'number', value: 4 },
    { id: `tut-l9-num-9-${ts}`, type: 'number', value: 9 },
  ];
  const botMirror = (h: Card[]) => h.map((c, i) => ({ ...c, id: `bot-${c.id}-${i}` }));
  return {
    type: 'TUTORIAL_FRACTION_SETUP' as const,
    slice: {
      currentPlayerIndex: 1,
      phase: 'building' as const,
      hands: [botMirror(hand), hand],
      discardPile: [pileTop],
      dice: { die1: 6, die2: 2, die3: 1 },
      pendingFractionTarget: null,
      fractionPenalty: 0,
      fractionAttackResolved: false,
      showFractions: false,
      fractionKinds: [] as const,
    },
  };
}

export type TutorialProgressPayload = {
  percent: number;
  celebrate: boolean;
  layerNumber: number;
  stepNumber: string;
};

interface Props {
  onExit: () => void;
  onProgressChange?: (progress: TutorialProgressPayload) => void;
  // The host (index.tsx) passes the live game store. We dispatch
  // START_GAME + TUTORIAL_SET_HANDS to boot the underlying game.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gameDispatch: (action: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gameState: any;
}

const TUTORIAL_WELCOME_COPY = {
  title: 'ברוכים הבאים לסלינדה',
  goalPrefix: 'מתחילים עם 7 קלפים, ',
  goalHighlight: 'ומנצחים שנשארים רק עם 2 קלפים!',
  action: 'בכל תור בונים תרגיל מ-2 או 3 קוביות.',
  rulePrefix: 'התוצאה חייבת להיות ',
  ruleMatch: 'שווה לקלף ביד',
  ruleMiddle: ' או לחיבור של ',
  rulePair: 'שני קלפים',
  ruleSuffix: ' כדי להיפטר מהם!',
  rewardBasicPrefix: 'בסיום ההדרכה תרוויחו ',
  rewardBasicValue: '10 מטבעות!',
  rewardHookPrefix: 'המשיכו ל-',
  rewardHookTitle: 'איך מנצחים?',
  rewardHookMiddle: ' ותרוויחו עוד ',
  rewardHookValue: '20 מטבעות!',
  start: 'בואו נתחיל',
  advanced: 'הדרכת מתקדמים',
} as const;

type TutorialWelcomeModalProps = {
  topInset: number;
  bottomInset: number;
  horizontalPadding: number;
  cardMaxWidth: ViewStyle['maxWidth'];
  cardWidth: ViewStyle['width'];
  cardPaddingVertical: number;
  cardPaddingHorizontal: number;
  cardGap: number;
  borderRadius: number;
  borderWidth: number;
  onStart: () => void;
  onAdvanced: () => void;
};

function TutorialWelcomeModal({
  topInset,
  bottomInset,
  horizontalPadding,
  cardMaxWidth,
  cardWidth,
  cardPaddingVertical,
  cardPaddingHorizontal,
  cardGap,
  borderRadius,
  borderWidth,
  onStart,
  onAdvanced,
}: TutorialWelcomeModalProps) {
  return (
    <View
      pointerEvents="auto"
      style={[
        styles.tutorialWelcomeOverlay,
        {
          paddingTop: topInset,
          paddingBottom: bottomInset,
          paddingHorizontal: horizontalPadding,
        },
      ]}
    >
      <View
        style={[
          styles.tutorialWelcomeCard,
          {
            borderRadius,
            borderWidth,
            maxWidth: cardMaxWidth,
            width: cardWidth,
            paddingVertical: cardPaddingVertical,
            paddingHorizontal: cardPaddingHorizontal,
            gap: cardGap,
          },
        ]}
      >
        <View style={[styles.tutorialWelcomeTextBlock, { gap: cardGap }]}>
          <Text style={styles.tutorialWelcomeTitle}>{TUTORIAL_WELCOME_COPY.title}</Text>

          <Text style={styles.tutorialWelcomeBodyText}>
            {TUTORIAL_WELCOME_COPY.goalPrefix}
            <Text style={styles.tutorialWelcomeGoldStrong}>
              {TUTORIAL_WELCOME_COPY.goalHighlight}
            </Text>
          </Text>

          <Text style={styles.tutorialWelcomeBodyText}>{TUTORIAL_WELCOME_COPY.action}</Text>

          <Text style={styles.tutorialWelcomeBodyText}>
            {TUTORIAL_WELCOME_COPY.rulePrefix}
            <Text style={styles.tutorialWelcomeGoldStrong}>
              {TUTORIAL_WELCOME_COPY.ruleMatch}
            </Text>
            {TUTORIAL_WELCOME_COPY.ruleMiddle}
            <Text style={styles.tutorialWelcomeGoldStrong}>
              {TUTORIAL_WELCOME_COPY.rulePair}
            </Text>
            <Text style={styles.tutorialWelcomeWhiteStrong}>
              {TUTORIAL_WELCOME_COPY.ruleSuffix}
            </Text>
          </Text>
        </View>

        <View style={styles.tutorialWelcomeRewardBlock}>
          <Text style={styles.tutorialWelcomeRewardText}>
            {TUTORIAL_WELCOME_COPY.rewardBasicPrefix}
            <Text style={styles.tutorialWelcomeRewardGold}>
              {TUTORIAL_WELCOME_COPY.rewardBasicValue}
            </Text>
          </Text>
          <Text style={styles.tutorialWelcomeRewardText}>
            {TUTORIAL_WELCOME_COPY.rewardHookPrefix}
            <Text style={styles.tutorialWelcomeRewardGold}>
              {TUTORIAL_WELCOME_COPY.rewardHookTitle}
            </Text>
            {TUTORIAL_WELCOME_COPY.rewardHookMiddle}
            <Text style={styles.tutorialWelcomeRewardGold}>
              {TUTORIAL_WELCOME_COPY.rewardHookValue}
            </Text>
          </Text>
        </View>

        <View style={[styles.tutorialWelcomeButtonStack, { gap: Math.max(8, cardGap) }]}>
          <TouchableOpacity
            onPress={onStart}
            accessibilityRole="button"
            accessibilityLabel={TUTORIAL_WELCOME_COPY.start}
            style={[styles.tutorialWelcomeButton, styles.tutorialWelcomeStartButton]}
          >
            <Text style={styles.tutorialWelcomeButtonText}>
              {TUTORIAL_WELCOME_COPY.start}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onAdvanced}
            accessibilityRole="button"
            accessibilityLabel={TUTORIAL_WELCOME_COPY.advanced}
            style={[styles.tutorialWelcomeButton, styles.tutorialWelcomeAdvancedButton]}
          >
            <Text style={styles.tutorialWelcomeButtonText}>
              {TUTORIAL_WELCOME_COPY.advanced}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tutorialWelcomeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.60)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9400,
  },
  tutorialWelcomeCard: {
    backgroundColor: '#78350F',
    borderColor: '#FACC15',
    alignSelf: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#FACC15',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 20,
      },
      android: { elevation: 12 },
    }),
  },
  tutorialWelcomeTextBlock: {
    width: '100%',
    alignItems: 'center',
  },
  tutorialWelcomeTitle: {
    color: '#FACC15',
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 30,
    textAlign: 'center',
    writingDirection: 'rtl',
    includeFontPadding: false,
  },
  tutorialWelcomeBodyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 23,
    textAlign: 'center',
    writingDirection: 'rtl',
    includeFontPadding: false,
  },
  tutorialWelcomeGoldStrong: {
    color: '#FACC15',
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  tutorialWelcomeWhiteStrong: {
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  tutorialWelcomeRewardBlock: {
    width: '100%',
    marginTop: 18,
    alignItems: 'center',
  },
  tutorialWelcomeRewardText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'center',
    writingDirection: 'rtl',
    includeFontPadding: false,
  },
  tutorialWelcomeRewardGold: {
    color: '#FFDF00',
    fontWeight: 'bold',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  tutorialWelcomeButtonStack: {
    width: '100%',
  },
  tutorialWelcomeButton: {
    minHeight: 48,
    paddingVertical: 0,
    paddingHorizontal: 28,
    borderRadius: 18,
    borderWidth: 2,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorialWelcomeStartButton: {
    backgroundColor: '#16A34A',
    borderColor: '#4ADE80',
  },
  tutorialWelcomeAdvancedButton: {
    backgroundColor: '#6D28D9',
    borderColor: '#C4B5FD',
  },
  tutorialWelcomeButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    textAlignVertical: 'center',
    writingDirection: 'rtl',
    includeFontPadding: false,
  },
});

function normalizeTutorialEquationDisplay(
  equationDisplay: string | null | undefined,
): string | null {
  if (!equationDisplay) return null;
  const lhs = equationDisplay.split('=')[0] ?? equationDisplay;
  const numbersRaw = lhs.match(/\d+/g);
  if (!numbersRaw || numbersRaw.length < 2) return null;
  const operators = (lhs.match(/[+\-x÷*/×]/g) ?? [])
    .map((op) => (op === '×' || op === '*' ? 'x' : op === '/' ? '÷' : op))
    .join(',');
  const compact = lhs.replace(/\s+/g, '');
  const parensRight = /^\d+[+\-x÷*/×]\(.*\)$/.test(compact);
  return `${numbersRaw.join(',')}|${operators}|${parensRight ? 'R' : 'L'}`;
}

function sumLessonSteps(start: number, endInclusive: number): number {
  if (endInclusive < start) return 0;
  return LESSONS.slice(start, endInclusive + 1).reduce((total, lesson) => total + lesson.steps.length, 0);
}

const CORE_TUTORIAL_TOTAL_STEPS = sumLessonSteps(0, MIMIC_LAST_CORE_LESSON_INDEX);
const ADVANCED_TUTORIAL_TOTAL_STEPS = sumLessonSteps(MIMIC_FIRST_FRACTION_LESSON_INDEX, LESSONS.length - 1);

function getTutorialProgressSnapshot(engine: MimicState): { percent: number; celebrate: boolean } {
  if (engine.phase === 'idle') {
    return { percent: 0, celebrate: false };
  }

  const isAdvancedBranch =
    engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX ||
    engine.phase === 'advanced-complete';
  const branchStart = isAdvancedBranch ? MIMIC_FIRST_FRACTION_LESSON_INDEX : 0;
  const branchEnd = isAdvancedBranch ? LESSONS.length - 1 : MIMIC_LAST_CORE_LESSON_INDEX;
  const totalSteps = isAdvancedBranch ? ADVANCED_TUTORIAL_TOTAL_STEPS : CORE_TUTORIAL_TOTAL_STEPS;

  if (totalSteps <= 0) {
    return { percent: 0, celebrate: false };
  }

  if (
    (!isAdvancedBranch && (engine.phase === 'core-complete' || engine.phase === 'post-signs-choice' || engine.phase === 'all-done')) ||
    (isAdvancedBranch && (engine.phase === 'advanced-complete' || engine.phase === 'all-done'))
  ) {
    return { percent: 100, celebrate: true };
  }

  const clampedLessonIndex = Math.max(branchStart, Math.min(branchEnd, engine.lessonIndex));
  const completedLessonsSteps =
    clampedLessonIndex > branchStart ? sumLessonSteps(branchStart, clampedLessonIndex - 1) : 0;
  const lesson = LESSONS[clampedLessonIndex];
  const completedStepsBeforeCurrent = Math.max(0, Math.min(engine.stepIndex, lesson?.steps.length ?? 0));
  const currentStepCompleted =
    engine.phase === 'celebrate' || engine.phase === 'lesson-done' ? 1 : 0;
  const completedSteps = Math.max(
    0,
    Math.min(totalSteps, completedLessonsSteps + completedStepsBeforeCurrent + currentStepCompleted),
  );
  const percent = Math.round((completedSteps / totalSteps) * 100);

  return {
    percent,
    celebrate: percent >= 100 && (engine.phase === 'celebrate' || engine.phase === 'lesson-done'),
  };
}

function rollThree(): { d1: number; d2: number; d3: number } {
  return {
    d1: Math.floor(Math.random() * 6) + 1,
    d2: Math.floor(Math.random() * 6) + 1,
    d3: Math.floor(Math.random() * 6) + 1,
  };
}

// Generate 3 random dice (any 1ג€“6). The hand includes ALL 3 possible
// 2-die sums so the learner can pick ANY pair and always find a matching
// card. For L4.3 the hint reads "pick one card OR several whose sum
// matches the result" ג€” so the hand MUST contain BOTH the single target
// card AND a distinct pair of cards summing to target. If the dice roll
// makes a distinct pair impossible (target=2 requires 1+1, same value),
// we re-roll until both options are guaranteed.
function rollL4Dice(): {
  d1: number; d2: number; d3: number;
  pickA: number; pickB: number; target: number;
  hand: number[]; validSums: number[];
} {
  // Re-roll until the chosen target supports a DISTINCT pair (two cards
  // with different values that sum to target). Only failure case is
  // target < 3, which happens when the two picked dice are both 1.
  let d1 = 0, d2 = 0, d3 = 0;
  let pickA = 0, pickB = 0, target = 0;
  let attempts = 0;
  while (attempts < 20) {
    attempts += 1;
    d1 = Math.floor(Math.random() * 6) + 1;
    d2 = Math.floor(Math.random() * 6) + 1;
    d3 = Math.floor(Math.random() * 6) + 1;
    const sums: [number, number, number][] = [
      [0, 1, d1 + d2],
      [0, 2, d1 + d3],
      [1, 2, d2 + d3],
    ];
    const sorted = [...sums].sort((a, b) => Math.abs(a[2] - 7) - Math.abs(b[2] - 7));
    [pickA, pickB, target] = sorted[0];
    if (target >= 3) break;
  }
  const sums: [number, number, number][] = [
    [0, 1, d1 + d2],
    [0, 2, d1 + d3],
    [1, 2, d2 + d3],
  ];
  // Hand must contain ALL valid equation results ג€” 2-die AND 3-die sums ג€”
  // so the learner always finds a matching card no matter how they build.
  const threeSum = d1 + d2 + d3;
  const validSums = [...new Set([...sums.map((s) => s[2]), threeSum])];
  const hand = new Set<number>(validSums);
  // Guaranteed distinct pair (pairA, pairB) where pairA + pairB = target.
  // For target ג‰¥ 3 we can always pick pairA in [1..floor((target-1)/2)] so
  // pairB = target - pairA is different from pairA. Both values stay
  // within [1..12] because target ג‰₪ 12 (two dice each ג‰₪ 6).
  const maxPairA = Math.floor((target - 1) / 2);
  const pairA = 1 + Math.floor(Math.random() * maxPairA);
  const pairB = target - pairA;
  hand.add(pairA);
  hand.add(pairB);
  while (hand.size < 6) {
    const v = Math.floor(Math.random() * 12) + 1;
    hand.add(v);
  }
  const sortedHand = [...hand].sort((a, b) => a - b);
  return { d1, d2, d3, pickA, pickB, target, hand: sortedHand, validSums };
}

function buildPreparedPairExercise(target: number): {
  dice: { die1: number; die2: number; die3: number };
  equationDisplay: string;
  pair: [number, number];
  hand: number[];
} {
  const exerciseByTarget: Record<number, { dice: { die1: number; die2: number; die3: number }; equationDisplay: string; pair: [number, number] }> = {
    9: { dice: { die1: 4, die2: 5, die3: 6 }, equationDisplay: '4 + 5 = 9', pair: [8, 1] },
    10: { dice: { die1: 4, die2: 6, die3: 5 }, equationDisplay: '4 + 6 = 10', pair: [9, 1] },
    11: { dice: { die1: 5, die2: 6, die3: 4 }, equationDisplay: '5 + 6 = 11', pair: [10, 1] },
    12: { dice: { die1: 6, die2: 6, die3: 5 }, equationDisplay: '6 + 6 = 12', pair: [11, 1] },
    15: { dice: { die1: 5, die2: 5, die3: 5 }, equationDisplay: '5 + 5 + 5 = 15', pair: [9, 6] },
    18: { dice: { die1: 6, die2: 6, die3: 6 }, equationDisplay: '6 + 6 + 6 = 18', pair: [10, 8] },
    20: { dice: { die1: 5, die2: 4, die3: 6 }, equationDisplay: '5 × 4 = 20', pair: [11, 9] },
    25: { dice: { die1: 5, die2: 5, die3: 6 }, equationDisplay: '5 × 5 = 25', pair: [13, 12] },
  };
  const exercise = exerciseByTarget[target] ?? exerciseByTarget[9];
  const dice = exercise.dice;
  const pair = exercise.pair;
  const hand = [pair[0], pair[1], 0, 10, 11, 12].filter((value) => value !== target);
  return {
    dice,
    equationDisplay: exercise.equationDisplay,
    pair,
    hand,
  };
}

function buildPreparedPairCards(hand: number[], prefix: string): Card[] {
  const numberCards = hand.map((value, i) => ({
    id: `${prefix}-${value}-${i}-${Date.now()}`,
    type: 'number' as const,
    value,
  }));
  return [
    ...numberCards,
    { id: `${prefix}-wild-${Date.now()}`, type: 'wild' as const },
  ];
}

function buildPreparedMultiPlayBonusCards(addA: number, addB: number, prefix: string): Card[] {
  const ts = Date.now();
  return [
    { id: `${prefix}-num-a-${ts}`, type: 'number', value: addA },
    { id: `${prefix}-wild-${ts}`, type: 'wild' },
    { id: `${prefix}-num-b-${ts}`, type: 'number', value: addB },
    { id: `${prefix}-zero-${ts}`, type: 'number', value: 0 },
    { id: `${prefix}-frac-${ts}`, type: 'fraction', fraction: '1/2' },
    { id: `${prefix}-joker-${ts}`, type: 'joker' },
  ];
}

export function InteractiveTutorialScreen({ onExit, onProgressChange, gameDispatch, gameState }: Props): React.ReactElement | null {
  const { t, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const { width: tutorialWindowWidth } = useWindowDimensions();
  const tutorialViewport = useWebViewportSize();
  const webTutorialLayout = Platform.OS === 'web' ? getWebGameLayout(tutorialViewport) : null;
  const nativeTutorialLayout =
    Platform.OS === 'web' ? null : getNativeGameLayout(tutorialViewport.height, Platform.OS);
  const tutorialSafeTop = getScreenSafeTop(insets.top);
  const isAndroidTutorialWelcome = Platform.OS === 'android';
  const tutorialWelcomeScale = isAndroidTutorialWelcome ? 0.5 : 2 / 3;
  const scaleTutorialWelcome = (value: number, min = 0) =>
    Math.max(min, Math.round(value * tutorialWelcomeScale));
  const tutorialMockupTopInset = Math.max(tutorialSafeTop + 22, 44);
  const tutorialMockupBottomInset = Math.max((insets.bottom || 0) + 24, 44);
  const tutorialMockupHorizontalPadding = isAndroidTutorialWelcome ? 18 : scaleTutorialWelcome(24, 16);
  const tutorialMockupCardMaxWidth = isAndroidTutorialWelcome
    ? Math.min(Math.max(tutorialWindowWidth - tutorialMockupHorizontalPadding * 2, 0), 340)
    : Math.min(Math.max(tutorialWindowWidth - tutorialMockupHorizontalPadding * 2, 0), 360);
  const tutorialMockupCardWidth = '100%';
  const tutorialMockupCardPaddingVertical = isAndroidTutorialWelcome ? 18 : scaleTutorialWelcome(24, 16);
  const tutorialMockupCardPaddingHorizontal = isAndroidTutorialWelcome ? 18 : scaleTutorialWelcome(24, 16);
  const tutorialMockupCardGap = isAndroidTutorialWelcome ? 11 : scaleTutorialWelcome(12, 9);
  const [engine, dispatchEngine] = useReducer(
    (s: MimicState, a: MimicAction) => mimicReducer(s, a, LESSON_SHAPES),
    INITIAL_MIMIC_STATE,
  );
  const advancedStartedFromWelcomeRef = useRef(false);
  const tutorialProgress = React.useMemo(() => getTutorialProgressSnapshot(engine), [engine]);
  // Tutorial-owned dice state ג€” used only for lesson 3 so the lesson is
  // self-contained and doesn't depend on the underlying game phase.
  const [tutorialDice, setTutorialDice] = useState<{ d1: number; d2: number; d3: number } | null>(null);
  // Pulse halo around the tutorial-owned dice button during the bot demo.
  const dicePulse = useRef(new Animated.Value(0)).current;
  // Lesson 4: random dice generated once when lesson 4 starts. The values
  // drive ROLL_DICE, and the bot demo reads pickA/pickB/target to know
  // which dice to pick and what the correct card value is.
  const l4DiceRef = useRef<ReturnType<typeof rollL4Dice> | null>(null);
  // Brief green-V overlay when the bot taps the equation confirm button.
  const [showConfirmCheck, setShowConfirmCheck] = useState(false);
  const confirmCheckScale = useRef(new Animated.Value(0)).current;
  // Brief "׳×׳•׳¦׳׳× ׳”׳×׳¨׳'׳™׳ ׳”׳™׳ X" announcement after the bot confirms the equation.
  const [resultAnnouncement, setResultAnnouncement] = useState<string | null>(null);
  // Brief "try again" feedback when the learner makes a WRONG pick during
  // await-mimic (e.g. taps a non-target card, picks the wrong die). The tick
  // retriggers the animation every wrong attempt.
  const [wrongAttemptTick, setWrongAttemptTick] = useState(0);
  const wrongShakeAnim = useRef(new Animated.Value(0)).current;

  // (L5a wrong-tap feedback was removed when the lesson was rebuilt
  // around card placement ג€” fan taps are now the correct first action.)

  // ג”€ג”€ Lesson 4 step 3 (guided full build) sub-phase ג”€ג”€
  // Flow:
  //   intro -> pickFirstDie -> pickSecondDie -> pickOperator
  //        -> pickCard -> pressPlay
  // Wrong card taps briefly detour into `wrongCard` and then bounce back to
  // `pickCard`, keeping the learner on the happy path.
  type L4Step3Phase =
    | 'intro'
    | 'pickFirstDie'
    | 'pickSecondDie'
    | 'pickOperator'
    | 'pickCard'
    | 'wrongCard'
    | 'pressPlay';
  type L4bHintPhase = 'pickDie' | 'pickCard';
  const l4Step1RiggedRef = useRef(false);
  const [l4bHintPhase, setL4bHintPhase] = useState<L4bHintPhase>('pickDie');
  const [l4CardMatchWrong, setL4CardMatchWrong] = useState(false);
  const l4CardMatchWrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [l4Step3Phase, setL4Step3Phase] = useState<L4Step3Phase>('intro');
  const [l4Step3IntroApproved, setL4Step3IntroApproved] = useState(false);
  const [l4Step3FinishApproved, setL4Step3FinishApproved] = useState(false);
  const l4Step3DicePickCountRef = useRef(0);
  const l4Step3OperatorPickedRef = useRef(false);
  const l4Step3WrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Measured rects of the "אשר את התרגיל" / "בחרתי" buttons ג€” updated by the
  // real game UI via tutorialBus.setLayout.
  const [confirmBtnRect, setConfirmBtnRect] = useState<LayoutRect | null>(null);
  const [playCardsBtnRect, setPlayCardsBtnRect] = useState<LayoutRect | null>(null);
  const [solveChipRect, setSolveChipRect] = useState<LayoutRect | null>(null);

  // Lesson 5 (op-cycle) state ג€” scratch canvas. The equation is
  //   `[a] [op] [b] = [result]`  where result updates live as op changes.
  // Number pairs are curated so all 4 operations yield integers (e.g. 4/2).
  // Step 5a: learner cycles the `?` slot through +, -, ×, ÷ ג€” advances once
  // all four signs have been visited. Step 5b: learner taps the joker card,
  // picks a sign in the modal, then taps the slot to place it.
  type L5Op = '+' | '-' | 'x' | '÷';
  const L5_CYCLE: readonly L5Op[] = ['+', '-', 'x', '÷'];
  const [l5Config, setL5Config] = useState<{ a: number; b: number } | null>(null);
  const [l5SelectedOp, setL5SelectedOp] = useState<L5Op | null>(null);
  const [l5JokerOpen, setL5JokerOpen] = useState(false);
  // Signs the learner has visited via the `?` cycle ג€” for step 5a outcome.
  const [l5CycledSigns, setL5CycledSigns] = useState<Set<L5Op>>(() => new Set());
  // Sign picked in the joker modal but not yet placed in the slot.
  const [l5PendingJokerOp, setL5PendingJokerOp] = useState<L5Op | null>(null);
  // Random dice for L5.1+L5.2 ג€” generated once per lesson entry.
  const l5DiceRef = useRef<{ d1: number; d2: number; d3: number }>({ d1: 4, d2: 3, d3: 9 });
  // L5.1 wrong-card feedback: shown 2s then auto-cleared.
  const [l5PlaceWrong, setL5PlaceWrong] = useState(false);
  const l5PlaceWrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // L5.2 wrong-sign feedback: shown 2s when Slinda is placed with wrong op.
  const [l5JokerWrong, setL5JokerWrong] = useState(false);
  const l5JokerWrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const l5SlotPulse = useRef(new Animated.Value(0)).current;
  // Fractions lesson ג€” pulse halo around the discard pile so the learner's
  // eye lands on the pile card (8 ג†' 9 ג†' fraction attack ג†' fraction attack)
  // before reading the bubble.
  const fracPilePulse = useRef(new Animated.Value(0)).current;
  const fracArrowPulse = useRef(new Animated.Value(0)).current;
  // Frac-intro two-stage flow: 0 = pile label, 1 = lesson bubble.
  const [fracIntroStage, setFracIntroStage] = useState<0 | 1>(0);
  // Frac-defense intro: 0 = defense concept bubble, 1 = practice.
  const [fracDefenseIntroStage, setFracDefenseIntroStage] = useState<0 | 1>(0);
  // Bonus defense step: 0 = "׳”׳™׳“׳¢׳×?" info, 1 = practice (only fraction).
  const [fracBonusStage, setFracBonusStage] = useState<0 | 1>(0);
  // Tracks whether user chose a fraction card in each defense step.
  const fracDefenseUsedFractionRef = useRef<{ step3: boolean; step4: boolean }>({ step3: false, step4: false });
const [l5FlowHintPhase, setL5FlowHintPhase] = useState<'tapJoker' | 'pickModal' | 'placeSign'>('tapJoker');
  // L6.2 (tap-mini) await-mimic: "׳”׳'׳ ׳×׳™" button appears ~1.5s after the hint
  // bubble so the learner has time to read "׳׳—׳¦׳• ׳¢׳ ׳׳™׳ ׳™ ׳§׳׳£" before the button shows.
  const [showL6TapMiniContinue, setShowL6TapMiniContinue] = useState(false);
  const [hideL6OpenResultsBubble, setHideL6OpenResultsBubble] = useState(false);
  const [l6MiniDemoPendingAdvance, setL6MiniDemoPendingAdvance] = useState(false);
  // L6.3 mismatch feedback: shown while the staged cards still don't match the red target.
  const [l6Mismatch, setL6Mismatch] = useState(false);
  // L7 (parens-move) mismatch feedback: shown 2.5s when confirmed equation
  // doesn't match the target (wrong parens position or wrong result).
  const [l7Mismatch, setL7Mismatch] = useState(false);
  const l7MismatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Frac-lesson bot-demo rig: tracks which stepIndex was last rigged so we
  // don't double-rig on re-renders. -1 means nothing rigged yet.
  const fracBotDemoRiggedRef = useRef(-1);
  // L7 rigged flag: prevents double-rigging on re-render during bot-demo.
  const l7RiggedRef = useRef(false);
  const l7AwaitSolveChipRef = useRef(false);
  const l7ExerciseRef = useRef(L7_EXERCISE_POOL[0]);
  const l7LastExerciseIdxRef = useRef(-1);
  const l9LastExerciseIdxRef = useRef(-1);
  // L9 (mini-copy) mismatch feedback.
  const [l9Mismatch, setL9Mismatch] = useState(false);
  const [l9Stage, setL9Stage] = useState<0 | 1 | 2>(0);
  const l9MismatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const l9RiggedRef = useRef(false);
  const l9InternalResetRef = useRef(false);
  const l7Step1RiggedRef = useRef(false);
  const l7WaitingForBuildingRef = useRef(false);
  const l7Step1SelectionRef = useRef<{ result: number; equation: string } | null>(null);
  const l7Step1OutcomeKeyRef = useRef('');
  const l8Step1RiggedRef = useRef(false);
  const l8Step3RiggedRef = useRef(false);
  const l8Step3LastTargetRef = useRef(-1);
  const l10RiggedRef = useRef(false);
  const l10LastDiscardRef = useRef(-1);
  const l11RiggedRef = useRef(false);
  const l11LastResultRef = useRef(-1);
  const l11Step0AwaitRiggedRef = useRef(false);
  const l11AwaitRiggedRef = useRef(false);
  const l11PreparedRef = useRef<ReturnType<typeof buildPreparedPairExercise> | null>(null);
  const [l7FanHintHidden, setL7FanHintHidden] = useState(false);
  const [l7Step1MiniPicked, setL7Step1MiniPicked] = useState(false);
  // L7 two-stage intro: 0=info bubble, 1=happy bubble+arrow, 2=gameplay.
  const [parensIntroStage, setParensIntroStage] = useState<0 | 1 | 2>(0);
  const [parensMockupApproved, setParensMockupApproved] = useState(false);
  const [parensMockupPendingAdvance, setParensMockupPendingAdvance] = useState(false);
  const [l3TipApproved, setL3TipApproved] = useState(false);
  const [l5aSignTipApproved, setL5aSignTipApproved] = useState(false);
  const [l6WildMockupApproved, setL6WildMockupApproved] = useState(false);
  const [identicalMockupApproved, setIdenticalMockupApproved] = useState(false);
  const [identicalMockupPendingAdvance, setIdenticalMockupPendingAdvance] = useState(false);
  const [l11MockupApproved, setL11MockupApproved] = useState(false);
  const [l11MockupPendingAdvance, setL11MockupPendingAdvance] = useState(false);

  const ensureL11PreparedConfig = (
    stepIndex: 0 | 1,
  ): {
    cfg: { addA: number; addB: number; target: number; includeZero: boolean; includeWild: boolean; wildValue?: number };
    prepared: ReturnType<typeof buildPreparedPairExercise>;
  } => {
    const cfg = tutorialBus.getL11Config();
    const prepared = l11PreparedRef.current;
    if (
      stepIndex === 0 &&
      cfg &&
      prepared &&
      cfg.includeZero &&
      !cfg.includeWild &&
      [9, 10, 11, 12].includes(cfg.target)
    ) {
      l11LastResultRef.current = cfg.target;
      return { cfg, prepared };
    }
    if (
      stepIndex === 1 &&
      cfg &&
      prepared &&
      !cfg.includeZero &&
      cfg.includeWild &&
      [15, 18, 20, 25].includes(cfg.target)
    ) {
      l8Step3LastTargetRef.current = cfg.target;
      return { cfg, prepared };
    }

    if (stepIndex === 0) {
      const targets = [9, 10, 11, 12];
      let target = targets[Math.floor(Math.random() * targets.length)];
      while (targets.length > 1 && target === l11LastResultRef.current) {
        target = targets[Math.floor(Math.random() * targets.length)];
      }
      l11LastResultRef.current = target;
      const nextPrepared = buildPreparedPairExercise(target);
      const [addA, addB] = nextPrepared.pair;
      const nextCfg = { addA, addB, target, includeZero: true, includeWild: false };
      tutorialBus.setL11Config(nextCfg);
      l11PreparedRef.current = nextPrepared;
      return { cfg: nextCfg, prepared: nextPrepared };
    }

    const pool = [15, 18, 20, 25];
    let target = pool[Math.floor(Math.random() * pool.length)];
    while (pool.length > 1 && (target === l8Step3LastTargetRef.current || target === l11LastResultRef.current)) {
      target = pool[Math.floor(Math.random() * pool.length)];
    }
    l8Step3LastTargetRef.current = target;
    const nextPrepared = buildPreparedPairExercise(target);
    const wildValue = target >= 20 ? 4 : target >= 16 ? 3 : 2;
    const pairTarget = target - wildValue;
    const addA = Math.max(1, Math.floor(pairTarget / 2));
    const addB = pairTarget - addA;
    const nextCfg = { addA, addB, target, includeZero: false, includeWild: true, wildValue };
    tutorialBus.setL11Config(nextCfg);
    l11PreparedRef.current = nextPrepared;
    return { cfg: nextCfg, prepared: nextPrepared };
  };
  const [l11ZeroGiftApproved, setL11ZeroGiftApproved] = useState(false);
  const [l8RolledBeforeIdentical, setL8RolledBeforeIdentical] = useState(false);
  const [l9IntroApproved, setL9IntroApproved] = useState(false);
  const [l9IntroPendingAdvance, setL9IntroPendingAdvance] = useState(false);
  // Skip counter: counts presses of "׳“׳׳'" during bot-demo or await-mimic phases
  // (the two phases where the learner is expected to watch or act). If > 2,
  // the core-complete popup shows "no coins" instead of the 10-coin reward.
  const [skipCount, setSkipCount] = useState(0);
  const [showWelcomeBubble, setShowWelcomeBubble] = useState(true);
  // Persistent count of tutorial runs where coins were actually earned.
  // Caps at 2 ג€” registered-user infrastructure: once a user has earned
  // tutorial coins twice, subsequent completions show "no coins".
  const TUTORIAL_COINS_KEY = 'lulos_tutorial_coins_earned_count';
  const [tutorialCoinsEarnedCount, setTutorialCoinsEarnedCount] = useState(0);
  const [tutorialCoinsLoaded, setTutorialCoinsLoaded] = useState(false);
  const [coreRewardOutcome, setCoreRewardOutcome] = useState<TutorialRewardOutcome | null>(null);
  const [advancedRewardOutcome, setAdvancedRewardOutcome] = useState<TutorialRewardOutcome | null>(null);
  const coreCompleteProcessedRef = useRef(false);
  useEffect(() => {
    void AsyncStorage.getItem(TUTORIAL_COINS_KEY)
      .then((val) => {
        const n = parseInt(val ?? '0', 10);
        setTutorialCoinsEarnedCount(isNaN(n) ? 0 : n);
      })
      .finally(() => {
        setTutorialCoinsLoaded(true);
      });
  }, []);
  useEffect(() => {
    if (engine.phase !== 'idle') return;
    coreCompleteProcessedRef.current = false;
    advancedCompleteProcessedRef.current = false;
    setCoreRewardOutcome(null);
    setAdvancedRewardOutcome(null);
  }, [engine.phase]);
  useEffect(() => {
    if (engine.phase !== 'core-complete') return;
    if (coreCompleteProcessedRef.current) return;
    if (!tutorialCoinsLoaded) return;
    coreCompleteProcessedRef.current = true;
    const outcome = getTutorialRewardOutcome({
      skipCount,
      earnedCount: tutorialCoinsEarnedCount,
    });
    setCoreRewardOutcome(outcome);
    if (outcome !== 'awarded') return;
    setTutorialCoinsEarnedCount((prev) => {
      const next = prev + 1;
      void AsyncStorage.setItem(TUTORIAL_COINS_KEY, String(next));
      void supabase.rpc('award_coins', { p_amount: SALINDA_TUTORIAL_REWARDS.basic, p_source: 'tutorial_core' });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.phase, skipCount, tutorialCoinsEarnedCount, tutorialCoinsLoaded]);

  // ג”€ג”€ Advanced-tutorial completion: award 20 coins when all advanced lessons done ג”€ג”€
  const advancedCompleteProcessedRef = useRef(false);
  useEffect(() => {
    if (engine.phase !== 'advanced-complete') return;
    if (advancedCompleteProcessedRef.current) return;
    if (!tutorialCoinsLoaded) return;
    advancedCompleteProcessedRef.current = true;
    const outcome = getTutorialRewardOutcome({
      skipCount,
      earnedCount: tutorialCoinsEarnedCount,
    });
    setAdvancedRewardOutcome(outcome);
    if (outcome !== 'awarded') return;
    setTutorialCoinsEarnedCount((prev) => {
      const next = prev + 1;
      void AsyncStorage.setItem(TUTORIAL_COINS_KEY, String(next));
      void supabase.rpc('award_coins', { p_amount: SALINDA_TUTORIAL_REWARDS.advanced, p_source: 'tutorial_advanced' });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.phase, skipCount, tutorialCoinsEarnedCount, tutorialCoinsLoaded]);


  // ג”€ג”€ Lesson 5c (solve-for-op) state ג”€ג”€
  // Two pre-generated exercises; learner must pick the sign that makes each
  // equation true and press "Confirm". `l5ExIndex` is the 0-based pointer
  // (2 = both solved, outcome fires). Wrong-confirm feedback rides on the
  // shared `wrongAttemptTick` shake/bubble wiring used by earlier lessons.
  type L5Ex = { a: number; b: number; op: L5Op; result: number };
  const [l5Exercises, setL5Exercises] = useState<L5Ex[]>([]);
  const [l5ExIndex, setL5ExIndex] = useState<0 | 1 | 2>(0);

  // ג”€ג”€ Lesson 5.2 (operator pick & place) state ג”€ג”€
  // Two exercises: first minus (e.g. 6גˆ'3), then plus (e.g. 4+5), with fresh
  // random numbers each run. The learner has to pick the matching operator
  // card from the fan and drop it on the op1 slot ג€” same mechanic as in the
  // real game (PLACE_EQ_OP). `l5OpPickIndex` is the 0-based pointer
  // (2 = both solved ג†' step outcome fires). The transient feedback banner
  // mirrors solve-for-op but is scoped to pick-place so the two steps don't
  // share state.
  type L5OpPickEx = { a: number; b: number; op: '+' | '-' };
  const [l5OpPickExercises, setL5OpPickExercises] = useState<L5OpPickEx[]>([]);
  const [l5OpPickIndex, setL5OpPickIndex] = useState<0 | 1 | 2>(0);
  const [l5OpPickFeedback, setL5OpPickFeedback] = useState<null | 'correct' | 'wrong'>(null);

  // Random exercise generator ג€” minus first (a ג‰¥ b + 1, result ג‰¥ 1) then plus
  // (1..6 both). Operations are fixed per slot (the lesson teaches minus AND
  // plus card placement specifically ג€” see spec in docs).
  const generateL5OpPickExercises = (): L5OpPickEx[] => {
    const aMinus = 3 + Math.floor(Math.random() * 7); // 3..9
    const bMinus = 1 + Math.floor(Math.random() * (aMinus - 1)); // 1..aMinus-1 ג†' a-b ג‰¥ 1
    const aPlus = 1 + Math.floor(Math.random() * 6); // 1..6
    const bPlus = 1 + Math.floor(Math.random() * 6); // 1..6
    return [
      { a: aMinus, b: bMinus, op: '-' },
      { a: aPlus, b: bPlus, op: '+' },
    ];
  };

  // Rig the underlying game for a single pick-place exercise: clear the
  // equation, roll dice to the exercise's (a, b) + a random d3, give the
  // learner a fresh 4-card hand with all four operator cards, then pre-
  // fill the two dice slots so the equation shows `[a] [?] [b] ג€¦ = ?`.
  // The learner's job is to drop the matching operator on the `?` slot.
  const rigL5OpPickExercise = (ex: L5OpPickEx): void => {
    // Clear any leftover placement from a prior exercise (PLACE_EQ_OP still
    // holds the card reference in equationHandSlots even after eqReset).
    gameDispatch({ type: 'CLEAR_EQ_HAND' });
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    const d3 = 1 + Math.floor(Math.random() * 6);
    gameDispatch({
      type: 'TUTORIAL_SET_DICE',
      values: { die1: ex.a, die2: ex.b, die3: d3 },
    });
    const ts = Date.now();
    const playerHand = [
      { id: `tut-l5op-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
      { id: `tut-l5op-minus-${ts}`, type: 'operation' as const, operation: '-' as const },
      { id: `tut-l5op-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
      { id: `tut-l5op-divide-${ts}`, type: 'operation' as const, operation: '÷' as const },
    ];
    const botHand = [
      { id: `tut-l5op-bot-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
      { id: `tut-l5op-bot-minus-${ts}`, type: 'operation' as const, operation: '-' as const },
      { id: `tut-l5op-bot-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
      { id: `tut-l5op-bot-divide-${ts}`, type: 'operation' as const, operation: '÷' as const },
    ];
    // Learner's hand at index 0 (currentPlayerIndex during L5) so the fan
    // always shows the learner's own cards.
    gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [playerHand, botHand] });
    // Pre-fill d1 and d2 after React commits TUTORIAL_SET_DICE ג€” without the
    // gap, eqPickDice reads stale dice values and the picks clobber each
    // other (see L5a prefill logic).
    setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 0 }), 140);
    setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 1 }), 280);
  };

  // Curated (a, b) pairs where all 4 operations yield integers. Pick one at
  // random when lesson 5 starts so the learner sees different numbers each
  // run. `a >= b >= 2` and `a % b === 0` guarantees `a / b` is a whole number
  // and `a - b >= 0` so subtraction never produces a negative.
  const L5_PAIRS: ReadonlyArray<{ a: number; b: number }> = [
    { a: 4, b: 2 }, { a: 6, b: 2 }, { a: 6, b: 3 },
    { a: 8, b: 2 }, { a: 8, b: 4 }, { a: 9, b: 3 },
    { a: 10, b: 2 }, { a: 10, b: 5 }, { a: 12, b: 3 },
    { a: 12, b: 4 }, { a: 12, b: 6 },
  ];
  const pickL5Pair = (): { a: number; b: number } =>
    L5_PAIRS[Math.floor(Math.random() * L5_PAIRS.length)];
  const computeL5Result = (a: number, b: number, op: L5Op | null): number | null => {
    if (op === null) return null;
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === 'x') return a * b;
    if (op === '÷') return b === 0 ? null : a / b;
    return null;
  };
  // Generate two lesson-5c exercises with different ops so the learner
  // doesn't get the same sign twice. Pairs are sampled from L5_PAIRS; for
  // each pair the chosen op + a/b are used to pre-compute the target result
  // (always an integer because L5_PAIRS is curated).
  const generateL5Exercises = (): L5Ex[] => {
    const allOps: L5Op[] = ['+', '-', 'x', '÷'];
    const ops = [...allOps].sort(() => Math.random() - 0.5).slice(0, 2);
    return ops.map((op) => {
      const { a, b } = pickL5Pair();
      const result = computeL5Result(a, b, op)!;
      return { a, b, op, result };
    });
  };

  // ג”€ג”€ Start the engine on mount + ensure SFX are loaded (StartScreen
  //    normally initializes them, but the tutorial skips StartScreen). ג”€ג”€
  useEffect(() => {
    dispatchEngine({ type: 'START' });
    void initializeSfx();
    // Pre-generate dice for lesson 4 so lesson 3's roll shows the SAME
    // values the equation lesson will use.
    if (!l4DiceRef.current) {
      l4DiceRef.current = rollL4Dice();
    }
  }, []);

  // ג”€ג”€ Keep SFX mute state in sync with game's soundsEnabled. StartScreen
  //    and GameScreen each do this in their own useEffect, but neither is
  //    always mounted during the tutorial (lessons 1ג€“3 skip GameScreen). ג”€ג”€
  useEffect(() => {
    setSfxMuted(gameState?.soundsEnabled === false);
  }, [gameState?.soundsEnabled]);

  // ג”€ג”€ Auto-dismiss the intro phase ג€” but only after the welcome screen is confirmed. ג”€ג”€
  useEffect(() => {
    if (engine.phase !== 'intro') return;
    if (showWelcomeBubble) return;
    if (engine.lessonIndex === 5 && engine.stepIndex === 2) {
      return;
    }
    dispatchEngine({ type: 'DISMISS_INTRO' });
  }, [engine.lessonIndex, engine.phase, engine.stepIndex, showWelcomeBubble]);

  // ג”€ג”€ External exit request (game's own red "׳™׳¦׳™׳׳”" header button) ג”€ג”€
  useEffect(() => {
    return tutorialBus.subscribeRequestExit(() => {
      dispatchEngine({ type: 'EXIT' });
      onExit();
    });
  }, [onExit]);

  // ג”€ג”€ lesson-done is invisible ג€” celebrate already announced success.
  //    Progress to the next lesson immediately. ג”€ג”€
  useEffect(() => {
    if (engine.phase !== 'lesson-done') return;
    dispatchEngine({ type: 'DISMISS_LESSON_DONE' });
  }, [engine.phase, engine.lessonIndex]);

  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX) {
    }
  }, [engine.lessonIndex]);

  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_MULTI_PLAY_LESSON_INDEX || engine.stepIndex !== 1) {
      setL11MockupApproved(false);
      setL11MockupPendingAdvance(false);
      return;
    }
    if (engine.phase === 'intro') {
      setL11MockupApproved(false);
      setL11MockupPendingAdvance(false);
    }
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_MULTI_PLAY_LESSON_INDEX || engine.stepIndex !== 1) {
      setL11ZeroGiftApproved(false);
      return;
    }
    if (engine.phase === 'intro' || engine.phase === 'bot-demo') {
      setL11ZeroGiftApproved(false);
    }
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ג”€ג”€ Clear card frames + reset all tutorial state whenever a new step
  //    begins (phase=intro). This handles lesson transitions, GO_BACK,
  //    and ensures refs are re-armed so the lesson can boot fresh. ג”€ג”€
  useEffect(() => {
    if (engine.phase !== 'intro') return;
    const isFracLesson =
      engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
      engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
    tutorialBus.emitFanDemo({ kind: 'clearCardFrame' });
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    if (isFracLesson) {
      tutorialBus.emitFanDemo({ kind: 'closeResultsChip' });
      gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: false });
    } else if (engine.lessonIndex === 5) {
      // L6 (possible-results) back-nav: close the chip and clear the solve chip
      // so the UI reflects the reset. Without this, the mini-strip stays open
      // and the SolveExerciseChip stays visible, making back-nav look like a no-op.
      tutorialBus.emitFanDemo({ kind: 'closeResultsChip' });
      tutorialBus.emitFanDemo({ kind: 'clearSolveExerciseChip' });
      tutorialBus.setL6CopyConfig(null);
    }
    // eqReset only clears the EquationBuilder's local dice/op state. Any
    // operator or joker card the learner placed into equationHandSlots in
    // the previous step (e.g. L5.2's joker on an op slot) is still held in
    // game state, and the L5.1 self-prefill bails out while any slot is
    // non-null ג€” producing the "empty equation, `?` sign" on GO_BACK into
    // L5.1. CLEAR_EQ_HAND is idempotent for lessons that don't populate
    // these slots, so it's safe to always dispatch on lesson-intro.
    gameDispatch({ type: 'CLEAR_EQ_HAND' });
    // Skip REVERT_TO_BUILDING for lesson-10 step 1 (the exercise): its own
    // l8Step3RiggedRef bot-demo rig will immediately set up TUTORIAL_FORCE_SOLVED,
    // so reverting to building is an unnecessary phase cycle that triggers
    // building-phase effects (onb hints, etc.) during the brief transition.
    const isL11ExerciseStep =
      engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX &&
      (engine.stepIndex === 0 || engine.stepIndex === 1);
    if (!isFracLesson && !isL11ExerciseStep && gameState?.phase === 'solved') {
      gameDispatch({ type: 'REVERT_TO_BUILDING' });
    }
    // If GO_BACK left the game in turn-transition, push it forward so the
    // equation builder becomes visible again. Calling BEGIN_TURN from
    // 'building' would wrongly advance the turn and hide the equation ג€”
    // so we only trigger this when already in turn-transition.
    if (!isFracLesson && gameState?.phase === 'turn-transition') {
      gameDispatch({ type: 'BEGIN_TURN' });
    }
    // Reset dice lesson state so the gold button re-appears on GO_BACK.
    setTutorialDice(null);
    setL3TipApproved(false);
    setL5aSignTipApproved(false);
    // Only regenerate L4 dice when going BACKWARDS (engine.lessonIndex
    // went down). Going forward (lesson 3 ג†' 4) must keep the same dice
    // the user already saw in lesson 3.
    // lessonIndex < 3 = going backward (dice/tap/fan lesson). lessonIndex === 3
    // means arriving at the equation lesson going FORWARD — keep the dice
    // the user already saw in the dice lesson so they match the equation.
    if (engine.lessonIndex < 3) {
      l4DiceRef.current = rollL4Dice();
    }
    // Re-arm lesson 4 refs so BEGIN_TURN + ROLL_DICE re-fire when needed.
    eqLessonAdvancedRef.current = false;
    eqLessonHandRiggedRef.current = false;
    // Clear result announcement if lingering.
    setResultAnnouncement(null);
    if (engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX) {
      // Clear stale copy-config on back navigation.
      // Full game state setup is handled by the bot-demo rigging effect.
      tutorialBus.setL6CopyConfig(null);
    } else if (isFracLesson) {
      gameDispatch(buildFractionTutorialSetup(engine.stepIndex, Date.now()));
    }
  }, [engine.phase, engine.lessonIndex, engine.stepIndex, gameState?.phase, gameDispatch]);

  // ג”€ג”€ Bot-demo re-entry reset: fires on every bot-demo entry so that
  //    GO_BACK_LAYER (await-mimic ג†' bot-demo) replays the demo cleanly. ג”€ג”€
  useEffect(() => {
    if (engine.phase !== 'bot-demo') return;
    tutorialBus.setL4bDicePulse(false);
    setL4Step3Phase('build');
    const isL6PossibleResults =
      engine.lessonIndex === 5 &&
      (engine.stepIndex === 0 || engine.stepIndex === 1);
    if (!isL6PossibleResults) {
      tutorialBus.emitFanDemo({ kind: 'eqReset' });
    }
    // L6.3 (wild-finish) keeps TUTORIAL_FORCE_SOLVED intact so the game stays
    // in 'solved' with equationResult set — the bot demo fills dice slots into
    // that solved state and the user then picks cards directly.
    const isL6Wild = engine.lessonIndex === 5 && engine.stepIndex === 2;
    if (gameState?.phase === 'solved' && !isL6Wild && !isL6PossibleResults) {
      gameDispatch({ type: 'REVERT_TO_BUILDING' });
    }
  }, [engine.phase, engine.lessonIndex, engine.stepIndex, gameState?.phase, gameDispatch]);

  // ג”€ג”€ Frac-lesson steps 1+: rig game state at bot-demo entry.
  //    The MimicEngine goes celebrate ג†' bot-demo (stepIndex+1) directly,
  //    skipping intro, so the intro effect above never fires for steps 1+.
  //    Step 0 is already handled by the intro effect above ג€” skip it here. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_FIRST_FRACTION_LESSON_INDEX) {
      fracBotDemoRiggedRef.current = -1;
      return;
    }
    if (engine.phase !== 'bot-demo') {
      fracBotDemoRiggedRef.current = -1;
      return;
    }
    if (engine.stepIndex === 0) return;
    if (fracBotDemoRiggedRef.current === engine.stepIndex) return;
    fracBotDemoRiggedRef.current = engine.stepIndex;
    gameDispatch(buildFractionTutorialSetup(engine.stepIndex, Date.now()));
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // ג”€ג”€ Boot underlying game once on mount ג”€ג”€
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    if (gameState?.phase !== 'setup') return;
    bootedRef.current = true;
    gameDispatch({
      type: 'START_GAME',
      players: [
        { name: locale === 'he' ? 'בוט מורה' : 'Coach Bot' },
        { name: locale === 'he' ? 'אתה' : 'You' },
      ],
      difficulty: 'easy',
      mode: 'pass-and-play',
      isTutorial: true,
      fractions: false,
      showPossibleResults: false,
      showSolveExercise: false,
      enabledOperators: ['+'],
      mathRangeMax: 12,
      timerSetting: 'off' as const,
      timerCustomSeconds: 60,
      difficultyStage: 'A',
    });
  }, [gameState?.phase, gameDispatch, locale]);

  // ג”€ג”€ Lesson 3 (dice) is handled entirely inside the tutorial overlay
  //    (its own button + dice display). We don't advance the underlying
  //    game phase ג€” that kept leaking real-game UI through the curtain.
  //    Phases:
  //      intro / bot-demo / await-mimic: tutorialDice is null so the
  //        GoldDiceButton remains visible. In await-mimic it becomes
  //        interactive ג€” the learner must tap it to roll.
  //      celebrate onward: the celebrate-phase effect (below) sets
  //        tutorialDice so the dice faces stay visible during the bubble. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== 2 || engine.stepIndex !== 0) return;
    const l4 = l4DiceRef.current ?? rollL4Dice();
    l4DiceRef.current = l4;
    // Keep button visible for intro, bot-demo, and await-mimic (user must tap).
    if (engine.phase === 'intro' || engine.phase === 'bot-demo' || engine.phase === 'await-mimic') {
      setTutorialDice(null);
      return;
    }
    setTutorialDice({ d1: l4.d1, d2: l4.d2, d3: l4.d3 });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ג”€ג”€ Rig the user's hand with sample cards once the game is in pre-roll ג”€ג”€
  const handsRiggedRef = useRef(false);
  useEffect(() => {
    if (handsRiggedRef.current) return;
    if (!gameState?.players || gameState.players.length < 2) return;
    if (gameState.phase !== 'turn-transition' && gameState.phase !== 'pre-roll') return;
    handsRiggedRef.current = true;
    const dice = gameState.dice ?? { die1: 3, die2: 4, die3: 2 };
    const handConfig: Parameters<typeof generateTutorialHand>[1] = {
      index: 0,
      titleKey: 'tutorial.l1.title',
      descKey: 'tutorial.l1.desc',
      enabledOperators: ['+'],
      showFractions: false,
      maxRange: 12,
      requiredSpecials: [],
      freePlay: false,
      botSteps: [],
      userSteps: [],
    };
    const result = generateTutorialHand(dice, handConfig, 0);
    gameDispatch({
      type: 'TUTORIAL_SET_HANDS',
      hands: [result.botHand, result.playerHand],
      ...(result.discardTop ? { discardPile: [result.discardTop] } : {}),
    });
  }, [gameState?.phase, gameState?.players, gameDispatch]);

  // ג”€ג”€ TurnTransition deliberately hides the "I'm ready" button when
  //    `state.isTutorial` (see index.tsx TurnTransition). Without an auto
  //    BEGIN_TURN the game can stay in `turn-transition` forever ג€” no fan on
  //    the transition screen path, or lesson 2 await-mimic never sees taps
  //    on the same stack as the full PlayerHand. Skip straight to pre-roll. ג”€ג”€
  useEffect(() => {
    if (!gameState?.isTutorial || gameState.phase !== 'turn-transition') return;
    // Don't auto-advance during any post-core lesson celebrate ג€” the rig
    // restores game state when the engine leaves celebrate. Firing BEGIN_TURN
    // here would move to pre-roll while the celebrate bubble is still showing.
    if (
      engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
      engine.phase === 'celebrate'
    ) return;
    gameDispatch({ type: 'BEGIN_TURN' });
  }, [gameState?.isTutorial, gameState?.phase, engine.lessonIndex, engine.phase, gameDispatch]);

  // ג”€ג”€ Identical-card lesson: auto-dismiss the identicalAlert modal so the
  //    tutorial never shows the "player X placed card Y" overlay.
  //    Exception: MIMIC_SINGLE_IDENTICAL_LESSON_INDEX step 1 (the teaching
  //    step) ג€” let the alert show so the learner gets visual feedback. ג”€ג”€
  useEffect(() => {
    if (!gameState?.identicalAlert) return;
    if (
      engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX &&
      engine.lessonIndex !== MIMIC_SINGLE_IDENTICAL_LESSON_INDEX
    ) return;
    gameDispatch({ type: 'DISMISS_IDENTICAL_ALERT' });
  }, [gameState?.identicalAlert, engine.lessonIndex, engine.stepIndex, gameDispatch]);

  // Lesson 4 step 2 (fill-missing-die) needs its own fresh exercise so the
  // learner doesn't inherit the prior step's hand/target. Rig it before the
  // bot demo starts so the demo and the await-mimic phase both read the same
  // fresh config.
  useEffect(() => {
    const isL4Step1 = engine.lessonIndex === 3 && engine.stepIndex === 1;
    if (!isL4Step1) {
      l4Step1RiggedRef.current = false;
      return;
    }
    if (engine.phase === 'intro' || engine.phase === 'idle') {
      l4Step1RiggedRef.current = false;
      return;
    }
    if (engine.phase !== 'bot-demo' && engine.phase !== 'await-mimic') return;
    if (!gameState?.players || gameState.players.length < 2) return;
    if (l4Step1RiggedRef.current) return;

    l4Step1RiggedRef.current = true;
    const l4 = rollL4Dice();
    l4DiceRef.current = l4;
    tutorialBus.setLastEquationResult(null);
    tutorialBus.emitFanDemo({ kind: 'clearCardFrame' });
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    gameDispatch({ type: 'CLEAR_EQ_HAND' });
    if (gameState.phase === 'solved') {
      gameDispatch({ type: 'REVERT_TO_BUILDING' });
    }

    const { d1, d2, d3, pickA, pickB, target, hand, validSums } = l4;
    tutorialBus.setL4Config({ pickA, pickB, target, hand, validSums });

    const ts = Date.now();
    const handCards = hand.map((value) => ({
      id: `tut-l4-card-${value}-${ts}`,
      type: 'number' as const,
      value,
    }));
    const botCards = hand.map((value) => ({
      id: `tut-l4-bot-card-${value}-${ts}`,
      type: 'number' as const,
      value,
    }));
    gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [botCards, handCards] });
    if (gameState.phase === 'pre-roll') {
      gameDispatch({ type: 'ROLL_DICE', values: { die1: d1, die2: d2, die3: d3 } });
    } else {
      gameDispatch({ type: 'TUTORIAL_SET_DICE', values: { die1: d1, die2: d2, die3: d3 } });
    }
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameState?.phase, gameState?.players, gameDispatch]);

  // ג”€ג”€ Run bot demo when phase=bot-demo. The scripted async chain advances
  //    naturally; a 6s safety timer also fires BOT_DEMO_DONE in case the
  //    chain stalls (e.g. WebView/Audio init holding the JS thread). ג”€ג”€
  useEffect(() => {
    if (engine.phase !== 'bot-demo') return;
    const lesson = LESSONS[engine.lessonIndex];
    const step = lesson?.steps[engine.stepIndex];
    if (!step) return;
    // Pass the `cancelled` flag through so bus emits from a skipped-past
    // bot-demo (e.g. L4's eqPickDice chain still waiting out a 2800ms
    // pause) cannot leak forward into the next step's UI after the user
    // hits "׳“׳׳'". Without this, L4's `eqPickDice(pickA)` / `eqPickDice(pickB)`
    // could fire while the learner is already on L5.1, clobbering its
    // pre-filled `4 ? 3 = 7` with stale indices (producing e.g. `4 + 9 = 13`).
    let cancelled = false;
    const demo = createBotDemonstrator(() => cancelled);
    let fired = false;
    const fireOnce = () => {
      if (cancelled || fired) return;
      if (
        engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
        engine.stepIndex === 0 &&
        !parensMockupApproved
      ) {
        setParensMockupPendingAdvance(true);
        return;
      }
      if (
        engine.lessonIndex === MIMIC_SINGLE_IDENTICAL_LESSON_INDEX &&
        engine.stepIndex === 0 &&
        !identicalMockupApproved
      ) {
        setIdenticalMockupPendingAdvance(true);
        return;
      }
      if (
        engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX &&
        engine.stepIndex === 1 &&
        !l11MockupApproved
      ) {
        setL11MockupPendingAdvance(true);
        return;
      }
      if (engine.lessonIndex === 5 && engine.stepIndex === 1) {
        fired = true;
        setL6MiniDemoPendingAdvance(true);
        return;
      }
      fired = true;
      dispatchEngine({ type: 'BOT_DEMO_DONE' });
    };
    (async () => {
      try {
        await step.botDemo(demo);
      } catch (e) {
        if (__DEV__) console.warn('[tutorial] botDemo failed', e);
      }
      fireOnce();
    })();
    const fallback = setTimeout(fireOnce, 6000);
    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, [engine.phase, engine.lessonIndex, engine.stepIndex, parensMockupApproved, identicalMockupApproved, l11MockupApproved]);

  useEffect(() => {
    const isL6MiniBotDemo =
      engine.lessonIndex === 5 &&
      engine.stepIndex === 1 &&
      engine.phase === 'bot-demo';
    if (!isL6MiniBotDemo) {
      setL6MiniDemoPendingAdvance(false);
    }
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ג”€ג”€ Listen for user mimic when phase=await-mimic ג”€ג”€
  useEffect(() => {
    if (engine.phase !== 'await-mimic') return;
    const lesson = LESSONS[engine.lessonIndex];
    const step = lesson?.steps[engine.stepIndex];
    if (!step) return;
    const isL4Step3 = engine.lessonIndex === 3 && engine.stepIndex === 3;
    const isL4CardMatchOnly = engine.lessonIndex === 3 && (engine.stepIndex === 0 || engine.stepIndex === 1);
    // Lesson 5 is a two-step placement lesson ג€” fan taps are always the
    // intended first action (pick an operator card in 5.1, tap the joker
    // in 5.2), so they should NEVER trigger the "wrong answer" shake.
    const isL5 = engine.lessonIndex === 4;
    const isL11 = engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX;
    // Lesson 7 (fractions): card taps flow through a separate validator
    // that emits `fracAttackPlayed`/`fracDefenseSolved` on success ג€” the
    // raw `cardTapped` event fires either way, so suppressing the shake
    // prevents a "try again" flash on what turned out to be a legal play.
    const isL7 = engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (step.outcome(evt)) {
        dispatchEngine({ type: 'OUTCOME_MATCHED' });
        return;
      }
      // Lesson-4 step-3 taps are staging actions, not "wrong answers" ג€” the
      // step advances when the learner hits "׳'׳—׳¨׳×׳™", so suppress the shake.
      if (isL4Step3) return;
      if (isL5) return;
      if (isL11) return;
      if (isL7) return;
      // A WRONG card pick ג€” only flash "try again" for cardTapped events
      // that didn't match. Die picks (eqUserPickedDice) are valid
      // intermediate actions and should NEVER trigger "wrong".
      if (evt.kind === 'cardTapped') {
        if (isL4CardMatchOnly) {
          setL4CardMatchWrong(true);
          if (l4CardMatchWrongTimerRef.current) clearTimeout(l4CardMatchWrongTimerRef.current);
          l4CardMatchWrongTimerRef.current = setTimeout(() => {
            setL4CardMatchWrong(false);
            l4CardMatchWrongTimerRef.current = null;
          }, 1600);
        }
        setWrongAttemptTick((n) => n + 1);
      }
    });
  }, [engine.phase, engine.lessonIndex, engine.stepIndex]);

  useEffect(() => {
    const isL4bAwait = engine.lessonIndex === 3 && engine.stepIndex === 1 && engine.phase === 'await-mimic';
    if (!isL4bAwait) {
      setL4bHintPhase('pickDie');
      return;
    }
    setL4bHintPhase('pickDie');
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind === 'eqUserPickedDice') {
        setL4bHintPhase('pickCard');
      }
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  useEffect(() => {
    const on =
      engine.lessonIndex === 3 &&
      (engine.stepIndex === 0 || engine.stepIndex === 1) &&
      engine.phase === 'await-mimic';
    tutorialBus.setL4CardMatchOnlyMode(on);
    if (!on) {
      setL4CardMatchWrong(false);
      if (l4CardMatchWrongTimerRef.current) {
        clearTimeout(l4CardMatchWrongTimerRef.current);
        l4CardMatchWrongTimerRef.current = null;
      }
    }
    return () => tutorialBus.setL4CardMatchOnlyMode(false);
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  useEffect(() => {
    const isL4CardMatchOnly =
      engine.lessonIndex === 3 &&
      (engine.stepIndex === 0 || engine.stepIndex === 1) &&
      engine.phase === 'await-mimic';
    if (!isL4CardMatchOnly || gameState?.message !== t('tutorial.l4c.tryAgain')) return;
    setL4CardMatchWrong(true);
    if (l4CardMatchWrongTimerRef.current) clearTimeout(l4CardMatchWrongTimerRef.current);
    l4CardMatchWrongTimerRef.current = setTimeout(() => {
      setL4CardMatchWrong(false);
      l4CardMatchWrongTimerRef.current = null;
    }, 1600);
    return () => {
      if (l4CardMatchWrongTimerRef.current) {
        clearTimeout(l4CardMatchWrongTimerRef.current);
        l4CardMatchWrongTimerRef.current = null;
      }
    };
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameState?.message, t]);

  // ג”€ג”€ Lesson 4 step 2 (fill-missing-die): pulse unplaced dice during await-mimic. ג”€ג”€
  useEffect(() => {
    const isL4b = engine.lessonIndex === 3 && engine.stepIndex === 1 && engine.phase === 'await-mimic';
    tutorialBus.setL4bDicePulse(isL4b);
    return () => tutorialBus.setL4bDicePulse(false);
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ג”€ג”€ Lesson 4 step 3 (guided full build): keep the real game UI live,
  //    but reset the local orchestration each time the step re-enters
  //    (e.g. after GO_BACK). The equation itself reuses the same rigged hand. ג”€ג”€
  useEffect(() => {
    const isL4Step3 = engine.lessonIndex === 3 && engine.stepIndex === 3 && engine.phase === 'await-mimic';
    if (isL4Step3) {
      tutorialBus.emitFanDemo({ kind: 'eqReset' });
      tutorialBus.setL4Step3Mode(true);
      tutorialBus.setL4GuidedEqValidationMode(true);
      setL4Step3Phase('intro');
      setL4Step3IntroApproved(false);
      setL4Step3FinishApproved(false);
      l4Step3DicePickCountRef.current = 0;
      l4Step3OperatorPickedRef.current = false;
      if (l4Step3WrongTimerRef.current) {
        clearTimeout(l4Step3WrongTimerRef.current);
        l4Step3WrongTimerRef.current = null;
      }
      return () => {
        tutorialBus.setL4Step3Mode(false);
        tutorialBus.setL4GuidedEqValidationMode(false);
        if (l4Step3WrongTimerRef.current) {
          clearTimeout(l4Step3WrongTimerRef.current);
          l4Step3WrongTimerRef.current = null;
        }
      };
    }
    tutorialBus.setL4Step3Mode(false);
    tutorialBus.setL4GuidedEqValidationMode(false);
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // Keep botDemoActive in sync so index.tsx can block number-card taps mid-demo.
  useEffect(() => {
    tutorialBus.setBotDemoActive(engine.phase === 'bot-demo');
    return () => tutorialBus.setBotDemoActive(false);
  }, [engine.phase]);

  // Lesson 5 runs on the real game UI (EquationBuilder + joker modal).
  useEffect(() => {
    const on = engine.lessonIndex === 4 && (engine.phase === 'bot-demo' || engine.phase === 'await-mimic');
    tutorialBus.setL5GuidedMode(on);
    return () => tutorialBus.setL5GuidedMode(false);
  }, [engine.lessonIndex, engine.phase]);

  useEffect(() => {
    const on = engine.lessonIndex === 4 && engine.stepIndex === 1 && engine.phase === 'await-mimic';
    tutorialBus.setL5bJokerOnlyMode(on);
    return () => tutorialBus.setL5bJokerOnlyMode(false);
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // L5 is now a pure "place an operator card" lesson ג€” no cycle-on-tap. The
  // fan is the PRIMARY interaction target (learner picks a card from it), so
  // we explicitly DO NOT block fan taps. Cycling the `?` slot is blocked in
  // BOTH L5 steps so tapping the operator slot either places a held card or
  // does nothing ג€” it never flips the sign.
  useEffect(() => {
    const on =
      engine.lessonIndex === 4 &&
      (engine.phase === 'bot-demo' || engine.phase === 'await-mimic' || engine.phase === 'celebrate');
    tutorialBus.setL5BlockOpCycle(on);
    return () => tutorialBus.setL5BlockOpCycle(false);
  }, [engine.lessonIndex, engine.phase]);

  // L5.1 (place-op) AND L5.2 (joker-place): lock the pre-filled dice slots
  // so the learner can't accidentally empty the equation while searching
  // for the operator slot. `setL5aBlockFanTaps` drives that lock in
  // renderDiceSlot / unplaced-dice-button onPress. Leaves fan card taps
  // untouched ג€” the learner still needs to pick an operation card (or
  // Slinda) from the fan.
  // `setL5aTargetResult` pushes the target (d1+d2) into the result box so
  // both steps show the same goal: sign slot empty, target `= d1+d2`.
  // Note: this effect fires before the L5 rigging effect (declaration order),
  // so it reads the PREVIOUS run's l5DiceRef values. The L5 rigging corrects
  // this immediately after by calling setL5aTargetResult with the fresh dice.
  useEffect(() => {
    const on =
      engine.lessonIndex === 4 &&
      engine.stepIndex <= 1 &&
      (engine.phase === 'bot-demo' || engine.phase === 'await-mimic' || engine.phase === 'celebrate');
    // Step 0 is now pre-filled via explicit eqPickDice+eqSetOp emits in the
    // rigging block ג€” diceUnlocked stays false so the self-prefill effect
    // in index.tsx does not interfere (it would clear the slots on re-run).
    const diceUnlocked = false;
    tutorialBus.setL5aBlockFanTaps(on);
    tutorialBus.setL5aDiceUnlocked(diceUnlocked);
    tutorialBus.setL5aTargetResult(on ? (l5DiceRef.current.d1 + l5DiceRef.current.d2) : null);
    return () => {
      tutorialBus.setL5aBlockFanTaps(false);
      tutorialBus.setL5aDiceUnlocked(false);
      tutorialBus.setL5aTargetResult(null);
    };
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // L5.1 (place-op) outcome wiring lives in the lesson definition
  // (lesson-05-op-cycle.ts) ג€” `outcome: event.kind === 'l5OperatorPlaced'`.
  // The engine subscribes to user events globally; index.tsx emits the
  // event from renderOpBtn.onPress ג†' PLACE_EQ_OP, so nothing else is
  // needed here.

  // (L5a wrong-tap wiring was removed ג€” the new L5.1 flow MAKES fan taps
  // the correct first action, so there's nothing "wrong" about tapping a
  // card during this step.)

  // Optional fractions module: emit bus events for scripted outcomes.
  useEffect(() => {
    const isFrac =
      engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
      engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
    const on =
      isFrac &&
      engine.phase !== 'post-signs-choice' &&
      engine.phase !== 'core-complete' &&
      engine.phase !== 'all-done' &&
      engine.phase !== 'idle';
    tutorialBus.setFracGuidedMode(on);
    return () => tutorialBus.setFracGuidedMode(false);
  }, [engine.lessonIndex, engine.phase]);

  // Lesson 6 (possible-results) guided mode: keep dice/equation visible while
  // teaching the green possible-results button and mini-card strip.
  useEffect(() => {
    const on =
      engine.lessonIndex === 5 &&
      (engine.stepIndex === 0 || engine.stepIndex === 1) &&
      engine.phase !== 'idle';
    tutorialBus.setL6GuidedMode(on);
    if (on) {
      gameDispatch({ type: 'TUTORIAL_SET_ENABLED_OPERATORS', operators: ['+'] });
    }
    return () => tutorialBus.setL6GuidedMode(false);
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // Lesson 7 (parens-move) guided mode ג€” suppress auto-confirm while
  // parensRight=false and pulse the parens toggle button.
  useEffect(() => {
    // L7GuidedMode covers the full parens lesson (all phases) so the green
    // results-chip never pulses while the parens exercise is shown.
    const on = engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX;
    tutorialBus.setL7GuidedMode(on);
    return () => tutorialBus.setL7GuidedMode(false);
  }, [engine.lessonIndex, engine.phase]);

  // Parens lesson: tutorial boot uses enabledOperators=['+'] only ג€” keep all
  // four signs allowed in game state for validTargets + hasError, including
  // after bot-demo ג†' await-mimic (not only inside the one-shot rig effect).
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX) return;
    if (engine.phase !== 'bot-demo' && engine.phase !== 'await-mimic') return;
    gameDispatch({ type: 'TUTORIAL_SET_ENABLED_OPERATORS', operators: ['+', '-', 'x', '÷'] });
  }, [engine.lessonIndex, engine.phase, gameDispatch]);

  // Fractions lesson: keep possible-results chip hidden and closed throughout.
  useEffect(() => {
    const inFractionsLesson =
      engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
      engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
    if (!inFractionsLesson) return;
    tutorialBus.emitFanDemo({ kind: 'closeResultsChip' });
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: false });
  }, [engine.lessonIndex, engine.phase, engine.stepIndex, gameDispatch]);

  // Pulse halo around the discard pile while in the fractions lesson ג€” keeps
  // the learner's attention on the pile card (the teaching target) across
  // all attack/defense steps.
  useEffect(() => {
    if (engine.lessonIndex < MIMIC_FIRST_FRACTION_LESSON_INDEX ||
        engine.lessonIndex >= MIMIC_PARENS_LESSON_INDEX) {
      fracPilePulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fracPilePulse, { toValue: 1, duration: 480, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(120),
        Animated.timing(fracPilePulse, { toValue: 0, duration: 600, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(200),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [engine.lessonIndex, fracPilePulse]);

  // Fractions lesson: re-rig the pile + hand on EVERY step transition. The
  // generic `intro` useEffect above only fires once per lesson entry, but
  // our fractions steps expect different pile cards per step (step 2
  // wants 8, step 3 wants 9, steps 4-5 swap the pile for defense setups).
  // Without this, the learner stays on the step-0 pile (12) while the
  // bubble text references the step-specific value.
  const lastFracRigRef = useRef<string>('');
  useEffect(() => {
    if (engine.lessonIndex < MIMIC_FIRST_FRACTION_LESSON_INDEX ||
        engine.lessonIndex >= MIMIC_PARENS_LESSON_INDEX) {
      lastFracRigRef.current = '';
      return;
    }
    if (engine.phase !== 'bot-demo') return;
    const key = `${engine.lessonIndex}-${engine.stepIndex}`;
    if (lastFracRigRef.current === key) return;
    lastFracRigRef.current = key;
    gameDispatch(buildFractionTutorialSetup(engine.stepIndex, Date.now()));
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  useEffect(() => {
    // Joker-place is now stepIndex 1 (the new place-op step took over
    // stepIndex 0 and the old cycle-signs / pick-place / solve-for-op
    // steps were retired). Sub-hint flow: tap joker ג†' pick sign in modal
    // ג†' place on slot.
    const isL5bAwait = engine.lessonIndex === 4 && engine.stepIndex === 1 && engine.phase === 'await-mimic';
    if (!isL5bAwait) return;
    setL5FlowHintPhase('tapJoker');
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind === 'l5JokerModalOpened') setL5FlowHintPhase('pickModal');
      else if (evt.kind === 'l5JokerPickedInModal') setL5FlowHintPhase('placeSign');
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ג”€ג”€ L5.2 wrong-sign feedback: when Slinda is placed with a non-`+` op,
  //    clear the slot, reset the flow hint, and show an error bubble for 2s. ג”€ג”€
  useEffect(() => {
    setL5JokerWrong(false);
    if (l5JokerWrongTimerRef.current) clearTimeout(l5JokerWrongTimerRef.current);
    if (engine.lessonIndex !== 4 || engine.stepIndex !== 1 || engine.phase !== 'await-mimic') return;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind !== 'l5JokerFlowCompleted' || evt.op === '+') return;
      setL5JokerWrong(true);
      setL5FlowHintPhase('tapJoker');
      tutorialBus.emitFanDemo({ kind: 'eqReset' });
      gameDispatch({ type: 'CLEAR_EQ_HAND' });
      if (l5JokerWrongTimerRef.current) clearTimeout(l5JokerWrongTimerRef.current);
      l5JokerWrongTimerRef.current = setTimeout(() => setL5JokerWrong(false), 2000);
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // ג”€ג”€ Layout subscription: keep local rects in sync with the bus so the
  //    arrow re-renders whenever a button's position changes (first mount,
  //    orientation change, etc). ג”€ג”€
  useEffect(() => {
    setConfirmBtnRect(tutorialBus.getLayout('confirmEqBtn'));
    setPlayCardsBtnRect(tutorialBus.getLayout('playCardsBtn'));
    setSolveChipRect(tutorialBus.getLayout('solveChip'));
    return tutorialBus.subscribeLayout((key, rect) => {
      if (key === 'confirmEqBtn') setConfirmBtnRect(rect);
      else if (key === 'playCardsBtn') setPlayCardsBtnRect(rect);
      else if (key === 'solveChip') setSolveChipRect(rect);
    });
  }, []);

  // ג”€ג”€ Lesson 4 bounce-back: if CONFIRM_STAGED advances the turn during
  //    any lesson-4 step, the game enters 'turn-transition' and the
  //    EquationBuilder + fan disappear. Immediately bounce back to
  //    'building' so the tutorial screen stays intact. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== 3) return;
    if (gameState?.phase !== 'turn-transition') return;
    // Chain: turn-transition ג†' pre-roll ג†' building (with current dice).
    gameDispatch({ type: 'BEGIN_TURN' });
  }, [engine.lessonIndex, gameState?.phase, gameDispatch]);
  useEffect(() => {
    if (engine.lessonIndex !== 3) return;
    if (gameState?.phase !== 'pre-roll') return;
    // Re-rig with existing l4 dice to get back to building.
    const l4 = l4DiceRef.current;
    if (l4) {
      gameDispatch({ type: 'ROLL_DICE', values: { die1: l4.d1, die2: l4.d2, die3: l4.d3 } });
    }
  }, [engine.lessonIndex, gameState?.phase, gameDispatch]);

  // Lesson 5 step 3: tip/mockup overlay. Show it automatically, then wait
  // for the learner to press continue.
  useEffect(() => {
    if (engine.lessonIndex !== 4 || engine.stepIndex !== 2) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (engine.phase === 'bot-demo') {
      timer = setTimeout(() => dispatchEngine({ type: 'BOT_DEMO_DONE' }), 120);
    } else if (engine.phase === 'await-mimic' && l3TipApproved) {
      timer = setTimeout(() => dispatchEngine({ type: 'OUTCOME_MATCHED' }), 120);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, l3TipApproved]);

  // Lesson 3 step 2: automatically reveal a solved equation using the same
  // dice that lesson 4 will immediately reuse, then auto-advance.
  useEffect(() => {
    if (engine.lessonIndex !== 2 || engine.stepIndex !== 1) return;
    const l4 = l4DiceRef.current ?? rollL4Dice();
    l4DiceRef.current = l4;
    const dice = { die1: l4.d1, die2: l4.d2, die3: l4.d3 };
    const diceValues = [l4.d1, l4.d2, l4.d3];
    const equationDisplay = `${diceValues[l4.pickA] ?? l4.d1} + ${diceValues[l4.pickB] ?? l4.d2} = ${l4.target}`;
    const ts = Date.now();
    const playerHand = l4.hand.map((value, idx) => ({ id: `tut-l3-hand-${ts}-${idx}`, type: 'number' as const, value }));
    const botHand = playerHand.map((card, idx) => ({ ...card, id: `bot-${card.id}-${idx}` }));
    gameDispatch({
      type: 'TUTORIAL_FORCE_SOLVED',
      equationResult: l4.target,
      dice,
      equationDisplay,
      playerHand,
      botHand,
    });
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (engine.phase === 'bot-demo') {
      timer = setTimeout(() => dispatchEngine({ type: 'BOT_DEMO_DONE' }), 250);
    } else if (engine.phase === 'await-mimic') {
      timer = setTimeout(() => tutorialBus.emitUserEvent({ kind: 'l3SolvedAck' }), 1500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // Lesson 4 step 2 used to show an old full-screen "׳”׳™׳“׳¢׳×?" mockup that
  // is no longer relevant. Keep the step in the engine for numbering
  // stability, but auto-advance through it with no overlay.
  useEffect(() => {
    if (engine.lessonIndex !== 3 || engine.stepIndex !== 2) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (engine.phase === 'bot-demo') {
      timer = setTimeout(() => dispatchEngine({ type: 'BOT_DEMO_DONE' }), 120);
    } else if (engine.phase === 'await-mimic') {
      timer = setTimeout(() => dispatchEngine({ type: 'OUTCOME_MATCHED' }), 120);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ג”€ג”€ Lesson 4 step 3 sub-phase transitions driven by user events. ג”€ג”€
  useEffect(() => {
    const isL4Step3 = engine.lessonIndex === 3 && engine.stepIndex === 3 && engine.phase === 'await-mimic';
    if (!isL4Step3 || !l4Step3IntroApproved) return;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind === 'eqUserPickedDice') {
        const nextCount = Math.min(2, l4Step3DicePickCountRef.current + 1);
        l4Step3DicePickCountRef.current = nextCount;
        setL4Step3Phase(
          nextCount >= 2 && l4Step3OperatorPickedRef.current
            ? 'pickCard'
            : nextCount >= 2
              ? 'pickOperator'
              : 'pickSecondDie',
        );
        return;
      }
      if (evt.kind === 'opSelected') {
        l4Step3OperatorPickedRef.current = true;
        if (l4Step3DicePickCountRef.current >= 2) {
          setL4Step3Phase('pickCard');
        }
        return;
      }
      if (evt.kind === 'eqReadyToConfirm') {
        setL4Step3Phase('pickCard');
        return;
      }
      if (evt.kind === 'l4Step3CardAccepted') {
        if (l4Step3WrongTimerRef.current) {
          clearTimeout(l4Step3WrongTimerRef.current);
          l4Step3WrongTimerRef.current = null;
        }
        setL4Step3Phase('pressPlay');
        return;
      }
      if (evt.kind === 'l4Step3WrongCard') {
        if (l4Step3WrongTimerRef.current) clearTimeout(l4Step3WrongTimerRef.current);
        setL4Step3Phase('wrongCard');
        l4Step3WrongTimerRef.current = setTimeout(() => {
          setL4Step3Phase('pickCard');
          l4Step3WrongTimerRef.current = null;
        }, 1600);
      }
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, l4Step3IntroApproved]);

  // Run the shake + auto-clear whenever wrongAttemptTick increments.
  useEffect(() => {
    if (wrongAttemptTick === 0) return;
    wrongShakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(wrongShakeAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(wrongShakeAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(wrongShakeAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(wrongShakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => setWrongAttemptTick(0), 1600);
    return () => clearTimeout(t);
  }, [wrongAttemptTick, wrongShakeAnim]);

  // ג”€ג”€ Bus subscriptions for lesson-4 actions that need access to game
  //    state (stageCardByValue, eqReset ג†' REVERT_TO_BUILDING) and for
  //    the green-V confirm flash. ג”€ג”€
  useEffect(() => {
    return tutorialBus.subscribeFanDemo((cmd) => {
      if (cmd.kind === 'stageCardByValue') {
        const cp = gameState?.players?.[gameState.currentPlayerIndex];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const card = cp?.hand?.find((c: any) => c.type === 'number' && c.value === cmd.value);
        if (card) gameDispatch({ type: 'STAGE_CARD', card });
      } else if (cmd.kind === 'eqReset') {
        // Revert back to 'building' from 'solved' so the EquationBuilder
        // accepts new dice picks. Also unstage any staged card.
        if (gameState?.phase === 'solved') {
          gameDispatch({ type: 'REVERT_TO_BUILDING' });
        }
      } else if (cmd.kind === 'eqConfirm') {
        // Flash a green V on top of the equation-confirm button.
        setShowConfirmCheck(true);
        confirmCheckScale.setValue(0);
        Animated.spring(confirmCheckScale, { toValue: 1, friction: 5, tension: 130, useNativeDriver: true }).start();
        setTimeout(() => setShowConfirmCheck(false), 900);
        // Result announcement removed ג€” it was reading stale/incorrect
        // data and confusing the learner. The green result box + golden
        // halo on the equation builder already communicate the answer.
      }
    });
  }, [gameState?.players, gameState?.currentPlayerIndex, gameState?.phase, gameDispatch, confirmCheckScale, locale]);

  // ג”€ג”€ Lesson 4 (build equation) auto-progression: drive the underlying
  //    game into 'building' with rigged dice + hand. Handles first entry
  //    AND re-entry after GO_BACK (refs are re-armed in the intro cleanup). ג”€ג”€
  const eqLessonAdvancedRef = useRef(false);
  const eqLessonHandRiggedRef = useRef(false);
  const l4Step3RiggedRef = useRef(false);
  const l5LessonAdvancedRef = useRef(false);
  const l5LessonHandRiggedRef = useRef(false);
  const rigL4 = () => {
    // Use rollL4Dice values as-is ג€” NO re-derivation. This guarantees
    // perfect consistency: the dice, pickA/pickB, target, hand, and
    // validSums are all computed ONCE in the same function call.
    const l4 = l4DiceRef.current ?? rollL4Dice();
    l4DiceRef.current = l4;
    const { d1, d2, d3, pickA, pickB, target, hand, validSums } = l4;
    tutorialBus.setL4Config({ pickA, pickB, target, hand, validSums });

    const ts = Date.now();
    const handCards = hand.map((v) => ({
      id: `tut-l4-card-${v}-${ts}`,
      type: 'number' as const,
      value: v,
    }));
    const botCards = hand.map((v) => ({
      id: `tut-l4-bot-card-${v}-${ts}`,
      type: 'number' as const,
      value: v,
    }));
    gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [botCards, handCards] });
    if (gameState?.phase === 'pre-roll') {
      gameDispatch({ type: 'ROLL_DICE', values: { die1: d1, die2: d2, die3: d3 } });
    } else {
      // Re-entry or any other non-pre-roll phase: force-set the dice so
      // the displayed values match the bus config above.
      gameDispatch({ type: 'TUTORIAL_SET_DICE', values: { die1: d1, die2: d2, die3: d3 } });
    }
  };
  useEffect(() => {
    if (engine.lessonIndex !== 3) return;
    // During intro the refs are reset by the global intro effect ג€” don't rig yet.
    if (engine.phase === 'intro' || engine.phase === 'idle') return;
    if (!gameState?.players || gameState.players.length < 2) return;

    // First entry: turn-transition ג†' pre-roll ג†' building
    if (gameState.phase === 'turn-transition' && !eqLessonAdvancedRef.current) {
      eqLessonAdvancedRef.current = true;
      gameDispatch({ type: 'BEGIN_TURN' });
      return;
    }
    if (gameState.phase === 'pre-roll' && !eqLessonHandRiggedRef.current) {
      eqLessonHandRiggedRef.current = true;
      rigL4();
      return;
    }
    // Re-entry after GO_BACK (same lesson or cross-lesson): game is already
    // in 'building' ג€” just re-rig so dice/hand match the current l4DiceRef.
    if (gameState.phase === 'building' && !eqLessonHandRiggedRef.current) {
      eqLessonHandRiggedRef.current = true;
      rigL4();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.lessonIndex, engine.phase, gameState?.phase, gameState?.players, gameDispatch]);

  // ג”€ג”€ L4 step 0 (play-card, layer 20): ensure the equation is confirmed when
  //    await-mimic starts. If the bot demo was skipped early (before eqConfirm
  //    fired), the game stays in 'building' and the learner sees an empty
  //    equation. Force-solve with the correct l4 values so the solved board is
  //    always visible when the learner's turn begins.
  //    Ref guard prevents double-dispatch: gameState.players changes after the
  //    dispatch (new array reference), which would re-trigger the effect. ג”€ג”€
  const l4Step0ForcedRef = useRef(false);
  useEffect(() => {
    if (engine.lessonIndex !== 3 || engine.stepIndex !== 0) {
      l4Step0ForcedRef.current = false;
      return;
    }
    if (engine.phase !== 'await-mimic') {
      l4Step0ForcedRef.current = false;
      return;
    }
    if (l4Step0ForcedRef.current) return; // already handled this enter
    if (gameState?.phase === 'solved') {
      // Bot demo ran correctly ג€” just ensure lastEquationResult is set.
      const l4 = l4DiceRef.current;
      if (l4 && tutorialBus.getLastEquationResult() === null) {
        tutorialBus.setLastEquationResult(l4.target);
      }
      l4Step0ForcedRef.current = true;
      return;
    }
    const l4 = l4DiceRef.current;
    if (!l4 || !gameState?.players || gameState.players.length < 2) return;
    l4Step0ForcedRef.current = true;
    const { d1, d2, d3, pickA, pickB, target } = l4;
    const dv = [d1, d2, d3];
    const equationDisplay = `${dv[pickA] ?? d1} + ${dv[pickB] ?? d2} = ${target}`;
    tutorialBus.setLastEquationResult(target);
    gameDispatch({
      type: 'TUTORIAL_FORCE_SOLVED',
      equationResult: target,
      dice: { die1: d1, die2: d2, die3: d3 },
      equationDisplay,
      playerHand: gameState.players[1]?.hand ?? [],
      botHand: gameState.players[0]?.hand ?? [],
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameState?.phase, gameState?.players, gameDispatch]);

  useEffect(() => {
    const isL4Step3 = engine.lessonIndex === 3 && engine.stepIndex === 3;
    if (!isL4Step3) {
      l4Step3RiggedRef.current = false;
      return;
    }
    if (engine.phase === 'intro' || engine.phase === 'idle') {
      l4Step3RiggedRef.current = false;
      return;
    }
    if (engine.phase !== 'bot-demo' && engine.phase !== 'await-mimic') return;
    if (!gameState?.players || gameState.players.length < 2) return;
    if (l4Step3RiggedRef.current) return;
    l4Step3RiggedRef.current = true;

    gameDispatch({ type: 'CLEAR_EQ_HAND' });
    if (gameState.phase === 'solved') {
      gameDispatch({ type: 'REVERT_TO_BUILDING' });
    }
    rigL4();
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameState?.phase, gameState?.players, gameDispatch]);

  // ג”€ג”€ Lesson 5 (op/joker) must run on the real EquationBuilder. Ensure the
  //    game is in `building` with visible dice and a hand that includes a joker. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== 4) return;
    if (engine.phase === 'intro') {
      l5LessonAdvancedRef.current = false;
      l5LessonHandRiggedRef.current = false;
      return;
    }
    if (!gameState?.players || gameState.players.length < 2) return;
    if (gameState.phase === 'turn-transition' && !l5LessonAdvancedRef.current) {
      l5LessonAdvancedRef.current = true;
      gameDispatch({ type: 'BEGIN_TURN' });
      return;
    }
    // Rig regardless of current gameState.phase ג€” entering lesson 5 from any
    // prior lesson/state (including `solved` after L4, or mid-`building` from
    // a GO_BACK) should rebuild the L5 hand + dice. ROLL_DICE in tutorial
    // mode bypasses its own phase gate (see index.tsx reducer). TUTORIAL_SET_HANDS
    // has no phase restriction. Run the rigging once per lesson entry.
    if (!l5LessonHandRiggedRef.current) {
      l5LessonHandRiggedRef.current = true;
      // L5.1 pedagogy: the learner sees `4 ? 3 = 7` and must pick the `+`
      // card to complete it. Dice are fixed (not rolled) so the exercise
      // stays deterministic; d1 and d2 are intentionally distinct and the
      // target (7 = 4+3) maps to exactly one correct operator.
      // No joker in this hand ג€” the joker is introduced in step 5.2, and
      // exposing it here would let the learner bypass the "pick the right
      // operation card" decision that step 5.1 is teaching.
      const d1 = 2 + Math.floor(Math.random() * 7); // 2..8
      const d2 = 1 + Math.floor(Math.random() * (d1 - 1)); // 1..d1-1, so d1>d2ג‰¥1
      const d3Cands = [1,2,3,4,5,6,7,8,9].filter(n => n !== d1 && n !== d2 && n !== d1 + d2);
      const d3 = d3Cands[Math.floor(Math.random() * d3Cands.length)] ?? 9;
      l5DiceRef.current = { d1, d2, d3 };
      // Correct the result-box target now that the ref has the fresh dice
      // (the setL5aBlockFanTaps effect above fired first with stale values).
      tutorialBus.setL5aTargetResult(d1 + d2);
      gameDispatch({ type: 'ROLL_DICE', values: { die1: d1, die2: d2, die3: d3 } });
      const ts = Date.now();
      const playerHand = [
        { id: `tut-l5-op-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
        { id: `tut-l5-op-minus-${ts}`, type: 'operation' as const, operation: '-' as const },
        { id: `tut-l5-op-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
        { id: `tut-l5-op-divide-${ts}`, type: 'operation' as const, operation: '÷' as const },
      ];
      const botHand = [
        { id: `tut-l5-bot-op-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
        { id: `tut-l5-bot-op-minus-${ts}`, type: 'operation' as const, operation: '-' as const },
        { id: `tut-l5-bot-op-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
        { id: `tut-l5-bot-op-divide-${ts}`, type: 'operation' as const, operation: '÷' as const },
      ];
      // Same swap rationale as L5b: put learner's hand at index 0 (= currentPlayerIndex
      // at L5 entry) so the fan shows the learner's own cards, not the bot's.
      gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [playerHand, botHand] });
      // d1 and d2 are pre-filled by the self-prefill effect inside
      // EquationBuilder (index.tsx L5.1 self-prefill) when L5aBlockFanTaps
      // is ON and all dice slots are null. eqPickDice setTimeouts were
      // removed because they fired AFTER the self-prefill had already filled
      // dice1 and dice2, causing the 140ms eqPickDice to fall through to
      // dice3 and incorrectly populate it (stuck equation with 3 dice).
    }
  }, [engine.lessonIndex, engine.phase, gameState?.phase, gameState?.players, gameDispatch]);

  // ג”€ג”€ Lesson 5.1 (place-op): d1+d2 dice slots are pre-filled by the
  //    self-prefill effect inside EquationBuilder (index.tsx) ג€” it fires
  //    when L5aBlockFanTaps is ON and all dice slots are null. No eqPickDice
  //    emits here; they were removed because they raced the self-prefill.

  // ג”€ג”€ If the user skipped the dice lesson without rolling, fabricate
  //    dice values when celebrate begins so the "these are the numbers"
  //    bubble has something to point at. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== 2) return;
    if (engine.phase !== 'celebrate') return;
    if (tutorialDice) return;
    const l4 = l4DiceRef.current ?? rollL4Dice();
    setTutorialDice({ d1: l4.d1, d2: l4.d2, d3: l4.d3 });
  }, [engine.phase, engine.lessonIndex, tutorialDice]);

  // ג”€ג”€ Pulse the tutorial-owned dice button during dice-lesson bot-demo. ג”€ג”€
  useEffect(() => {
    const isPulsing = engine.phase === 'bot-demo' && engine.lessonIndex === 2 && engine.stepIndex === 0;
    if (!isPulsing) {
      dicePulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dicePulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(dicePulse, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [engine.phase, engine.lessonIndex, dicePulse]);

  // ג”€ג”€ Lesson 5: pick a fresh (a, b) pair on entry + reset per-lesson state
  //    (cycled signs, pending joker op, modal) so each run starts clean. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== 4) {
      setL5JokerOpen(false);
      return;
    }
    const cfg = pickL5Pair();
    setL5Config(cfg);
    setL5SelectedOp(null);
    setL5JokerOpen(false);
    setL5CycledSigns(new Set());
    setL5PendingJokerOp(null);
    setL5Exercises(generateL5Exercises());
    setL5ExIndex(0);
    tutorialBus.setL5Config(cfg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.lessonIndex]);

  // ג”€ג”€ Between lesson-5 steps (place-op ג†' joker), reset per-step state so
  //    each step starts on a clean slate (modal closed, no pending joker
  //    pick). Step 0 (place-op) rigging ג€” full 3-dice layout with `+` on
  //    both operator slots ג€” lives in the lesson-entry rigging block (see
  //    the L5 dice/hand useEffect above). ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== 4) return;
    if (engine.phase !== 'bot-demo') return;
    if (engine.stepIndex > 0) {
      setL5JokerOpen(false);
      setL5PendingJokerOp(null);
    }
    if (engine.stepIndex === 2) {
      // Step 5.3 (important-tip): clear any joker the learner placed in step
      // 5.2 so ok=false and the confirm button is hidden while the tip shows.
      gameDispatch({ type: 'CLEAR_EQ_HAND' });
      tutorialBus.emitFanDemo({ kind: 'eqReset' });
    }
    if (engine.stepIndex === 1) {
      // Step 5.2 (joker-place ג€” "meet Slinda"): mirror 5.1. Keep the 5.1
      // dice (4, 3, 9) on the table; clear the placed `+` card and the
      // op/result state; swap in a 5-card hand with Slinda centred at
      // index 2; then re-pre-fill d1 and d2 so the equation reads
      // `4 ? 3 = 7` with the sign slot empty. The staged delays mirror
      // `rigL5OpPickExercise`'s pattern ג€” without them, eqPickDice races
      // the eqReset commit.
      gameDispatch({ type: 'CLEAR_EQ_HAND' });
      tutorialBus.emitFanDemo({ kind: 'eqReset' });
      const ts = Date.now();
      const playerHand = [
        { id: `tut-l5b-op-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
        { id: `tut-l5b-op-minus-${ts}`, type: 'operation' as const, operation: '-' as const },
        { id: `tut-l5b-joker-${ts}`, type: 'joker' as const },
        { id: `tut-l5b-op-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
        { id: `tut-l5b-op-divide-${ts}`, type: 'operation' as const, operation: '÷' as const },
      ];
      const botHand = [
        { id: `tut-l5b-bot-op-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
        { id: `tut-l5b-bot-op-minus-${ts}`, type: 'operation' as const, operation: '-' as const },
        { id: `tut-l5b-bot-joker-${ts}`, type: 'joker' as const },
        { id: `tut-l5b-bot-op-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
        { id: `tut-l5b-bot-op-divide-${ts}`, type: 'operation' as const, operation: '÷' as const },
      ];
      // Swap so the learner's hand (with Slinda at index 2) lands at
      // currentPlayerIndex (which is 0 at L5b entry ג€” the previous turn
      // belonged to the learner/player-1, so endTurnLogic advanced to
      // player-0). The fan always shows hands[currentPlayerIndex]; putting
      // the learner's joker there prevents the bot's ghost joker from
      // appearing in the fan and triggering a broken card-tap path.
      gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [playerHand, botHand] });
      // Keep the rigged hand order as-is ג€” the default sort would push
      // Slinda to the end (operations before jokers), but we rigged her at
      // the centre index 2 on purpose. Flag is cleared when the lesson/step
      // changes (see the cleanup effect right below this one).
      tutorialBus.setTutorialPreserveHandOrder(true);
      // Slinda is centred by the bot demo's immediate scrollFanTo(2, durationMs:0)
      // at the start of botDemo ג€” no separate setTimeout needed here.
      // d1+d2 pre-fill is handled by the self-prefill inside EquationBuilder
      // (same mechanism as step 5.1). eqPickDice setTimeouts were removed:
      // they raced the self-prefill and caused dice3 to be incorrectly set.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ג”€ג”€ Clear the "preserve hand order" flag when leaving L5.2. The flag is
  //    set inside the L5.2 rigging block above. Without this, Slinda would
  //    stay pinned to the middle of the fan even in later lessons. ג”€ג”€
  useEffect(() => {
    const inL5b = engine.lessonIndex === 4 && engine.stepIndex === 1;
    if (!inL5b) tutorialBus.setTutorialPreserveHandOrder(false);
    return () => tutorialBus.setTutorialPreserveHandOrder(false);
  }, [engine.lessonIndex, engine.stepIndex]);

  // ג”€ג”€ Lesson 6 (possible-results) rigging: on entry, the learner sees a
  //    fully-filled equation and a full hand ג€” the green ResultsChip pulses
  //    strongly to draw attention. We rig a safe random setup so the chip
  //    always has possible targets to show, and
  //    enable showPossibleResults on the game state (the boot defaults it
  //    to false so the chip stays hidden during earlier lessons). Runs once
  //    per L6 entry (reset on lesson exit via the ref below). ג”€ג”€
  const l6RiggedRef = useRef(false);
  const l6PossibleResultsSetupRef = useRef<L6PossibleResultsSetup | null>(null);
  const l6WildRiggedRef = useRef(false);
  const l6WildAwaitRiggedRef = useRef(false);
  useEffect(() => {
    if (engine.lessonIndex !== 5) {
      l6RiggedRef.current = false;
      l6PossibleResultsSetupRef.current = null;
      return;
    }
    // Re-arm the rigging on every re-entry into step 0 (GO_BACK flows the
    // engine through `intro` before landing on `bot-demo`, and the shared
    // `intro` useEffect at the top of this file clears equationHandSlots +
    // runs eqReset). Without this, returning to step 0 after a back-nav
    // leaves the equation empty and validTargets stale.
    if (engine.phase === 'intro' && engine.stepIndex === 0) {
      l6RiggedRef.current = false;
      l6PossibleResultsSetupRef.current = null;
      return;
    }
    if (engine.phase !== 'bot-demo' || engine.stepIndex !== 0) return;
    if (l6RiggedRef.current) return;
    l6RiggedRef.current = true;

    const setup = buildL6PossibleResultsSetup();
    l6PossibleResultsSetupRef.current = setup;
    gameDispatch({ type: 'TUTORIAL_SET_ENABLED_OPERATORS', operators: ['+'] });
    gameDispatch({ type: 'ROLL_DICE', values: setup.dice });
    gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [setup.botHand, setup.playerHand] });

    // Enable the ResultsChip (boot defaults it to false so it stays hidden
    // in L1ג€“L5). Must be dispatched after the dice so validTargets is ready.
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: true });

    // Show a solved equation so the learner sees a concrete result while
    // learning that the chip reveals OTHER possible outcomes for the same dice.
    // showPossibleResults stays true (spread via TUTORIAL_FORCE_SOLVED) so the
    // chip remains visible in solved phase.
    // Chip starts CLOSED ג€” user taps it in step 6.1 to open the mini-strip.
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    tutorialBus.emitFanDemo({ kind: 'closeResultsChip' });
    gameDispatch({
      type: 'TUTORIAL_FORCE_SOLVED',
      equationResult: setup.target,
      dice: setup.dice,
      equationDisplay: setup.equationDisplay,
      playerHand: setup.playerHand,
      botHand: setup.botHand,
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // Layer 48 safety net: the learner must see the solved reference equation
  // before tapping the green possible-results button.
  useEffect(() => {
    const isL6OpenChipAwait =
      engine.lessonIndex === 5 &&
      engine.stepIndex === 0 &&
      engine.phase === 'await-mimic';
    if (!isL6OpenChipAwait) return;
    let setup = l6PossibleResultsSetupRef.current;
    if (!setup) {
      setup = buildL6PossibleResultsSetup();
      l6PossibleResultsSetupRef.current = setup;
    }
    const needsReference =
      gameState?.phase !== 'solved' ||
      gameState?.equationResult == null ||
      !gameState?.lastEquationDisplay ||
      (gameState?.validTargets?.length ?? 0) === 0;
    if (gameState?.showPossibleResults !== true) {
      gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: true });
    }
    if (!needsReference) return;
    tutorialBus.emitFanDemo({ kind: 'closeResultsChip' });
    tutorialBus.emitFanDemo({ kind: 'clearSolveExerciseChip' });
    gameDispatch({ type: 'TUTORIAL_SET_ENABLED_OPERATORS', operators: ['+'] });
    gameDispatch({ type: 'ROLL_DICE', values: setup.dice });
    gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [setup.botHand, setup.playerHand] });
    gameDispatch({
      type: 'TUTORIAL_FORCE_SOLVED',
      equationResult: setup.target,
      dice: setup.dice,
      equationDisplay: setup.equationDisplay,
      playerHand: setup.playerHand,
      botHand: setup.botHand,
    });
  }, [
    engine.lessonIndex,
    engine.stepIndex,
    engine.phase,
    gameState?.phase,
    gameState?.equationResult,
    gameState?.lastEquationDisplay,
    gameState?.validTargets?.length,
    gameState?.showPossibleResults,
    gameDispatch,
  ]);

  // ג”€ג”€ Lesson 6 step transitions: ensure the chip is in the expected state
  //    when the learner arrives at each step. Step 6.1 (tap-mini) remains in
  //    the registry as legacy compatibility; the normal flow jumps from
  //    step 6.0 straight to step 6.2 (wild mockup), so cleanup must already
  //    happen during the intro phase of step 6.2. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== 5) return;
    if (engine.stepIndex === 2 && (engine.phase === 'intro' || engine.phase === 'bot-demo')) {
      gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: false });
      gameDispatch({ type: 'TUTORIAL_SET_SHOW_SOLVE_EXERCISE', value: false });
      tutorialBus.emitFanDemo({ kind: 'closeResultsChip' });
      tutorialBus.emitFanDemo({ kind: 'clearSolveExerciseChip' });
      tutorialBus.setL6WildStepMode(true);
      // TUTORIAL_FORCE_SOLVED with solved state + wild hand fires in await-mimic rig.
      return;
    }
    if (engine.phase !== 'bot-demo') return;
    if (engine.stepIndex === 0) {
      // Step 6.0: chip MUST start closed so the learner sees it pulsing and
      // can tap to open. If the user navigated here with chip open, reset.
      tutorialBus.emitFanDemo({ kind: 'closeResultsChip' });
    } else if (engine.stepIndex === 1) {
      // Step 6.1 (tap-mini): chip MUST be open so the mini-strip is visible.
      // If the learner skipped step 6.0 without actually opening it, this
      // force-opens so the bot demo + await-mimic have something to tap.
      tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
      // Re-fill the dice AND both operators in the EquationBuilder so the
      // learner sees a complete reference equation next to the mini-cards
      // strip. Without operators the slots show "?" which invites taps that
      // are intentionally blocked, causing confusion.
      // Staggered timeouts prevent eqPickDice picks from clobbering each
      // other (same issue as L5a ג€” simultaneous picks read stale state).
      setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 0 }), 140);
      setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 1 }), 280);
      setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 2 }), 420);
      setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqSetOp', which: 1, op: '+' }), 560);
      setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqSetOp', which: 2, op: '+' }), 700);
    }
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // ג”€ג”€ Copy-exercise validator (L6 legacy + L9): when the learner confirms
  //    an equation, compare against the selected mini-card config and emit
  //    success/mismatch feedback. L9 requires copying the FULL equation. ג”€ג”€
  useEffect(() => {
    const isL6TapMiniStep =
      engine.lessonIndex === 5 &&
      engine.stepIndex === 1 &&
      (engine.phase === 'bot-demo' || engine.phase === 'await-mimic');
    if (!isL6TapMiniStep) return;
    const targets = gameState?.validTargets ?? [];
    const filtered = targets.filter((eq: { result: number }) => eq.result !== 0);
    if (filtered.length === 0) return;
    // Guard: only dispatch if the filter actually removes items to prevent
    // an infinite loop (dispatching changes validTargets ג†' effect re-fires).
    if (filtered.length === targets.length) return;
    gameDispatch({ type: 'TUTORIAL_SET_VALID_TARGETS', targets: filtered });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameState?.validTargets, gameDispatch]);

  useEffect(() => {
    const on =
      engine.lessonIndex === 5 &&
      engine.stepIndex === 2 &&
      (engine.phase === 'intro' || engine.phase === 'bot-demo' || engine.phase === 'await-mimic');
    tutorialBus.setTutorialPreserveHandOrder(on);
    tutorialBus.setL6WildStepMode(on);
    return () => {
      tutorialBus.setTutorialPreserveHandOrder(false);
      tutorialBus.setL6WildStepMode(false);
    };
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  useEffect(() => {
    if (engine.lessonIndex === 5 && engine.stepIndex === 2) return;
    const isL6CopyAwait = engine.lessonIndex === 5 && engine.stepIndex === 2 && engine.phase === 'await-mimic';
    const isL9CopyAwait = engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX && engine.stepIndex === 0 && engine.phase === 'await-mimic' && l9Stage === 1;
    if (!isL6CopyAwait && !isL9CopyAwait) return;
    if (gameState?.phase !== 'solved') return;
    const cfg = tutorialBus.getL6CopyConfig();
    if (!cfg) return;
    const got = gameState.equationResult as number | null;
    const normalizeEq = (s: string | null | undefined): string =>
      String(s ?? '')
        .replace(/\u00d7/g, 'x')
        .replace(/\u2212/g, '-')
        .replace(/\u00f7/g, '÷')
        .replace(/\s+/g, '');
    const copiedExactly =
      isL9CopyAwait && cfg.equation
        ? normalizeEq(gameState?.lastEquationDisplay) === normalizeEq(cfg.equation)
        : true;
    if (got === cfg.target && copiedExactly) {
      tutorialBus.emitUserEvent({ kind: 'l6CopyConfirmed' });
    } else if (got != null) {
      tutorialBus.emitUserEvent({ kind: 'l6CopyMismatch', expected: cfg.target, got });
    }
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameState?.phase, gameState?.equationResult, gameState?.lastEquationDisplay, l9Stage]);

  // ג”€ג”€ Copy mismatch bubble (L6/L9): show error when wrong copy is confirmed. ג”€ג”€
  useEffect(() => {
    const isL6WildAwait = engine.lessonIndex === 5 && engine.stepIndex === 2 && engine.phase === 'await-mimic';
    if (!isL6WildAwait) {
      setL6Mismatch(false);
      return;
    }
    const message = gameState?.message ?? '';
    const isMismatchMessage =
      message === t('tutorial.l6c.mismatch') ||
      message === t('confirm.sumMismatch');
    setL6Mismatch(isMismatchMessage);
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameState?.message, t]);

  useEffect(() => {
    setL9Mismatch(false);
    if (l9MismatchTimerRef.current) clearTimeout(l9MismatchTimerRef.current);
    const isL9CopyAwait = engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX && engine.stepIndex === 0 && engine.phase === 'await-mimic';
    if (!isL9CopyAwait) return;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind !== 'l6CopyMismatch') return;
      setL9Mismatch(true);
      gameDispatch({ type: 'REVERT_TO_BUILDING' });
      tutorialBus.emitFanDemo({ kind: 'eqReset' });
      if (l9MismatchTimerRef.current) clearTimeout(l9MismatchTimerRef.current);
      l9MismatchTimerRef.current = setTimeout(() => setL9Mismatch(false), 2500);
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // ג”€ג”€ Lesson 7 (parens-move) rigging: dice 6,2,1; both ops minus; chip shows
  //    target 6 גˆ' (2 גˆ' 1) = 5. Runs once per L7 entry (bot-demo step 0). ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX) { l7RiggedRef.current = false; return; }
    // Reset the flag on any non-bot-demo phase so back-navigation re-rigs correctly.
    if (engine.phase !== 'bot-demo') { l7RiggedRef.current = false; return; }
    if (engine.stepIndex !== 0) return;
    if (l7RiggedRef.current) return;
    l7RiggedRef.current = true;
    // Pick a random exercise, avoiding repeating the last one.
    let idx: number;
    do { idx = Math.floor(Math.random() * L7_EXERCISE_POOL.length); }
    while (L7_EXERCISE_POOL.length > 1 && idx === l7LastExerciseIdxRef.current);
    l7LastExerciseIdxRef.current = idx;
    const ex = L7_EXERCISE_POOL[idx];
    l7ExerciseRef.current = ex;
    const ts = Date.now();
    // Full operator set + red solve chip + open mini strip so the board matches
    // a real "possible results" session.
    gameDispatch({ type: 'TUTORIAL_SET_ENABLED_OPERATORS', operators: ['+', '-', 'x', '÷'] });
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_SOLVE_EXERCISE', value: true });
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: true });
    tutorialBus.emitFanDemo({ kind: 'disarmResultsChipPulse' });
    tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
    gameDispatch({ type: 'ROLL_DICE', values: { die1: ex.d1, die2: ex.d2, die3: ex.d3 } });
    // Keep at least one guaranteed matching card in hand (target), so the
    // learner can complete the exercise without being blocked by hand RNG.
    const extraNums = [3, 5, 7, 8, 9]
      .filter((v) => v !== ex.d1 && v !== ex.d2 && v !== ex.d3 && v !== ex.target)
      .slice(0, 4);
    const playerHand = [ex.target, ...extraNums].map((value, i) => ({
      id: `tut-l7-num-${value}-${ts}-${i}`,
      type: 'number' as const,
      value,
    }));
    const botHand = playerHand.map((c) => ({ ...c, id: `bot-${c.id}` }));
    gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [botHand, playerHand] });
    // Dice pre-filled; operators left empty for the learner to set.
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 0 }), 140);
    setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 1 }), 280);
    setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 2 }), 420);
    const chipEq = buildL7ChipEquation(ex);
    setTimeout(() => {
      tutorialBus.emitFanDemo({ kind: 'setSolveChip', equation: chipEq, result: ex.target });
    }, 560);
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // Ensure layer 72 / step 2.1 (L7 step 0 await-mimic) always re-shows the
  // reference equation chip even if GameScreen local UI state reset between
  // bot-demo and the learner's turn.
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX || engine.stepIndex !== 0) {
      l7AwaitSolveChipRef.current = false;
      return;
    }
    if (engine.phase !== 'await-mimic') {
      l7AwaitSolveChipRef.current = false;
      return;
    }
    if (l7AwaitSolveChipRef.current) return;
    const ex = l7ExerciseRef.current;
    if (!ex) return;
    l7AwaitSolveChipRef.current = true;
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_SOLVE_EXERCISE', value: true });
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: true });
    tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
    tutorialBus.emitFanDemo({
      kind: 'setSolveChip',
      equation: buildL7ChipEquation(ex),
      result: ex.target,
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // ג”€ג”€ Lesson 9 (mini-copy): next turn with mini-strip ON and red chip OFF
  //    until the learner taps a mini card. Learner then copies that exact
  //    equation in the builder and confirms. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX) { l9RiggedRef.current = false; return; }
    if (engine.phase !== 'bot-demo') { l9RiggedRef.current = false; return; }
    if (engine.stepIndex !== 0) return;
    if (l9RiggedRef.current) return;
    l9RiggedRef.current = true;
    // Pick a random exercise every run (avoid repeating previous L9 run).
    let idx: number;
    do { idx = Math.floor(Math.random() * L7_EXERCISE_POOL.length); }
    while (L7_EXERCISE_POOL.length > 1 && idx === l9LastExerciseIdxRef.current);
    l9LastExerciseIdxRef.current = idx;
    const ex = L7_EXERCISE_POOL[idx];
    setL9Stage(0);
    gameDispatch({ type: 'TUTORIAL_SET_ENABLED_OPERATORS', operators: ['+', '-', 'x', '÷'] });
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: true });
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_SOLVE_EXERCISE', value: false });
    tutorialBus.setL6CopyConfig(null);
    tutorialBus.emitFanDemo({ kind: 'clearSolveExerciseChip' });
    tutorialBus.emitFanDemo({ kind: 'disarmResultsChipPulse' });
    tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    // ROLL_DICE in a separate tick so React flushes TUTORIAL_SET_ENABLED_OPERATORS first.
    // Without this, React batches both dispatches and ROLL_DICE sees the old operators (['+'] only),
    // producing validTargets with no minus/multiply equations ג†' empty mini-cards strip.
    setTimeout(() => {
      gameDispatch({ type: 'ROLL_DICE', values: { die1: ex.d1, die2: ex.d2, die3: ex.d3 } });
    }, 0);
    // Build hand: one card per unique parens-right result (a op (b op c)).
    // This ensures every mini card shown has a matching number card in the fan.
    const ts9 = Date.now();
    const _applyOp = (a: number, op: string, b: number): number | null => {
      if (op === '+') return a + b;
      if (op === '-') return a - b;
      if (op === 'x') return a * b;
      if (op === '÷') return b !== 0 && Number.isInteger(a / b) ? a / b : null;
      return null;
    };
    const _ops = ['+', '-', 'x', '÷'];
    const _vals = [ex.d1, ex.d2, ex.d3];
    const _resultSet = new Set<number>();
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (j !== i) for (let k = 0; k < 3; k++) if (k !== i && k !== j) {
      const [a, b, c] = [_vals[i], _vals[j], _vals[k]];
      for (const op1 of _ops) for (const op2 of _ops) {
        const inner = _applyOp(b, op2, c);
        if (inner === null) continue;
        const result = _applyOp(a, op1, inner);
        if (result !== null && result > 0 && result <= 25 && Number.isInteger(result)) _resultSet.add(result);
      }
    }
    const l9PlayerHand = [..._resultSet].sort((a, b) => a - b).map((value, i) => ({
      id: `tut-l9-num-${value}-${ts9}-${i}`,
      type: 'number' as const,
      value,
    }));
    const l9BotHand = l9PlayerHand.map((c) => ({ ...c, id: `bot-${c.id}` }));
    gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [l9BotHand, l9PlayerHand] });
    // Ensure human player (index 1) is the active player so UI interactions work.
    // Discard pile: a number card matching ex.target so the player can play
    // their matching hand card in stage 2 of the exercise.
    const l9PileCard = { id: `tut-l9-pile-${ts9}`, type: 'number' as const, value: ex.target };
    gameDispatch({ type: 'TUTORIAL_FRACTION_SETUP', slice: {
      currentPlayerIndex: 1,
      phase: 'building' as const,
      hands: [l9BotHand, l9PlayerHand], // parens-right matching hand
      discardPile: [l9PileCard],
      dice: null,
      pendingFractionTarget: null,
      fractionPenalty: 0,
      fractionAttackResolved: false,
      showFractions: false,
      fractionKinds: [] as const,
    }});
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // ג”€ג”€ Lesson 10 (single identical): pre-roll with one matching card.
  //    Discard value is randomised every run (avoid repeating). ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_SINGLE_IDENTICAL_LESSON_INDEX) { l10RiggedRef.current = false; return; }
    if (engine.phase !== 'bot-demo') { l10RiggedRef.current = false; return; }
    if (engine.stepIndex !== 0) return;
    if (l10RiggedRef.current) return;
    l10RiggedRef.current = true;
    // Pick a random discard value in [3..9], avoid repeating the last run.
    const pool = [3, 4, 5, 6, 7, 8, 9];
    let discardValue: number;
    do { discardValue = pool[Math.floor(Math.random() * pool.length)]; }
    while (pool.length > 1 && discardValue === l10LastDiscardRef.current);
    l10LastDiscardRef.current = discardValue;
    const ts = Date.now();
    const matchCard = { id: `tut-l10-match-${ts}`, type: 'number' as const, value: discardValue };
    // Fill the rest of the hand with values different from discardValue.
    const extras = [2, 3, 4, 5, 6, 7, 8, 9]
      .filter((v) => v !== discardValue)
      .slice(0, 4)
      .map((v, i) => ({ id: `tut-l10-extra-${v}-${ts}-${i}`, type: 'number' as const, value: v }));
    const discardCard = { id: `tut-l10-discard-${ts}`, type: 'number' as const, value: discardValue };
    const playerHand = [matchCard, ...extras];
    const botHand = playerHand.map((c) => ({ ...c, id: `bot-${c.id}` }));
    gameDispatch({
      type: 'TUTORIAL_FRACTION_SETUP',
      slice: {
        currentPlayerIndex: 1,
        phase: 'pre-roll',
        hands: [botHand, playerHand],
        discardPile: [discardCard],
        dice: null,
        pendingFractionTarget: null,
        fractionPenalty: 0,
        fractionAttackResolved: false,
        showFractions: false,
        fractionKinds: [],
      },
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // ג”€ג”€ L8 step 1: identical card exercise ג€” same pre-roll setup as step 0
  //    so the learner sees the gold button and plays the matching card. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_SINGLE_IDENTICAL_LESSON_INDEX) { l8Step1RiggedRef.current = false; return; }
    if (engine.phase !== 'bot-demo' || engine.stepIndex !== 1) { l8Step1RiggedRef.current = false; return; }
    if (l8Step1RiggedRef.current) return;
    l8Step1RiggedRef.current = true;
    // Reuse the discard value from step 0 so it's consistent.
    const discardValue = l10LastDiscardRef.current > 0 ? l10LastDiscardRef.current : 5;
    const ts = Date.now();
    const matchCard = { id: `tut-l10s1-match-${ts}`, type: 'number' as const, value: discardValue };
    const extras = [2, 3, 4, 5, 6, 7, 8, 9]
      .filter((v) => v !== discardValue)
      .slice(0, 4)
      .map((v, i) => ({ id: `tut-l10s1-extra-${v}-${ts}-${i}`, type: 'number' as const, value: v }));
    const discardCard = { id: `tut-l10s1-discard-${ts}`, type: 'number' as const, value: discardValue };
    const playerHand = [matchCard, ...extras];
    const botHand = playerHand.map((c) => ({ ...c, id: `bot-${c.id}` }));
    gameDispatch({
      type: 'TUTORIAL_FRACTION_SETUP',
      slice: {
        currentPlayerIndex: 1,
        phase: 'pre-roll',
        hands: [botHand, playerHand],
        discardPile: [discardCard],
        dice: null,
        pendingFractionTarget: null,
        fractionPenalty: 0,
        fractionAttackResolved: false,
        showFractions: true, // unlocks discard pile + gold button display in tutorial
        fractionKinds: [],
      },
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // ג”€ג”€ L8 step 1: detect if player rolled dice instead of playing identical card.
  //    Show a retry hint and revert to pre-roll so they can try again. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_SINGLE_IDENTICAL_LESSON_INDEX) { setL8RolledBeforeIdentical(false); return; }
    if (engine.phase !== 'await-mimic' || engine.stepIndex !== 1) { setL8RolledBeforeIdentical(false); return; }
    if (gameState?.phase !== 'building') return;
    // Player rolled dice ג€” show hint and revert to pre-roll after a brief delay.
    setL8RolledBeforeIdentical(true);
    const discardValue = l10LastDiscardRef.current > 0 ? l10LastDiscardRef.current : 5;
    const ts = Date.now();
    const matchCard = { id: `tut-l10-retry-match-${ts}`, type: 'number' as const, value: discardValue };
    const extras = [2, 3, 4, 5, 6, 7, 8, 9].filter((v) => v !== discardValue).slice(0, 4)
      .map((v, i) => ({ id: `tut-l10-retry-extra-${v}-${ts}-${i}`, type: 'number' as const, value: v }));
    const discardCard = { id: `tut-l10-retry-disc-${ts}`, type: 'number' as const, value: discardValue };
    const playerHand = [matchCard, ...extras];
    const botHand = playerHand.map((c) => ({ ...c, id: `bot-${c.id}` }));
    const timer = setTimeout(() => {
      setL8RolledBeforeIdentical(false);
      gameDispatch({ type: 'TUTORIAL_FRACTION_SETUP', slice: {
        currentPlayerIndex: 1, phase: 'pre-roll',
        hands: [botHand, playerHand], discardPile: [discardCard],
        dice: null, pendingFractionTarget: null, fractionPenalty: 0,
        fractionAttackResolved: false, showFractions: true, fractionKinds: [],
      }});
    }, 2200);
    return () => clearTimeout(timer);
  }, [engine.lessonIndex, engine.phase, engine.stepIndex, gameState?.phase, gameDispatch]);

  // ג”€ג”€ L11 step 1 (first multi-play exercise): simple prepared solved board. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_MULTI_PLAY_LESSON_INDEX) { l11RiggedRef.current = false; return; }
    if (engine.phase !== 'bot-demo' || engine.stepIndex !== 0) { l11RiggedRef.current = false; return; }
    if (l11RiggedRef.current) return;
    l11RiggedRef.current = true;
    const { cfg, prepared } = ensureL11PreparedConfig(0);
    const playerHand = buildPreparedPairCards(prepared.hand, 'tut-l11-step2');
    const botHand = playerHand.map((c) => ({ ...c, id: `bot-${c.id}` }));
    const discardCard = { id: `tut-l11-step2-discard-${Date.now()}`, type: 'number' as const, value: cfg.target };
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: false });
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_SOLVE_EXERCISE', value: false });
    tutorialBus.emitFanDemo({ kind: 'disarmResultsChipPulse' });
    tutorialBus.emitFanDemo({ kind: 'closeResultsChip' });
    tutorialBus.emitFanDemo({ kind: 'clearSolveExerciseChip' });
    gameDispatch({
      type: 'TUTORIAL_FORCE_SOLVED',
      equationResult: cfg.target,
      dice: prepared.dice,
      equationDisplay: prepared.equationDisplay,
      playerHand,
      botHand,
      discardPile: [discardCard],
    });
  }, [engine.lessonIndex, engine.phase, engine.stepIndex, gameDispatch]);

  // ג”€ג”€ L11 step 2 (second multi-play exercise): open directly in solved to keep
  //    the transition clean. Only prepare config here; the actual solved
  //    board is rigged once in await-mimic to avoid a duplicate open. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_MULTI_PLAY_LESSON_INDEX) { l8Step3RiggedRef.current = false; return; }
    if (engine.phase !== 'bot-demo' || engine.stepIndex !== 1) { l8Step3RiggedRef.current = false; return; }
    if (l8Step3RiggedRef.current) return;
    l8Step3RiggedRef.current = true;
    ensureL11PreparedConfig(1);
  }, [engine.lessonIndex, engine.phase, engine.stepIndex, gameDispatch]);

  // ג”€ג”€ L11: clear l11Config when leaving the lesson ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_MULTI_PLAY_LESSON_INDEX) {
      tutorialBus.setL11Config(null);
      l11RiggedRef.current = false;
      l11Step0AwaitRiggedRef.current = false;
      l11AwaitRiggedRef.current = false;
      l11PreparedRef.current = null;
    }
  }, [engine.lessonIndex]);

  // ג”€ג”€ L11 step 0 await-mimic: always restore the prepared solved board so
  //    direct entry / resume into layer 88 still has a target, equation,
  //    and playable pair ready. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_MULTI_PLAY_LESSON_INDEX) { l11Step0AwaitRiggedRef.current = false; return; }
    if (engine.phase !== 'await-mimic') { l11Step0AwaitRiggedRef.current = false; return; }
    if (engine.stepIndex !== 0) { l11Step0AwaitRiggedRef.current = false; return; }
    if (l11Step0AwaitRiggedRef.current) return;
    const { cfg, prepared } = ensureL11PreparedConfig(0);
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: false });
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_SOLVE_EXERCISE', value: false });
    tutorialBus.emitFanDemo({ kind: 'disarmResultsChipPulse' });
    tutorialBus.emitFanDemo({ kind: 'closeResultsChip' });
    tutorialBus.emitFanDemo({ kind: 'clearSolveExerciseChip' });
    if (gameState?.phase === 'solved' && gameState?.equationResult === cfg.target) {
      l11Step0AwaitRiggedRef.current = true;
      return;
    }
    l11Step0AwaitRiggedRef.current = true;
    const ts = Date.now();
    const playerHand = buildPreparedPairCards(prepared.hand, 'tut-l11-await-pair');
    const botHand = playerHand.map((c) => ({ ...c, id: `bot-await-${c.id}` }));
    const discardCard = { id: `tut-l11-await-discard-${ts}`, type: 'number' as const, value: cfg.target };
    gameDispatch({
      type: 'TUTORIAL_FORCE_SOLVED',
      equationResult: cfg.target,
      dice: prepared.dice,
      equationDisplay: prepared.equationDisplay,
      playerHand,
      botHand,
      discardPile: [discardCard],
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameState?.phase, gameState?.equationResult, gameDispatch]);

  // ג”€ג”€ L11 step 1 await-mimic: re-rig solved state so the learner gets a fresh
  //    hand after the bot demo consumed the previous game state (CONFIRM_STAGED). ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_MULTI_PLAY_LESSON_INDEX) { l11AwaitRiggedRef.current = false; return; }
    if (engine.phase !== 'await-mimic') { l11AwaitRiggedRef.current = false; return; }
    if (engine.stepIndex !== 1) { l11AwaitRiggedRef.current = false; return; }
    if (l11AwaitRiggedRef.current) return;
    const { cfg, prepared } = ensureL11PreparedConfig(1);
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: false });
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_SOLVE_EXERCISE', value: false });
    tutorialBus.emitFanDemo({ kind: 'disarmResultsChipPulse' });
    tutorialBus.emitFanDemo({ kind: 'closeResultsChip' });
    tutorialBus.emitFanDemo({ kind: 'clearSolveExerciseChip' });
    if (gameState?.phase === 'solved' && gameState?.equationResult === cfg.target) {
      l11AwaitRiggedRef.current = true;
      return;
    }
    l11AwaitRiggedRef.current = true;
    const ts = Date.now();
    const playerHand = buildPreparedMultiPlayBonusCards(cfg.addA, cfg.addB, 'tut-l11-await-bonus');
    const botHand = playerHand.map((c) => ({ ...c, id: `bot-await-${c.id}` }));
    const discardCard = { id: `tut-l11-await-discard-${ts}`, type: 'number' as const, value: cfg.target };
    gameDispatch({
      type: 'TUTORIAL_FORCE_SOLVED',
      equationResult: cfg.target,
      dice: prepared.dice,
      equationDisplay: prepared.equationDisplay,
      playerHand,
      botHand,
      discardPile: [discardCard],
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameState?.phase, gameState?.equationResult, gameDispatch]);

  // ג”€ג”€ L6.3 wild-finish await-mimic: always rig TUTORIAL_FORCE_SOLVED once with 7-card
  //    wild hand. No early-exit on “already solved” — the hand must always be replaced. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== 5) { l6WildAwaitRiggedRef.current = false; return; }
    if (engine.phase !== 'await-mimic') { l6WildAwaitRiggedRef.current = false; return; }
    if (engine.stepIndex !== 2) { l6WildAwaitRiggedRef.current = false; return; }
    if (l6WildAwaitRiggedRef.current) return;
    l6WildAwaitRiggedRef.current = true;
    const ts = Date.now();
    // Pick a random target 5-12, independent of l6CopyConfig
    const TARGET_POOL = [5, 6, 7, 8, 9, 10, 11, 12];
    const target = TARGET_POOL[Math.floor(Math.random() * TARGET_POOL.length)];
    const baseCard = Math.min(target - 1, 4 + Math.floor(Math.random() * 3)); // 4-6
    const wildNeeded = target - baseCard; // always ≥ 1
    // 7-card hand: wild (★ only, no resolvedValue) + baseCard + 5 distractors
    const distractors = new Set<number>();
    while (distractors.size < 5) {
      const v = 1 + Math.floor(Math.random() * 10);
      if (v !== baseCard && v !== target) distractors.add(v);
    }
    const playerHand = [
      { id: `tut-l6w-wild-${ts}`, type: 'wild' as const },
      { id: `tut-l6w-base-${ts}`, type: 'number' as const, value: baseCard },
      ...[...distractors].map((v, i) => ({ id: `tut-l6w-d${i}-${ts}`, type: 'number' as const, value: v })),
    ].slice(0, 7);
    const botHand = playerHand.map((c) => ({ ...c, id: `bot-${c.id}` }));
    // Use 3 dice that sum to target — no '?' slot left empty
    const d1 = Math.max(1, Math.floor(target / 3));
    const d2 = Math.max(1, Math.floor(target / 3));
    const d3 = target - d1 - d2;
    const dice = { die1: d1, die2: d2, die3: d3 };
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    gameDispatch({ type: 'CLEAR_EQ_HAND' });
    void wildNeeded;
    gameDispatch({
      type: 'TUTORIAL_FORCE_SOLVED',
      equationResult: target,
      dice,
      equationDisplay: `${d1} + ${d2} + ${d3} = ${target}`,
      playerHand,
      botHand,
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // ג”€ג”€ Multi-card discard steps + L6.3 wild-finish: enable l4Step3Mode so the “׳'׳—׳¨׳×׳™” button shows. ג”€ג”€
  useEffect(() => {
    const on =
      (engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX &&
        (engine.stepIndex === 0 || engine.stepIndex === 1) &&
        engine.phase === 'await-mimic') ||
      (engine.lessonIndex === 5 && engine.stepIndex === 2 && engine.phase === 'await-mimic');
    tutorialBus.setL4Step3Mode(on);
    return () => tutorialBus.setL4Step3Mode(false);
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  useEffect(() => {
    const on =
      engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX &&
      engine.stepIndex === 1 &&
      engine.phase === 'await-mimic';
    tutorialBus.setL11StrictMultiPlayMode(on);
    return () => tutorialBus.setL11StrictMultiPlayMode(false);
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  const solvedPlayConfirmedRef = useRef('');
  useEffect(() => {
    const shouldWatchSolvedPlay =
      engine.phase === 'await-mimic' &&
      (
        (engine.lessonIndex === 3 && engine.stepIndex === 3) ||
        (engine.lessonIndex === 5 && engine.stepIndex === 2) ||
        (engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX && (engine.stepIndex === 0 || engine.stepIndex === 1))
      );
    if (!shouldWatchSolvedPlay) {
      solvedPlayConfirmedRef.current = '';
      return;
    }
    const endedTurnWithPlayedCards =
      gameState?.phase === 'turn-transition' &&
      (gameState?.lastDiscardCount ?? 0) > 0 &&
      Array.isArray(gameState?.lastTurnPlayedCards) &&
      gameState.lastTurnPlayedCards.length > 0;
    const liveSolvedPlay =
      !!gameState?.hasPlayedCards &&
      Array.isArray(gameState?.stagedCards) &&
      gameState.stagedCards.length > 0;
    if (!endedTurnWithPlayedCards && !liveSolvedPlay) return;

    const playedCards: Card[] = endedTurnWithPlayedCards
      ? (gameState.lastTurnPlayedCards as Card[])
      : (gameState.stagedCards as Card[]);
    const key = `${engine.lessonIndex}:${engine.stepIndex}:${gameState.roundsPlayed}:${gameState.lastDiscardCount}:${playedCards.map((card: Card) => card.id).join(',')}`;
    if (solvedPlayConfirmedRef.current === key) return;
    solvedPlayConfirmedRef.current = key;
    tutorialBus.emitUserEvent({
      kind: 'userPlayedCards',
      count: playedCards.length,
      hasZero: playedCards.some((c: Card) => c.type === 'number' && c.value === 0),
      hasWild: playedCards.some((c: Card) => c.type === 'wild'),
      positiveNumberCount: playedCards.filter((c: Card) => c.type === 'number' && (c.value ?? 0) > 0).length,
    });
  }, [
    engine.lessonIndex,
    engine.stepIndex,
    engine.phase,
    gameState?.phase,
    gameState?.hasPlayedCards,
    gameState?.lastDiscardCount,
    gameState?.lastTurnPlayedCards,
    gameState?.stagedCards,
    gameState?.roundsPlayed,
  ]);

  // ג”€ג”€ L9: parens filter controls equation builder visibility by stage:
  //    Stage 1 (build equation): l9ParensFilter=true ג†' dice row visible + clickable ג”€ג”€
  useEffect(() => {
    const on = engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX &&
               engine.phase === 'await-mimic' &&
               l9Stage === 1;
    tutorialBus.setL9ParensFilter(on);
    return () => { tutorialBus.setL9ParensFilter(false); };
  }, [engine.lessonIndex, engine.phase, l9Stage]);

  // ג”€ג”€ L9: reset stage + target filter when leaving the lesson or re-entering bot-demo ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX) {
      setL9Stage(0);
      return;
    }
    if (engine.phase === 'bot-demo' || engine.phase === 'intro') setL9Stage(0);
  }, [engine.lessonIndex, engine.phase]);

  // ג”€ג”€ L9: on entering await-mimic stage 0 ג€” reset equation, open chip,
  //    then filter validTargets to parens-right only. Running the filter
  //    here (not in bot-demo) prevents a stale equation from auto-confirming
  //    against the filtered targets before the learner taps a mini card. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX) return;
    if (engine.phase !== 'await-mimic' || l9Stage !== 0) return;
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
    if (l9InternalResetRef.current) {
      // Internal reset (stage 1→0 within await-mimic): validTargets already populated
      // from the ROLL_DICE in bot-demo — don't null them or mini cards vanish.
      l9InternalResetRef.current = false;
      return;
    }
    gameDispatch({ type: 'TUTORIAL_SET_VALID_TARGETS', targets: null });
  }, [engine.lessonIndex, engine.phase, l9Stage, gameDispatch]);

  // ג”€ג”€ L9 stage 0ג†'1: mini card tapped ג†' unlock equation builder ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX || engine.phase !== 'await-mimic' || l9Stage !== 0) return;
    return tutorialBus.subscribeUserEvent((e) => {
      if (e.kind === 'miniCardTapped') setL9Stage(1);
    });
  }, [engine.lessonIndex, engine.phase, l9Stage]);

  // ג”€ג”€ L9 stage 1: equation confirmed correctly ג†' lesson outcome fires directly ג”€ג”€
  // The lesson outcome is now `l6CopyConfirmed`, so emitting it from tutorialBus
  // triggers OUTCOME_MATCHED in the engine ג†' celebrate phase with ׳›׳ ׳”׳›׳'׳•׳“ bubble.
  useEffect(() => {
    const on = engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX && engine.phase === 'await-mimic' && l9Stage === 1;
    tutorialBus.setManualEqConfirm(on);
    return () => tutorialBus.setManualEqConfirm(false);
  }, [engine.lessonIndex, engine.phase, l9Stage]);


  // ג”€ג”€ L7 pulses choreography:
  // stage 0 -> pulse red solve chip (copy target); after learner cycles an op,
  // stage 1 -> stop red, pulse orange parens button + continuation bubble;
  // stage 2 -> stop both (free play to confirm).
  useEffect(() => {
    const isParensAwait =
      engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
      engine.phase === 'await-mimic';
    if (!isParensAwait) {
      tutorialBus.setL7SolveChipLoopPulse(false);
      tutorialBus.setParensButtonPulse(false);
      return;
    }
    if (parensIntroStage === 0) {
      tutorialBus.setL7SolveChipLoopPulse(true);
      tutorialBus.setParensButtonPulse(false);
      return;
    }
    if (parensIntroStage === 1) {
      tutorialBus.setL7SolveChipLoopPulse(false);
      tutorialBus.setParensButtonPulse(true);
      return;
    }
    tutorialBus.setL7SolveChipLoopPulse(false);
    tutorialBus.setParensButtonPulse(false);
  }, [engine.lessonIndex, engine.phase, parensIntroStage]);

  useEffect(() => {
    return () => {
      tutorialBus.setParensButtonPulse(false);
      tutorialBus.setL7SolveChipLoopPulse(false);
    };
  }, []);

  // ג”€ג”€ L7: reset intro stage when leaving OR backing up within the parens lesson. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX) {
      setParensIntroStage(0);
      return;
    }
    // Back navigation returns to bot-demo or intro ג€” reset choreography and
    // exercise counter so step 0 starts cleanly.
    if (engine.phase === 'bot-demo' || engine.phase === 'intro') {
      setParensIntroStage(0);
      // Reset waiting guard so the validator starts clean on back-nav.
      l7WaitingForBuildingRef.current = false;
    }
  }, [engine.lessonIndex, engine.phase]);

  useEffect(() => {
    const isL7Await =
      engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
      engine.phase === 'await-mimic';
    if (isL7Await) {
      setL7FanHintHidden(false);
    }
  }, [engine.lessonIndex, engine.phase, engine.stepIndex]);

  useEffect(() => {
    const isL7Step1Active =
      engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
      engine.stepIndex === 1 &&
      engine.phase === 'await-mimic';
    if (!isL7Step1Active) {
      setL7Step1MiniPicked(false);
      l7Step1SelectionRef.current = null;
      l7Step1OutcomeKeyRef.current = '';
      return;
    }
    setL7Step1MiniPicked(false);
    l7Step1SelectionRef.current = null;
    l7Step1OutcomeKeyRef.current = '';
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind === 'miniCardTapped') {
        setL7Step1MiniPicked(true);
        l7Step1SelectionRef.current = { result: evt.result, equation: evt.equation };
        tutorialBus.emitFanDemo({ kind: 'closeResultsChip' });
      }
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  useEffect(() => {
    const isL7Await =
      engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
      engine.phase === 'await-mimic';
    if (!isL7Await || l7FanHintHidden) return;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind === 'eqUserPickedDice' || evt.kind === 'opSelected' || evt.kind === 'parensToggled') {
        setL7FanHintHidden(true);
      }
    });
  }, [engine.lessonIndex, engine.phase, l7FanHintHidden]);


  // ג”€ג”€ L7 stage 0ג†'1: operator set ג†' stop red-chip pulse, start parens-button pulse ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX || engine.phase !== 'await-mimic' || parensIntroStage !== 0) return;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind === 'opSelected') setParensIntroStage(1);
    });
  }, [engine.lessonIndex, engine.phase, parensIntroStage]);

  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX) {
      setParensMockupApproved(false);
      setParensMockupPendingAdvance(false);
    }
  }, [engine.lessonIndex]);

  useEffect(() => {
    if (engine.lessonIndex !== 5 || engine.stepIndex !== 1) {
      setShowL6TapMiniContinue(false);
      return;
    }
    if (engine.phase === 'intro') setShowL6TapMiniContinue(false);
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  useEffect(() => {
    if (engine.lessonIndex !== 5 || engine.stepIndex !== 2) {
      setL6WildMockupApproved(false);
      return;
    }
    if (engine.phase === 'intro' || engine.phase === 'bot-demo') {
      setL6WildMockupApproved(false);
    }
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  useEffect(() => {
    if (!parensMockupPendingAdvance || !parensMockupApproved) return;
    setParensMockupPendingAdvance(false);
    dispatchEngine({ type: 'BOT_DEMO_DONE' });
  }, [parensMockupPendingAdvance, parensMockupApproved]);

  useEffect(() => {
    if (!identicalMockupPendingAdvance || !identicalMockupApproved) return;
    setIdenticalMockupPendingAdvance(false);
    dispatchEngine({ type: 'BOT_DEMO_DONE' });
  }, [identicalMockupPendingAdvance, identicalMockupApproved]);

  useEffect(() => {
    if (!l11MockupPendingAdvance || !l11MockupApproved) return;
    setL11MockupPendingAdvance(false);
    dispatchEngine({ type: 'BOT_DEMO_DONE' });
  }, [l11MockupPendingAdvance, l11MockupApproved]);

  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_SINGLE_IDENTICAL_LESSON_INDEX) {
      setIdenticalMockupApproved(false);
      setIdenticalMockupPendingAdvance(false);
    }
  }, [engine.lessonIndex]);

  // ג”€ג”€ L8 step 0 await-mimic: auto-advance via identicalSingleAck so the
  //    intro step (our "׳§׳׳£ ׳–׳”׳”" mockup) skips to step 1 immediately.
  //    The mockup already served as the explanation. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_SINGLE_IDENTICAL_LESSON_INDEX) return;
    if (engine.phase !== 'await-mimic' || engine.stepIndex !== 0) return;
    tutorialBus.emitUserEvent({ kind: 'identicalSingleAck' });
  }, [engine.lessonIndex, engine.phase, engine.stepIndex]);

  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX || engine.stepIndex !== 0) return;
    if (engine.phase === 'intro' || engine.phase === 'bot-demo') {
      setL9IntroApproved(false);
      setL9IntroPendingAdvance(false);
    }
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  useEffect(() => {
    if (!l9IntroPendingAdvance || !l9IntroApproved) return;
    setL9IntroPendingAdvance(false);
    dispatchEngine({ type: 'BOT_DEMO_DONE' });
  }, [l9IntroPendingAdvance, l9IntroApproved]);

  // ג”€ג”€ L7: stage 1ג†'2 when parens toggled. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX || parensIntroStage !== 1) return;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind === 'parensToggled') {
        setParensIntroStage(2);
      }
    });
  }, [engine.lessonIndex, parensIntroStage]);

  // ג”€ג”€ L7 await-mimic: enable manual eq confirm so the confirm button is visible. ג”€ג”€
  useEffect(() => {
    const isL7Step0Await =
      engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
      engine.phase === 'await-mimic' &&
      engine.stepIndex === 0;
    const isL7Step1AwaitWithMini =
      engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
      engine.phase === 'await-mimic' &&
      engine.stepIndex === 1 &&
      l7Step1MiniPicked;
    if (!isL7Step0Await && !isL7Step1AwaitWithMini) {
      tutorialBus.setManualEqConfirm(false);
      return;
    }
    tutorialBus.setManualEqConfirm(true);
    return () => tutorialBus.setManualEqConfirm(false);
  }, [engine.lessonIndex, engine.phase, engine.stepIndex, l7Step1MiniPicked]);

  // ג”€ג”€ L7 step 1 setup: runs ONCE (ref guard). Rolls dice for validTargets,
  //    opens chip. No eqPickDice ג€” equation slots stay empty so the learner
  //    picks dice manually. l7Step1Mode enables the parens-right mini-card
  //    filter without needing operators in the equation. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX) {
      l7Step1RiggedRef.current = false;
      tutorialBus.setL7Step1Mode(false);
      return;
    }
    if (engine.stepIndex !== 1) {
      l7Step1RiggedRef.current = false;
      tutorialBus.setL7Step1Mode(false);
      return;
    }
    if (engine.phase !== 'bot-demo' && engine.phase !== 'await-mimic') return;
    if (l7Step1RiggedRef.current) return;
    l7Step1RiggedRef.current = true;
    const ex = l7ExerciseRef.current;
    gameDispatch({ type: 'REVERT_TO_BUILDING' });
    gameDispatch({ type: 'TUTORIAL_SET_ENABLED_OPERATORS', operators: ['+', '-', 'x', '÷'] });
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: true });
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_SOLVE_EXERCISE', value: false });
    tutorialBus.emitFanDemo({ kind: 'disarmResultsChipPulse' });
    tutorialBus.emitFanDemo({ kind: 'clearSolveExerciseChip' });
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    tutorialBus.setL7Step1Mode(true);
    const ts = Date.now();
    const applyOp = (a: number, op: string, b: number): number | null => {
      if (op === '+') return a + b;
      if (op === '-') return a - b;
      if (op === 'x') return a * b;
      if (op === '÷') return b !== 0 && Number.isInteger(a / b) ? a / b : null;
      return null;
    };
    const ops = ['+', '-', 'x', '÷'] as const;
    const vals = [ex.d1, ex.d2, ex.d3];
    const resultSet = new Set<number>();
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (j !== i) for (let k = 0; k < 3; k++) if (k !== i && k !== j) {
      const [a, b, c] = [vals[i], vals[j], vals[k]];
      for (const op1 of ops) for (const op2 of ops) {
        const inner = applyOp(b, op2, c);
        if (inner === null) continue;
        const result = applyOp(a, op1, inner);
        if (result !== null && result > 0 && result <= 25 && Number.isInteger(result)) resultSet.add(result);
      }
    }
    const playerHand = [...resultSet].sort((a, b) => a - b).map((value, i) => ({
      id: `tut-l7s1-${value}-${ts}-${i}`,
      type: 'number' as const,
      value,
    }));
    const botHand = playerHand.map((c) => ({ ...c, id: `bot-${c.id}` }));
    gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [botHand, playerHand] });
    const id = setTimeout(() => {
      gameDispatch({ type: 'ROLL_DICE', values: { die1: ex.d1, die2: ex.d2, die3: ex.d3 } });
      tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
    }, 0);
    return () => clearTimeout(id);
  }, [engine.lessonIndex, engine.phase, engine.stepIndex, gameDispatch]);

  useEffect(() => {
    const on =
      engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
      engine.stepIndex === 1 &&
      (engine.phase === 'bot-demo' || engine.phase === 'await-mimic');
    tutorialBus.setTutorialPreserveHandOrder(on);
    return () => tutorialBus.setTutorialPreserveHandOrder(false);
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ג”€ג”€ L7 validator: fires for BOTH steps. The engine knows which step is
  //    active, so the same event (l7ParensCopyConfirmed) advances step 0
  //    to step 1's celebrate, then step 1 to lesson-done. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX) return;
    if (engine.phase !== 'await-mimic') return;
    if (engine.stepIndex !== 0) return;
    if (gameState?.phase !== 'solved') return;
    const parensRight = tutorialBus.getParensRightValue();
    const got = gameState.equationResult as number | null;
    const liveRight = tutorialBus.getL7ParensResults()?.right ?? null;
    const expected = liveRight ?? l7ExerciseRef.current.target;
    if (parensRight && got === expected) {
      tutorialBus.emitUserEvent({ kind: 'l7ParensCopyConfirmed' });
    } else if (got != null) {
      tutorialBus.emitUserEvent({ kind: 'l7ParensCopyMismatch', expected, got });
    }
  }, [engine.lessonIndex, engine.phase, engine.stepIndex, gameState?.phase, gameState?.equationResult, gameDispatch]);

  // ג”€ג”€ L7ג†'L9 boundary cleanup: once we actually leave parens, reset solved
  //    staging so the next lesson starts from a clean "building" board. ג”€ג”€
  useEffect(() => {
    const isL7Step1Await =
      engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
      engine.phase === 'await-mimic' &&
      engine.stepIndex === 1;
    if (!isL7Step1Await) {
      l7Step1OutcomeKeyRef.current = '';
      return;
    }
    if (gameState?.phase !== 'solved') return;
    const selected = l7Step1SelectionRef.current;
    const got = gameState?.equationResult as number | null;
    if (!selected || got == null) return;
    const key = `${gameState?.roundsPlayed ?? 0}:${gameState?.lastEquationDisplay ?? ''}:${selected.result}:${selected.equation}`;
    if (l7Step1OutcomeKeyRef.current === key) return;
    l7Step1OutcomeKeyRef.current = key;
    const parensRight = tutorialBus.getParensRightValue();
    const builtEquation = normalizeTutorialEquationDisplay(gameState?.lastEquationDisplay);
    const expectedEquation = normalizeTutorialEquationDisplay(selected.equation);
    if (parensRight && got === selected.result && builtEquation !== null && builtEquation === expectedEquation) {
      tutorialBus.emitUserEvent({ kind: 'l7ParensCopyConfirmed' });
    } else {
      tutorialBus.emitUserEvent({ kind: 'l7ParensCopyMismatch', expected: selected.result, got });
    }
  }, [
    engine.lessonIndex,
    engine.phase,
    engine.stepIndex,
    gameState?.phase,
    gameState?.equationResult,
    gameState?.lastEquationDisplay,
    gameState?.roundsPlayed,
  ]);

  const prevLessonIndexRef = useRef(engine.lessonIndex);
  useEffect(() => {
    const prev = prevLessonIndexRef.current;
    if (prev === MIMIC_PARENS_LESSON_INDEX && engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX) {
      gameDispatch({ type: 'REVERT_TO_BUILDING' });
      tutorialBus.setL7SolveChipLoopPulse(false);
      tutorialBus.setParensButtonPulse(false);
    }
    prevLessonIndexRef.current = engine.lessonIndex;
  }, [engine.lessonIndex, gameDispatch]);

  // ג”€ג”€ L7 mismatch bubble: show error 2.5s when wrong parens or result. ג”€ג”€
  useEffect(() => {
    setL7Mismatch(false);
    if (l7MismatchTimerRef.current) clearTimeout(l7MismatchTimerRef.current);
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX || engine.phase !== 'await-mimic') return;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind !== 'l7ParensCopyMismatch') return;
      setL7Mismatch(true);
      gameDispatch({ type: 'REVERT_TO_BUILDING' });
      setParensIntroStage(0);
      // Reset to empty equation ג€” learner places dice again from the panel above.
      tutorialBus.emitFanDemo({ kind: 'eqReset' });
      if (l7MismatchTimerRef.current) clearTimeout(l7MismatchTimerRef.current);
      l7MismatchTimerRef.current = setTimeout(() => setL7Mismatch(false), 2500);
    });
  }, [engine.lessonIndex, engine.phase]);

  // ג”€ג”€ Lesson 5a: when the learner cycles the `?` slot, publish the matching
  //    op card id prefix to tutorialBus so the fan can emphasize it. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== 4 || engine.stepIndex !== 0) return;
    const unsubscribe = tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind !== 'opSelected' || evt.via !== 'cycle') return;
      const cardIdByOp: Record<'+' | '-' | 'x' | '÷', string> = {
        '+': 'tut-l5-op-plus',
        '-': 'tut-l5-op-minus',
        'x': 'tut-l5-op-times',
        '÷': 'tut-l5-op-divide',
      };
      tutorialBus.setEmphasizedCardId(cardIdByOp[evt.op]);
      setL5SelectedOp(evt.op);
    });
    return () => {
      unsubscribe();
      tutorialBus.setEmphasizedCardId(null);
    };
  }, [engine.lessonIndex, engine.stepIndex]);

  // ג”€ג”€ L5.1 wrong-card feedback: when a non-`+` op card is placed in the slot,
  //    clear the placed card, show an error bubble for 2s, then revert to
  //    the normal hint. ג”€ג”€
  useEffect(() => {
    setL5PlaceWrong(false);
    if (l5PlaceWrongTimerRef.current) clearTimeout(l5PlaceWrongTimerRef.current);
    if (engine.lessonIndex !== 4 || engine.stepIndex !== 0 || engine.phase !== 'await-mimic') return;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind !== 'l5OperatorPlaced' || evt.position !== 0 || evt.op === '+') return;
      setL5PlaceWrong(true);
      gameDispatch({ type: 'CLEAR_EQ_HAND' });
      if (l5PlaceWrongTimerRef.current) clearTimeout(l5PlaceWrongTimerRef.current);
      l5PlaceWrongTimerRef.current = setTimeout(() => setL5PlaceWrong(false), 2000);
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // ג”€ג”€ Lesson 5: pulse the `?` slot whenever nothing is selected yet so the
  //    learner's eye is drawn to the interactive spot. Stops the instant an
  //    op is chosen. useNativeDriver is intentionally FALSE: the pulse feeds
  //    interpolations that re-create per render (different outputRanges when
  //    the slot becomes filled). Native driver can't handle that churn safely
  //    ג€” keeping the animation on the JS side avoids a native-graph crash. ג”€ג”€
  useEffect(() => {
    if (engine.lessonIndex !== 4) {
      l5SlotPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(l5SlotPulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(l5SlotPulse, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    loop.start();
    const sub = l5SlotPulse.addListener(({ value }) => {
      tutorialBus.setOpButtonPulse(value);
    });
    return () => {
      loop.stop();
      l5SlotPulse.removeListener(sub);
      tutorialBus.setOpButtonPulse(0);
    };
  }, [engine.lessonIndex, l5SlotPulse]);

  // ג”€ג”€ Celebrate timer (longer if the step provides a custom message
  //    that the learner actually needs time to read). Dice lesson (idx 2)
  //    skips straight to the equation with zero delay. L6.2 (tap-mini)
  //    requires a MANUAL "׳”׳'׳ ׳×׳™ ג€÷" confirmation so the learner can read
  //    the red SolveExerciseChip at their own pace before advancing. ג”€ג”€
  useEffect(() => {
    if (engine.phase !== 'celebrate') return;
    // Dice step 0 (roll-dice): wait for user to tap "׳”׳'׳ ׳×׳™" ג€” no auto-advance.
    if (engine.lessonIndex === 2 && engine.stepIndex === 0) return;
    // Lesson 4 step 3 ends with a blocking success modal; the learner moves
    // on only after explicitly acknowledging it.
    if (engine.lessonIndex === 3 && engine.stepIndex === 3) return;
    // L6.1 (open possible results): this is a key concept, so do not
    // auto-advance. The learner continues with the explicit "Got it" button.
    if (engine.lessonIndex === 5 && engine.stepIndex === 0) {
      return;
    }
    // Frac-intro (stepIndex 0 of any frac lesson): skip celebrate instantly
    // so the learner jumps straight into the attack step without a "׳'׳•׳ ׳ ׳ ׳¡׳”" pause.
    if (engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
        engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX &&
        engine.stepIndex === 0) {
      dispatchEngine({ type: 'CELEBRATE_DONE' });
      return;
    }
    // L10 (single identical) steps 0 + 1: skip celebrate instantly ג€” the
    // identical-card lesson ends with lesson-done, no fanfare bubble.
    if (engine.lessonIndex === MIMIC_SINGLE_IDENTICAL_LESSON_INDEX) {
      dispatchEngine({ type: 'CELEBRATE_DONE' });
      return;
    }
    if (engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX && engine.stepIndex === 0) {
      const id = setTimeout(() => {
        dispatchEngine({ type: 'CELEBRATE_DONE' });
        setTimeout(() => dispatchEngine({ type: 'BOT_DEMO_DONE' }), 0);
      }, 900);
      return () => clearTimeout(id);
    }
    // Parens lesson: auto-advance so flow continues into the next exercise.
    if (engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX) {
      const id = setTimeout(() => dispatchEngine({ type: 'CELEBRATE_DONE' }), 1200);
      return () => clearTimeout(id);
    }
    // L6.2 (tap-mini, stepIndex 1): short celebrate, then continue automatically.
    if (engine.lessonIndex === 5 && engine.stepIndex === 1) {
      const id = setTimeout(() => dispatchEngine({ type: 'CELEBRATE_DONE' }), 1200);
      return () => clearTimeout(id);
    }
    const lesson = LESSONS[engine.lessonIndex];
    const step = lesson?.steps[engine.stepIndex];
    // Dice lesson ג†' equation: instant transition, no celebration pause.
    const ms = step?.celebrateKey ? 2600 : CELEBRATE_MS;
    const id = setTimeout(() => dispatchEngine({ type: 'CELEBRATE_DONE' }), ms);
    return () => clearTimeout(id);
  }, [engine.phase, engine.lessonIndex, engine.stepIndex]);

  // ג”€ג”€ L6.2 (tap-mini): clear bot demo's solve-chip selection on entry so
  //    the learner taps their own mini-card fresh. ג”€ג”€
  useEffect(() => {
    const isL6TapMiniStep = engine.lessonIndex === 5 && engine.stepIndex === 1;
    const isL6TapMiniAwait = isL6TapMiniStep && engine.phase === 'await-mimic';
    if (!isL6TapMiniStep) {
      tutorialBus.setL6MiniLocked(false);
      return;
    }
    if (!isL6TapMiniAwait) {
      tutorialBus.setL6MiniLocked(false);
      return;
    }
    if (showL6TapMiniContinue) {
      tutorialBus.setL6MiniLocked(false);
      return;
    }
    // Clear the solve chip the bot demo may have left open so the learner's
    // own tap is the action that reveals it (teaching point of the step).
    tutorialBus.emitFanDemo({ kind: 'clearSolveExerciseChip' });
    tutorialBus.setL6MiniLocked(true);
    setShowL6TapMiniContinue(false);
    const id = setTimeout(() => tutorialBus.setL6MiniLocked(false), 1500);
    return () => { clearTimeout(id); tutorialBus.setL6MiniLocked(false); };
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, showL6TapMiniContinue]);

  useEffect(() => {
    const isL6OpenResultsCelebrate =
      engine.lessonIndex === 5 &&
      engine.stepIndex === 0 &&
      engine.phase === 'celebrate';
    if (!isL6OpenResultsCelebrate) {
      setHideL6OpenResultsBubble(false);
      return;
    }
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind === 'miniCardTapped') {
        setHideL6OpenResultsBubble(true);
      }
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ג”€ג”€ L6.2 (tap-mini): hide the mini-card explanation and show "׳”׳'׳ ׳×׳™"
  // only after the learner taps a mini card. If they tap while the bot-demo
  // reading beat is still up, move straight into await-mimic and preserve the
  // red solve chip opened by that tap.

  // ג”€ג”€ Frac-intro: reset stage whenever we leave the intro step ג”€ג”€
  useEffect(() => {
    const isL6TapMiniInteractive =
      engine.lessonIndex === 5 &&
      engine.stepIndex === 1 &&
      (engine.phase === 'bot-demo' || engine.phase === 'await-mimic');
    if (!isL6TapMiniInteractive) return;
    let advancedFromBotDemo = false;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind === 'miniCardTapped') {
        setShowL6TapMiniContinue(true);
        if (engine.phase === 'bot-demo' && !advancedFromBotDemo) {
          advancedFromBotDemo = true;
          setL6MiniDemoPendingAdvance(false);
          dispatchEngine({ type: 'BOT_DEMO_DONE' });
        }
      }
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, dispatchEngine]);

  useEffect(() => {
    const isFracIntro =
      engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
      engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX &&
      engine.stepIndex === 0;
    if (!isFracIntro) setFracIntroStage(0);
  }, [engine.lessonIndex, engine.stepIndex]);

  // ג”€ג”€ Frac intro: reset stage to 0 whenever leaving step 0 (back/skip/navigate) ג”€ג”€
  useEffect(() => {
    const isFrac = engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
                   engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
    if (!isFrac || engine.stepIndex !== 0) setFracIntroStage(0);
  }, [engine.lessonIndex, engine.stepIndex]);

  // ג”€ג”€ Frac-defense intro: reset whenever leaving step 3 ג”€ג”€
  useEffect(() => {
    const isFrac = engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
                   engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
    if (!isFrac || engine.stepIndex !== 3) setFracDefenseIntroStage(0);
  }, [engine.lessonIndex, engine.stepIndex]);

  // ג”€ג”€ Frac bonus step: reset stage + tracking ref when entering/leaving frac lesson ג”€ג”€
  useEffect(() => {
    const isFrac = engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
                   engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
    if (!isFrac || engine.stepIndex !== 5) setFracBonusStage(0);
    if (!isFrac) fracDefenseUsedFractionRef.current = { step3: false, step4: false };
  }, [engine.lessonIndex, engine.stepIndex]);

  // ג”€ג”€ Track fraction usage in defense steps 3 and 4 ג”€ג”€
  useEffect(() => {
    const isFrac = engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
                   engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
    if (!isFrac) return;
    if ((engine.stepIndex !== 3 && engine.stepIndex !== 4) || engine.phase !== 'await-mimic') return;
    return tutorialBus.subscribeUserEvent((e) => {
      if (e.kind === 'fracDefenseWithFraction') {
        if (engine.stepIndex === 3) fracDefenseUsedFractionRef.current.step3 = true;
        if (engine.stepIndex === 4) fracDefenseUsedFractionRef.current.step4 = true;
      }
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ג”€ג”€ Bonus step 5: auto-skip if user already used a fraction in step 3 or 4 ג”€ג”€
  useEffect(() => {
    const isFrac = engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
                   engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
    if (!isFrac || engine.stepIndex !== 5 || engine.phase !== 'await-mimic') return;
    const usedFrac = fracDefenseUsedFractionRef.current.step3 || fracDefenseUsedFractionRef.current.step4;
    if (usedFrac) {
      dispatchEngine({ type: 'OUTCOME_MATCHED' });
    }
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ג”€ג”€ Frac intro stage 0: flashing arrow toward the pile ג”€ג”€
  useEffect(() => {
    const isFrac = engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
                   engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
    if (!isFrac || engine.stepIndex !== 0 || fracIntroStage !== 0) {
      fracArrowPulse.stopAnimation();
      fracArrowPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fracArrowPulse, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(fracArrowPulse, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [engine.lessonIndex, engine.stepIndex, fracIntroStage, fracArrowPulse]);

  // ג”€ג”€ Pick the bubble copy for the current phase. ג”€ג”€
  const currentLesson = LESSONS[engine.lessonIndex];
  const currentStep = currentLesson?.steps[engine.stepIndex];
  const isL4bAwait = engine.lessonIndex === 3 && engine.stepIndex === 1 && engine.phase === 'await-mimic';
  const l4bHintKey: string | null = isL4bAwait
    ? (l4bHintPhase === 'pickCard' ? 'tutorial.l4b.hintPickCard' : 'tutorial.l4b.hintFillDie')
    : null;
  const l4CardMatchWrongKey: string | null =
    engine.lessonIndex === 3 &&
    (engine.stepIndex === 0 || engine.stepIndex === 1) &&
    engine.phase === 'await-mimic' &&
    l4CardMatchWrong
      ? 'tutorial.l4c.tryAgain'
      : null;
  const isL4Step3BotDemo = engine.lessonIndex === 3 && engine.stepIndex === 3 && engine.phase === 'bot-demo';
  const isL4Step3Await = engine.lessonIndex === 3 && engine.stepIndex === 3 && engine.phase === 'await-mimic';
  const isL4Step3Celebrate = engine.lessonIndex === 3 && engine.stepIndex === 3 && engine.phase === 'celebrate';
  const showL4Step3IntroModal = isL4Step3Await && !l4Step3IntroApproved;
  const showL4Step3FinishModal = isL4Step3Celebrate && !l4Step3FinishApproved;
  // Lesson 4 step 3 uses a dynamic bubble: die 1 -> die 2 -> operator -> card -> play.
  const l4Step3HintKey: string | null = isL4Step3Await
    ? (l4Step3Phase === 'pickFirstDie' ? 'tutorial.l4c.hintFull'
       : l4Step3Phase === 'pickSecondDie' ? 'tutorial.l4c.hintPickSecondDie'
       : l4Step3Phase === 'pickOperator' ? 'tutorial.l4c.hintPickOperator'
       : l4Step3Phase === 'pickCard' ? 'tutorial.l4c.hintBuildProgress'
       : l4Step3Phase === 'wrongCard' ? 'tutorial.l4c.tryAgain'
       : l4Step3Phase === 'pressPlay' ? 'tutorial.l4c.hintPressPlay'
       : null)
    : null;
  // Lesson 5 step 5b (joker-place, now stepIndex 1) dynamic bubble:
  // tap joker ג†' pick ג†' place.
  const isL5bAwait = engine.lessonIndex === 4 && engine.stepIndex === 1 && engine.phase === 'await-mimic';
  const l5bHintKey: string | null = isL5bAwait
    ? (l5JokerWrong ? 'tutorial.l5b.wrongSign'
       : l5FlowHintPhase === 'pickModal' ? 'tutorial.l5b.hintPickInModal'
       : l5FlowHintPhase === 'placeSign' ? 'tutorial.l5b.hintPlaceSign'
       : 'tutorial.l5b.hintTapJoker')
    : null;
  // Three-phase hint for L5.1 (place-op):
  //   1. no card selected yet ג†' "choose an op card that solves {{result}}"
  //   2. card selected (equationHandPick set) ג†' "now press in the exercise to place it"
  //   3. wrong card placed ג†' error message (auto-clears after 2s)
  const isL5PlaceAwait = engine.lessonIndex === 4 && engine.stepIndex === 0 && engine.phase === 'await-mimic';
  const L5A_TARGET_RESULT = l5DiceRef.current.d1 + l5DiceRef.current.d2;
  // "X+X" condition: dice are rolled ג€” equation shows die1 and die2 values.
  const l5EquationHasXplusX = !!(gameState?.dice?.die1 != null && gameState?.dice?.die2 != null);
  const l5PlaceHintKey: string | null = isL5PlaceAwait
    ? (l5PlaceWrong
        ? 'tutorial.l5op.wrong'
        : (gameState?.equationHandPick != null
            ? 'tutorial.l5a.hintPressEquation'
            : (l5EquationHasXplusX ? 'tutorial.l5a.hintChooseCard' : null)))
    : null;
  const l5PlaceHintParams: Record<string, string> | undefined =
    l5PlaceHintKey === 'tutorial.l5a.hintChooseCard' ? { result: String(L5A_TARGET_RESULT) } : undefined;
  const isL6TapMiniAwait = engine.lessonIndex === 5 && engine.stepIndex === 1 && engine.phase === 'await-mimic';
  const l6TapMiniHintKey: string | null = isL6TapMiniAwait
    ? (showL6TapMiniContinue ? 'tutorial.l6b.hintReadExercise' : 'tutorial.l6b.hintTapMini')
    : null;
  const isL6WildIntro = engine.lessonIndex === 5 && engine.stepIndex === 2 && engine.phase === 'intro';
  const isL6WildBotDemo = engine.lessonIndex === 5 && engine.stepIndex === 2 && engine.phase === 'bot-demo';
  const isL6WildAwait = engine.lessonIndex === 5 && engine.stepIndex === 2 && engine.phase === 'await-mimic';
  const isL6WildCelebrate = engine.lessonIndex === 5 && engine.stepIndex === 2 && engine.phase === 'celebrate';
  const isL6WildMockupOpen = isL6WildIntro && !l6WildMockupApproved;
  const isL6CopyAwait = engine.lessonIndex === 5 && engine.stepIndex === 2 && engine.phase === 'await-mimic';
  const l6MismatchHintKey: string | null = isL6CopyAwait && l6Mismatch ? 'tutorial.l6c.mismatch' : null;
  const l6WildSelectionReady =
    isL6CopyAwait &&
    isL6WildTutorialSelectionReady(
      gameState?.stagedCards ?? [],
      gameState?.equationResult,
      gameState?.mathRangeMax ?? 25,
    );
  const l6WildHintKey: string | null =
    isL6WildAwait
      ? (l6MismatchHintKey
          ? l6MismatchHintKey
          : l6WildSelectionReady
            ? 'tutorial.l6c.hintConfirm'
            : (currentStep?.hintKey ?? null))
      : null;
  const isL9CopyAwait = engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX && engine.stepIndex === 0 && engine.phase === 'await-mimic';
  const l9MismatchHintKey: string | null = isL9CopyAwait && l9Mismatch ? 'tutorial.l9.copy.mismatch' : null;
  const isL9Lesson = engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX;
  const l9SelectMiniKey: string | null =
    isL9Lesson && engine.phase === 'await-mimic' && l9Stage === 0
      ? 'tutorial.l9.selectMini'
      : null;
  const l9BuildEqKey: string | null = null;
  const l9ChooseCardKey: string | null = null; // stage 2 removed ג€” lesson ends on l6CopyConfirmed
  const l11HintParams: Record<string, string> | undefined =
    engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX &&
    (engine.stepIndex === 0 || engine.stepIndex === 1) &&
    tutorialBus.getL11Config()?.target != null
      ? { n: String(tutorialBus.getL11Config()?.target) }
      : undefined;
  const isL7ParensAwait = engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX && engine.phase === 'await-mimic';
  const isL7Step1Await = engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
    engine.stepIndex === 1 &&
    engine.phase === 'await-mimic';
  const isL7Step1Phase = engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
    engine.stepIndex === 1 &&
    (engine.phase === 'bot-demo' || engine.phase === 'await-mimic');
  const l7MismatchHintKey: string | null = isL7ParensAwait && l7Mismatch ? 'tutorial.l8.mismatch' : null;
  // Fractions intro step uses custom dedicated bubbles ג€” suppress default bubble.
  // Parens lesson does NOT suppress (it uses its own hintKey via currentStep).
  const isFracIntroActive =
    engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
    engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX &&
    engine.stepIndex === 0 &&
    (engine.phase === 'bot-demo' || engine.phase === 'await-mimic');
  const isFracAttackActive =
    engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
    engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX &&
    (engine.stepIndex === 1 || engine.stepIndex === 2);
  // Defense steps (3-5) have their own HappyBubble ג€” suppress the default bubble.
  const isFracDefenseActive =
    engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
    engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX &&
    engine.stepIndex >= 3 &&
    (engine.phase === 'bot-demo' || engine.phase === 'await-mimic');
  const bubbleText: string | null =
    isFracIntroActive ? null
    : isFracDefenseActive ? null
    : (isFracAttackActive && engine.phase === 'bot-demo') ? null
    : (engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX && (engine.stepIndex === 0 || engine.stepIndex === 1) && engine.phase === 'await-mimic') ? null
    : isL4Step3BotDemo ? null
    : showL4Step3IntroModal || showL4Step3FinishModal ? null
    : engine.phase === 'post-signs-choice' || engine.phase === 'core-complete' ? null
    : isL7Step1Phase ? null
    : isL6WildIntro ? (isL6WildMockupOpen ? null : (currentStep?.botHintKey ? t(currentStep.botHintKey) : null))
    : isL6WildBotDemo ? null
    : isL6WildAwait ? (l6WildHintKey ? t(l6WildHintKey) : null)
    : isL6WildCelebrate ? 'אתם מוכנים למשחק האמיתי!\nסיימתם את ההדרכה הבסיסית.'
    : engine.phase === 'bot-demo' ? (isL9Lesson ? null : (currentStep?.botHintKey ? t(currentStep.botHintKey) : null))
    : engine.phase === 'await-mimic'
      ? (l9SelectMiniKey ? t(l9SelectMiniKey) : l9BuildEqKey ? t(l9BuildEqKey) : l9MismatchHintKey ? t(l9MismatchHintKey) : l9ChooseCardKey ? t(l9ChooseCardKey) : l4CardMatchWrongKey ? t(l4CardMatchWrongKey) : l4bHintKey ? t(l4bHintKey) : l4Step3HintKey ? t(l4Step3HintKey) : l5PlaceHintKey ? t(l5PlaceHintKey, l5PlaceHintParams) : l5bHintKey ? t(l5bHintKey) : l6TapMiniHintKey ? t(l6TapMiniHintKey) : l6WildHintKey ? t(l6WildHintKey) : l7MismatchHintKey ? t(l7MismatchHintKey) : (engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX ? null : (currentStep?.hintKey ? t(currentStep.hintKey, (currentStep.hintKey === 'tutorial.multiPlayExercise.hint' || currentStep.hintKey === 'tutorial.multiPlayExerciseMore.hint') ? l11HintParams : undefined) : null)))
    : engine.phase === 'celebrate'
      ? (hideL6OpenResultsBubble && engine.lessonIndex === 5 && engine.stepIndex === 0
          ? null
          : (currentStep?.celebrateKey ? t(currentStep.celebrateKey) : t('tutorial.engine.celebrate')))
    // lesson-done has no bubble ג€” celebrate already said its piece, and a
    // generic "you finished the lesson" right after every action is noise.
    : engine.phase === 'all-done' ? t('tutorial.engine.allDone')
    : null;
  const isL4CardChoiceBubble =
    l4CardMatchWrongKey === 'tutorial.l4c.tryAgain' ||
    l4Step3HintKey === 'tutorial.l4c.hintBuildProgress' ||
    l4Step3HintKey === 'tutorial.l4c.tryAgain';
  const bubbleTitle =
    isL4CardChoiceBubble
      ? String(gameState?.equationResult ?? '?')
      : undefined;
  const bubbleTitleStyleOverride =
    isL4CardChoiceBubble
      ? {
          color: '#C2410C',
          fontSize: 38,
          lineHeight: 42,
          fontWeight: '900' as const,
          letterSpacing: 0.5,
          marginBottom: 8,
        }
      : undefined;
  const bubbleTextStyleOverride =
    l4CardMatchWrongKey === 'tutorial.l4c.tryAgain'
      ? {
          color: '#991B1B',
          fontSize: 17,
          lineHeight: 24,
          fontWeight: '900' as const,
        }
      : l4bHintKey === 'tutorial.l4b.hintPickCard'
      ? {
          color: '#9A3412',
          fontSize: 16,
          lineHeight: 20,
          fontWeight: '900' as const,
        }
      : l4Step3HintKey === 'tutorial.l4c.hintBuildProgress'
        ? {
            color: '#7C2D12',
            fontSize: 16,
            lineHeight: 22,
            fontWeight: '900' as const,
          }
        : l4Step3HintKey === 'tutorial.l4c.hintPressPlay'
          ? {
              color: '#9A3412',
              fontSize: 19,
              lineHeight: 24,
              fontWeight: '900' as const,
            }
          : l4Step3HintKey === 'tutorial.l4c.tryAgain'
            ? {
                color: '#991B1B',
                fontSize: 17,
                lineHeight: 24,
                fontWeight: '900' as const,
              }
      : undefined;
  const bubbleTone: HappyBubbleTone =
    l4Step3HintKey === 'tutorial.l4c.hintPressPlay' ? 'buttonOrange'
    : l4Step3HintKey === 'tutorial.l4c.tryAgain' || l4CardMatchWrongKey === 'tutorial.l4c.tryAgain' ? 'buttonRed'
    : engine.phase === 'celebrate' || engine.phase === 'lesson-done' || engine.phase === 'all-done' ? 'celebrate'
    : engine.phase === 'await-mimic' ? 'turn'
    : 'demo';

  // Fan strip lives at the bottom of the screen. getWebGameLayout now returns
  // the same mobile constants (handBottom=195, fanViewportHeight=116).
  const FAN_BOTTOM = webTutorialLayout?.handBottom ?? 195;
  const FAN_STRIP_H = webTutorialLayout?.fanViewportHeight ?? 116;
  const FAN_VISUAL_TOP_FROM_BOTTOM = FAN_BOTTOM + FAN_STRIP_H + 30; // 365 ג€” leaves a clear margin above bleeding cards
  // Uniform bottom offset for every "׳”׳'׳ ׳×׳™" intro-overlay button across all lessons.
  const GOT_IT_BOTTOM = 28;
  // Advanced lessons (fractions, parens) need a bit more breathing room above the hand.
  const GOT_IT_BOTTOM_ADV = 52;
  // Header column (top-left): red "׳™׳¦׳™׳׳”" + ׳˜׳•׳¨׳ ׳™׳¨ + sound buttons stack
  // here, ~72px wide each + paddingHorizontal:12 + small buffer = ~100. Three
  // 32px buttons stacked at marginTop:-65 leaves the column ending around 110.
  const HEADER_COL_W = 100;
  const HEADER_COL_H = 110;
  // Lesson 2 (dice) exposes a vertical window in the middle/bottom area
  // covering both the gold dice button (~82ג€“140 px from bottom) and the
  // equation area where the rolled dice land (~200ג€“360 px from bottom).
  const DICE_WINDOW_BOTTOM = 60;
  const DICE_WINDOW_TOP_FROM_BOTTOM = 400;

  const isDiceLesson = engine.lessonIndex === 2 && engine.stepIndex === 0;
  const isEquationLesson = engine.lessonIndex === 3;
  const isOpCycleLesson = engine.lessonIndex === 4;
  const isPossibleResultsLesson = engine.lessonIndex === 5;
  const isFracLesson =
    engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
    engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
  const isParensLesson = engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX;
  const isIdenticalLesson = engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX;
  const isL3TipStep = engine.lessonIndex === 4 && engine.stepIndex === 2;
  const isL10Intro = engine.lessonIndex === MIMIC_SINGLE_IDENTICAL_LESSON_INDEX &&
    engine.stepIndex === 0 &&
    (engine.phase === 'await-mimic' || engine.phase === 'bot-demo');
  const isL10PlayStep = engine.lessonIndex === MIMIC_SINGLE_IDENTICAL_LESSON_INDEX &&
    engine.stepIndex === 1 &&
    (engine.phase === 'await-mimic' || engine.phase === 'bot-demo');
  const isL11PlayStep = engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX &&
    (engine.stepIndex === 0 || engine.stepIndex === 1) &&
    (engine.phase === 'await-mimic' || engine.phase === 'bot-demo');
  const l11Target = tutorialBus.getL11Config()?.target ?? null;
  const l11StagedCards = gameState?.stagedCards ?? [];
  const l11PositiveNumberCount = l11StagedCards.filter((c: Card) => c.type === 'number' && (c.value ?? 0) > 0).length;
  const l11HasZeroStaged = l11StagedCards.some((c: Card) => c.type === 'number' && c.value === 0);
  const l11HasWildStaged = l11StagedCards.some((c: Card) => c.type === 'wild');
  const isL11SecondExerciseAwait =
    engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX &&
    engine.stepIndex === 1 &&
    engine.phase === 'await-mimic';
  const l11TopHintKey =
    engine.stepIndex === 0
      ? 'tutorial.multiPlayExercise.hint'
      : isL11SecondExerciseAwait && l11PositiveNumberCount >= 2 && !l11HasWildStaged
        ? 'tutorial.multiPlayExerciseWild.hint'
        : 'tutorial.multiPlayExerciseMore.hint';

  // Lesson 4 step 3 (did-you-know): overlay before the full-build step.
  const isL4DidYouKnow = false;
  // Top discard card value ג€” used by the L10 intro overlay mockup.
  const l10TopDiscard = gameState?.discardPile?.[gameState.discardPile.length - 1];
  const l10TopDiscardValue = l10TopDiscard?.value ?? '?';

  // Step progress indicator:
  // multi-step lessons show an explicit sub-step so a second exercise does
  // not look like "the same screen" inside the same lesson.
  // (e.g. 2.1, 2.2, then next lesson starts at 3).
  const coreLessons = LESSONS.slice(0, MIMIC_LAST_CORE_LESSON_INDEX + 1);
  const totalCoreLessons = coreLessons.length;
  const isAdvancedLesson =
    engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
    engine.lessonIndex <= MIMIC_IDENTICAL_LESSON_INDEX;
  const advancedLessons = LESSONS.slice(MIMIC_FIRST_FRACTION_LESSON_INDEX);
  const totalAdvancedLessons = advancedLessons.length;
  const currentLessonStepCount = LESSONS[engine.lessonIndex]?.steps.length ?? 0;
  const lessonOrdinal = isAdvancedLesson
    ? (engine.lessonIndex - MIMIC_FIRST_FRACTION_LESSON_INDEX + 1)
    : (engine.lessonIndex + 1);
  const tutorialLayersBeforeCurrentLesson = LESSONS
    .slice(0, engine.lessonIndex)
    .reduce((total, lesson) => total + lesson.steps.length * 4, 0);
  const tutorialCurrentStepLayerBase = engine.stepIndex * 4;
  const tutorialCurrentPhaseLayerOffset =
    showWelcomeBubble ? 0
    : engine.phase === 'intro' ? 1
    : engine.phase === 'bot-demo' ? 2
    : engine.phase === 'await-mimic' ? 3
    : engine.phase === 'celebrate' || engine.phase === 'lesson-done' ? 4
    : engine.phase === 'core-complete' || engine.phase === 'post-signs-choice' || engine.phase === 'advanced-complete' || engine.phase === 'all-done' ? 1
    : 0;
  const tutorialLayerNumber = Math.max(
    1,
    1 + tutorialLayersBeforeCurrentLesson + tutorialCurrentStepLayerBase + tutorialCurrentPhaseLayerOffset,
  );
  const tutorialStepNumber =
    currentLessonStepCount > 1
      ? `${lessonOrdinal}.${Math.max(1, Math.min(currentLessonStepCount, engine.stepIndex + 1))}`
      : `${lessonOrdinal}`;
  const shouldHideTutorialLayer = HIDDEN_TUTORIAL_LAYERS.has(tutorialLayerNumber);
  const resolvedCoreRewardOutcome =
    coreRewardOutcome ??
    getTutorialRewardOutcome({
      skipCount,
      earnedCount: tutorialCoinsEarnedCount,
    });
  const resolvedAdvancedRewardOutcome =
    advancedRewardOutcome ??
    getTutorialRewardOutcome({
      skipCount,
      earnedCount: tutorialCoinsEarnedCount,
    });

  useEffect(() => {
    onProgressChange?.({
      ...tutorialProgress,
      layerNumber: tutorialLayerNumber,
      stepNumber: tutorialStepNumber,
    });
  }, [onProgressChange, tutorialLayerNumber, tutorialProgress, tutorialStepNumber]);

  useEffect(() => {
    if (!shouldHideTutorialLayer) return;
    const nextAction = getHiddenLayerAdvanceAction(engine.phase);
    if (!nextAction) return;
    const timer = setTimeout(() => dispatchEngine(nextAction), 0);
    return () => clearTimeout(timer);
  }, [shouldHideTutorialLayer, engine.phase]);

  // Bubble sits just above whatever window is exposed for this lesson.
  // For the dice lesson's initial hint ("׳ ׳¡׳• ׳׳”׳˜׳™׳ ׳§׳•׳'׳™׳•׳×") we keep the
  // bubble at the previous lesson's position so it doesn't jump; only the
  // subsequent messages (celebrate / lesson-done) rise above the dice window.
  const diceHintShouldStayLow =
    isDiceLesson && (engine.phase === 'bot-demo' || engine.phase === 'await-mimic');
  const BUBBLE_BOTTOM = isDiceLesson && !diceHintShouldStayLow
    ? DICE_WINDOW_TOP_FROM_BOTTOM + 12
    : FAN_VISUAL_TOP_FROM_BOTTOM + 18;
  // L5.1 bubble sits just above the fan cards (below equation mockup).
  // FAN_BOTTOM + FAN_STRIP_H is the fan strip container top without the 30px
  // safety margin, keeping the bubble below the equation on all screen sizes.
  const L5_STEP0_BUBBLE_BOTTOM = FAN_BOTTOM + FAN_STRIP_H;
  const isAndroidTutorialUi = Platform.OS === 'android';
  const tutorialTopControlRight = isAndroidTutorialUi ? 106 : 12;
  const tutorialTopBubbleInsets = isAndroidTutorialUi
    ? { left: 104, right: 12 }
    : { left: 16, right: 16 };
  const tutorialCompactBubbleMaxWidth = isAndroidTutorialUi ? 236 : 300;
  const tutorialNormalBubbleMaxWidth = isAndroidTutorialUi ? 276 : undefined;
  const tutorialSideBubbleMaxWidth = isAndroidTutorialUi ? 248 : 320;
  // Desktop web uses the same narrow playfield as mobile, so tutorial hints
  // that floated mid-screen started covering the table. Keep those hints in
  // the slot just above the table instead.
  const tutorialWebAboveTableBubbleTop =
    Platform.OS === 'web' && webTutorialLayout
      ? Math.max(124, webTutorialLayout.tableTop - 76)
      : null;
  const tutorialCompactMidBubbleTop = tutorialWebAboveTableBubbleTop ?? 400;
  const tutorialL6AfterOpenBubbleTop = tutorialWebAboveTableBubbleTop ?? Math.max(tutorialSafeTop + 58, 112);
  const tutorialGameTableBottom =
    webTutorialLayout
      ? webTutorialLayout.tableTop + webTutorialLayout.tableHeight
      : nativeTutorialLayout
        ? nativeTutorialLayout.tableTop + nativeTutorialLayout.tableHeight
        : 445;
  const tutorialL6BubbleFrameHeight =
    webTutorialLayout?.frameHeight ?? tutorialViewport.height ?? 844;
  const tutorialL6OpenChipBubbleTop = Math.min(
    Math.max(tutorialGameTableBottom + 64, 478),
    Math.max(tutorialGameTableBottom + 64, tutorialL6BubbleFrameHeight - 220),
  );
  const tutorialL6ReadExerciseFallbackTop = Math.max(166, tutorialSafeTop + 118);
  const tutorialL6ReadExerciseBubbleTop = Math.min(
    Math.max(
      tutorialL6ReadExerciseFallbackTop,
      solveChipRect
        ? Math.ceil(solveChipRect.top + solveChipRect.height + 10)
        : tutorialL6ReadExerciseFallbackTop,
    ),
    Math.max(tutorialL6ReadExerciseFallbackTop, tutorialL6BubbleFrameHeight - 320),
  );
  const tutorialSideHintBubbleTop = tutorialWebAboveTableBubbleTop ?? 340;

  // ג”€ג”€ Skip button: pushes the engine forward one phase. Lets us walk
  //    through the tutorial without performing every action. ג”€ג”€
  // Counts presses during bot-demo/await-mimic ג€” the phases where learning
  // is expected. > 2 such skips blocks the coin reward at core-complete.
  const handleTutorialBack = useCallback(() => {
    if (showWelcomeBubble) return;
    if (
      advancedStartedFromWelcomeRef.current &&
      engine.lessonIndex === MIMIC_FIRST_FRACTION_LESSON_INDEX &&
      engine.stepIndex === 0
    ) {
      advancedStartedFromWelcomeRef.current = false;
      dispatchEngine({ type: 'EXIT' });
      dispatchEngine({ type: 'START' });
      setShowWelcomeBubble(true);
      return;
    }
    if (
      engine.lessonIndex === MIMIC_SINGLE_IDENTICAL_LESSON_INDEX &&
      engine.stepIndex === 1
    ) {
      setIdenticalMockupApproved(false);
      setIdenticalMockupPendingAdvance(false);
      l8Step1RiggedRef.current = false;
      dispatchEngine({ type: 'GO_BACK' });
      dispatchEngine({ type: 'DISMISS_INTRO' });
      return;
    }
    if (isL9Lesson && engine.phase === 'await-mimic' && l9Stage > 0) {
      if (l9Stage === 2) {
        setL9Stage(1);
        gameDispatch({ type: 'REVERT_TO_BUILDING' });
        tutorialBus.emitFanDemo({ kind: 'eqReset' });
      } else {
        l9InternalResetRef.current = true;
        setL9Stage(0);
        tutorialBus.setL6CopyConfig(null);
        tutorialBus.emitFanDemo({ kind: 'eqReset' });
        gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: true });
        tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
      }
      return;
    }
    if (engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX && engine.stepIndex === 1) {
      l8Step3RiggedRef.current = false;
      l11RiggedRef.current = false;
      l11Step0AwaitRiggedRef.current = false;
      l11AwaitRiggedRef.current = false;
      dispatchEngine({ type: 'GO_BACK_LAYER' });
      return;
    }
    if (engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX && engine.stepIndex === 0) {
      l11RiggedRef.current = false;
      l11Step0AwaitRiggedRef.current = false;
      l11AwaitRiggedRef.current = false;
      dispatchEngine({ type: 'GO_BACK_LAYER' });
      return;
    }
    if (
      engine.phase === 'lesson-done' ||
      engine.phase === 'advanced-complete' ||
      engine.phase === 'all-done' ||
      engine.phase === 'core-complete' ||
      engine.phase === 'post-signs-choice'
    ) {
      dispatchEngine({ type: 'GO_BACK' });
      return;
    }
    dispatchEngine({ type: 'GO_BACK_LAYER' });
  }, [
    engine.lessonIndex,
    engine.phase,
    engine.stepIndex,
    gameDispatch,
    isL9Lesson,
    l9Stage,
    showWelcomeBubble,
  ]);

  const skipForward = useCallback(() => {
    if (showWelcomeBubble) return;
    if (engine.phase === 'bot-demo' || engine.phase === 'await-mimic') {
      setSkipCount((n) => n + 1);
    }
    switch (engine.phase) {
      case 'intro': dispatchEngine({ type: 'DISMISS_INTRO' }); break;
      case 'bot-demo':
        if (
          engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
          engine.stepIndex === 0 &&
          !parensMockupApproved
        ) {
          // Skip should dismiss the explanatory mockup and continue immediately,
          // not wait for a separate CTA press that leaves the lesson stuck.
          setParensMockupPendingAdvance(true);
          setParensMockupApproved(true);
          break;
        }
        if (
          engine.lessonIndex === MIMIC_SINGLE_IDENTICAL_LESSON_INDEX &&
          engine.stepIndex === 0 &&
          !identicalMockupApproved
        ) {
          setIdenticalMockupPendingAdvance(true);
          setIdenticalMockupApproved(true);
          break;
        }
        if (
          engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX &&
          engine.stepIndex === 1 &&
          !l11MockupApproved
        ) {
          setL11MockupPendingAdvance(true);
          setL11MockupApproved(true);
          break;
        }
        dispatchEngine({ type: 'BOT_DEMO_DONE' });
        break;
      case 'await-mimic': dispatchEngine({ type: 'OUTCOME_MATCHED' }); break;
      case 'celebrate': dispatchEngine({ type: 'CELEBRATE_DONE' }); break;
      case 'lesson-done': dispatchEngine({ type: 'DISMISS_LESSON_DONE' }); break;
      case 'core-complete': dispatchEngine({ type: 'DISMISS_CORE_COMPLETE' }); break;
      case 'post-signs-choice': dispatchEngine({ type: 'CHOOSE_FINISH_TUTORIAL' }); break;
      case 'advanced-complete': dispatchEngine({ type: 'DISMISS_ADVANCED_COMPLETE' }); onExit(); break;
      case 'all-done': onExit(); break;
      default: break;
    }
  }, [
    engine.phase,
    engine.lessonIndex,
    engine.stepIndex,
    identicalMockupApproved,
    l11MockupApproved,
    onExit,
    parensMockupApproved,
    showWelcomeBubble,
  ]);

  useEffect(() => tutorialBus.subscribeRequestBack(handleTutorialBack), [handleTutorialBack]);
  useEffect(() => tutorialBus.subscribeRequestSkip(skipForward), [skipForward]);

  if (shouldHideTutorialLayer) {
    return null;
  }

  const tutorialOverlay = (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Single-tone tutorial coverage ג€” one opaque color (#0a1628) painted
          as contiguous bands around the lesson's focal "window". All bands
          bleed past the screen edges (top:-60, sides:-10, bottom:-60) so
          the coverage extends into notched/overscan areas. No semi-
          transparent wash ג€” that created visible seams between bands.

          Windows left uncovered per lesson:
            ג€¢ All non-equation lessons: top-left corner (0..HEADER_COL_W,
              0..HEADER_COL_H) for the game's red "׳™׳¦׳™׳׳”" button.
            ג€¢ Fan/tap lessons: bottom strip from FAN_VISUAL_TOP_FROM_BOTTOM
              down, so the card fan shows through.
            ג€¢ Dice lesson: no bottom window ג€” tutorial renders its own dice
              button on top, so coverage extends all the way down.
            ג€¢ Equation lesson: no body coverage at all ג€” the real game's
              EquationBuilder + PlayerHand + discard pile must be visible. */}

      {/* Top band removed ג€” player chips, tournament, and other header
          elements are already gated by !state.isTutorial in the game
          components. No need for a covering rectangle that creates a
          visible seam in the upper-right corner. */}

      {/* Body band ג€” spans full width (with side bleed), from the bottom of
          the header row down to either the top of the fan window or the
          bottom of the screen, depending on the lesson. */}
      {isDiceLesson ? (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: HEADER_COL_H,
            left: -10,
            right: -10,
            bottom: -60,
            backgroundColor: '#0a1628',
            zIndex: 9000,
          }}
        />
      ) : (isEquationLesson || isOpCycleLesson || isPossibleResultsLesson || isFracLesson || isParensLesson || isIdenticalLesson
          || engine.lessonIndex === MIMIC_SINGLE_IDENTICAL_LESSON_INDEX
          || engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX) ? (
        null
      ) : (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: HEADER_COL_H,
            left: -10,
            right: -10,
            bottom: FAN_VISUAL_TOP_FROM_BOTTOM,
            backgroundColor: '#0a1628',
            zIndex: 9000,
          }}
        />
      )}

      {/* Dice lesson body ג€” tutorial-owned button + dice display, matching
          the real game: button anchored at GOLD_ACTION_BUTTON_TOP (low on
          screen) and dice rendered as a row of framed gold faces in the
          equation-builder zone. */}
      {isDiceLesson ? (
        <>
          {/* Dice display ג€” equation-builder style row, sits in the upper-
              middle of the canvas where the real builder lives. */}
          {tutorialDice ? (
            <View
              pointerEvents="none"
              style={{ position: 'absolute', top: HEADER_COL_H + 110, left: 0, right: 0, alignItems: 'center', zIndex: 9100 }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                }}
              >
                {[tutorialDice.d1, tutorialDice.d2, tutorialDice.d3].map((v, idx) => (
                  <View
                    key={idx}
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 14,
                      borderWidth: 2,
                      borderColor: 'rgba(232,184,48,0.4)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <GoldDieFace value={v} size={52} />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Gold dice button ג€” same screen position as in the real game.
              Driven by `dicePulse` (animation loop runs while bot-demo is
              active for this step). The bot's pulseDiceBtn call also plays
              the dice-roll sound during the demo.
              In await-mimic the button becomes interactive ג€” the learner
              must tap it to roll; tapping plays the sound, reveals the dice
              faces, and emits the diceRolled event. */}
          {!tutorialDice ? (
            <View
              pointerEvents={engine.phase === 'await-mimic' ? 'auto' : 'none'}
              style={{
                position: 'absolute',
                top: webTutorialLayout?.goldActionButtonTop ?? Math.max(96, Math.min(680, tutorialViewport.height - 140)),
                left: 0,
                right: 0,
                alignItems: 'center',
                zIndex: 9100,
              }}
            >
              <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: -14,
                    left: -14,
                    right: -14,
                    bottom: -14,
                    borderRadius: 70,
                    borderWidth: 4,
                    borderColor: '#FCD34D',
                    opacity: dicePulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.95] }),
                    transform: [{ scale: dicePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
                  }}
                />
                <GoldDiceButton
                  onPress={() => {
                    if (engine.phase !== 'await-mimic') return;
                    const l4 = l4DiceRef.current ?? rollL4Dice();
                    if (!isSfxMuted()) {
                      // eslint-disable-next-line @typescript-eslint/no-var-requires
                      Audio.Sound.createAsync(diceRollSound, getAudioLoadStatus()).then(({ sound }) => {
                        if (isSfxMuted()) {
                          sound.unloadAsync().catch(() => {});
                          return;
                        }
                        sound.replayAsync(getAudioReplayStatus()).catch(() => {});
                        sound.setOnPlaybackStatusUpdate((s) => {
                          if ((s as { didJustFinish?: boolean }).didJustFinish) sound.unloadAsync().catch(() => {});
                        });
                      }).catch(() => {});
                    }
                    setTutorialDice({ d1: l4.d1, d2: l4.d2, d3: l4.d3 });
                    tutorialBus.emitUserEvent({ kind: 'diceRolled' });
                  }}
                  width={160}
                  size={58}
                />
              </View>
            </View>
          ) : null}

          {/* "׳”׳'׳ ׳×׳™" button after rolling ג€” blocks auto-advance so learner
              reads the celebrate bubble at their own pace. */}
          {engine.phase === 'celebrate' ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => dispatchEngine({ type: 'CELEBRATE_DONE' })}
              style={{ position: 'absolute', bottom: Platform.OS === 'android' ? GOT_IT_BOTTOM + 150 : GOT_IT_BOTTOM, left: 0, right: 0, alignItems: 'center', zIndex: 9410 }}
            >
              <View style={{
                backgroundColor: '#2563EB', borderRadius: 20,
                paddingVertical: 15, paddingHorizontal: 48,
                borderWidth: 2, borderColor: '#93C5FD',
                ...Platform.select({
                  ios: { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 },
                  android: { elevation: 12 },
                }),
              }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>
                  {locale === 'he' ? 'הבנתי ✓' : 'Got it ✓'}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}

        </>
      ) : null}

      {/* Lesson 5 runs on the real game UI (EquationBuilder + hand).
          Step 5.1 (place-op) pre-fills the full equation + sets `+` on both
          operator slots; the learner drops an operation card on op1.
          Step 5.2 (joker-place) introduces Slinda the joker. */}

      {/* (Legacy solve-for-op puzzle kept commented out ג€” the step was
          retired when the lesson was reduced to two screens.) */}
      {false ? (() => {
        const current = l5Exercises[l5ExIndex];
        if (!current) return null;
        const displayOp: L5Op | null = l5PendingJokerOp ?? l5SelectedOp;
        const liveResult = computeL5Result(current.a, current.b, displayOp);
        const confirmEnabled = displayOp !== null;
        const isCorrect = displayOp !== null && computeL5Result(current.a, current.b, displayOp) === current.result;
        const onConfirm = () => {
          if (!confirmEnabled) return;
          if (isCorrect) {
            const idx = l5ExIndex as 0 | 1;
            tutorialBus.emitUserEvent({ kind: 'l5OpSolveCorrect', exerciseIdx: idx });
            if (idx === 0) {
              // Advance to exercise 2 with a clean slot.
              setL5ExIndex(1);
              setL5SelectedOp(null);
              setL5PendingJokerOp(null);
              setL5JokerOpen(false);
            } else {
              // Both done ג€” fire the step outcome.
              setL5ExIndex(2);
              tutorialBus.emitUserEvent({ kind: 'l5OpExercisesDone' });
            }
          } else {
            tutorialBus.emitUserEvent({ kind: 'l5OpSolveWrong' });
            setWrongAttemptTick((n) => n + 1);
          }
        };
        const onSlotTap = () => {
          // If a joker sign is pending, placing it in the slot commits it.
          if (l5PendingJokerOp !== null) {
            setL5SelectedOp(l5PendingJokerOp);
            setL5PendingJokerOp(null);
            return;
          }
          // Otherwise cycle through the four signs.
          const cur = l5SelectedOp;
          const idx = cur === null ? -1 : L5_CYCLE.indexOf(cur);
          const next = L5_CYCLE[(idx + 1) % L5_CYCLE.length];
          setL5SelectedOp(next);
        };
        const onOpCardTap = (op: L5Op) => {
          setL5SelectedOp(op);
          setL5PendingJokerOp(null);
        };
        return (
          <>
            {/* Dark cover over the real game body. */}
            <View
              pointerEvents="auto"
              style={{
                position: 'absolute',
                top: HEADER_COL_H,
                left: -10,
                right: -10,
                bottom: -60,
                backgroundColor: '#0a1628',
                zIndex: 9000,
              }}
            />
            {/* Exercise counter (e.g. "׳×׳¨׳'׳™׳ 1 ׳׳×׳•׳ 2"). */}
            <View pointerEvents="none" style={{ position: 'absolute', top: HEADER_COL_H + 28, left: 0, right: 0, alignItems: 'center', zIndex: 9100 }}>
              <Text style={{ color: '#CBD5E1', fontSize: 13, fontWeight: '700' }}>
                {locale === 'he' ? `תרגיל ${l5ExIndex + 1} מתוך 2` : `Exercise ${l5ExIndex + 1} of 2`}
              </Text>
            </View>
            {/* Equation row: a [?] b = result */}
            <View
              pointerEvents="box-none"
              style={{ position: 'absolute', top: HEADER_COL_H + 70, left: 0, right: 0, alignItems: 'center', zIndex: 9100 }}
            >
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  paddingVertical: 18, paddingHorizontal: 24, borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <View
                  style={{
                    width: 62, height: 78, borderRadius: 14, borderWidth: 2,
                    borderColor: '#60A5FA', backgroundColor: '#EFF6FF',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 32, fontWeight: '900', color: '#1D4ED8' }}>{String(current.a)}</Text>
                </View>
                <TouchableOpacity activeOpacity={0.85} onPress={onSlotTap}>
                  <View
                    style={{
                      width: 62, height: 78, borderRadius: 14, borderWidth: 3,
                      borderColor: displayOp ? '#F97316' : '#FDE68A',
                      backgroundColor: displayOp ? '#FFF7ED' : 'rgba(253,230,138,0.12)',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {displayOp ? (
                      <OperatorGlyph op={displayOp} color="#EA580C" size={34} />
                    ) : (
                      <Text style={{ fontSize: 34, fontWeight: '900', color: '#FDE68A' }}>?</Text>
                    )}
                  </View>
                </TouchableOpacity>
                <View
                  style={{
                    width: 62, height: 78, borderRadius: 14, borderWidth: 2,
                    borderColor: '#60A5FA', backgroundColor: '#EFF6FF',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 32, fontWeight: '900', color: '#1D4ED8' }}>{String(current.b)}</Text>
                </View>
                <Text style={{ fontSize: 32, fontWeight: '900', color: '#FDE68A' }}>=</Text>
                <View
                  style={{
                    minWidth: 62, height: 78, paddingHorizontal: 14, borderRadius: 14, borderWidth: 2,
                    borderColor: '#34D399', backgroundColor: 'rgba(16,185,129,0.12)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 32, fontWeight: '900', color: '#A7F3D0' }}>
                    {String(current.result)}
                  </Text>
                </View>
              </View>
              {/* Live-result preview ג€” shows what the current sign produces vs target. */}
              {displayOp !== null && liveResult !== null && liveResult !== current.result ? (
                <Text style={{ marginTop: 10, color: '#FCA5A5', fontSize: 14, fontWeight: '700' }}>
                  {locale === 'he' ? `עם הסימן הזה: ${liveResult}` : `With this sign: ${liveResult}`}
                </Text>
              ) : null}
            </View>
            {/* Op cards row + joker (all tappable). */}
            <View
              pointerEvents="box-none"
              style={{ position: 'absolute', top: HEADER_COL_H + 260, left: 0, right: 0, alignItems: 'center', zIndex: 9100 }}
            >
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {(['+', '-', 'x', '÷'] as L5Op[]).map((op) => (
                  <TouchableOpacity key={op} activeOpacity={0.85} onPress={() => onOpCardTap(op)}>
                    <View
                      style={{
                        width: 56, height: 72, borderRadius: 12, borderWidth: 2,
                        borderColor: displayOp === op ? '#F59E0B' : '#F97316',
                        backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center',
                        transform: displayOp === op ? [{ scale: 1.08 }] : undefined,
                      }}
                    >
                      <OperatorGlyph op={op} color="#EA580C" size={28} />
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity activeOpacity={0.85} onPress={() => setL5JokerOpen(true)}>
                  <View
                    style={{
                      width: 56, height: 72, borderRadius: 12, borderWidth: 2, borderColor: '#EAB308',
                      backgroundColor: '#FEFCE8', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 20, color: '#CA8A04', fontWeight: '900' }}>ג˜…</Text>
                    <Text style={{ fontSize: 10, color: '#CA8A04', fontWeight: '800', marginTop: 2 }}>
                      {t('tutorial.l5.jokerLabel')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
            {/* Confirm button. */}
            <View pointerEvents="box-none" style={{ position: 'absolute', top: HEADER_COL_H + 370, left: 0, right: 0, alignItems: 'center', zIndex: 9100 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onConfirm}
                disabled={!confirmEnabled}
                style={{
                  paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16,
                  backgroundColor: confirmEnabled ? '#16A34A' : '#475569',
                  borderWidth: 2, borderColor: confirmEnabled ? '#BBF7D0' : '#64748B',
                  opacity: confirmEnabled ? 1 : 0.7,
                }}
              >
                <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900' }}>
                  {t('game.buildingEquationNext')}
                </Text>
              </TouchableOpacity>
            </View>
            {/* Joker modal ג€” reuse the same modal body as lesson 5b. Picking
                a sign sets `l5PendingJokerOp`; the learner then taps the slot
                to place it (or taps an op card directly). */}
            {l5JokerOpen ? (
              <View
                pointerEvents="auto"
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
                  zIndex: 9500,
                }}
              >
                <View
                  style={{
                    backgroundColor: '#0F172A', borderRadius: 22, paddingVertical: 22, paddingHorizontal: 26,
                    borderWidth: 2, borderColor: '#EAB308', minWidth: 260,
                  }}
                >
                  <Text style={{ color: '#FEF9C3', fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 16 }}>
                    {t('tutorial.l5.jokerPickTitle')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
                    {(['+', '-', 'x', '÷'] as L5Op[]).map((op) => (
                      <TouchableOpacity
                        key={op}
                        activeOpacity={0.85}
                        onPress={() => {
                          setL5JokerOpen(false);
                          setL5PendingJokerOp(op);
                          tutorialBus.emitUserEvent({ kind: 'opSelected', op, via: 'joker' });
                        }}
                        style={{
                          width: 54, height: 54, borderRadius: 12, backgroundColor: '#FFF7ED',
                          borderWidth: 2, borderColor: '#F97316', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <OperatorGlyph op={op} color="#EA580C" size={26} />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    onPress={() => setL5JokerOpen(false)}
                    style={{ marginTop: 18, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 18, borderRadius: 10, backgroundColor: 'rgba(71,85,105,0.92)' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800' }}>ג•</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </>
        );
      })() : null}

      {/* Back stays inside the tutorial overlay; Android moves skip into the header
          so it stays visible beside the progress meter without fighting for width. */}
      {false && !isAndroidTutorialUi ? (
      <View style={{ position: 'absolute', top: Math.max(tutorialSafeTop, 12), right: tutorialTopControlRight, zIndex: 9600, flexDirection: 'row', direction: 'ltr', gap: 8, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => {
            if (showWelcomeBubble) return;
            // Advanced module started from welcome ג†' restart.
            if (
              advancedStartedFromWelcomeRef.current &&
              engine.lessonIndex === MIMIC_FIRST_FRACTION_LESSON_INDEX &&
              engine.stepIndex === 0
            ) {
              advancedStartedFromWelcomeRef.current = false;
              dispatchEngine({ type: 'EXIT' });
              dispatchEngine({ type: 'START' });
              setShowWelcomeBubble(true);
              return;
            }
            // L8 step 1 (identical card mockup): back to step 0 mockup.
            // Keeps GO_BACK + DISMISS_INTRO to skip the intro and show mockup directly.
            if (
              engine.lessonIndex === MIMIC_SINGLE_IDENTICAL_LESSON_INDEX &&
              engine.stepIndex === 1
            ) {
              setIdenticalMockupApproved(false);
              setIdenticalMockupPendingAdvance(false);
              l8Step1RiggedRef.current = false;
              dispatchEngine({ type: 'GO_BACK' });
              dispatchEngine({ type: 'DISMISS_INTRO' });
              return;
            }
            // L9: go back one sub-stage at a time; at stage 0 fall through to GO_BACK_LAYER.
            if (isL9Lesson && engine.phase === 'await-mimic' && l9Stage > 0) {
              if (l9Stage === 2) {
                setL9Stage(1);
                gameDispatch({ type: 'REVERT_TO_BUILDING' });
                tutorialBus.emitFanDemo({ kind: 'eqReset' });
              } else {
                setL9Stage(0);
                tutorialBus.setL6CopyConfig(null);
                tutorialBus.emitFanDemo({ kind: 'eqReset' });
                gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: true });
                tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
              }
              return;
            }
            // L11 step 1: reset rigging refs before phase-level back.
            if (engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX && engine.stepIndex === 1) {
              l8Step3RiggedRef.current = false;
              l11RiggedRef.current = false;
              l11Step0AwaitRiggedRef.current = false;
              l11AwaitRiggedRef.current = false;
              dispatchEngine({ type: 'GO_BACK_LAYER' });
              return;
            }
            // L11 step 0: reset rigging refs before phase-level back.
            if (engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX && engine.stepIndex === 0) {
              l11RiggedRef.current = false;
              l11Step0AwaitRiggedRef.current = false;
              l11AwaitRiggedRef.current = false;
              dispatchEngine({ type: 'GO_BACK_LAYER' });
              return;
            }
            // Completion screens (lesson-done, core-complete, post-signs-choice,
            // advanced-complete, all-done): GO_BACK_LAYER is a no-op there; use
            // GO_BACK which navigates back to lesson content.
            if (
              engine.phase === 'lesson-done' ||
              engine.phase === 'advanced-complete' ||
              engine.phase === 'all-done' ||
              engine.phase === 'core-complete' ||
              engine.phase === 'post-signs-choice'
            ) {
              dispatchEngine({ type: 'GO_BACK' });
              return;
            }
            // Default: phase-level back.
            dispatchEngine({ type: 'GO_BACK_LAYER' });
          }}
          disabled={
            engine.lessonIndex === 0 &&
            engine.stepIndex === 0 &&
            engine.phase === 'intro'
          }
          style={[
            {
              paddingVertical: 8,
              paddingHorizontal: 12,
              minWidth: 82,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(71,85,105,0.92)',
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: 'rgba(148,163,184,0.7)',
            },
            engine.lessonIndex === 0 &&
              engine.stepIndex === 0 &&
              engine.phase === 'intro' && { opacity: 0.35 },
          ]}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{'‹ חזור'}</Text>
        </TouchableOpacity>
        {!isAndroidTutorialUi ? (
          <TouchableOpacity
            onPress={skipForward}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              minWidth: 82,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(90,95,105,0.88)',
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: 'rgba(180,185,195,0.6)',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
              {engine.phase === 'celebrate' ? 'הבנתי ›' : 'דלג ›'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      ) : null}

      {/* Lesson 5.3: tip/mockup after Slinda and before lesson 6. */}
      {isL3TipStep && !l3TipApproved ? (
        <>
          <View
            pointerEvents="auto"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(5,10,22,0.88)',
              zIndex: 9250,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              zIndex: 9260,
            }}
          >
            <View
              style={{
                maxWidth: 360,
                width: '100%',
                borderRadius: 24,
                backgroundColor: 'rgba(15,23,42,0.96)',
                borderWidth: 2.5,
                borderColor: '#F59E0B',
                paddingVertical: 22,
                paddingHorizontal: 18,
                gap: 12,
                ...Platform.select({
                  ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 16 },
                  android: { elevation: 14 },
                }),
              }}
            >
              <Text style={{ color: '#FFDF00', fontSize: 25, fontWeight: '900', textAlign: 'center', writingDirection: locale === 'he' ? 'rtl' : 'ltr', lineHeight: 31 }}>
                {t('tutorial.l3.tipTitle')}
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '400', textAlign: 'center', writingDirection: locale === 'he' ? 'rtl' : 'ltr', lineHeight: 24 }}>
                {t('tutorial.l3.tipBody')}
              </Text>
            </View>
          </View>
          {engine.phase === 'await-mimic' ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setL3TipApproved(true)}
              style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', zIndex: 9270 }}
            >
              <View style={{
                backgroundColor: '#F59E0B',
                borderRadius: 20,
                minHeight: 62,
                paddingVertical: 15,
                paddingHorizontal: 42,
                borderWidth: 2,
                borderColor: '#FCD34D',
                alignItems: 'center',
                justifyContent: 'center',
                ...Platform.select({
                  ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 },
                  android: { elevation: 12 },
                }),
              }}>
                <Text style={{ color: '#431407', fontSize: 17, lineHeight: 22, fontWeight: '900', textAlign: 'center', textAlignVertical: 'center', writingDirection: locale === 'he' ? 'rtl' : 'ltr', includeFontPadding: false }}>
                  {t('tutorial.l3.tipCta')}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}

      {/* L5a step 0 (place-op): "׳”׳™׳“׳¢׳×?" sign-card mockup ג€” shown until the
          learner taps "׳”׳'׳ ׳×׳™". Bot-demo runs behind the overlay; the button
          only appears during await-mimic so the learner can't skip too early. */}
      {engine.lessonIndex === 4 && engine.stepIndex === 0 && !l5aSignTipApproved && (
        <>
          <View
            pointerEvents="auto"
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(5,10,22,0.90)',
              zIndex: 9250,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center',
              paddingHorizontal: 24, zIndex: 9260,
            }}
          >
            <View
              style={{
                maxWidth: 360, width: '100%',
                borderRadius: 24,
                backgroundColor: 'rgba(15,23,42,0.97)',
                borderWidth: 2.5, borderColor: '#818CF8',
                paddingVertical: 24, paddingHorizontal: 20,
                gap: 14, alignItems: 'center',
                ...Platform.select({
                  ios: { shadowColor: '#818CF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 18 },
                  android: { elevation: 14 },
                }),
              }}
            >
              {/* ׳›׳•׳×׳¨׳× */}
              <Text style={{ color: '#FCD34D', fontSize: 22, fontWeight: '900', textAlign: 'center' }}>
                {t('tutorial.signCard.title')}
              </Text>
              {/* Mini operation-card visual */}
              <View style={{
                width: 64, height: 80, borderRadius: 14,
                backgroundColor: '#312E81',
                borderWidth: 2.5, borderColor: '#818CF8',
                alignItems: 'center', justifyContent: 'center',
                ...Platform.select({
                  ios: { shadowColor: '#818CF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 12 },
                  android: { elevation: 10 },
                }),
              }}>
                <Text style={{ fontSize: 30, color: '#FFF', fontWeight: '900', lineHeight: 36 }}>{'+'}</Text>
                <Text style={{ fontSize: 9, color: '#C7D2FE', fontWeight: '800', letterSpacing: 0.5, marginTop: 2 }}>{'׳¡׳™׳׳'}</Text>
              </View>
              {/* Body */}
              <Text style={{ color: '#F8FAFC', fontSize: 17, fontWeight: '800', textAlign: 'center', lineHeight: 26 }}>
                {t('tutorial.signCard.body')}
              </Text>
            </View>
          </View>
          {engine.phase === 'await-mimic' ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setL5aSignTipApproved(true)}
              style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', zIndex: 9270 }}
            >
              <View style={{
                backgroundColor: '#6D28D9',
                borderRadius: 20,
                paddingVertical: 15, paddingHorizontal: 42,
                borderWidth: 2, borderColor: '#818CF8',
                ...Platform.select({
                  ios: { shadowColor: '#818CF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 },
                  android: { elevation: 12 },
                }),
              }}>
                <Text style={{ color: '#EDE9FE', fontSize: 17, fontWeight: '900' }}>
                  {t('tutorial.signCard.button')}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </>
      )}

      {showL4Step3IntroModal ? (
        <>
          <View
            pointerEvents="auto"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(5,10,22,0.90)',
              zIndex: 9250,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              zIndex: 9260,
            }}
          >
            <View
              style={{
                maxWidth: 360,
                width: '100%',
                borderRadius: 24,
                backgroundColor: 'rgba(15,23,42,0.96)',
                borderWidth: 2.5,
                borderColor: '#F59E0B',
                paddingVertical: 24,
                paddingHorizontal: 20,
                gap: 14,
                ...Platform.select({
                  ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 18 },
                  android: { elevation: 14 },
                }),
              }}
            >
              <Text style={{ color: '#FCD34D', fontSize: 22, fontWeight: '900', textAlign: 'center', lineHeight: 30 }}>
                {t('tutorial.l4c.botFull')}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setL4Step3IntroApproved(true);
              setL4Step3Phase('pickFirstDie');
            }}
            style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', zIndex: 9270 }}
          >
            <View style={{
              backgroundColor: '#F59E0B',
              borderRadius: 20,
              paddingVertical: 15,
              paddingHorizontal: 42,
              borderWidth: 2,
              borderColor: '#FCD34D',
              ...Platform.select({
                ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 },
                android: { elevation: 12 },
              }),
            }}>
              <Text style={{ color: '#431407', fontSize: 17, fontWeight: '900' }}>
                {t('tutorial.l4c.gotIt')}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      ) : null}

      {showL4Step3FinishModal ? (
        <>
          <View
            pointerEvents="auto"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(5,10,22,0.90)',
              zIndex: 9250,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              zIndex: 9260,
            }}
          >
            <View
              style={{
                maxWidth: 360,
                width: '100%',
                borderRadius: 24,
                backgroundColor: 'rgba(15,23,42,0.96)',
                borderWidth: 2.5,
                borderColor: '#F59E0B',
                paddingVertical: 24,
                paddingHorizontal: 20,
                gap: 12,
                ...Platform.select({
                  ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 18 },
                  android: { elevation: 14 },
                }),
              }}
            >
              <Text style={{ color: '#FCD34D', fontSize: 22, fontWeight: '900', textAlign: 'center' }}>
                {t('tutorial.l4c.finishTitle')}
              </Text>
              <Text style={{ color: '#F8FAFC', fontSize: 17, fontWeight: '800', textAlign: 'center', lineHeight: 26 }}>
                {t('tutorial.l4c.finishBody')}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setL4Step3FinishApproved(true);
              dispatchEngine({ type: 'CELEBRATE_DONE' });
            }}
            style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', zIndex: 9270 }}
          >
            <View style={{
              backgroundColor: '#F59E0B',
              borderRadius: 20,
              paddingVertical: 15,
              paddingHorizontal: 42,
              borderWidth: 2,
              borderColor: '#FCD34D',
              ...Platform.select({
                ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 },
                android: { elevation: 12 },
              }),
            }}>
              <Text style={{ color: '#431407', fontSize: 17, fontWeight: '900' }}>
                {t('tutorial.l4c.gotIt')}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      ) : null}

      {engine.lessonIndex === 5 &&
       engine.stepIndex === 0 &&
       engine.phase === 'celebrate' ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => dispatchEngine({ type: 'CELEBRATE_DONE' })}
          style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', zIndex: 9270 }}
        >
          <View style={{
            backgroundColor: '#15803D',
            borderRadius: 20,
            paddingVertical: 15,
            paddingHorizontal: 42,
            borderWidth: 2,
            borderColor: '#86EFAC',
            ...Platform.select({
              ios: { shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 14 },
              android: { elevation: 12 },
            }),
          }}>
            <Text style={{ color: '#F0FDF4', fontSize: 17, lineHeight: 22, fontWeight: '900', textAlign: 'center', textAlignVertical: 'center', writingDirection: locale === 'he' ? 'rtl' : 'ltr', includeFontPadding: false }}>
              {t('tutorial.l6a.continue')}
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {engine.lessonIndex === 5 &&
       engine.stepIndex === 1 &&
       engine.phase === 'bot-demo' &&
       l6MiniDemoPendingAdvance ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            setL6MiniDemoPendingAdvance(false);
            dispatchEngine({ type: 'BOT_DEMO_DONE' });
          }}
          style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', zIndex: 9270 }}
        >
          <View style={{
            backgroundColor: '#15803D',
            borderRadius: 20,
            paddingVertical: 15,
            paddingHorizontal: 42,
            borderWidth: 2,
            borderColor: '#86EFAC',
            ...Platform.select({
              ios: { shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 14 },
              android: { elevation: 12 },
            }),
          }}>
            <Text style={{ color: '#F0FDF4', fontSize: 17, fontWeight: '900' }}>
              {t('tutorial.l6b.demoContinue')}
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {engine.lessonIndex === 5 &&
       engine.stepIndex === 1 &&
       engine.phase === 'await-mimic' &&
       showL6TapMiniContinue ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            setShowL6TapMiniContinue(false);
            tutorialBus.emitUserEvent({ kind: 'l6TapMiniAck' });
          }}
          style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', zIndex: 9270 }}
        >
          <View style={{
            backgroundColor: '#15803D',
            borderRadius: 20,
            paddingVertical: 15,
            paddingHorizontal: 42,
            borderWidth: 2,
            borderColor: '#86EFAC',
            ...Platform.select({
              ios: { shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 14 },
              android: { elevation: 12 },
            }),
          }}>
            <Text style={{ color: '#F0FDF4', fontSize: 17, fontWeight: '900' }}>
              {t('tutorial.l6b.continue')}
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {engine.lessonIndex === 5 &&
       engine.stepIndex === 2 &&
       engine.phase === 'intro' &&
       !l6WildMockupApproved ? (
        <>
          <View
            pointerEvents="auto"
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(5,10,22,0.90)',
              zIndex: 9250,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center',
              paddingHorizontal: 24, zIndex: 9260,
            }}
          >
            <View
              style={{
                maxWidth: 360, width: '100%',
                borderRadius: 24,
                backgroundColor: 'rgba(15,23,42,0.97)',
                borderWidth: 2.5, borderColor: '#A78BFA',
                paddingVertical: 24, paddingHorizontal: 20,
                gap: 14, alignItems: 'center',
                ...Platform.select({
                  ios: { shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 18 },
                  android: { elevation: 14 },
                }),
              }}
            >
              <Text style={{ color: '#DDD6FE', fontSize: 22, fontWeight: '900', textAlign: 'center' }}>
                {t('tutorial.wildTitle')}
              </Text>
              <TutorialWildMiniCard maxNumber={gameState?.mathRangeMax === 25 ? 25 : 12} />
              <Text style={{ color: '#F8FAFC', fontSize: 17, fontWeight: '800', textAlign: 'center', lineHeight: 26 }}>
                {t('tutorial.l6c.wildMockupBody')}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setL6WildMockupApproved(true);
              dispatchEngine({ type: 'DISMISS_INTRO' });
            }}
            style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', zIndex: 9270 }}
          >
            <View style={{
              backgroundColor: '#6D28D9',
              borderRadius: 20,
              paddingVertical: 15, paddingHorizontal: 42,
              borderWidth: 2, borderColor: '#A78BFA',
              ...Platform.select({
                ios: { shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 },
                android: { elevation: 12 },
              }),
            }}>
              <Text style={{ color: '#F5F3FF', fontSize: 17, fontWeight: '900' }}>
                {t('tutorial.gotIt')}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      ) : null}

      {/* Parens lesson: "Did you know?" style mockup + explicit confirm. */}
      {isParensLesson && engine.stepIndex === 0 && engine.phase === 'bot-demo' && !parensMockupApproved ? (
        <>
          <View
            pointerEvents="auto"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(5,10,22,0.88)',
              zIndex: 9250,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              zIndex: 9260,
            }}
          >
            <View
              style={{
                maxWidth: 360,
                width: '100%',
                borderRadius: 24,
                backgroundColor: 'rgba(15,23,42,0.96)',
                borderWidth: 2.5,
                borderColor: '#60A5FA',
                paddingVertical: 22,
                paddingHorizontal: 18,
                gap: 12,
                ...Platform.select({
                  ios: { shadowColor: '#60A5FA', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 16 },
                  android: { elevation: 14 },
                }),
              }}
            >
              <Text style={{ color: '#FCD34D', fontSize: 25, fontWeight: '900', textAlign: 'center', lineHeight: 31 }}>
                {t('tutorial.l8.mockupTitle')}
              </Text>
              <Text style={{ color: '#86EFAC', fontSize: 16, fontWeight: '800', textAlign: 'center', lineHeight: 24 }}>
                {t('tutorial.l8.mockupBody')}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setParensMockupApproved(true)}
            style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', zIndex: 9270 }}
          >
            <View style={{
              backgroundColor: '#2563EB',
              borderRadius: 20,
              paddingVertical: 15,
              paddingHorizontal: 42,
              borderWidth: 2,
              borderColor: '#93C5FD',
              ...Platform.select({
                ios: { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 },
                android: { elevation: 12 },
              }),
            }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>
                {t('tutorial.l8.mockupContinue')}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      ) : null}




      {/* L11 exercise 1 only: floating result chip ג€” hidden on exercise 2 so
          the learner sees a single instruction bubble instead of two. */}
      {engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX &&
       engine.stepIndex === 1 &&
       engine.phase === 'bot-demo' &&
       !l11MockupApproved ? (
        <>
          <View
            pointerEvents="auto"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(5,10,22,0.88)',
              zIndex: 9250,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              zIndex: 9260,
            }}
          >
            <View
              style={{
                maxWidth: 360,
                width: '100%',
                borderRadius: 24,
                backgroundColor: 'rgba(15,23,42,0.96)',
                borderWidth: 2.5,
                borderColor: '#F59E0B',
                paddingVertical: 22,
                paddingHorizontal: 18,
                alignItems: 'center',
                gap: 12,
                ...Platform.select({
                  ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 16 },
                  android: { elevation: 14 },
                }),
              }}
            >
              <Text style={{ color: '#86EFAC', fontSize: 15, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5 }}>
                {t('tutorial.identicalMulti.didYouKnow')}
              </Text>
              <Text style={{ color: '#FCD34D', fontSize: 25, fontWeight: '900', textAlign: 'center', lineHeight: 31 }}>
                {t('tutorial.identicalMulti.body', { n: String(l11Target ?? gameState?.equationResult ?? '?') })}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setL11MockupApproved(true)}
            style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', zIndex: 9270 }}
          >
            <View style={{
              backgroundColor: '#F59E0B',
              borderRadius: 20,
              paddingVertical: 15,
              paddingHorizontal: 32,
              borderWidth: 2,
              borderColor: '#FCD34D',
              ...Platform.select({
                ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 },
                android: { elevation: 12 },
              }),
            }}>
              <Text style={{ color: '#431407', fontSize: 17, fontWeight: '900' }}>
                {t('tutorial.identicalMulti.cta')}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      ) : null}

      {false && engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX &&
       (engine.stepIndex === 0 || engine.stepIndex === 1) &&
       engine.phase === 'await-mimic' &&
       !gameState?.hasPlayedCards && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 124,
            left: 18,
            right: 18,
            alignItems: 'center',
            zIndex: 12000,
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(15,23,42,0.98)',
              borderRadius: 22,
              borderWidth: 2.5,
              borderColor: '#f59e0b',
              paddingVertical: 18,
              paddingHorizontal: 20,
              width: '100%',
              minHeight: 118,
              alignItems: 'center',
              justifyContent: 'center',
              ...Platform.select({
                ios: { shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 14 },
                android: { elevation: 18 },
              }),
            }}
          >
            <Text style={{ color: '#fff7ed', fontSize: 20, fontWeight: '900', textAlign: 'center', lineHeight: 28 }}>
              {`בחר שני קלפים שסכומם שווה לתוצאת התרגיל = ${gameState?.equationResult ?? '?'}`}
            </Text>
          </View>
        </View>
      )}

      {engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX &&
       (engine.stepIndex === 0 || engine.stepIndex === 1) &&
       engine.phase === 'await-mimic' &&
       !gameState?.hasPlayedCards && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 72,
            left: HEADER_COL_W + 14,
            right: 12,
            alignItems: 'center',
            zIndex: 12000,
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(15,23,42,0.98)',
              borderRadius: 22,
              borderWidth: 2.5,
              borderColor: '#f59e0b',
              paddingVertical: 18,
              paddingHorizontal: 20,
              width: '100%',
              maxWidth: 340,
              minHeight: 118,
              alignItems: 'center',
              justifyContent: 'center',
              ...Platform.select({
                ios: { shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 14 },
                android: { elevation: 18 },
              }),
            }}
          >
            <Text style={{ color: '#fff7ed', fontSize: 18, fontWeight: '900', textAlign: 'center', lineHeight: 26 }}>
              {t(
                l11TopHintKey,
                { n: String(gameState?.equationResult ?? l11Target ?? '?') },
              )}
            </Text>
          </View>
        </View>
      )}

      {isL11SecondExerciseAwait &&
       !gameState?.hasPlayedCards &&
       l11PositiveNumberCount >= 1 &&
       !l11HasZeroStaged &&
       !l11ZeroGiftApproved ? (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 12500,
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(15,23,42,0.97)',
              borderRadius: 20,
              borderWidth: 2,
              borderColor: '#f472b6',
              paddingVertical: 26,
              paddingHorizontal: 24,
              width: '100%',
              maxWidth: 340,
              alignItems: 'center',
              ...Platform.select({
                ios: { shadowColor: '#f472b6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 20 },
                android: { elevation: 16 },
              }),
            }}
          >
            <Text style={{ color: '#fbcfe8', fontWeight: '900', fontSize: 17, marginBottom: 12, textAlign: 'center', lineHeight: 26 }}>
              {t('tutorial.multiPlayGiftZero.body')}
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#f472b6', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32 }}
              onPress={() => setL11ZeroGiftApproved(true)}
            >
              <Text style={{ color: '#1f2937', fontWeight: '900', fontSize: 16 }}>
                {t('tutorial.multiPlayGiftZero.cta')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {false && engine.lessonIndex === 5 &&
       engine.stepIndex === 2 &&
       engine.phase === 'await-mimic' && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 58,
            left: 8,
            right: 8,
            alignItems: 'center',
            zIndex: 12000,
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(15,23,42,0.98)',
              borderRadius: 22,
              borderWidth: 2.5,
              borderColor: '#f59e0b',
              paddingVertical: 18,
              paddingHorizontal: 20,
              width: '100%',
              minHeight: 126,
              alignItems: 'center',
              justifyContent: 'center',
              ...Platform.select({
                ios: { shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 14 },
                android: { elevation: 18 },
              }),
            }}
          >
            <Text style={{ color: '#fff7ed', fontSize: 20, fontWeight: '900', textAlign: 'center', lineHeight: 28 }}>
              {`בחרו קלפים שסכומם ${gameState?.equationResult ?? '?'}`}
            </Text>
          </View>
        </View>
      )}

      {/* ׳§׳׳£ ׳–׳”׳” ג€” did-you-know mockup */}
      {isL10Intro && !identicalMockupApproved && (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9250,
            paddingHorizontal: 24,
          }}
        >
          <View style={{
            maxWidth: 360,
            width: '100%',
            borderRadius: 24,
            backgroundColor: 'rgba(15,23,42,0.96)',
            borderWidth: 2.5,
            borderColor: '#F59E0B',
            paddingVertical: 22,
            paddingHorizontal: 18,
            alignItems: 'center',
            gap: 12,
            ...Platform.select({
              ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 16 },
              android: { elevation: 14 },
            }),
          }}>
            <Text style={{ color: '#86EFAC', fontSize: 15, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5 }}>
              {t('tutorial.identicalCard.subtitle')}
            </Text>
            <Text style={{ color: '#FCD34D', fontSize: 25, fontWeight: '900', textAlign: 'center', lineHeight: 31 }}>
              {t('tutorial.identicalCard.title')}
            </Text>
            <View style={{ width: '100%', height: 1, backgroundColor: 'rgba(245,158,11,0.3)' }} />
            <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '700', textAlign: 'center', lineHeight: 24 }}>
              {t('tutorial.identicalCard.desc')}
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={{
                marginTop: 4,
                backgroundColor: '#F59E0B',
                borderRadius: 20,
                paddingVertical: 15,
                paddingHorizontal: 32,
                borderWidth: 2,
                borderColor: '#FCD34D',
                ...Platform.select({
                  ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 },
                  android: { elevation: 12 },
                }),
              }}
              onPress={() => setIdenticalMockupApproved(true)}
            >
              <Text style={{ color: '#431407', fontSize: 17, fontWeight: '900' }}>
                {t('tutorial.identicalCard.cta')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* L8 step 1: rolled-before-identical retry hint ג€” positioned on the table */}
      {l8RolledBeforeIdentical && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 280,
            left: 24,
            right: 24,
            zIndex: 9300,
            backgroundColor: 'rgba(15,23,42,0.96)',
            borderRadius: 16,
            borderWidth: 2,
            borderColor: '#f59e0b',
            paddingVertical: 16,
            paddingHorizontal: 20,
            alignItems: 'center',
            ...Platform.select({
              ios: { shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 12 },
              android: { elevation: 14 },
            }),
          }}
        >
          <Text style={{ fontSize: 24, marginBottom: 6 }}></Text>
          <Text style={{ color: '#fde68a', fontWeight: '800', fontSize: 15, marginBottom: 4, textAlign: 'center' }}>
            {t('tutorial.identicalCard.retryTitle')}
          </Text>
          <Text style={{ color: '#e5e7eb', fontSize: 13, lineHeight: 20, textAlign: 'center' }}>
            {t('tutorial.identicalCard.retryDesc')}
          </Text>
        </View>
      )}


      {/* L4 step 3 (did-you-know): "׳”׳™׳“׳¢׳×?" overlay before full-build */}
      {isL4DidYouKnow && (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(5,10,22,0.93)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            paddingHorizontal: 32,
          }}
        >
          <Text style={{ fontSize: 40, marginBottom: 8 }}>נ'¡</Text>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#fde68a', marginBottom: 4, textAlign: 'center' }}>
            {t('tutorial.l4.didYouKnow')}
          </Text>
          <Text style={{ fontSize: 14, color: '#9ca3af', marginBottom: 12, textAlign: 'center' }}>
            {t('tutorial.l4.didYouKnowBestTip')}
          </Text>
          <Text style={{ fontSize: 16, color: '#e5e7eb', textAlign: 'center', marginBottom: 24, lineHeight: 24 }}>
            {t('tutorial.l4.didYouKnowBody')}
          </Text>
          {engine.phase === 'await-mimic' && (
            <TouchableOpacity
              style={{ backgroundColor: '#f59e0b', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32 }}
              onPress={() => tutorialBus.emitUserEvent({ kind: 'l4DidYouKnowAck' })}
            >
              <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>
                {t('tutorial.l4.didYouKnowCta')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Cheerful speech bubble ג€” position depends on lesson + phase:
          ג€¢ Dice lesson (3) bot-demo: bottom (matches lesson 2 height, smooth
            transition into the lesson).
          ג€¢ Dice lesson (3) await-mimic/celebrate: top ג€” so the rolled dice
            results remain visible in the middle of the screen.
          ג€¢ Equation (4) / op-cycle (5) lessons: always top ג€” the builder / UI
            occupies the middle.
          ג€¢ Fan (1) / tap (2) lessons: always bottom ג€” just above the fan. */}
      {bubbleText ? (() => {
        const bubbleAtTop =
          isEquationLesson ||
          (isOpCycleLesson && engine.stepIndex === 1) ||
          (isDiceLesson && engine.phase !== 'bot-demo');
        // Step 5.1 (place-op, await-mimic + celebrate): keep the bubble
        // anchored between the equation mockup and the fan ג€” never at the
        // top of the screen.
        const isL5Step0Bubble =
          isOpCycleLesson &&
          engine.stepIndex === 0 &&
          (engine.phase === 'await-mimic' || engine.phase === 'celebrate');
        // Compact bubble for L6 (possible results) + L7 (fractions) ג€” both
        // lessons teach UI that lives at the TOP of the real game board
        // (green chip at top:84 / discard pile at top:50). A full-width
        // bubble at top:55 would cover exactly what the learner is supposed
        // to look at. Placing the compact bubble at top:400 keeps it in the
        // middle of the screen where no teaching target lives.
        // After L6's green chip is opened, the mini-card ribbon becomes the
        // teaching target, so those bubbles move above the equation instead.
        // Exception: frac-intro (stepIndex 0) renders its own two-bubble
        // layout ג€” suppress the default compact bubble there.
        const isL6 = isPossibleResultsLesson;
        const isL6OpenChipHintBubble =
          isL6 &&
          engine.stepIndex === 0 &&
          (engine.phase === 'bot-demo' || engine.phase === 'await-mimic');
        const isL6Step1Bubble = isL6 && engine.stepIndex === 1;
        const isL6ReadExerciseBubble =
          isL6Step1Bubble &&
          engine.phase === 'await-mimic' &&
          showL6TapMiniContinue;
        const isL6AfterResultsOpenBubble =
          isL6 &&
          (
            (engine.stepIndex === 0 && engine.phase === 'celebrate') ||
            engine.stepIndex === 1
          );
        const isFracIntroStep = isFracLesson && engine.stepIndex === 0 &&
          (engine.phase === 'bot-demo' || engine.phase === 'await-mimic');
        const compactMid =
          (((isL6 || isFracLesson) && !isFracIntroStep) ||
            (isParensLesson && engine.phase === 'celebrate'));
        const isL6WildTopBubble = isL6WildAwait;
        const isL9Stage0Bubble = isL9Lesson && engine.phase === 'await-mimic' && l9Stage === 0;
        const isL9Stage1Bubble = isL9Lesson && engine.phase === 'await-mimic' && l9Stage === 1;
        const isCompact = compactMid || bubbleAtTop || isL5Step0Bubble || isL9Stage0Bubble || isL9Stage1Bubble;
        return (
          <View
            pointerEvents={isParensLesson && engine.phase === 'celebrate' ? 'box-none' : 'none'}
            style={
              isL9Stage0Bubble
                ? { position: 'absolute', top: 130, alignItems: 'center', zIndex: 9200, ...tutorialTopBubbleInsets }
                : isL9Stage1Bubble
                  ? { position: 'absolute', top: 55, alignItems: 'center', zIndex: 9200, ...tutorialTopBubbleInsets }
                  : isL6WildTopBubble
                    ? { position: 'absolute', top: 55, alignItems: 'center', zIndex: 9200, ...tutorialTopBubbleInsets }
                  : isL6Step1Bubble
                    ? { position: 'absolute', top: tutorialL6ReadExerciseBubbleTop, alignItems: 'center', zIndex: 9200, ...tutorialTopBubbleInsets }
                  : isL6AfterResultsOpenBubble
                    ? { position: 'absolute', top: tutorialL6AfterOpenBubbleTop, alignItems: 'center', zIndex: 9200, ...tutorialTopBubbleInsets }
                  : isL6OpenChipHintBubble
                    ? { position: 'absolute', top: tutorialL6OpenChipBubbleTop, alignItems: 'center', zIndex: 9200, ...tutorialTopBubbleInsets }
                  : compactMid
                    ? { position: 'absolute', top: tutorialCompactMidBubbleTop, alignItems: 'center', zIndex: 9200, ...tutorialTopBubbleInsets }
                    : isL5Step0Bubble
                      ? { position: 'absolute', bottom: L5_STEP0_BUBBLE_BOTTOM, left: 16, right: 16, alignItems: 'center', zIndex: 9200 }
                      : bubbleAtTop
                        ? { position: 'absolute', top: 55, alignItems: 'center', zIndex: 9200, ...tutorialTopBubbleInsets }
                        : { position: 'absolute', bottom: BUBBLE_BOTTOM, left: 0, right: 0, alignItems: 'center', zIndex: 9200 }
            }
          >
            <HappyBubble
              text={bubbleText}
              title={bubbleTitle}
              tone={bubbleTone}
              arrowSize='small'
              withTail={!isL6Step1Bubble && !isL6OpenChipHintBubble}
              size={isCompact ? 'compact' : 'normal'}
              maxWidth={isL6ReadExerciseBubble ? tutorialCompactBubbleMaxWidth : isCompact ? tutorialCompactBubbleMaxWidth : tutorialNormalBubbleMaxWidth}
              tailTop={false}
              titleStyleOverride={bubbleTitleStyleOverride}
              textStyleOverride={bubbleTextStyleOverride}
            />
          </View>
        );
      })() : null}

      {isL7Step1Await && !l7Step1MiniPicked ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: FAN_BOTTOM + 14,
            left: 22,
            right: 22,
            alignItems: 'center',
            zIndex: 9200,
          }}
        >
          <View
            style={{
              maxWidth: 350,
              borderRadius: 22,
              backgroundColor: 'rgba(234,242,255,0.98)',
              borderWidth: 2.5,
              borderColor: '#3B82F6',
              paddingVertical: 14,
              paddingHorizontal: 18,
              ...Platform.select({
                ios: { shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10 },
                android: { elevation: 8 },
              }),
            }}
          >
            <Text
              style={{
                color: '#1E3A8A',
                fontSize: 15,
                lineHeight: 22,
                fontWeight: '800',
                textAlign: 'center',
              }}
            >
              {t('tutorial.l8.step2.selectMini')}
            </Text>
          </View>
        </View>
      ) : null}

      {engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
       engine.phase === 'await-mimic' &&
       engine.stepIndex === 0 &&
       !l7FanHintHidden &&
       !l7Mismatch ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: FAN_BOTTOM + 14,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 9210,
          }}
        >
          <HappyBubble
            text={t('tutorial.l8.continueParens')}
            tone="celebrate"
            size="compact"
            arrowSize="small"
            maxWidth={300}
            tailTop={false}
          />
        </View>
      ) : null}


      {/* Fractions lesson ג€” pulsing halo around the discard pile.
          The pile is positioned in the game at `top: 50, right: 12` with
          roughly 96px width and ~120px height (card + count badge). We
          draw a gold ring just outside its bounds that pulses in sync
          with `fracPilePulse`. */}
      {/* Fractions attack/defend steps (stepIndex > 0) ג€” multi-layer pulsing
          glow around the pile card, like a glowing button. Three rings:
          outer fill-glow, mid halo ring, inner sharp border. */}
      {isFracLesson && engine.stepIndex > 0 && engine.stepIndex !== 3 ? (
        <>
          {/* Outer fill-glow ג€” large, very soft */}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', top: 28, right: -10, width: 140, height: 158,
            borderRadius: 28, backgroundColor: 'rgba(252,211,77,0.18)',
            opacity: fracPilePulse.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.7] }),
            transform: [{ scale: fracPilePulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.18] }) }],
            zIndex: 9140,
          }} />
          {/* Mid halo ring */}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', top: 36, right: -2, width: 124, height: 142,
            borderRadius: 22, borderWidth: 3, borderColor: '#FCD34D',
            opacity: fracPilePulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.85] }),
            transform: [{ scale: fracPilePulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.12] }) }],
            zIndex: 9148,
            ...Platform.select({
              ios: { shadowColor: '#FCD34D', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 18 },
              android: { elevation: 12 },
            }),
          }} />
          {/* Inner sharp border ג€” tightest ring, brightest pulse */}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', top: 42, right: 4, width: 112, height: 130,
            borderRadius: 16, borderWidth: 3.5, borderColor: '#FEF08A',
            opacity: fracPilePulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
            transform: [{ scale: fracPilePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
            zIndex: 9155,
            ...Platform.select({
              ios: { shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 14 },
              android: { elevation: 18 },
            }),
          }} />
        </>
      ) : null}

      {/* Frac attack steps (stepIndex 1ג€“2) ג€” HappyBubble near pile with pile value. */}
      {isFracLesson && (engine.stepIndex === 1 || engine.stepIndex === 2) &&
       (engine.phase === 'bot-demo' || engine.phase === 'await-mimic') ? (() => {
        const pileTop = gameState?.discardPile?.[gameState.discardPile.length - 1];
        const pileVal: number | null = pileTop?.type === 'number' ? (pileTop as { type: 'number'; value: number }).value : null;
        const pileText = locale === 'he'
          ? `בערימה יש ${pileVal ?? '…'} והוא מתחלק ב${engine.stepIndex === 1 ? '½' : '⅓'}`
          : `Pile is ${pileVal ?? '…'} — divides by ${engine.stepIndex === 1 ? '½' : '⅓'}`;
        return (
          <View pointerEvents="none" style={{ position: 'absolute', top: tutorialSideHintBubbleTop, alignItems: 'center', zIndex: 9310, ...tutorialTopBubbleInsets }}>
            <HappyBubble text={pileText} tone="turn" withTail={false} size="compact" maxWidth={tutorialSideBubbleMaxWidth} />
          </View>
        );
      })() : null}

      {/* Fractions intro (frac-intro, stepIndex 0) ג€” full-screen dark spotlight,
          only the pile card visible. Two-stage button flow:
          Stage 0: pile label + "׳”׳'׳ ׳×׳™" ג†' advances to stage 1 locally.
          Stage 1: styled lesson bubble + "׳”׳'׳ ׳×׳™" ג†' fires fracLessonAck ג†' practice. */}
      {isFracLesson && engine.stepIndex === 0 && (engine.phase === 'bot-demo' || engine.phase === 'await-mimic') ? (
        <>
          {/* Full-screen dark overlay ג€” 3 rects exposing only the pile */}
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 40, backgroundColor: 'rgba(5, 10, 22, 0.92)', zIndex: 9200 }} />
          <View pointerEvents="none" style={{ position: 'absolute', top: 40, left: 0, right: 116, height: 162, backgroundColor: 'rgba(5, 10, 22, 0.92)', zIndex: 9200 }} />
          <View pointerEvents="none" style={{ position: 'absolute', top: 202, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 10, 22, 0.92)', zIndex: 9200 }} />

          {/* ג”€ג”€ Stage 0: pile label bubble + first "׳”׳'׳ ׳×׳™" ג”€ג”€ */}
          {fracIntroStage === 0 ? (
            <>
              {/* Flashing card-arrow pointing at the pile from the left */}
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 88,
                  right: 126,
                  zIndex: 9400,
                  opacity: fracArrowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
                  transform: [
                    { scale: fracArrowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.06] }) },
                    { translateX: fracArrowPulse.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
                  ],
                }}
              >
                {/* Depth shadow ג€” offset for 3D card feel */}
                <View pointerEvents="none" style={{ position: 'absolute', top: 5, left: 5, right: -5, bottom: -5, backgroundColor: '#92400E', borderRadius: 14 }} />
                {/* Front face */}
                <View pointerEvents="none" style={{
                  backgroundColor: '#FCD34D', borderRadius: 14,
                  paddingHorizontal: 14, paddingVertical: 12,
                  borderWidth: 2.5, borderColor: '#F59E0B',
                  alignItems: 'center', justifyContent: 'center',
                  ...Platform.select({
                    ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 12 },
                    android: { elevation: 10 },
                  }),
                }}>
                  <Text style={{ fontSize: 28, color: '#78350F', fontWeight: '900' }}>{'→'}</Text>
                </View>
              </Animated.View>

              {/* Label bubble below pile, arrow up ג€” bigger and centered */}
              <View pointerEvents="none" style={{ position: 'absolute', top: 202, left: 8, right: 8, alignItems: 'flex-end', zIndex: 9310 }}>
                <View style={{ marginRight: 90, width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 13, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#F59E0B' }} />
                <View style={{ width: '100%', backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 2.5, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 16, ...Platform.select({ ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 10 }, android: { elevation: 8 } }) }}>
                  <Text style={{ color: '#78350F', fontSize: 22, fontWeight: '900', textAlign: 'center' }}>
                    {locale === 'he' ? 'זאת ערימת הקלפים' : 'This is the card deck'}
                  </Text>
                </View>
              </View>

              {engine.phase === 'await-mimic' ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setFracIntroStage(1)}
                  style={{ position: 'absolute', bottom: GOT_IT_BOTTOM_ADV, left: 0, right: 0, alignItems: 'center', zIndex: 9410 }}
                >
                  <View style={{ backgroundColor: '#2563EB', borderRadius: 20, paddingVertical: 15, paddingHorizontal: 48, borderWidth: 2, borderColor: '#93C5FD', ...Platform.select({ ios: { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 }, android: { elevation: 12 } }) }}>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>
                      {locale === 'he' ? 'הבנתי ✓' : 'Got it ✓'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}

          {/* ג”€ג”€ Stage 1: styled lesson bubble + second "׳”׳'׳ ׳×׳™" ג†' fracLessonAck ג”€ג”€ */}
          {fracIntroStage === 1 ? (
            <>
              <View pointerEvents="none" style={{ position: 'absolute', top: 200, left: 18, right: 18, zIndex: 9210 }}>
                <View style={{
                  backgroundColor: '#0F1E3A',
                  borderColor: '#3B82F6',
                  borderWidth: 2,
                  borderRadius: 24,
                  paddingHorizontal: 24,
                  paddingVertical: 26,
                  alignItems: 'center',
                  gap: 10,
                  ...Platform.select({ ios: { shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 22 }, android: { elevation: 18 } }),
                }}>
                  <Text style={{ color: '#93C5FD', fontSize: 15, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5 }}>
                    {locale === 'he' ? 'איך מאתגרים את השחקן הבא?' : 'How to challenge the next player?'}
                  </Text>
                  <Text style={{ color: '#FCD34D', fontSize: 30, fontWeight: '900', textAlign: 'center' }}>
                    {locale === 'he' ? 'עם קלף שבר!' : 'With a Fraction card!'}
                  </Text>
                  <View style={{ width: '100%', height: 1, backgroundColor: 'rgba(59,130,246,0.3)' }} />
                  <Text style={{ color: '#CBD5E1', fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 21 }}>
                    {locale === 'he'
                      ? 'שחקן יכול לאתגר כשהמספר\nבערימה מתחלק בשבר שלו'
                      : 'A player can challenge when the\npile number is divisible by their fraction'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => tutorialBus.emitUserEvent({ kind: 'fracLessonAck' })}
                style={{ position: 'absolute', bottom: GOT_IT_BOTTOM_ADV, left: 0, right: 0, alignItems: 'center', zIndex: 9300 }}
              >
                <View style={{ backgroundColor: '#2563EB', borderRadius: 20, paddingVertical: 15, paddingHorizontal: 42, borderWidth: 2, borderColor: '#93C5FD', ...Platform.select({ ios: { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 }, android: { elevation: 12 } }) }}>
                  <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>
                    {locale === 'he' ? 'הבנתי — בוא ננסה ›' : 'Got it — let\'s try! ›'}
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          ) : null}
        </>
      ) : null}


      {/* ג”€ג”€ Defense intro (stepIndex 3, stage 0): concept bubble ג”€ג”€ */}
      {isFracLesson && engine.stepIndex === 3 && fracDefenseIntroStage === 0 &&
       (engine.phase === 'bot-demo' || engine.phase === 'await-mimic') ? (
        <>
          {/* Dark overlay over entire screen */}
          <View pointerEvents="auto" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,10,22,0.88)', zIndex: 9250 }} />
          {/* Defense concept bubble ג€” same style as the attack intro bubble */}
          <View pointerEvents="none" style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 24, zIndex: 9260,
          }}>
            <View style={{
              backgroundColor: '#1e1b4b',
              borderWidth: 2,
              borderColor: '#6366F1',
              borderRadius: 24,
              paddingHorizontal: 24,
              paddingVertical: 26,
              alignItems: 'center',
              gap: 10,
              ...Platform.select({
                ios: { shadowColor: '#6366F1', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 22 },
                android: { elevation: 18 },
              }),
            }}>
              <Text style={{ color: '#FCD34D', fontSize: 26, fontWeight: '900', textAlign: 'center' }}>
                {locale === 'he' ? 'הגנה' : 'Defense'}
              </Text>
              <View style={{ width: '100%', height: 1, backgroundColor: 'rgba(99,102,241,0.3)' }} />
              <Text style={{ color: '#E2E8F0', fontSize: 15, fontWeight: '700', textAlign: 'center', lineHeight: 23 }}>
                {locale === 'he' ? 'הנח קלף שבר כדי להעביר את האתגר\nאו הנח קלף שמתחלק בשבר' : 'Play a fraction card to pass the challenge\nor play a card divisible by the fraction'}
              </Text>
            </View>
          </View>
          {/* "׳”׳'׳ ׳×׳™" button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setFracDefenseIntroStage(1)}
            style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', zIndex: 9270 }}
          >
            <View style={{
              backgroundColor: '#4F46E5',
              borderRadius: 20,
              paddingVertical: 15,
              paddingHorizontal: 42,
              borderWidth: 2,
              borderColor: '#A5B4FC',
              ...Platform.select({
                ios: { shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 },
                android: { elevation: 12 },
              }),
            }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>
                {locale === 'he' ? 'הבנתי — בוא ננסה ›' : 'Got it — let\'s try! ›'}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      ) : null}

      {/* ג”€ג”€ Defend steps (stepIndex 3-4): HappyBubble hint ג”€ג”€ */}
      {/* stepIndex 5 (bonus) has its own more specific bubble ג€” suppress this one there */}
      {isFracLesson && engine.stepIndex >= 3 && engine.stepIndex < 5 && (engine.stepIndex > 3 || fracDefenseIntroStage === 1) && (engine.phase === 'bot-demo' || engine.phase === 'await-mimic') ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: tutorialSideHintBubbleTop, alignItems: 'center', zIndex: 9210, ...tutorialTopBubbleInsets }}>
          <HappyBubble
            text={locale === 'he' ? 'לחצו על קלף מתאים להגנה' : 'Tap a matching card to defend'}
            tone="turn"
            withTail={false}
            size="compact"
            maxWidth={tutorialSideBubbleMaxWidth}
          />
        </View>
      ) : null}

      {/* ג”€ג”€ Bonus defense step (stepIndex 5): "׳”׳™׳“׳¢׳×?" intro + fraction-only practice ג”€ג”€ */}
      {isFracLesson && engine.stepIndex === 5 && engine.phase === 'await-mimic' &&
       !(fracDefenseUsedFractionRef.current.step3 || fracDefenseUsedFractionRef.current.step4) ? (
        <>
          {fracBonusStage === 0 ? (
            <>
              {/* Dark overlay */}
              <View pointerEvents="auto" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,10,22,0.88)', zIndex: 9250 }} />
              {/* "׳”׳™׳“׳¢׳×?" bubble */}
              <View pointerEvents="none" style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                alignItems: 'center', justifyContent: 'center',
                paddingHorizontal: 24, zIndex: 9260,
              }}>
                <View style={{
                  backgroundColor: '#14532d',
                  borderWidth: 2,
                  borderColor: '#22C55E',
                  borderRadius: 24,
                  paddingHorizontal: 24,
                  paddingVertical: 26,
                  alignItems: 'center',
                  gap: 10,
                  ...Platform.select({
                    ios: { shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 22 },
                    android: { elevation: 18 },
                  }),
                }}>
                  <Text style={{ color: '#86EFAC', fontSize: 15, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5 }}>
                    {locale === 'he' ? 'הידעת?' : 'Did you know?'}
                  </Text>
                  <Text style={{ color: '#FCD34D', fontSize: 24, fontWeight: '900', textAlign: 'center', lineHeight: 30 }}>
                    {locale === 'he' ? 'אפשר גם להניח קלף שבר כהגנה!' : 'You can also play a fraction card to defend!'}
                  </Text>
                  <View style={{ width: '100%', height: 1, backgroundColor: 'rgba(34,197,94,0.3)' }} />
                  <Text style={{ color: '#D1FAE5', fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 21 }}>
                    {locale === 'he' ? 'קלף שבר מעביר את האתגר לשחקן הבא' : 'A fraction card passes the challenge to the next player'}
                  </Text>
                </View>
              </View>
              {/* "׳'׳•׳ ׳ ׳ ׳¡׳”" button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setFracBonusStage(1)}
                style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', zIndex: 9270 }}
              >
                <View style={{
                  backgroundColor: '#16A34A',
                  borderRadius: 20,
                  paddingVertical: 15,
                  paddingHorizontal: 42,
                  borderWidth: 2,
                  borderColor: '#86EFAC',
                  ...Platform.select({
                    ios: { shadowColor: '#16A34A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 },
                    android: { elevation: 12 },
                  }),
                }}>
                  <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>
                    {locale === 'he' ? 'בוא ננסה ›' : 'Let\'s try! ›'}
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          ) : (
            /* Stage 1: hint to tap a fraction card only */
            <View pointerEvents="none" style={{ position: 'absolute', top: tutorialSideHintBubbleTop, alignItems: 'center', zIndex: 9260, ...tutorialTopBubbleInsets }}>
              <HappyBubble
                text={locale === 'he' ? 'לחצו על קלף שבר להגנה' : 'Tap a fraction card to defend'}
                tone="turn"
                withTail={false}
                size="compact"
                maxWidth={tutorialSideBubbleMaxWidth}
              />
            </View>
          )}
        </>
      ) : null}

      {/* Parens lesson: bubble UI temporarily removed ג€” re-add one by one. */}

      {/* Lesson 4 (build equation) body is intentionally EMPTY here:
          the lesson is performed on the real game's EquationBuilder + fan.
          The tutorial only contributes the speech bubble + (later) highlights. */}

      {/* Removed by request: no "try again" happy/error bubble overlay. */}

      {/* (L5a wrong-tap amber ring + "tap the sign" bubble were removed
          when cycle-signs was retired ג€” in the new L5.1 (place-op) flow,
          fan taps are the CORRECT first action.) */}

      {/* Green V flash when the bot taps the equation confirm button ג€”
          centered on the measured confirm button (same rect as the hint arrow). */}
      {showConfirmCheck && isEquationLesson ? (() => {
        const CHECK = 70;
        const half = CHECK / 2;
        const r = confirmBtnRect;
        const wrapStyle = r
          ? {
              position: 'absolute' as const,
              top: r.top + r.height / 2 - half,
              left: r.left + r.width / 2 - half,
              width: CHECK,
              height: CHECK,
              zIndex: 9400,
            }
          : {
              position: 'absolute' as const,
              top: 500,
              left: 0,
              right: 0,
              alignItems: 'center' as const,
              zIndex: 9400,
            };
        return (
          <View pointerEvents="none" style={wrapStyle}>
            <Animated.View
              style={{
                width: CHECK,
                height: CHECK,
                borderRadius: half,
                backgroundColor: '#16A34A',
                borderWidth: 4,
                borderColor: '#FFF',
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: confirmCheckScale }],
                shadowColor: '#16A34A',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.95,
                shadowRadius: 18,
                elevation: 16,
              }}
            >
              <Text style={{ color: '#FFF', fontSize: 42, fontWeight: '900', lineHeight: 46 }}>{'✓'}</Text>
            </Animated.View>
          </View>
        );
      })() : null}




      {/* Welcome bubble ג€” shown at the very start before any lesson begins */}
      {showWelcomeBubble && engine.phase !== 'idle' && (
        <TutorialWelcomeModal
          topInset={tutorialMockupTopInset}
          bottomInset={tutorialMockupBottomInset}
          horizontalPadding={tutorialMockupHorizontalPadding}
          cardMaxWidth={tutorialMockupCardMaxWidth}
          cardWidth={tutorialMockupCardWidth}
          cardPaddingVertical={tutorialMockupCardPaddingVertical}
          cardPaddingHorizontal={tutorialMockupCardPaddingHorizontal}
          cardGap={tutorialMockupCardGap}
          borderRadius={scaleTutorialWelcome(22, 11)}
          borderWidth={scaleTutorialWelcome(3, 1)}
          onStart={() => {
            advancedStartedFromWelcomeRef.current = false;
            setShowWelcomeBubble(false);
          }}
          onAdvanced={() => {
            advancedStartedFromWelcomeRef.current = true;
            setShowWelcomeBubble(false);
            dispatchEngine({ type: 'JUMP_TO_ADVANCED' });
          }}
        />
      )}

      {/* Core tutorial finished ג€” choice screen: continue to fractions or start real game. */}
      {engine.phase === 'core-complete' ? (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.60)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9400,
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#78350F',
              borderRadius: 24,
              paddingVertical: 32,
              paddingHorizontal: 24,
              borderWidth: 3,
              borderColor: '#FACC15',
              maxWidth: 380,
              width: '100%',
              alignItems: 'center',
              gap: 14,
              ...Platform.select({
                ios: { shadowColor: '#FACC15', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 20 },
                android: { elevation: 12 },
              }),
            }}
          >
            <Text style={{ color: '#FEF3C7', fontSize: 26, fontWeight: '900', textAlign: 'center' }}>
              {t('tutorial.coreComplete.title')}
            </Text>
            {resolvedCoreRewardOutcome !== 'awarded' ? (
              <>
                <Text style={{ color: '#FCA5A5', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
                  {t('tutorial.coreComplete.bodySkipped')}
                </Text>
                <Text style={{ color: '#FCA5A5', fontSize: 13, fontWeight: '600', textAlign: 'center', opacity: 0.75, marginTop: -6 }}>
                  {resolvedCoreRewardOutcome === 'limit'
                    ? t('tutorial.coreComplete.bodyLimitSub')
                    : t('tutorial.coreComplete.bodySkippedSub')}
                </Text>
              </>
            ) : (
              <Text style={{ color: '#FDE68A', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
                {t('tutorial.coreComplete.body')}
              </Text>
            )}
            <Text style={{ color: '#FDE68A', fontSize: 15, fontWeight: '600', textAlign: 'center', opacity: 0.9 }}>
              {t('tutorial.coreComplete.advancedOffer')}
            </Text>
            {/* Advanced fractions option */}
            <TouchableOpacity
              onPress={() => {
                dispatchEngine({ type: 'CHOOSE_ADVANCED_FRACTIONS' });
              }}
              accessibilityLabel={locale === 'he'
                ? 'המשיכו למתקדמים ותרוויחו 20 מטבעות סלינדה'
                : 'Continue to advanced and earn 20 Slinda coins'}
              style={{
                paddingVertical: 15,
                paddingHorizontal: 28,
                borderRadius: 18,
                backgroundColor: '#F59E0B',
                borderWidth: 2,
                borderColor: '#FCD34D',
                width: '100%',
                alignItems: 'center',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Text style={{ color: '#431407', fontWeight: '900', fontSize: 17 }}>
                  {t('tutorial.coreComplete.advancedBtn')}
                </Text>
                <SlindaCoin size={20} />
                <Text style={{ color: '#431407', fontWeight: '900', fontSize: 17 }}>
                  20
                </Text>
              </View>
            </TouchableOpacity>
            {/* Real game ג€” exits tutorial */}
            <TouchableOpacity
              onPress={onExit}
              style={{
                paddingVertical: 15,
                paddingHorizontal: 28,
                borderRadius: 18,
                backgroundColor: '#10B981',
                borderWidth: 2,
                borderColor: '#34D399',
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 17, textAlign: 'center' }}>
                {t('tutorial.coreComplete.realGameBtn')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Optional fractions: choice after core tutorial */}
      {engine.phase === 'post-signs-choice' ? (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9400,
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#0F172A',
              borderRadius: 22,
              paddingVertical: 22,
              paddingHorizontal: 20,
              borderWidth: 2,
              borderColor: '#EAB308',
              maxWidth: 380,
              width: '100%',
            }}
          >
            <Text style={{ color: '#FEF9C3', fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 10 }}>
              {t('tutorial.fracBranch.title')}
            </Text>
            <Text style={{ color: '#E2E8F0', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 20 }}>
              {t('tutorial.fracBranch.body')}
            </Text>
            <TouchableOpacity
              onPress={() => {
                dispatchEngine({ type: 'CHOOSE_ADVANCED_FRACTIONS' });
              }}
              style={{ paddingVertical: 14, borderRadius: 16, backgroundColor: '#2563EB', marginBottom: 10 }}
            >
              <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center', fontSize: 16 }}>
                {t('tutorial.fracBranch.advancedBtn')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => dispatchEngine({ type: 'CHOOSE_FINISH_TUTORIAL' })}
              style={{ paddingVertical: 14, borderRadius: 16, backgroundColor: '#475569' }}
            >
              <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center', fontSize: 16 }}>
                {t('tutorial.fracBranch.finishBtn')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Legacy standalone intro/theory "Continue" button was removed when
          the fractions lesson merged into direct attack steps ג€” each step's
          outcome is now a real card tap, not a Continue click. */}

      {/* ג”€ג”€ Advanced-complete: celebratory "׳¡׳™׳™׳׳×׳ ׳׳× ׳”׳”׳“׳¨׳›׳”!" modal ג”€ג”€ */}
      {engine.phase === 'advanced-complete' ? (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 15000,
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#78350F',
              borderRadius: 24,
              paddingVertical: 32,
              paddingHorizontal: 24,
              borderWidth: 3,
              borderColor: '#FACC15',
              maxWidth: 380,
              width: '100%',
              alignItems: 'center',
              gap: 14,
              ...Platform.select({
                ios: { shadowColor: '#FACC15', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 20 },
                android: { elevation: 12 },
              }),
            }}
          >
            <Text style={{ color: '#FEF3C7', fontSize: 26, fontWeight: '900', textAlign: 'center' }}>
              {t('tutorial.advancedComplete.title')}
            </Text>
            {resolvedAdvancedRewardOutcome !== 'awarded' ? (
              <>
                <Text style={{ color: '#FCA5A5', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
                  {t('tutorial.advancedComplete.bodySkipped')}
                </Text>
                <Text style={{ color: '#FCA5A5', fontSize: 13, fontWeight: '600', textAlign: 'center', opacity: 0.75, marginTop: -6 }}>
                  {resolvedAdvancedRewardOutcome === 'limit'
                    ? t('tutorial.advancedComplete.bodyLimitSub')
                    : t('tutorial.coreComplete.bodySkippedSub')}
                </Text>
              </>
            ) : (
              <Text style={{ color: '#FDE68A', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
                {t('tutorial.advancedComplete.body')}
              </Text>
            )}
            <TouchableOpacity
              onPress={() => {
                dispatchEngine({ type: 'DISMISS_ADVANCED_COMPLETE' });
                onExit();
              }}
              style={{
                paddingVertical: 15,
                paddingHorizontal: 28,
                borderRadius: 18,
                backgroundColor: '#10B981',
                borderWidth: 2,
                borderColor: '#34D399',
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 17, textAlign: 'center' }}>
                {t('tutorial.advancedComplete.realGameBtn')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* All-done: "׳™׳׳׳׳” ׳ ׳©׳—׳§!" CTA ג€” returns to the mode picker */}
      {engine.phase === 'all-done' ? (
        <View style={{ position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center', zIndex: 9300 }}>
          <TouchableOpacity
            onPress={onExit}
            activeOpacity={0.8}
            style={{
              paddingVertical: 18,
              paddingHorizontal: 48,
              backgroundColor: '#10B981',
              borderRadius: 28,
              borderWidth: 3,
              borderColor: '#34D399',
              ...Platform.select({
                ios: { shadowColor: '#10B981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 18 },
                android: { elevation: 14 },
              }),
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 22, letterSpacing: 0.5 }}>{t('tutorial.engine.exitAndReturn')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  const useFullShellWebOverlay =
    Platform.OS === 'web' &&
    (
      showWelcomeBubble ||
      engine.phase === 'core-complete' ||
      engine.phase === 'post-signs-choice' ||
      engine.phase === 'advanced-complete' ||
      engine.phase === 'all-done'
    );

  if (useFullShellWebOverlay) {
    return tutorialOverlay;
  }

  if (Platform.OS === 'web' && webTutorialLayout) {
    return (
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <WebGameScreenFrame
          width={webTutorialLayout.playfieldWidth}
          frameHeight={webTutorialLayout.frameHeight}
          contentScale={webTutorialLayout.contentScale}
          snapToTop={webTutorialLayout.portraitMobileWebViewport}
          outerStyle={{ backgroundColor: 'transparent' }}
          innerStyle={{ backgroundColor: 'transparent' }}
        >
          {tutorialOverlay}
        </WebGameScreenFrame>
      </View>
    );
  }

  return tutorialOverlay;
}
