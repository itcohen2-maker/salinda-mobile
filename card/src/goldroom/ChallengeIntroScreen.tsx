import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GoldButton } from '../../components/GoldButton';

const rtlText = {
  writingDirection: 'rtl' as const,
  textAlign: 'right' as const,
};

interface ChallengeIntroScreenProps {
  onContinue: () => void;
}

export function ChallengeIntroScreen({ onContinue }: ChallengeIntroScreenProps) {
  return (
    <LinearGradient colors={['#080A10', '#151823', '#07080C']} style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.title}>אותגרת! ⚔️</Text>
        <Text style={styles.body}>
          היריב זרק עליכם קלף ⅓. כדי להתגונן, עליכם להשתמש בקלף שמתחלק ב-3.
        </Text>
      </View>
      <View style={styles.action}>
        <GoldButton
          label="להגנה!"
          onPress={onContinue}
          accessibilityLabel="להגנה"
          fullWidth
          height={56}
          radius={16}
          fontSize={22}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 34,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 24,
  },
  title: {
    ...rtlText,
    color: '#FFF4C7',
    fontSize: 38,
    fontWeight: '900',
  },
  body: {
    ...rtlText,
    color: '#E8EDF7',
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 34,
    maxWidth: 420,
  },
  action: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
});

export default ChallengeIntroScreen;
