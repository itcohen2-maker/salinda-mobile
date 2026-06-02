import React from 'react'
import { Text, View, StyleSheet } from 'react-native'
import { useLocale } from '../../i18n/LocaleContext'
import Card from './Card'
import { Card as CardType } from '../../types/game'

interface Props {
  card: CardType
  selected?: boolean
  onPress?: () => void
  small?: boolean
}

export default function SalindaCard({ card: _card, selected, onPress, small }: Props) {
  const { t } = useLocale()
  return (
    <Card borderColor="#EAB308" bgColor="#FEFCE8" selected={selected} onPress={onPress} small={small}>
      <View style={styles.inner}>
        <Text style={[styles.letter, { fontSize: small ? 26 : 34 }]}>S</Text>
        <Text style={[styles.text, { fontSize: small ? 9 : 12 }]}>{t('cardLabel.salinda')}</Text>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  inner: { alignItems: 'center' },
  letter: { color: '#15803D', fontWeight: '900', lineHeight: 36 },
  text: { color: '#CA8A04', fontWeight: '800' },
})
