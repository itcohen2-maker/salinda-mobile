import * as React from 'react'

import { FONT_STACKS } from '../../theme'

const serifFontFamily = FONT_STACKS.serif
  .map((font) => (font.includes(' ') ? `"${font}"` : font))
  .join(', ')

export type StageCard = {
  accent?: string
  dx: number
  face?: 'ivory' | 'ink'
  glyph: string
  highlight?: boolean
  rotate: number
}

type CardStageProps = {
  cards: StageCard[]
  caption?: string
}

export function CardStage({ cards, caption }: CardStageProps) {
  return (
    <div
      style={{
        position: 'relative',
        minHeight: 220,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 0 8px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '18px 12px 12px',
          borderRadius: 22,
          background: 'radial-gradient(70% 58% at 50% 46%, rgba(47, 58, 74, 0.34) 0%, rgba(20, 22, 27, 0) 100%)',
          opacity: 0.9,
        }}
      />

      {cards.map((card, index) => {
        const face = card.face ?? (card.highlight ? 'ivory' : 'ink')
        const accent = card.accent ?? (card.highlight ? '#6A3434' : '#D6B36C')

        return (
          <div
            key={`${card.glyph}-${index}`}
            style={{
              position: 'absolute',
              width: 86,
              height: 120,
              transform: `translateX(${card.dx}px) rotate(${card.rotate}deg)`,
              borderRadius: 10,
              background: face === 'ivory'
                ? 'linear-gradient(180deg, #ECE4D0 0%, #D8CDB0 100%)'
                : 'linear-gradient(180deg, #1A2438 0%, #0E1525 100%)',
              boxShadow: face === 'ivory'
                ? '0 0 0 1px #8C6B2C, 0 10px 22px rgba(0, 0, 0, 0.55)'
                : '0 0 0 1px #3A2D14, 0 8px 18px rgba(0, 0, 0, 0.48)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: serifFontFamily,
              fontSize: 34,
              color: accent,
            }}
          >
            {card.glyph}
          </div>
        )
      })}

      {caption ? (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: serifFontFamily,
            fontSize: 13,
            fontStyle: 'italic',
            lineHeight: 1.45,
            color: 'rgba(236, 228, 208, 0.62)',
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  )
}
