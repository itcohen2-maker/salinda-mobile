import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Dimensions, Platform } from 'react-native'
import { useGame } from '../../hooks/useGame'
import { useLocale } from '../../i18n/LocaleContext'
import Button from '../ui/Button'
import SalindaLogoOption06 from '../branding/SalindaLogoOption06'
import { useWebViewportSize } from '../../hooks/useWebViewportSize'
import { getWebGameLayout } from '../../theme/webLayout'
import { WebGameScreenFrame } from '../layout/WebGameScreenFrame'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const COLORS = ['#EAB308', '#3B82F6', '#EF4444', '#22C55E', '#8B5CF6', '#F97316']
const CONFETTI_COUNT = 30

function Confetti({ width, height }: { width: number; height: number }) {
  const anims = useRef(
    Array.from({ length: CONFETTI_COUNT }, () => ({
      x: new Animated.Value(Math.random() * width),
      y: new Animated.Value(-20),
      rotate: new Animated.Value(0),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))
  ).current

  useEffect(() => {
    anims.forEach((a) => {
      a.x.setValue(Math.random() * width)
      a.y.setValue(-20)
      a.rotate.setValue(0)
      const duration = 2000 + Math.random() * 2000
      const delay = Math.random() * 1500
      Animated.parallel([
        Animated.timing(a.y, {
          toValue: height + 20,
          duration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(a.rotate, {
          toValue: Math.random() * 720 - 360,
          duration,
          delay,
          useNativeDriver: true,
        }),
      ]).start()
    })
  }, [anims, height, width])

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: 10,
            height: 10,
            borderRadius: 2,
            backgroundColor: a.color,
            transform: [
              { translateX: a.x as any },
              { translateY: a.y as any },
              {
                rotateZ: a.rotate.interpolate({
                  inputRange: [-360, 360],
                  outputRange: ['-360deg', '360deg'],
                }) as any,
              },
            ],
          }}
        />
      ))}
    </View>
  )
}

export default function GameOver({ onPlayVsBot, onBackToLobby }: {
  onPlayVsBot?: () => void;
  onBackToLobby?: () => void;
}) {
  const { t } = useLocale()
  const { state, dispatch } = useGame()
  const viewport = useWebViewportSize()
  const webGameLayout = Platform.OS === 'web' ? getWebGameLayout(viewport) : null
  const playfieldWidth = webGameLayout?.playfieldWidth ?? SCREEN_W
  const screenHeight = webGameLayout?.frameHeight ?? SCREEN_H
  const playfieldFrameHeight = webGameLayout?.frameHeight ?? SCREEN_H
  const playfieldContentScale = webGameLayout?.contentScale ?? 1

  const sortedPlayers = [...state.players].sort(
    (a, b) => a.hand.length - b.hand.length
  )

  const isTechnicalVictory = (state as any).winReason === 'technical';
  const disconnectedPlayerName = (state as any).disconnectedPlayerName as string | undefined;

  return (
    <WebGameScreenFrame
      width={playfieldWidth}
      frameHeight={playfieldFrameHeight}
      contentScale={playfieldContentScale}
      testID="game-over-playfield"
    >
      <View style={styles.container}>
      <Confetti width={playfieldWidth} height={screenHeight} />

      <View style={styles.logoRow}>
        <SalindaLogoOption06 width={200} />
      </View>
      <Text style={styles.trophy}>🏆</Text>
      <Text style={styles.heading}>{isTechnicalVictory ? t('game.technicalVictoryTitle') : t('game.over')}</Text>
      <Text style={styles.winner}>{state.winner ? t('game.winner', { name: state.winner.name }) : ''}</Text>

      {isTechnicalVictory && disconnectedPlayerName ? (
        <View style={styles.technicalBanner}>
          <Text style={styles.technicalBannerText}>
            {t('game.technicalVictoryBody', { name: disconnectedPlayerName })}
          </Text>
        </View>
      ) : null}

      <View style={styles.standings}>
        <Text style={styles.standingsTitle}>{t('game.finalStandings')}</Text>
        {sortedPlayers.map((p, i) => (
          <View key={p.id} style={styles.standingRow}>
            {(() => {
              const courageCoins = Math.max(0, Math.floor(Number((p as any).courageCoins ?? 0) || 0))

              return (
                <>
            <Text style={styles.standingName}>
              {i + 1}. {p.name}
              {p.hand.length === 0 ? ' ★' : ''}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {courageCoins > 0 ? (
                <Text style={styles.coinBadge}>🪙×{courageCoins}</Text>
              ) : (
                <Text style={styles.standingCards}>—</Text>
              )}
              <Text style={styles.standingCards}>{t('game.cardsLeft', { n: String(p.hand.length) })}</Text>
            </View>
                </>
              )
            })()}
          </View>
        ))}
      </View>

      {isTechnicalVictory ? (
        <View style={{ width: '100%', marginTop: 20, gap: 12 }}>
          <Button
            variant="primary"
            size="lg"
            onPress={() => onPlayVsBot?.()}
            style={{ width: '100%' }}
          >
            {t('game.playVsBot')}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onPress={() => onBackToLobby?.()}
            style={{ width: '100%' }}
          >
            {t('game.backToLobby')}
          </Button>
        </View>
      ) : (
        <Button
          variant="primary"
          size="lg"
          onPress={() => dispatch({ type: 'RESET_GAME' })}
          style={{ width: '100%', marginTop: 20 }}
        >
          {t('game.playAgain')}
        </Button>
      )}
      </View>
    </WebGameScreenFrame>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  logoRow: { marginBottom: 4 },
  trophy: { fontSize: 56, marginBottom: 8 },
  heading: { color: '#FFF', fontSize: 28, fontWeight: '800' },
  winner: { color: '#FACC15', fontSize: 20, fontWeight: '700', marginTop: 8, marginBottom: 24 },
  standings: {
    backgroundColor: 'rgba(55,65,81,0.5)',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  standingsTitle: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: 'right',
  },
  standingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  standingName: { color: '#D1D5DB', fontSize: 14 },
  standingCards: { color: '#9CA3AF', fontSize: 14 },
  coinBadge: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '700',
  },
  technicalBanner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    marginBottom: 16,
  },
  technicalBannerText: {
    color: '#92400E',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
})
