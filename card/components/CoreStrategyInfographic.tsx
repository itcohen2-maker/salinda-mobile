import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

interface CoreStrategyInfographicProps {
  scale?: number;
  style?: StyleProp<ViewStyle>;
}

const GOLD = '#F4CD5A';
const GOLD_DEEP = '#8A5A1C';
const PANEL_BG = '#2B1A0B';
const PANEL_BG_SOFT = '#3A2410';
const CARD_CREAM = '#FFF2C7';
const CARD_TEXT = '#4A2E0D';

export function CoreStrategyInfographic({ scale = 1, style }: CoreStrategyInfographicProps) {
  const s = Math.max(0.45, Math.min(scale, 1.5));

  return (
    <View style={[styles.root, style]}>
      <Text
        style={[
          styles.headline,
          {
            fontSize: 24 * s,
            lineHeight: 30 * s,
            marginBottom: 14 * s,
          },
        ]}
      >
        הסוד במשחק: להתאים את התרגיל לקלף שלכם.
      </Text>

      <View
        style={[
          styles.panel,
          {
            width: 260 * s,
            minHeight: 340 * s,
            borderRadius: 26 * s,
            borderWidth: Math.max(3, 5 * s),
            paddingHorizontal: 24 * s,
            paddingVertical: 26 * s,
          },
        ]}
      >
        <View
          style={[
            styles.equationBox,
            {
              width: 170 * s,
              height: 74 * s,
              borderRadius: 16 * s,
              borderWidth: Math.max(2, 3 * s),
            },
          ]}
        >
          <Text style={[styles.equationText, { fontSize: 20 * s, lineHeight: 25 * s }]}>
            תרגיל מתאים
          </Text>
        </View>

        <Text style={[styles.equals, { fontSize: 58 * s, lineHeight: 66 * s, marginVertical: 16 * s }]}>
          =
        </Text>

        <View
          style={[
            styles.card,
            {
              width: 118 * s,
              height: 168 * s,
              borderRadius: 18 * s,
              borderWidth: Math.max(3, 4 * s),
            },
          ]}
        >
          <View
            style={[
              styles.cardInner,
              {
                borderRadius: 12 * s,
                borderWidth: Math.max(1, 2 * s),
                margin: 9 * s,
              },
            ]}
          >
            <Text style={[styles.cardText, { fontSize: 24 * s, lineHeight: 30 * s }]}>
              קלף
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default CoreStrategyInfographic;

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    color: GOLD,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  panel: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PANEL_BG,
    borderColor: GOLD,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 12,
  },
  equationBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_CREAM,
    borderColor: '#D9A23A',
  },
  equationText: {
    color: CARD_TEXT,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  equals: {
    color: GOLD,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  card: {
    alignItems: 'stretch',
    justifyContent: 'center',
    backgroundColor: CARD_CREAM,
    borderColor: GOLD_DEEP,
  },
  cardInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PANEL_BG_SOFT,
    borderColor: '#F0C659',
  },
  cardText: {
    color: GOLD,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
