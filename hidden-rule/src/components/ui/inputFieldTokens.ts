import { ACCENT_TOKENS, BRASS_TOKENS, FONT_STACKS, SURFACE_TOKENS, TEXT_COLORS } from '../../theme'
import type { InputFieldState } from './controlStates'

export const INPUT_FIELD_TOKENS = {
  minHeight: 56,
  radius: 14,
  paddingX: 14,
  paddingTop: 11,
  paddingBottom: 12,
  eyebrowGap: 8,
  fieldGap: 10,
  faceTop: '#232730',
  faceBottom: '#161A21',
  edge: 'rgba(236, 228, 208, 0.20)',
  edgeHover: 'rgba(236, 228, 208, 0.30)',
  text: TEXT_COLORS.primary,
  softText: 'rgba(207, 198, 184, 0.54)',
  placeholder: 'rgba(207, 198, 184, 0.42)',
  label: BRASS_TOKENS.soft,
  invalid: ACCENT_TOKENS.oxblood,
  readingSurface: SURFACE_TOKENS.surface,
  fontFamily: FONT_STACKS.serif,
} as const

export const INPUT_FIELD_COPY_NOTES: Record<InputFieldState, string> = {
  idle: 'Use for first entry or optional search input.',
  focused: 'Focus must read as deliberate, never electric.',
  filled: 'A filled field should feel like a quiet editorial note.',
  invalid: 'Validation can use oxblood, but only as a precise correction signal.',
  disabled: 'Disabled state should flatten hierarchy without turning glossy gray.',
}
