import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GoldButton } from '../../components/GoldButton';

const rtlText = {
  writingDirection: 'rtl' as const,
  textAlign: 'right' as const,
};

interface HotPotatoModalProps {
  onContinue: () => void;
}

export function HotPotatoModal({ onContinue }: HotPotatoModalProps) {
  return (
    <View style={styles.overlay}>
      <LinearGradient
        colors={['#FFF2B8', '#E9B84C', '#9B641E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.card}
      >
        <Text style={styles.title}>חסימה מוצלחת! 🛡️</Text>
        <Text style={styles.body}>
          אבל חכו... ידעתם שאפשר גם להעביר את ההתקפה הלאה? אם תזרקו קלף שבר משלכם,
          האתגר יעבור מיד לשחקן הבא (כמו תפוח אדמה לוהט)!
        </Text>
        <GoldButton
          label="בואו ננסה!"
          onPress={onContinue}
          accessibilityLabel="בואו ננסה"
          fullWidth
          height={52}
          radius={14}
          fontSize={20}
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    backgroundColor: 'rgba(4, 5, 10, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFF5C9',
    padding: 22,
    gap: 16,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 18,
  },
  title: {
    ...rtlText,
    color: '#2B1D08',
    fontSize: 26,
    fontWeight: '900',
  },
  body: {
    ...rtlText,
    color: '#33240D',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 27,
  },
});

export default HotPotatoModal;
