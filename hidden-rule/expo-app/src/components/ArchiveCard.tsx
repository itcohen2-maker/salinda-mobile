import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { CardGlyphId } from '../prototypeGame'
import { palette } from '../theme'
import { RuleGlyph } from './RuleGlyph'

type ArchiveCardProps = {
  catalog: string
  glyph: CardGlyphId
  onPress?: () => void
  showCatalog?: boolean
  showPlaque?: boolean
  size?: 'evidence' | 'focus' | 'hand'
  state?: 'accepted' | 'neutral' | 'rejected' | 'selected'
}

const sizes = {
  evidence: {
    badge: 10,
    caption: 10,
    glyph: 40,
    height: 96,
    padding: 7,
    width: 72,
  },
  focus: {
    badge: 12,
    caption: 12,
    glyph: 112,
    height: 236,
    padding: 14,
    width: 172,
  },
  hand: {
    badge: 11,
    caption: 11,
    glyph: 74,
    height: 156,
    padding: 10,
    width: 116,
  },
} as const

function resolveState(state: ArchiveCardProps['state']) {
  switch (state) {
    case 'accepted':
      return {
        badge: '#8FB184',
        border: '#E0BF7B',
        chamber: ['#355440', '#243228'] as const,
        frame: ['#50695A', '#223129', '#172019'] as const,
        glyphAccent: '#B8D0B8',
        glyphColor: palette.ivory,
        glow: 'rgba(117, 146, 122, 0.34)',
        halo: 'rgba(184, 208, 184, 0.24)',
        pin: '#E8D7A8',
        rail: '#47705A',
        stripe: '#9CC58D',
      }
    case 'rejected':
      return {
        badge: palette.emberRed,
        border: '#F0B07D',
        chamber: ['#5A282E', '#38191E'] as const,
        frame: ['#D84840', '#8F1F24', '#5A151A'] as const,
        glyphAccent: '#FFD0B3',
        glyphColor: palette.ivory,
        glow: 'rgba(240, 90, 83, 0.34)',
        halo: 'rgba(255, 208, 179, 0.24)',
        pin: '#F6D79D',
        rail: '#B12F35',
        stripe: '#F07F5E',
      }
    case 'selected':
      return {
        badge: palette.emberRed,
        border: palette.hotGold,
        chamber: ['#3A5474', '#25354A'] as const,
        frame: ['#5B86B5', '#26405C', '#1A293A'] as const,
        glyphAccent: '#B9DDFF',
        glyphColor: palette.ivory,
        glow: 'rgba(115, 183, 255, 0.38)',
        halo: 'rgba(185, 221, 255, 0.3)',
        pin: palette.hotGold,
        rail: '#D04038',
        stripe: '#84C0FF',
      }
    default:
      return {
        badge: palette.deepRed,
        border: palette.hotGold,
        chamber: ['#F4E3C4', '#E2CFAE'] as const,
        frame: ['#5A7EA2', '#243A50', '#182531'] as const,
        glyphAccent: palette.lacquerRed,
        glyphColor: palette.inkBlue,
        glow: 'rgba(214, 58, 54, 0.18)',
        halo: 'rgba(214, 58, 54, 0.16)',
        pin: palette.hotGold,
        rail: '#D63A36',
        stripe: '#D63A36',
      }
  }
}

export function ArchiveCard({
  catalog,
  glyph,
  onPress,
  showCatalog = false,
  showPlaque = false,
  size = 'hand',
  state = 'neutral',
}: ArchiveCardProps) {
  const metrics = sizes[size]
  const colors = resolveState(state)
  const Component = onPress ? Pressable : View

  return (
    <Component
      onPress={onPress}
      style={[styles.cardShell, { height: metrics.height, width: metrics.width }]}
    >
      <View style={[styles.cardAura, { backgroundColor: colors.glow }]} />
      <LinearGradient
        colors={colors.frame}
        end={{ x: 0.9, y: 1 }}
        start={{ x: 0.1, y: 0 }}
        style={[styles.outerFrame, { borderColor: colors.border, padding: metrics.padding }]}
      >
        <View style={[styles.sideRail, { backgroundColor: colors.rail }]} />
        <View style={[styles.cornerPin, styles.cornerPinTopLeft, { backgroundColor: colors.pin }]} />
        <View style={[styles.cornerPin, styles.cornerPinTopRight, { backgroundColor: colors.pin }]} />
        <View style={[styles.cornerPin, styles.cornerPinBottomLeft, { backgroundColor: colors.pin }]} />
        <View style={[styles.cornerPin, styles.cornerPinBottomRight, { backgroundColor: colors.pin }]} />
        {showCatalog ? (
          <View style={[styles.topBand, { backgroundColor: colors.badge }]}>
            <Text style={[styles.catalogText, { fontSize: metrics.badge }]}>{catalog}</Text>
          </View>
        ) : null}
        <LinearGradient
          colors={colors.chamber}
          end={{ x: 0.8, y: 1 }}
          start={{ x: 0.2, y: 0 }}
          style={[
            styles.chamber,
            {
              marginTop: showCatalog ? 10 : 2,
            },
          ]}
        >
          <View style={[styles.chamberHalo, { backgroundColor: colors.halo }]} />
          <View style={[styles.chamberRing, { borderColor: colors.pin }]} />
          <View style={[styles.glyphPlate, { borderColor: colors.pin }]}>
            <View style={[styles.glyphPlateInner, { backgroundColor: colors.halo }]} />
          </View>
          <RuleGlyph
            accentColor={colors.glyphAccent}
            color={colors.glyphColor}
            glyph={glyph}
            size={metrics.glyph}
          />
          <View style={[styles.bottomStripe, { backgroundColor: colors.stripe }]} />
        </LinearGradient>
        {showPlaque ? (
          <View style={styles.bottomPlaque}>
            <Text style={[styles.bottomPlaqueText, { fontSize: metrics.caption }]}>מסמך מסווג</Text>
          </View>
        ) : null}
      </LinearGradient>
    </Component>
  )
}

const styles = StyleSheet.create({
  bottomPlaque: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  bottomPlaqueText: {
    color: palette.softText,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  bottomStripe: {
    borderRadius: 999,
    bottom: 12,
    height: 6,
    left: '22%',
    opacity: 0.9,
    position: 'absolute',
    right: '22%',
  },
  cardAura: {
    borderRadius: 26,
    bottom: -4,
    left: -4,
    opacity: 0.45,
    position: 'absolute',
    right: -4,
    top: -4,
  },
  cardShell: {
    shadowColor: palette.shadow,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 16,
  },
  catalogText: {
    color: palette.ivory,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  chamber: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chamberHalo: {
    borderRadius: 999,
    height: '58%',
    opacity: 0.9,
    position: 'absolute',
    width: '58%',
  },
  chamberRing: {
    borderRadius: 999,
    borderWidth: 1,
    height: '72%',
    opacity: 0.45,
    position: 'absolute',
    width: '72%',
  },
  cornerPin: {
    borderRadius: 999,
    height: 6,
    opacity: 0.9,
    position: 'absolute',
    width: 6,
  },
  cornerPinBottomLeft: {
    bottom: 10,
    left: 10,
  },
  cornerPinBottomRight: {
    bottom: 10,
    right: 18,
  },
  cornerPinTopLeft: {
    left: 10,
    top: 10,
  },
  cornerPinTopRight: {
    right: 18,
    top: 10,
  },
  glyphPlate: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: '46%',
    justifyContent: 'center',
    opacity: 0.32,
    position: 'absolute',
    width: '46%',
  },
  glyphPlateInner: {
    borderRadius: 999,
    height: '72%',
    opacity: 0.35,
    width: '72%',
  },
  outerFrame: {
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    overflow: 'hidden',
  },
  sideRail: {
    borderBottomRightRadius: 12,
    borderTopRightRadius: 12,
    bottom: 14,
    position: 'absolute',
    right: 0,
    top: 14,
    width: 10,
  },
  topBand: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
})
