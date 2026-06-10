import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import HandFan from '../../components/HandFan';
import type { Card } from '../../components/CardDesign';

const GOLD_TABLE_IMG = require('../../assets/table_golden_nobg.png');

const GOLD_GRADIENT = ['#F8E08E', '#F0C659', '#D9A23A', '#8A5A1C'] as const;
const GREEN_GRADIENT = ['#37A66A', '#247C4A', '#145B32'] as const;
const RED_GRADIENT = ['#C43C32', '#942720', '#671717'] as const;

const DICE_VALUES = [6, 9, 11] as const;

type LifelineOption = {
  value: number;
  equation: string;
};

const LIFELINE_OPTIONS: LifelineOption[] = [
  { value: 6, equation: '6 = (2 + 4)' },
  { value: 9, equation: '9 = (5 + 4)' },
  { value: 11, equation: '11 = (6 + 5)' },
];

const FAN_CARDS: Card[] = [
  { id: 'lifeline-preview-hand-5', type: 'number', value: 5 },
  { id: 'lifeline-preview-hand-6', type: 'number', value: 6 },
  { id: 'lifeline-preview-hand-9', type: 'number', value: 9 },
  { id: 'lifeline-preview-hand-11', type: 'number', value: 11 },
  { id: 'lifeline-preview-hand-4', type: 'number', value: 4 },
];

const INSTRUCTION_COPY =
  'הכפתור הירוק סרק את המניפה ומצא פתרונות! לחצו על מיני-קלף לחשיפת התרגיל.';

export function LifelineUIPreview() {
  const { width } = useWindowDimensions();
  const [selectedOption, setSelectedOption] = useState<LifelineOption | null>(null);
  const fanWidth = Math.min(width, 480);

  const selectedMiniValue = selectedOption?.value ?? null;
  const redButtonText = selectedOption?.equation ?? null;

  const selectedIds = useMemo(() => new Set<string>(), []);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#050505', '#130D06', '#241407', '#050505']}
        locations={[0, 0.42, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />

      <InstructionBanner />

      <View style={styles.centerLayer} pointerEvents="box-none">
        <View style={styles.actionRow}>
          <LifelineGreenButton />
          <LifelineRedButton text={redButtonText} />
        </View>

        <View style={styles.boardShell}>
          <Image source={GOLD_TABLE_IMG} resizeMode="contain" style={styles.tableImage} />
          <View style={styles.boardContent}>
            <DiceRow />
            <EmptyEquationRail />
          </View>
        </View>
      </View>

      <View style={styles.miniCardsDock}>
        <MiniCards selectedValue={selectedMiniValue} onSelect={setSelectedOption} />
      </View>

      <View style={[styles.fanWrap, { width: fanWidth }]}>
        <HandFan
          cards={FAN_CARDS}
          width={fanWidth}
          selectedIds={selectedIds}
          playTapSound={false}
        />
      </View>
    </View>
  );
}

function InstructionBanner() {
  return (
    <View pointerEvents="none" style={styles.bannerPin}>
      <LinearGradient colors={GOLD_GRADIENT} locations={[0, 0.3, 0.62, 1]} style={styles.banner}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.52)', 'rgba(255,255,255,0)']}
          style={styles.bannerSheen}
        />
        <Text allowFontScaling={false} style={styles.bannerText}>
          {INSTRUCTION_COPY}
        </Text>
      </LinearGradient>
    </View>
  );
}

function LifelineGreenButton() {
  return (
    <View style={styles.helperSlot}>
      <LinearGradient colors={GREEN_GRADIENT} style={[styles.helperButton, styles.greenButton]}>
        <View pointerEvents="none" style={styles.greenInnerRing} />
        <Text allowFontScaling={false} style={styles.greenButtonText}>
          גלגל הצלה
        </Text>
      </LinearGradient>
    </View>
  );
}

function LifelineRedButton({ text }: { text: string | null }) {
  const isEquation = !!text;

  return (
    <View style={styles.helperSlot}>
      <LinearGradient colors={RED_GRADIENT} style={[styles.helperButton, styles.redButton]}>
        {isEquation ? (
          <Text allowFontScaling={false} style={[styles.redText, styles.redEquationText]}>
            {text}
          </Text>
        ) : (
          <>
            <Text allowFontScaling={false} style={styles.redText}>
              לחצו על מיני קלפים
            </Text>
            <Text allowFontScaling={false} style={styles.redText}>
              כדי לקבל את התרגיל
            </Text>
          </>
        )}
      </LinearGradient>
    </View>
  );
}

function DiceRow() {
  return (
    <View style={styles.diceRow}>
      {DICE_VALUES.map((value) => (
        <View key={value} style={styles.diceCube}>
          <Text allowFontScaling={false} style={styles.diceText}>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function EmptyEquationRail() {
  return (
    <View style={styles.emptyEquation}>
      <View style={styles.emptyEquationLine} />
    </View>
  );
}

function MiniCards({
  selectedValue,
  onSelect,
}: {
  selectedValue: number | null;
  onSelect: (option: LifelineOption) => void;
}) {
  return (
    <View style={styles.miniRow}>
      {LIFELINE_OPTIONS.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onSelect(option)}
          accessibilityRole="button"
          accessibilityLabel={`פתרון ${option.value}`}
        >
          <View style={[styles.miniCard, selectedValue === option.value && styles.miniCardActive]}>
            <Text allowFontScaling={false} style={styles.miniCardText}>
              {option.value}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  bannerPin: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    zIndex: 30,
    alignItems: 'center',
  },
  banner: {
    width: '100%',
    maxWidth: 430,
    minHeight: 84,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#8A5A1C',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.42,
    shadowRadius: 14,
    elevation: 10,
  },
  bannerSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '46%',
  },
  bannerText: {
    color: '#2F2009',
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  centerLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 52,
    gap: 6,
    zIndex: 10,
  },
  actionRow: {
    width: '100%',
    maxWidth: 390,
    minHeight: 96,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  helperSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperButton: {
    borderWidth: 2,
    borderColor: '#F5D45A',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  greenButton: {
    width: 95,
    height: 95,
    borderRadius: 47.5,
    paddingHorizontal: 10,
  },
  greenInnerRing: {
    position: 'absolute',
    left: 7,
    right: 7,
    top: 7,
    bottom: 7,
    borderRadius: 40.5,
    borderWidth: 2,
    borderColor: 'rgba(255,241,168,0.9)',
  },
  greenButtonText: {
    color: '#FFF7D6',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  redButton: {
    width: 206,
    minHeight: 66,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  redText: {
    color: '#FFF7D6',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  redEquationText: {
    width: '100%',
    fontSize: 20,
    lineHeight: 26,
    writingDirection: 'ltr',
    direction: 'ltr',
  },
  boardShell: {
    width: '100%',
    maxWidth: 390,
    aspectRatio: 1024 / 774,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.68,
  },
  boardContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  diceRow: {
    flexDirection: 'row',
    direction: 'ltr',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceCube: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(248,224,142,0.72)',
    backgroundColor: 'rgba(20,12,4,0.46)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceText: {
    color: '#F8E08E',
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
  },
  emptyEquation: {
    width: 238,
    height: 50,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(248,224,142,0.42)',
    backgroundColor: 'rgba(18,11,4,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyEquationLine: {
    width: '84%',
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(248,224,142,0.48)',
  },
  miniCardsDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 140,
    zIndex: 20,
    alignItems: 'center',
  },
  miniRow: {
    minHeight: 52,
    flexDirection: 'row',
    direction: 'ltr',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCard: {
    width: 38,
    height: 48,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D7C58D',
    backgroundColor: '#F8F4EA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 5,
  },
  miniCardActive: {
    borderColor: '#7BE08A',
    shadowColor: '#7BE08A',
    shadowOpacity: 0.75,
    shadowRadius: 12,
    elevation: 10,
    transform: [{ translateY: -2 }],
  },
  miniCardText: {
    color: '#3D2A0E',
    fontSize: 18,
    fontWeight: '900',
  },
  fanWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 8,
  },
});
