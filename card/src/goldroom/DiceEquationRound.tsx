// ============================================================
// DiceEquationRound — Gold Room "Mastery Loop", a fully SELF-CONTAINED
// onboarding sandbox. It is intentionally DECOUPLED from the live game
// engine: all flow + validation logic lives locally here, so the room
// stays a premium, bug-free experience that can never break the real game.
//
// THE AUTHENTIC SALINDA RULE (modelled faithfully here):
//
//   • The DICE are the INPUTS. The player forms an equation FROM the dice on
//     the GoldEquationTrack — using TWO dice (5 + 3 = 8) or, if they choose,
//     all THREE (5 + 3 − 2 = 6). They are never obligated to use all three.
//   • The HAND/FAN holds the TARGET cards. After evaluating the dice equation,
//     the player TAPS the single hand card whose value equals that result, and
//     "בדוק" discards it (it flies out of the hand).
//
// Two guided steps, then a clean frozen success:
//   Step 1 — PLUS : add the dice, tap the matching card, clear it.
//   Step 2 — MINUS: subtract the dice, tap the matching card, clear it. → 🏆
//
// The round is SEEDED for the tutorial: [2,4,5] teaches + with card 6, then
// teaches ordered subtraction with card 3. No game/excellence meters are shown
// or updated here: this is pure mathematical explanation.
//
// Orchestration only: reuses AnimatedDice/GoldDieFace, the shared HandFan, the
// GoldButton and OperatorGlyph. No duplicated/shared game state.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedDice, { type AnimatedDiceHandle, GoldDieFace } from '../../AnimatedDice';
import { GameCard, type Card } from '../../components/CardDesign';
import HandFan from '../../components/HandFan';
import { GoldButton } from '../../components/GoldButton';
import OperatorGlyph from '../components/ui/OperatorGlyph';
import { applyOperation } from '../utils/arithmetic';
import { playSfx } from '../audio/sfx';

// The Gold Room table surface (same asset family the live game uses).
const GOLD_TABLE_IMG = require('../../assets/table_golden_nobg.png');

// ── Steps. Each guided step fixes a single operator so the lesson stays sharp.
type StepId = 'plus' | 'minus';
const STEP_OP: Record<StepId, '+' | '-'> = { plus: '+', minus: '-' };

const STEP_TEXT: Record<StepId, string> = {
  // Step 1 (PLUS) — keep the first action crisp: read dice + fan, then press check.
  plus: 'הביטו בקוביות ובמניפה. הרכבנו עבורכם תרגיל חיבור (+) שמגיע בדיוק ל-6. עכשיו, מצאו ולחצו על קלף 6 במניפה שלכם כדי לבחור אותו!',
  // Step 2 (MINUS) — real discovery: not every card is reachable. The player
  // scans the hand and picks one they can actually build toward.
  minus: 'עבודה מעולה! עכשיו האתגר גדל ועוברים לחיסור (-). הרכבנו עבורכם תרגיל חיסור (5 - 2) שמגיע בדיוק ל-3. מצאו ולחצו על קלף 3 במניפה שלכם!',
};

const SEEDED_DICE: [number, number, number] = [2, 4, 5];
const FIXED_HAND_VALUES = [12, 6, 3, 9, 15, 20, 1] as const;
const OPERATOR_LESSON_HAND: Card[] = [
  { id: 'op-lesson-num-12', type: 'number', value: 12 },
  { id: 'op-lesson-num-9', type: 'number', value: 9 },
  { id: 'op-lesson-num-3', type: 'number', value: 3 },
  { id: 'op-lesson-plus', type: 'operation', operation: '+' },
  { id: 'op-lesson-target-6', type: 'number', value: 6 },
  { id: 'op-lesson-num-15', type: 'number', value: 15 },
  { id: 'op-lesson-num-1', type: 'number', value: 1 },
];
const OPERATOR_LESSON_PLUS_ID = 'op-lesson-plus';
const OPERATOR_LESSON_TARGET_ID = 'op-lesson-target-6';
const SEND_BUTTON_WIDTH = 140;
const SEND_BUTTON_HEIGHT = 26;
const SEND_BUTTON_RADIUS = 12;
const SEND_BUTTON_RAISE = 5;
const SEND_BUTTON_FONT_SIZE = 13;

// ── A round: the three landed dice (inputs) and the fixed operator for this
// guided step.
interface Round {
  dice: [number, number, number];
  op: '+' | '-';
}

// ── Evaluate the dice the player placed on the track, left-to-right, under the
// step's single operator. Fewer than two operands ⇒ no result yet.
function calcResult(placed: number[], dice: [number, number, number], op: '+' | '-'): number | null {
  if (placed.length < 2) return null;
  let acc = dice[placed[0]];
  for (let i = 1; i < placed.length; i++) {
    const next = applyOperation(acc, op, dice[placed[i]]);
    if (next === null) return null;
    acc = next;
  }
  return acc;
}

function makeRound(step: StepId): Round {
  const op = STEP_OP[step];
  return { dice: SEEDED_DICE, op };
}

// ── Fixed 7-card tutorial hand for the Golden Rule explanation. Card 6 is the
// first Plus target (2 + 4), and card 3 is the second Minus target (5 - 2).
function buildTutorialHand(): Card[] {
  return FIXED_HAND_VALUES.map((value, i) => ({ id: `gr-hand-${i + 1}`, type: 'number', value }));
}

// ── A tappable gold DIE on the track — the landed face the player adds to the
// equation. Placed dice dim + show a check so it's clear they're "in".
function DiceChip({ value, placed, order, onPress }: { value: number; placed: boolean; order: number | null; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={placed ? `הסר קובייה ${value}` : `הוסף קובייה ${value}`}>
      <View style={[styles.diceChip, placed && styles.diceChipPlaced]}>
        <GoldDieFace value={value} size={52} />
        {placed && order !== null ? (
          <View style={styles.diceOrderBadge}><Text style={styles.diceOrderTxt}>{order}</Text></View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ── The equation track: THREE fixed dice slots (the player may use two or all
// three), joined by the step operator, then "= result". Filled slots show the
// placed die and are tappable to REMOVE it (it returns to the pool); empty slots
// are faint dashed placeholders so the room for up to three dice is always
// visible. The third slot reads as optional ("?") since two dice already solve.
const SLOT_COUNT = 3;
function EquationTrack({
  placed,
  dice,
  op,
  result,
  onRemove,
}: {
  placed: number[];
  dice: [number, number, number];
  op: '+' | '-';
  result: number | null;
  onRemove: (diceIdx: number) => void;
}) {
  return (
    <View style={styles.track}>
      {Array.from({ length: SLOT_COUNT }).map((_, i) => {
        const diceIdx = placed[i]; // dice index sitting in slot i, or undefined
        const filled = diceIdx !== undefined;
        // The operator LEADING INTO this slot is bright only when this slot is
        // actually filled (i.e. it joins two real operands).
        const operatorBright = placed.length > i;
        return (
          <React.Fragment key={`slot-${i}`}>
            {i > 0 ? (
              <View style={styles.trackOperatorGlyph}>
                <OperatorGlyph op={op} color={operatorBright ? '#F8E08E' : 'rgba(244,205,90,0.48)'} size={32} />
              </View>
            ) : null}
            {filled ? (
              <Pressable onPress={() => onRemove(diceIdx)} accessibilityRole="button" accessibilityLabel={`הסר קובייה ${dice[diceIdx]}`}>
                <View style={[styles.slot, styles.slotFilled]}>
                  <Text style={styles.slotTxt}>{dice[diceIdx]}</Text>
                </View>
              </Pressable>
            ) : (
              <View style={[styles.slot, styles.slotEmpty, i === 2 && styles.slotOptional]}>
                <Text style={styles.slotHintTxt}>{i === 2 ? '?' : '+'}</Text>
              </View>
            )}
          </React.Fragment>
        );
      })}
      <Text style={styles.equals}>=</Text>
      <View style={[styles.slot, styles.resultSlot]}><Text style={styles.slotTxt}>{result ?? '?'}</Text></View>
    </View>
  );
}

// ── The instruction bubble — the rule in one line, pinned to the very TOP black
// space (Y ≈ 10–25), clear of the dice table below.
function InstructionBanner({ text }: { text: string }) {
  return (
    <View style={styles.instructionWrap} pointerEvents="none">
      <View style={styles.instructionBubble}>
        <Text allowFontScaling={false} style={styles.headerText}>{text}</Text>
      </View>
    </View>
  );
}

// ── A matched card flying out of the hand toward the deck — the "discard" beat
// the player earns on a correct equation. The success chime plays LOUD and clear
// here — this is the player's first win, the dopamine moment.
function FlyingCard({ card, onDone, doneDelayMs = 0 }: { card: Card; onDone: () => void; doneDelayMs?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let doneTimer: ReturnType<typeof setTimeout> | null = null;
    void playSfx('success', { cooldownMs: 0, volumeOverride: 0.95 });
    const animation = Animated.timing(a, { toValue: 1, duration: 620, useNativeDriver: true });
    animation.start(() => {
      doneTimer = setTimeout(onDone, doneDelayMs);
    });
    return () => {
      animation.stop();
      if (doneTimer) clearTimeout(doneTimer);
    };
  }, [a, doneDelayMs, onDone]);
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [0, -320] });
  const scale = a.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1.12, 0.7] });
  const opacity = a.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] });
  return (
    <View pointerEvents="none" style={styles.flyingLayer}>
      <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
        <GameCard card={card} small onPress={undefined} />
      </Animated.View>
    </View>
  );
}

// ── Success — the explicit finish. A trophy pops, then a single "סיום"
// returns to the Hub. No Retry/Next/Menu choice overlay.
function SuccessCelebration({ onDone }: { onDone?: () => void }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
  }, [pop]);
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  return (
    <View style={styles.successOverlay}>
      <View style={styles.successCard}>
        <Animated.Text style={[styles.successTrophy, { opacity: pop, transform: [{ scale }] }]}>🏆</Animated.Text>
        <Text style={styles.successTitle}>כל הכבוד!</Text>
        <Text style={styles.successSub}>בנית תרגיל מהקוביות ונפטרת מהקלף המתאים ✓</Text>
        <View style={styles.successCta}>
          <GoldButton label="סיום" onPress={onDone} accessibilityLabel="סיום" fullWidth height={56} fontSize={20} />
        </View>
      </View>
    </View>
  );
}

function MiniOperatorCard({ op }: { op: '+' }) {
  return (
    <LinearGradient colors={['#F8E08E', '#F0C659', '#D9A23A', '#8A5A1C']} locations={[0, 0.35, 0.68, 1]} style={styles.operatorMiniCard}>
      <Text style={styles.operatorMiniText}>{op}</Text>
    </LinearGradient>
  );
}

function FlyingMiniOperator() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    void playSfx('success', { cooldownMs: 0, volumeOverride: 0.9 });
    Animated.timing(a, { toValue: 1, duration: 680, useNativeDriver: true }).start();
  }, [a]);
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [0, -340] });
  const translateX = a.interpolate({ inputRange: [0, 1], outputRange: [0, 72] });
  const rotate = a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '22deg'] });
  const scale = a.interpolate({ inputRange: [0, 0.28, 1], outputRange: [1, 1.16, 0.68] });
  const opacity = a.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
  return (
    <View pointerEvents="none" style={styles.flyingLayer}>
      <Animated.View style={{ opacity, transform: [{ translateX }, { translateY }, { rotate }, { scale }] }}>
        <MiniOperatorCard op="+" />
      </Animated.View>
    </View>
  );
}

function OperatorLessonTrack({
  operatorInserted,
  operatorReady,
  pulse,
  onPlaceOperator,
}: {
  operatorInserted: boolean;
  operatorReady: boolean;
  pulse: Animated.Value;
  onPlaceOperator: () => void;
}) {
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.9] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.1] });
  const slot = (
    <View style={[styles.operatorHole, operatorReady && styles.operatorHoleReady]}>
      {operatorReady ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.operatorHoleGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
        />
      ) : null}
      {operatorInserted ? <MiniOperatorCard op="+" /> : <Text style={styles.operatorHoleHint}>?</Text>}
    </View>
  );

  return (
    <View style={styles.track}>
      <View style={[styles.slot, styles.slotFilled]}><Text style={styles.slotTxt}>2</Text></View>
      {operatorReady ? (
        <Pressable onPress={onPlaceOperator} accessibilityRole="button" accessibilityLabel="מקם קלף פלוס בחריץ הסימן">
          {slot}
        </Pressable>
      ) : slot}
      <View style={[styles.slot, styles.slotFilled]}><Text style={styles.slotTxt}>4</Text></View>
      <Text style={styles.equals}>=</Text>
      <View style={[styles.slot, styles.resultSlot]}><Text style={styles.slotTxt}>6</Text></View>
    </View>
  );
}

function OperatorCardsLesson({ onComplete }: { onComplete?: () => void }) {
  const { width: winW } = useWindowDimensions();
  const fanW = Math.min(winW, 480);
  const [hand, setHand] = useState<Card[]>(OPERATOR_LESSON_HAND);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [operatorInserted, setOperatorInserted] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [flyingOperator, setFlyingOperator] = useState(false);
  const slotPulse = useRef(new Animated.Value(0)).current;

  const selectedCard = useMemo(() => hand.find((card) => card.id === selectedId) ?? null, [hand, selectedId]);
  const selectedIds = useMemo(() => (selectedId ? new Set([selectedId]) : new Set<string>()), [selectedId]);
  const plusSelected = selectedCard?.type === 'operation' && selectedCard.operation === '+';
  const targetSelected = operatorInserted && selectedCard?.type === 'number' && selectedCard.value === 6;
  const operatorReady = plusSelected && !operatorInserted && !resolving;
  const focusedFanCardId = operatorInserted ? OPERATOR_LESSON_TARGET_ID : OPERATOR_LESSON_PLUS_ID;

  const instructionText = useMemo(() => {
    if (targetSelected) return "מעולה! עכשיו לחצו על כפתור 'שגר' כדי להעיף את הקלף ולסיים את השיעור!";
    if (operatorInserted) return 'התרגיל מושלם: 2 + 4 = 6. עכשיו מצאו ולחצו על קלף 6 במניפה שלכם.';
    if (plusSelected) return 'מצוין! עכשיו לחצו על חריץ הסימן הריק שבמשוואה למעלה כדי למקם את הקלף שם.';
    return 'הכירו את קלפי הסימן! הם מאפשרים לכם להשלים תרגילים וגם להיפטר מקלפים מהיד. כאן מחכה לכם תרגיל של 2 ו-4 ששווה ל-6, אך חסר סימן החיבור. לחצו על קלף הפלוס (+) במניפה שלכם!';
  }, [operatorInserted, plusSelected, targetSelected]);

  useEffect(() => {
    if (!operatorReady) {
      slotPulse.stopAnimation();
      slotPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(slotPulse, { toValue: 1, duration: 520, useNativeDriver: true }),
        Animated.timing(slotPulse, { toValue: 0, duration: 520, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [operatorReady, slotPulse]);

  const canTapCard = useCallback((card: Card) => {
    if (resolving) return false;
    if (!operatorInserted) return card.type === 'operation' && card.operation === '+';
    return card.type === 'number' && card.value === 6;
  }, [operatorInserted, resolving]);

  const tapCard = useCallback((card: Card) => {
    if (!canTapCard(card)) return;
    setSelectedId((current) => (current === card.id ? null : card.id));
  }, [canTapCard]);

  const placeOperator = useCallback(() => {
    if (!operatorReady || !selectedId) return;
    void playSfx('place', { cooldownMs: 0, volumeOverride: 0.4 });
    setOperatorInserted(true);
    setHand((cards) => cards.filter((card) => card.id !== selectedId));
    setSelectedId(null);
  }, [operatorReady, selectedId]);

  const launch = useCallback(() => {
    if (!targetSelected || resolving) return;
    setResolving(true);
    setFlyingOperator(true);
    void playSfx('complete', { cooldownMs: 0, volumeOverride: 0.55 });
    setTimeout(() => {
      onComplete?.();
    }, 700);
  }, [onComplete, resolving, targetSelected]);

  return (
    <View style={styles.root}>
      <InstructionBanner text={instructionText} />

      <View style={styles.playArea}>
        <View style={styles.tableZone}>
          <Image source={GOLD_TABLE_IMG} resizeMode="contain" style={styles.tableImg} />
          <View style={styles.tableOverlay} pointerEvents="box-none">
            <View style={styles.operatorLessonArea}>
              <View style={styles.diceRow}>
                {SEEDED_DICE.map((value, idx) => (
                  <View key={idx} style={styles.diceChip}>
                    <GoldDieFace value={value} size={48} />
                  </View>
                ))}
              </View>
              <OperatorLessonTrack
                operatorInserted={operatorInserted}
                operatorReady={operatorReady}
                pulse={slotPulse}
                onPlaceOperator={placeOperator}
              />
              <View style={styles.fixedActionWrap}>
                <GoldButton
                  label={targetSelected ? 'שגר' : 'בחר קלפים'}
                  onPress={launch}
                  disabled={!targetSelected || resolving}
                  fullWidth
                  height={SEND_BUTTON_HEIGHT}
                  radius={SEND_BUTTON_RADIUS}
                  raise={SEND_BUTTON_RAISE}
                  fontSize={SEND_BUTTON_FONT_SIZE}
                  textStyle={styles.fixedActionText}
                  accessibilityLabel={targetSelected ? 'שגר' : 'בחר קלפים'}
                />
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.fanWrap} pointerEvents={resolving ? 'none' : 'box-none'}>
        <HandFan
          cards={hand}
          width={fanW}
          selectedIds={selectedIds}
          onTapCard={tapCard}
          canTap={canTapCard}
          centerCardId={focusedFanCardId}
        />
      </View>

      {flyingOperator ? <FlyingMiniOperator /> : null}
    </View>
  );
}

type DiceEquationRoundProps = {
  onExit?: () => void;
  onComplete?: () => void;
  mode?: 'practice' | 'operators';
};

export function DiceEquationRound({ onExit, onComplete, mode = 'practice' }: DiceEquationRoundProps) {
  if (mode === 'operators') {
    return <OperatorCardsLesson onComplete={onComplete} />;
  }

  // The fan is centered to the ROOM FRAME (capped at 480 on web), not the whole
  // window — without this the hand mis-centers off-frame and feels "stuck".
  const { width: winW } = useWindowDimensions();
  const fanW = Math.min(winW, 480);

  const diceRef = useRef<AnimatedDiceHandle>(null);

  // ── Round + flow state ──────────────────────────────────────────────────
  const initialRound = useRef(makeRound('plus')).current;
  const [step, setStep] = useState<StepId>('plus');
  const [substage, setSubstage] = useState<'roll' | 'solve'>('roll');
  const [round, setRound] = useState<Round>(initialRound);
  const [hand, setHand] = useState<Card[]>(buildTutorialHand);

  // The dice the player has placed on the track (dice indices, in tap order),
  // and the hand card they've marked as the matching target.
  const [placed, setPlaced] = useState<number[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [resolving, setResolving] = useState(false); // freezes input during the win
  const [flying, setFlying] = useState<Card | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const shake = useRef(new Animated.Value(0)).current;
  // Cross-fade driver: 0 = dice rolling (solve UI hidden, fan dimmed to 0.25),
  // 1 = solving (solve UI lit, fan fully lit + interactive). Nothing unmounts —
  // every element stays rendered and is governed only by opacity / pointerEvents.
  const reveal = useRef(new Animated.Value(0)).current;
  const didPlusGuidedPrefill = useRef(false);
  const didMinusGuidedPrefill = useRef(false);

  const op = round.op;
  const result = useMemo(() => calcResult(placed, round.dice, op), [placed, round.dice, op]);
  const selectedIds = useMemo(() => (selectedId ? new Set([selectedId]) : new Set<string>()), [selectedId]);
  const selectedCard = useMemo(() => hand.find((c) => c.id === selectedId) ?? null, [hand, selectedId]);
  const expectedTarget = step === 'plus' ? 6 : 3;
  const instructionText = useMemo(() => {
    if (step === 'plus' && selectedId !== null) {
      return 'מעולה! עכשיו לחצו על כפתור \'שגר\' כדי להעיף את הקלף הראשון!';
    }
    if (step === 'minus' && selectedCard?.value === 3) {
      return "מצוין! לחצו על כפתור 'שגר' כדי להעיף את הקלף!";
    }
    return STEP_TEXT[step];
  }, [selectedCard?.value, selectedId, step]);
  const checkButtonLabel = useMemo(() => {
    if (placed.length >= 2 && selectedId === null) return 'בחר קלפים';
    if (placed.length >= 2 && selectedId !== null) return 'שגר';
    return 'בדוק';
  }, [placed.length, selectedId]);
  const equationReady = placed.length >= 2;
  // The action is intentionally locked until the matching fan card is selected;
  // the label still reflects that the equation itself is ready.
  const canAttemptCheck = equationReady && selectedCard?.value === expectedTarget && !resolving;
  // FAILURE — "Game of Silence": a gentle shake, no text, no jarring chime.
  const doShake = useCallback(() => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0.55, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -0.55, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shake]);

  // The dice finished rolling — fade the solve UI in and lift the hand fan from
  // dim to fully lit (it never unmounts; only its opacity / touchability change).
  const handleRollComplete = useCallback(() => {
    setSubstage('solve');
    Animated.timing(reveal, { toValue: 1, duration: 420, useNativeDriver: true }).start();
    if (step === 'plus' && !didPlusGuidedPrefill.current) {
      didPlusGuidedPrefill.current = true;
      setPlaced([0, 1]); // [2,4] => 6, the guided first win.
      setSelectedId(null);
    }
    if (step === 'minus' && !didMinusGuidedPrefill.current) {
      didMinusGuidedPrefill.current = true;
      setPlaced([2, 0]); // [5,2] => 3, the guided subtraction win.
      setSelectedId(null);
    }
  }, [reveal, step]);

  // Tap a die: add it to the equation (in order) or remove it if already placed.
  const tapDie = useCallback(
    (idx: number) => {
      if (resolving) return;
      if (step === 'minus' && substage === 'solve') return;
      const alreadyPlaced = placed.includes(idx);
      if (alreadyPlaced) {
        void playSfx('transition', { cooldownMs: 0, volumeOverride: 0.24 });
        setPlaced((prev) => prev.filter((i) => i !== idx));
        return;
      }
      if (placed.length >= 3) return;
      void playSfx('place', { cooldownMs: 0, volumeOverride: 0.34 });
      setPlaced((prev) => (prev.includes(idx) || prev.length >= 3 ? prev : [...prev, idx]));
    },
    [placed, resolving, step, substage],
  );

  // Tap a hand card: mark (or unmark) it as the matching target card.
  const tapCard = useCallback(
    (card: Card) => {
      if (resolving || typeof card.value !== 'number') return;
      if (step === 'plus' && card.value !== 6) {
        console.log('[GoldRoom DiceEquationRound] blocked card tap', {
          step,
          cardId: card.id,
          cardValue: card.value,
          expectedValue: 6,
        });
        doShake();
        return;
      }
      if (step === 'minus' && card.value !== 3) {
        console.log('[GoldRoom DiceEquationRound] blocked card tap', {
          step,
          cardId: card.id,
          cardValue: card.value,
          expectedValue: 3,
        });
        doShake();
        return;
      }
      console.log('[GoldRoom DiceEquationRound] selected card tap', {
        step,
        cardId: card.id,
        cardValue: card.value,
        nextSelectedId: selectedId === card.id ? null : card.id,
      });
      setSelectedId((cur) => (cur === card.id ? null : card.id));
    },
    [doShake, resolving, selectedId, step],
  );

  // Reset the placed dice / selection for a fresh round.
  const resetSelections = useCallback(() => {
    setPlaced([]);
    setSelectedId(null);
  }, []);

  // After the matched card flies out: clear it from the hand, then either move
  // to the MINUS step (after PLUS) or freeze on the success state (after MINUS).
  const finishWin = useCallback(() => {
    const clearedId = selectedId;
    setFlying(null);
    setHand((h) => h.filter((c) => c.id !== clearedId));
    setResolving(false);
    resetSelections();
    if (step === 'plus') {
      const next = makeRound('minus');
      setRound(next);
      setStep('minus');
      reveal.setValue(0); // back to the rolling state for part B (subtraction)
      setSubstage('roll');
    } else {
      onComplete?.();
      setShowSuccess(true);
    }
  }, [selectedId, step, resetSelections, onComplete, reveal]);

  // "בדוק": does the dice equation equal the marked hand card?
  //   • match (result === selectedCard.value) → freeze input, the card flies out
  //     with the celebratory success chime, then finishWin advances the step.
  //   • mismatch → a quiet shake (no popup) — the "Game of Silence" failure beat.
  const handleCheck = useCallback(() => {
    console.log('[GoldRoom DiceEquationRound] handleCheck', {
      step,
      result,
      selectedCardValue: selectedCard?.value ?? null,
      selectedCardId: selectedCard?.id ?? null,
      selectedId,
      placedLength: placed.length,
      placed,
      canAttemptCheck,
      resolving,
    });
    if (!canAttemptCheck) return;
    if (selectedCard && selectedCard.value === result) {
      setResolving(true);
      setFlying(selectedCard); // FlyingCard plays 'success' loud, then calls finishWin
    } else {
      doShake();
    }
  }, [canAttemptCheck, doShake, placed, resolving, result, selectedCard, selectedId, step]);

  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] });
  const solving = substage === 'solve';
  const interactive = solving && !resolving;
  // Opacity ramps driven by `reveal` — the dice cross-fade into the solve UI and
  // the fan lifts from dim to full. No element is ever removed from the tree.
  const rollOpacity = reveal.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const fanOpacity = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });

  return (
    <View style={styles.root}>
      {/* The instruction bubble — pinned to the very top black space. */}
      <InstructionBanner text={instructionText} />

      <View style={styles.playArea}>
        <View style={styles.tableZone}>
          <Image source={GOLD_TABLE_IMG} resizeMode="contain" style={styles.tableImg} />
          <View style={styles.tableOverlay} pointerEvents="box-none">
            {/* ROLL layer — the rolling dice. ALWAYS mounted; fades out on solve. */}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rollLayer, { opacity: rollOpacity }]}>
              <AnimatedDice
                key={step}
                ref={diceRef}
                size={58}
                fixedFinalValues={round.dice}
                autoRollOnMount
                hideRollButton
                hideSumBadge
                onRollStart={() => {
                  void playSfx('diceRoll', { cooldownMs: 0, volumeOverride: 0.5 });
                }}
                onRollComplete={handleRollComplete}
              />
            </Animated.View>

            {/* SOLVE layer — landed dice (tappable), the 3-slot equation track and
             *  the check button. ALWAYS mounted; hidden + inert while rolling. */}
            <Animated.View
              pointerEvents={interactive ? 'box-none' : 'none'}
              style={[styles.solveZone, { opacity: reveal, transform: [{ translateX }] }]}
            >
              {/* The landed dice — tappable inputs; tap again to remove (Undo). */}
              <View style={styles.diceRow}>
                {round.dice.map((v, idx) => {
                  const pos = placed.indexOf(idx);
                  return (
                    <DiceChip
                      key={idx}
                      value={v}
                      placed={pos >= 0}
                      order={pos >= 0 ? pos + 1 : null}
                      onPress={() => tapDie(idx)}
                    />
                  );
                })}
              </View>
              <EquationTrack placed={placed} dice={round.dice} op={op} result={result} onRemove={tapDie} />
              <View style={styles.confirmWrap}>
                <View style={styles.checkPulseWrap}>
                  <GoldButton
                    label={checkButtonLabel}
                    onPress={handleCheck}
                    disabled={!canAttemptCheck}
                    fullWidth
                    height={SEND_BUTTON_HEIGHT}
                    radius={SEND_BUTTON_RADIUS}
                    raise={SEND_BUTTON_RAISE}
                    fontSize={SEND_BUTTON_FONT_SIZE}
                    textStyle={styles.fixedActionText}
                    accessibilityLabel={checkButtonLabel}
                  />
                </View>
                <Text style={styles.confirmHint}>שתי קוביות מספיקות — קובייה שלישית היא רשות, לא חובה.</Text>
              </View>
            </Animated.View>
          </View>
        </View>
      </View>

      {/* The hand fan — the TARGET cards. ALWAYS mounted: dimmed (0.25) and
       *  untouchable while the dice roll, then fades to full + interactive on
       *  solve. Tap the card equal to the equation result; "בדוק" flies it out. */}
      <Animated.View style={[styles.fanWrap, { opacity: fanOpacity }]} pointerEvents={interactive ? 'box-none' : 'none'}>
        <HandFan cards={hand} width={fanW} selectedIds={selectedIds} onTapCard={tapCard} />
      </Animated.View>

      {flying ? <FlyingCard card={flying} onDone={finishWin} doneDelayMs={step === 'minus' ? 700 : 0} /> : null}

      {showSuccess ? <SuccessCelebration onDone={onExit} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Play area — fills the space above the bottom hand. Anchored to the BOTTOM
  // (just above the fan) with a small gap, so the dice/equation sit LOW and well
  // clear of the instruction banner pinned at the top (no overlap).
  playArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 18, gap: 12 },
  // The table: a sized, semi-transparent surface. Content is overlaid centered
  // ON it, so the dice / equation always sit on the table, not off it.
  tableZone: { width: '94%', maxWidth: 380, aspectRatio: 1024 / 774, alignItems: 'center', justifyContent: 'center' },
  tableImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.55 },
  tableOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  solveZone: { alignItems: 'center', width: '100%', gap: 14 },
  // The rolling-dice layer sits absolutely over the solve UI and centers the
  // dice; it fades out (never unmounts) once the dice land.
  rollLayer: { alignItems: 'center', justifyContent: 'center' },

  // The landed dice, shown as tappable gold chips above the equation track.
  diceRow: { flexDirection: 'row', direction: 'ltr', gap: 12, justifyContent: 'center', alignItems: 'center' },
  diceChip: {
    padding: 4,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  diceChipPlaced: {
    borderColor: 'rgba(244,205,90,0.9)',
    backgroundColor: 'rgba(244,205,90,0.16)',
    opacity: 0.85,
  },
  diceOrderBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#8A5A1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceOrderTxt: { color: '#FFF7DA', fontSize: 11, fontWeight: '900' },
  operatorLessonArea: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 12,
    paddingHorizontal: 4,
  },

  // The equation track — dice operands, operator glyphs, "= result".
  track: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(20,12,4,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(244,205,90,0.35)',
  },
  slot: {
    minWidth: 44,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,243,201,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(244,205,90,0.5)',
  },
  slotEmpty: { borderStyle: 'dashed', borderColor: 'rgba(244,205,90,0.3)', backgroundColor: 'transparent' },
  // A filled, tappable die sitting in a slot — brighter so it reads as "active,
  // tap to take it back out".
  slotFilled: { borderColor: 'rgba(244,205,90,0.85)', backgroundColor: 'rgba(244,205,90,0.10)' },
  // The optional third slot: faded so it clearly reads as "open for more", not
  // "required" — two dice already solve the equation.
  slotOptional: { opacity: 0.4 },
  resultSlot: { borderColor: 'rgba(244,205,90,0.85)', backgroundColor: 'rgba(244,205,90,0.12)' },
  slotTxt: { color: '#F8E08E', fontSize: 18, fontWeight: '900' },
  slotHintTxt: { color: 'rgba(244,205,90,0.35)', fontSize: 18, fontWeight: '900' },
  trackOperatorGlyph: {
    width: 34,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorHole: {
    width: 42,
    height: 44,
    borderRadius: 11,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(244,205,90,0.48)',
    backgroundColor: 'rgba(255,243,201,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorHoleReady: {
    borderColor: '#F8E08E',
    backgroundColor: 'rgba(244,205,90,0.12)',
  },
  operatorHoleGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F4CD5A',
    shadowColor: '#F8E08E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 12,
  },
  operatorHoleHint: { color: 'rgba(244,205,90,0.48)', fontSize: 22, fontWeight: '900' },
  operatorMiniCard: {
    width: 32,
    height: 40,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#8A5A1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorMiniText: {
    color: '#3D2A0E',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 30,
    textAlign: 'center',
  },
  equals: { color: '#F8E08E', fontSize: 20, fontWeight: '900', marginHorizontal: 2 },
  confirmWrap: { alignSelf: 'stretch', alignItems: 'center', marginTop: 2 },
  checkPulseWrap: { alignSelf: 'center', width: SEND_BUTTON_WIDTH, borderRadius: SEND_BUTTON_RADIUS },
  fixedActionWrap: { alignSelf: 'center', width: SEND_BUTTON_WIDTH, borderRadius: SEND_BUTTON_RADIUS },
  fixedActionText: { textAlign: 'center' as const },
  confirmHint: { color: 'rgba(244,205,90,0.65)', fontSize: 14.5, fontWeight: '700', textAlign: 'center', marginTop: 8 },

  // Hand fan — anchored low at the bottom of the screen, swipeable; only a small
  // safe-area gap below it (clear of the iPhone home indicator).
  fanWrap: { alignItems: 'center', paddingBottom: 28 },

  // The matched card flying out toward the deck.
  flyingLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 120, zIndex: 18 },

  // The instruction bubble — pinned to the very TOP black space (Y ≈ 10–25),
  // full width, well clear of the centered dice table.
  instructionWrap: { position: 'absolute', top: 14, left: 16, right: 16, zIndex: 15 },
  instructionBubble: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(20,12,4,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(244,205,90,0.35)',
  },
  headerText: { color: '#F8E08E', fontSize: 18, fontWeight: '700', lineHeight: 26, textAlign: 'right' },

  // Success celebration — full-screen, explicit finish.
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,5,2,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 20,
  },
  successCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#2E7D43',
    backgroundColor: 'rgba(17,12,4,0.96)',
    paddingHorizontal: 26,
    paddingVertical: 30,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 14,
  },
  successTrophy: { fontSize: 56 },
  successTitle: { color: '#7BE08A', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  successSub: { color: '#D8C49A', fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 22, marginBottom: 6 },
  successCta: { alignSelf: 'stretch', marginTop: 6 },
});

export default DiceEquationRound;
