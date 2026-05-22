import { ACCENT_TOKENS, BRASS_TOKENS, SURFACE_TOKENS } from '../../theme'
import type { SelectableState } from './controlStates'

export type IconGlyphId = 'back' | 'hint' | 'rules' | 'close' | 'search'
export type IconButtonSize = 'compact' | 'default' | 'large'

export const ICON_BUTTON_SIZES: Record<IconButtonSize, { box: number; radius: number; glyph: number }> = {
  compact: { box: 40, radius: 11, glyph: 16 },
  default: { box: 48, radius: 13, glyph: 18 },
  large: { box: 56, radius: 15, glyph: 20 },
}

export const ICON_BUTTON_TOKENS = {
  faceTop: '#232631',
  faceBottom: '#15171F',
  edge: 'rgba(236, 228, 208, 0.22)',
  edgeHover: 'rgba(236, 228, 208, 0.34)',
  selectedTop: SURFACE_TOKENS.ink,
  selectedBottom: '#131A2A',
  glyph: BRASS_TOKENS.soft,
  glyphSelected: '#D6B36C',
  focusRing: ACCENT_TOKENS.oxblood,
  shadow: '0 1px 2px rgba(0, 0, 0, 0.38)',
} as const

export const ICON_BUTTON_STATE_NOTES: Record<SelectableState, string> = {
  idle: 'Default utility control. Matte face with restrained brass glyph.',
  pressed: 'Press deepens the face rather than adding bounce or glow.',
  focused: 'Accessibility ring uses the same oxblood family as the buttons.',
  selected: 'Selected state borrows the ink-blue selection logic from Secondary.',
  disabled: 'Disabled state removes hierarchy and keeps the glyph subdued.',
}

export const ICON_GLYPH_LABELS: Record<IconGlyphId, string> = {
  back: 'Back',
  hint: 'Hint',
  rules: 'Rules',
  close: 'Close',
  search: 'Search',
}
