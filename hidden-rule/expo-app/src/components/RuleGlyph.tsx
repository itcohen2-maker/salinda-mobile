import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg'

import type { CardGlyphId } from '../prototypeGame'
import { palette } from '../theme'

type RuleGlyphProps = {
  accentColor?: string
  color?: string
  glyph: CardGlyphId
  size?: number
}

function GlowDisk({
  color,
}: {
  color: string
}) {
  return (
    <>
      <Circle cx="50" cy="50" fill={color} opacity="0.16" r="34" />
      <Circle cx="50" cy="50" fill={color} opacity="0.08" r="42" />
    </>
  )
}

export function RuleGlyph({
  accentColor = palette.liveBrass,
  color = palette.liveInk,
  glyph,
  size = 72,
}: RuleGlyphProps) {
  const strokeWidth = size / 8.6
  const accentWidth = size / 11.5

  return (
    <Svg height={size} viewBox="0 0 100 100" width={size}>
      <GlowDisk color={accentColor} />

      <G fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth}>
        {glyph === 'paired-bars' ? (
          <>
            <Rect fill={accentColor} height="14" opacity="0.24" rx="7" width="58" x="21" y="43" />
            <Line x1="30" x2="30" y1="22" y2="78" />
            <Line x1="70" x2="70" y1="22" y2="78" />
            <Line x1="22" x2="78" y1="50" y2="50" />
            <Line stroke={accentColor} strokeWidth={accentWidth} x1="36" x2="64" y1="34" y2="34" />
          </>
        ) : null}

        {glyph === 'cut-diamond' ? (
          <>
            <Path d="M50 16 L82 50 L50 84 L18 50 Z" />
            <Path d="M50 27 L71 50 L50 73 L29 50 Z" fill={accentColor} opacity="0.24" stroke="none" />
            <Line stroke={accentColor} strokeWidth={accentWidth} x1="34" x2="43" y1="50" y2="50" />
            <Line stroke={accentColor} strokeWidth={accentWidth} x1="57" x2="66" y1="50" y2="50" />
            <Line x1="50" x2="50" y1="28" y2="72" />
          </>
        ) : null}

        {glyph === 'ring-axis' ? (
          <>
            <Circle cx="50" cy="50" r="31" />
            <Circle cx="50" cy="50" fill={accentColor} opacity="0.24" r="19" stroke="none" />
            <Line x1="18" x2="82" y1="50" y2="50" />
            <Line stroke={accentColor} strokeWidth={accentWidth} x1="50" x2="50" y1="24" y2="76" />
          </>
        ) : null}

        {glyph === 'triple-notch' ? (
          <>
            <Rect height="50" rx="8" ry="8" width="60" x="20" y="26" />
            <Rect fill={accentColor} height="14" opacity="0.22" rx="7" width="42" x="29" y="43" stroke="none" />
            <Line stroke={accentColor} strokeWidth={accentWidth} x1="30" x2="40" y1="24" y2="16" />
            <Line stroke={accentColor} strokeWidth={accentWidth} x1="50" x2="50" y1="24" y2="14" />
            <Line stroke={accentColor} strokeWidth={accentWidth} x1="70" x2="60" y1="24" y2="16" />
            <Line x1="30" x2="70" y1="50" y2="50" />
          </>
        ) : null}

        {glyph === 'tally-seal' ? (
          <>
            <Circle cx="50" cy="50" r="30" />
            <Path d="M30 60 L60 34" stroke={accentColor} strokeWidth={accentWidth} />
            <Line x1="36" x2="36" y1="34" y2="66" />
            <Line x1="48" x2="48" y1="34" y2="66" />
            <Line x1="60" x2="60" y1="34" y2="66" />
          </>
        ) : null}

        {glyph === 'ladder-rungs' ? (
          <>
            <Rect fill={accentColor} height="14" opacity="0.24" rx="7" width="46" x="27" y="59" stroke="none" />
            <Line x1="30" x2="30" y1="22" y2="78" />
            <Line x1="70" x2="70" y1="22" y2="78" />
            <Line x1="30" x2="70" y1="32" y2="32" />
            <Line x1="30" x2="70" y1="50" y2="50" />
            <Line stroke={accentColor} strokeWidth={accentWidth} x1="30" x2="70" y1="68" y2="68" />
          </>
        ) : null}

        {glyph === 'nested-arc' ? (
          <>
            <Path d="M22 68 C28 32 72 32 78 68" />
            <Path d="M34 68 C38 44 62 44 66 68" />
            <Rect fill={accentColor} height="14" opacity="0.24" rx="7" width="66" x="17" y="63" stroke="none" />
            <Line stroke={accentColor} strokeWidth={accentWidth} x1="18" x2="82" y1="70" y2="70" />
          </>
        ) : null}
      </G>
    </Svg>
  )
}
