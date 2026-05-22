import * as React from 'react'

import type { IconGlyphId } from './iconButtonTokens'

type IconGlyphProps = {
  icon: IconGlyphId
}

export function IconGlyph({ icon }: IconGlyphProps) {
  if (icon === 'back') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.5 5.5L8 12l6.5 6.5" />
        <path d="M9 12h7" />
      </svg>
    )
  }

  if (icon === 'rules') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7.5 6.5h9" />
        <path d="M7.5 11.5h9" />
        <path d="M7.5 16.5h6.5" />
      </svg>
    )
  }

  if (icon === 'search') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="M15 15l4 4" />
      </svg>
    )
  }

  if (icon === 'close') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7l10 10" />
        <path d="M17 7L7 17" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 6v7" />
      <circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
      <path d="M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 0 1 0-17Z" />
    </svg>
  )
}
