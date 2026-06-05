import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GoldButton } from '../../components/GoldButton';
import { GameCard, type Card } from '../../components/CardDesign';
import HandFan from '../../components/HandFan';
import { evaluateComboExercise } from '../../shared/comboEvaluation';
import { playSfx } from '../audio/sfx';
import { FeraShowcaseScreen } from './FeraShowcaseScreen';

const GOLD_TABLE_IMG = require('../../assets/table_golden_nobg.png');

const rtlText = {
  writingDirection: 'rtl' as const,
  textAlign: 'right' as const,
};

type VictorySecretScenarioId = 'multi-card-drop' | 'fera-combo';

type VictorySecretScenario = {
  id: VictorySecretScenarioId;
  title: string;
  prompt: string;
  target: number;
  hand: Card[];
  requiredCardIds: string[];
  stagedCards?: Card[];
};

const MULTI_16_ID = 'victory-secret-16';
const MULTI_4_ID = 'victory-secret-4';
const FERA_WILD_ID = 'victory-secret-fera';

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function uniqueNoiseValues(blocked: number[], count: number): number[] {
  const values: number[] = [];
  while (values.length < count) {
    const value = randInt(1, 20);
    if (!blocked.includes(value) && !values.includes(value)) values.push(value);
  }
  return values;
}

function splitPositiveSum(total: number, parts: number): number[] {
  const cuts = new Set<number>();
  while (cuts.size < parts - 1) cuts.add(randInt(1, total - 1));
  const sorted = [0, ...[...cuts].sort((a, b) => a - b), total];
  return sorted.slice(1).map((cut, index) => cut - sorted[index]);
}

function buildMultiCardDropScenario(): VictorySecretScenario {
  const target = 21;
  const first = 10;
  const second = 11;
  const noise = uniqueNoiseValues([first, second, target], 3);

  return {
    id: 'multi-card-drop',
    title: 'פינוי כפול',
    prompt: 'רוצים להיפטר מקלפים מהר יותר? חברו קלפים יחד כדי להגיע למטרה! סמנו את 10 ו-11 כדי להשלים ל-21, ושגרו אותם.',
    target,
    requiredCardIds: [MULTI_16_ID, MULTI_4_ID],
    hand: [
      { id: `multi-dummy-${noise[0]}`, type: 'number', value: noise[0] },
      { id: MULTI_16_ID, type: 'number', value: first },
      { id: MULTI_4_ID, type: 'number', value: second },
      { id: `multi-dummy-${noise[1]}`, type: 'number', value: noise[1] },
      { id: `multi-dummy-${noise[2]}`, type: 'number', value: noise[2] },
    ],
  };
}

function buildFeraComboScenario(): VictorySecretScenario {
  const target = randInt(14, 25);
  const missing = randInt(2, Math.min(9, target - 3));
  const baseTotal = target - missing;
  const base = splitPositiveSum(baseTotal, 3);
  const noise = uniqueNoiseValues([...base, missing, target], 3);

  return {
    id: 'fera-combo',
    title: 'הפרא הכל-יכול',
    prompt: 'הרצף כבר על השולחן. בחרו את פרא כדי להשלים את הערך החסר.',
    target,
    requiredCardIds: ['fera-a', 'fera-b', 'fera-c', FERA_WILD_ID],
    stagedCards: [
      { id: 'fera-a', type: 'number', value: base[0] },
      { id: 'fera-b', type: 'number', value: base[1] },
      { id: 'fera-c', type: 'number', value: base[2] },
    ],
    hand: [
      { id: `fera-dummy-${noise[0]}`, type: 'number', value: noise[0] },
      { id: FERA_WILD_ID, type: 'wild' },
      { id: `fera-dummy-${noise[1]}`, type: 'number', value: noise[1] },
      { id: `fera-dummy-${noise[2]}`, type: 'number', value: noise[2] },
    ],
  };
}

function buildVictorySecretScenarios(): VictorySecretScenario[] {
  return [buildMultiCardDropScenario(), buildFeraComboScenario()];
}

type FlyingComboCard = {
  card: Card;
  order: number;
};

function usePulseLoop(value: Animated.Value, active: boolean, from: number, to: number, duration: number) {
  useEffect(() => {
    value.stopAnimation();
    if (!active) {
      value.setValue(from);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: to, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(value, { toValue: from, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, duration, from, to, value]);
}

function ScenarioTrack({
  scenario,
  selectedCards,
  resolvedCards,
  pulse,
}: {
  scenario: VictorySecretScenario;
  selectedCards: Card[];
  resolvedCards: Card[];
  pulse: Animated.Value;
}) {
  const cardsOnTrack = scenario.id === 'fera-combo' ? [...(scenario.stagedCards ?? []), ...selectedCards] : selectedCards;
  const displayCards = cardsOnTrack.map((card) => resolvedCards.find((resolved) => resolved.id === card.id) ?? card);
  const total = displayCards.reduce((sum, card) => sum + (card.type === 'wild' ? card.resolvedValue ?? 0 : card.value ?? 0), 0);
  const emptyPulse = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.9] });

  return (
    <View style={styles.trackWrap}>
      <View style={styles.targetBadge}>
        <Text style={styles.targetLabel}>מטרה</Text>
        <Text style={styles.targetValue}>{scenario.target}</Text>
      </View>
      <View style={styles.comboRow}>
        {displayCards.map((card, index) => (
          <React.Fragment key={card.id}>
            {index > 0 ? <Text style={styles.plus}>+</Text> : null}
            <View style={styles.miniCardSlot}>
              <GameCard card={card} small />
            </View>
          </React.Fragment>
        ))}
        {scenario.id === 'fera-combo' && selectedCards.length === 0 ? (
          <>
            <Text style={styles.plus}>+</Text>
            <Animated.View style={[styles.emptySlot, { opacity: emptyPulse }]}>
              <Text style={styles.emptyText}>?</Text>
            </Animated.View>
          </>
        ) : null}
        <Text style={styles.equals}>=</Text>
        <View style={[styles.resultSlot, total === scenario.target && styles.resultReady]}>
          <Text style={styles.resultText}>{total || '?'}</Text>
        </View>
      </View>
    </View>
  );
}

function FlyingComboCards({ cards, onDone }: { cards: FlyingComboCard[]; onDone: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    void playSfx('combo', { cooldownMs: 0, volumeOverride: 0.75 });
    Animated.timing(progress, {
      toValue: 1,
      duration: 780,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onDone();
    });
  }, [onDone, progress]);

  return (
    <View pointerEvents="none" style={styles.flyingLayer}>
      {cards.map(({ card, order }) => {
        const spread = (order - (cards.length - 1) / 2) * 42;
        const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [spread, spread * 2.4] });
        const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -310 - order * 14] });
        const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(order - 1.5) * 22}deg`] });
        const scale = progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.82, 1.08, 0.58] });
        const opacity = progress.interpolate({ inputRange: [0, 0.68, 1], outputRange: [1, 1, 0] });
        return (
          <Animated.View key={card.id} style={[styles.flyingCard, { opacity, transform: [{ translateX }, { translateY }, { rotate }, { scale }] }]}>
            <GameCard card={card} small />
          </Animated.View>
        );
      })}
    </View>
  );
}

export function VictorySecretScenarioRound({ onExit, onComplete }: { onExit?: () => void; onComplete?: () => void }) {
  const { width: winW } = useWindowDimensions();
  const fanW = Math.min(winW, 480);
  const [scenarios] = useState<VictorySecretScenario[]>(() => buildVictorySecretScenarios());
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const scenario = scenarios[scenarioIndex];
  const [hand, setHand] = useState<Card[]>(scenario.hand);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resolvedCards, setResolvedCards] = useState<Card[]>([]);
  const [flyingCards, setFlyingCards] = useState<FlyingComboCard[] | null>(null);
  const [showMultiCardWin, setShowMultiCardWin] = useState(false);
  const [feraShowcaseDone, setFeraShowcaseDone] = useState(false);
  const [complete, setComplete] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const buttonPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setHand(scenario.hand);
    setSelectedIds(new Set());
    setResolvedCards([]);
    setFlyingCards(null);
    setShowMultiCardWin(false);
  }, [scenario]);

  const selectedCards = useMemo(() => hand.filter((card) => selectedIds.has(card.id)), [hand, selectedIds]);
  const cardsForEvaluation = useMemo(() => [...(scenario.stagedCards ?? []), ...selectedCards], [scenario.stagedCards, selectedCards]);
  const evaluation = useMemo(
    () =>
      evaluateComboExercise({
        target: scenario.target,
        cards: cardsForEvaluation,
        requiredCardIds: scenario.requiredCardIds,
      }),
    [cardsForEvaluation, scenario.requiredCardIds, scenario.target],
  );
  const ready = evaluation.isComplete && !flyingCards;
  const previewResolvedCards = ready ? evaluation.resolvedCards : resolvedCards;

  usePulseLoop(pulse, scenario.id === 'fera-combo' && selectedCards.length === 0, 0, 1, 620);
  usePulseLoop(buttonPulse, ready, 1, 1.055, 470);

  const tapCard = useCallback(
    (card: Card) => {
      if (flyingCards) return;
      const isRequired = scenario.requiredCardIds.includes(card.id);
      if (!isRequired) return;
      setSelectedIds((current) => {
        const next = new Set(current);
        if (scenario.id === 'fera-combo') {
          next.clear();
          next.add(card.id);
          return next;
        }
        if (next.has(card.id)) next.delete(card.id);
        else next.add(card.id);
        return next;
      });
    },
    [flyingCards, scenario.id, scenario.requiredCardIds],
  );

  const launch = useCallback(() => {
    if (!ready) return;
    const nextResolvedCards = evaluation.resolvedCards;
    setResolvedCards(nextResolvedCards);
    setFlyingCards(nextResolvedCards.map((card, order) => ({ card, order })));
  }, [evaluation.resolvedCards, ready]);

  const finishFlight = useCallback(() => {
    setFlyingCards(null);
    setHand((cards) => cards.filter((card) => !evaluation.clearedCardIds.includes(card.id)));
    if (scenario.id === 'multi-card-drop') {
      setShowMultiCardWin(true);
      return;
    }
    if (scenarioIndex < scenarios.length - 1) {
      setScenarioIndex((index) => index + 1);
      return;
    }
    setComplete(true);
    onComplete?.();
  }, [evaluation.clearedCardIds, onComplete, scenario.id, scenarioIndex, scenarios.length]);

  const continueAfterMultiCardWin = useCallback(() => {
    setShowMultiCardWin(false);
    setScenarioIndex((index) => Math.min(index + 1, scenarios.length - 1));
  }, [scenarios.length]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  if (scenario.id === 'fera-combo' && !feraShowcaseDone) {
    return <FeraShowcaseScreen onStart={() => setFeraShowcaseDone(true)} />;
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#050505', '#130E07', '#050505']} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Text style={styles.title}>{scenario.title}</Text>
        <Text style={styles.prompt}>{scenario.prompt}</Text>
      </View>

      <View style={styles.playArea}>
        <View style={styles.tableZone}>
          <Image source={GOLD_TABLE_IMG} resizeMode="contain" style={styles.tableImg} />
          <View style={styles.tableOverlay}>
            <ScenarioTrack scenario={scenario} selectedCards={selectedCards} resolvedCards={previewResolvedCards} pulse={pulse} />
            {scenario.id === 'fera-combo' && evaluation.missingValue != null && selectedCards.length > 0 ? (
              <View style={styles.feraResolve}>
                <Text style={styles.feraResolveText}>פרא משלים: {evaluation.missingValue}</Text>
              </View>
            ) : null}
            <Animated.View style={[styles.launchWrap, { transform: [{ scale: buttonPulse }] }]}>
              <GoldButton
                label={ready ? 'שגר' : scenario.id === 'multi-card-drop' ? 'בחרו 2 קלפים' : 'בחרו פרא'}
                onPress={launch}
                disabled={!ready}
                fullWidth
                height={50}
                radius={12}
                raise={5}
                fontSize={22}
              />
            </Animated.View>
          </View>
        </View>
      </View>

      <View style={styles.fanWrap}>
        <HandFan
          cards={hand}
          width={fanW}
          selectedIds={selectedIdSet}
          onTapCard={tapCard}
          canTap={(card) => scenario.requiredCardIds.includes(card.id)}
          centerCardId={scenario.id === 'multi-card-drop' ? MULTI_16_ID : FERA_WILD_ID}
        />
      </View>

      {flyingCards ? <FlyingComboCards cards={flyingCards} onDone={finishFlight} /> : null}

      {showMultiCardWin ? (
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Text style={styles.successTrophy}>🏆</Text>
            <Text style={styles.successTitle}>איזה כיף!</Text>
            <Text style={styles.successSub}>נפטרתם משני קלפים במכה אחת!</Text>
            <GoldButton label="המשך" onPress={continueAfterMultiCardWin} accessibilityLabel="המשך" fullWidth height={54} fontSize={20} />
          </View>
        </View>
      ) : null}

      {complete ? (
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Text style={styles.successTrophy}>🏆</Text>
            <Text style={styles.successTitle}>סוד הניצחון נפתח</Text>
            <Text style={styles.successSub}>פתרתם פינוי כפול ופרא משלים. עכשיו יש לכם קומבו אמיתי ביד.</Text>
            <GoldButton label="סיום" onPress={onExit} accessibilityLabel="סיום" fullWidth height={54} fontSize={20} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 44,
    paddingHorizontal: 22,
    flexDirection: 'row-reverse',
    zIndex: 5,
  },
  header: {
    paddingTop: 0,
    paddingHorizontal: 22,
    alignItems: 'stretch',
    zIndex: 2,
  },
  kicker: {
    ...rtlText,
    color: 'rgba(248,224,142,0.72)',
    fontSize: 13,
    fontWeight: '900',
  },
  title: {
    ...rtlText,
    color: '#F8E08E',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  prompt: {
    ...rtlText,
    color: '#F5E6BF',
    fontSize: 15.5,
    lineHeight: 23,
    fontWeight: '700',
    marginTop: 8,
  },
  playArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 86,
  },
  tableZone: {
    width: '100%',
    maxWidth: 430,
    aspectRatio: 1024 / 774,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableImg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.56,
  },
  tableOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    gap: 12,
  },
  trackWrap: {
    alignItems: 'center',
    gap: 12,
  },
  targetBadge: {
    minWidth: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(248,224,142,0.5)',
    backgroundColor: 'rgba(20,12,4,0.72)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  targetLabel: { color: 'rgba(245,230,191,0.75)', fontSize: 12, fontWeight: '800' },
  targetValue: { color: '#F8E08E', fontSize: 30, fontWeight: '900', lineHeight: 34 },
  comboRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 98,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: 'rgba(20,12,4,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(244,205,90,0.34)',
  },
  miniCardSlot: {
    width: 54,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    transform: [{ scale: 0.52 }],
  },
  emptySlot: {
    width: 54,
    height: 76,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#F8E08E',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248,224,142,0.08)',
  },
  emptyText: { color: '#F8E08E', fontSize: 26, fontWeight: '900' },
  plus: { color: '#F8E08E', fontSize: 24, fontWeight: '900', marginHorizontal: 4 },
  equals: { color: '#F8E08E', fontSize: 24, fontWeight: '900', marginHorizontal: 6 },
  resultSlot: {
    minWidth: 54,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(244,205,90,0.55)',
    backgroundColor: 'rgba(255,243,201,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  resultReady: {
    borderColor: '#7BE08A',
    backgroundColor: 'rgba(46,125,67,0.24)',
  },
  resultText: { color: '#F8E08E', fontSize: 22, fontWeight: '900' },
  feraResolve: {
    borderRadius: 14,
    backgroundColor: 'rgba(46,125,67,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(123,224,138,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  feraResolveText: {
    ...rtlText,
    color: '#C8F7CE',
    fontSize: 14,
    fontWeight: '900',
  },
  launchWrap: {
    width: 180,
    borderRadius: 12,
  },
  fanWrap: {
    alignItems: 'center',
    paddingBottom: 28,
  },
  flyingLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 116,
    zIndex: 18,
  },
  flyingCard: {
    position: 'absolute',
    bottom: 0,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,5,2,0.84)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 24,
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
    alignItems: 'stretch',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 14,
  },
  successTrophy: { fontSize: 56, textAlign: 'center' },
  successTitle: { ...rtlText, color: '#7BE08A', fontSize: 25, fontWeight: '900' },
  successSub: { ...rtlText, color: '#D8C49A', fontSize: 15, fontWeight: '700', lineHeight: 22, marginBottom: 6 },
});
