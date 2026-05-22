import * as React from 'react'

import { ACCENT_TOKENS, BRASS_TOKENS, SURFACE_TOKENS, TEXT_COLORS } from '../../theme'

export type RuleGlyphId =
  | 'ring-axis'
  | 'paired-bars'
  | 'cut-diamond'
  | 'nested-arc'
  | 'ladder-rungs'
  | 'triple-notch'
  | 'tally-seal'

type RuleGlyphProps = {
  id: RuleGlyphId
  size?: number
  tone?: 'ivory' | 'brass' | 'oxblood' | 'ink'
}

const TONE_COLORS: Record<NonNullable<RuleGlyphProps['tone']>, string> = {
  ivory: TEXT_COLORS.primary,
  brass: BRASS_TOKENS.soft,
  oxblood: ACCENT_TOKENS.oxblood,
  ink: SURFACE_TOKENS.ink,
}

export function RuleGlyph({
  id,
  size = 64,
  tone = 'ivory',
}: RuleGlyphProps) {
  const color = TONE_COLORS[tone]
  const sharedProps = {
    fill: 'none',
    stroke: color,
    strokeWidth: 2.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={{ width: size, height: size, display: 'block' }}
    >
      {id === 'ring-axis' ? (
        <>
          <circle cx="32" cy="32" r="17" {...sharedProps} />
          <line x1="19" y1="32" x2="45" y2="32" {...sharedProps} />
          <circle cx="32" cy="18" r="2.2" fill={color} stroke="none" />
          <circle cx="32" cy="46" r="2.2" fill={color} stroke="none" />
        </>
      ) : null}

      {id === 'paired-bars' ? (
        <>
          <line x1="20" y1="18" x2="20" y2="46" {...sharedProps} />
          <line x1="44" y1="18" x2="44" y2="46" {...sharedProps} />
          <rect x="26" y="24" width="12" height="16" rx="2" {...sharedProps} />
          <line x1="26" y1="32" x2="38" y2="32" {...sharedProps} />
        </>
      ) : null}

      {id === 'cut-diamond' ? (
        <>
          <path d="M32 13L48 32L32 51L16 32Z" {...sharedProps} />
          <line x1="24" y1="24" x2="40" y2="40" {...sharedProps} />
          <line x1="40" y1="24" x2="24" y2="40" {...sharedProps} />
          <path d="M21 32H11" {...sharedProps} />
        </>
      ) : null}

      {id === 'nested-arc' ? (
        <>
          <path d="M16 32C16 21 22 15 32 15C42 15 48 21 48 32C48 43 42 49 32 49C22 49 16 43 16 32Z" {...sharedProps} />
          <path d="M22 32C22 25 26 21 32 21C38 21 42 25 42 32C42 39 38 43 32 43C26 43 22 39 22 32Z" {...sharedProps} />
          <line x1="19" y1="19" x2="45" y2="45" {...sharedProps} />
        </>
      ) : null}

      {id === 'ladder-rungs' ? (
        <>
          <line x1="22" y1="16" x2="22" y2="48" {...sharedProps} />
          <line x1="42" y1="16" x2="42" y2="48" {...sharedProps} />
          <line x1="22" y1="22" x2="42" y2="22" {...sharedProps} />
          <line x1="22" y1="32" x2="42" y2="32" {...sharedProps} />
          <line x1="22" y1="42" x2="42" y2="42" {...sharedProps} />
        </>
      ) : null}

      {id === 'triple-notch' ? (
        <>
          <path d="M18 18H46V46H18Z" {...sharedProps} />
          <path d="M18 24H28" {...sharedProps} />
          <path d="M18 32H34" {...sharedProps} />
          <path d="M18 40H28" {...sharedProps} />
          <path d="M38 24H46" {...sharedProps} />
          <path d="M34 32H46" {...sharedProps} />
          <path d="M38 40H46" {...sharedProps} />
        </>
      ) : null}

      {id === 'tally-seal' ? (
        <>
          <circle cx="32" cy="32" r="18" {...sharedProps} />
          <line x1="22" y1="22" x2="22" y2="42" {...sharedProps} />
          <line x1="30" y1="20" x2="30" y2="44" {...sharedProps} />
          <line x1="38" y1="22" x2="38" y2="42" {...sharedProps} />
          <line x1="20" y1="44" x2="42" y2="20" {...sharedProps} />
        </>
      ) : null}
    </svg>
  )
}
