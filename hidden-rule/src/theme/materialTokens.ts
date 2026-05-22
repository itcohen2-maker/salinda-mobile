export const FONT_STACKS = {
  serif: ['Frank Ruhl Libre', 'Cormorant Garamond', 'EB Garamond', 'David Libre', 'Georgia', 'serif'],
}

export const TYPE_SCALE = {
  eyebrow: {
    fontFamily: FONT_STACKS.serif,
    fontSize: 12,
    lineHeight: 1.2,
    letterSpacing: 0.28,
    fontWeight: 500,
  },
  label: {
    fontFamily: FONT_STACKS.serif,
    fontSize: 16,
    lineHeight: 1.22,
    letterSpacing: 0.01,
    fontWeight: 500,
  },
  body: {
    fontFamily: FONT_STACKS.serif,
    fontSize: 17,
    lineHeight: 1.45,
    letterSpacing: 0,
    fontWeight: 400,
  },
  title: {
    fontFamily: FONT_STACKS.serif,
    fontSize: 28,
    lineHeight: 1.14,
    letterSpacing: 0,
    fontWeight: 500,
  },
  display: {
    fontFamily: FONT_STACKS.serif,
    fontSize: 34,
    lineHeight: 1.1,
    letterSpacing: 0,
    fontWeight: 500,
  },
} as const

export const TEXT_COLORS = {
  primary: '#EDE4D3',
  secondary: '#CFC6B8',
  subdued: 'rgba(237, 228, 211, 0.64)',
  disabled: 'rgba(237, 228, 211, 0.3)',
} as const

export const SURFACE_TOKENS = {
  background: '#14161B',
  surface: '#1C2128',
  raised: '#232A33',
  ink: '#2F3A4A',
  matteOverlay: 'rgba(11, 13, 17, 0.36)',
  readingField: 'rgba(28, 33, 40, 0.9)',
} as const

export const BRASS_TOKENS = {
  soft: '#A88A58',
  dark: '#7B6541',
  glow: 'rgba(168, 138, 88, 0.22)',
  hairline: 'rgba(237, 228, 211, 0.22)',
} as const

export const ACCENT_TOKENS = {
  oxblood: '#6A3434',
  mutedGreenGray: '#5F6B63',
} as const

export const RADIUS_TOKENS = {
  panel: 12,
  card: 14,
  frame: 18,
  phoneShell: 30,
} as const

export const SHADOW_TOKENS = {
  panel: '0 10px 24px rgba(6, 8, 12, 0.28)',
  cardStage: '0 18px 48px rgba(6, 8, 12, 0.34)',
  focusRing: '0 0 0 2px #0C0E14, 0 0 0 4px #6A3434',
} as const

export const TEXTURE_TOKENS = {
  paperDust: {
    opacity: 0.05,
    blendMode: 'soft-light',
  },
  archivalGrain: {
    opacity: 0.08,
    blendMode: 'overlay',
  },
} as const

export const MOTION_TOKENS = {
  pressDurationMs: 120,
  revealDurationMs: 220,
  ease: 'cubic-bezier(.4,.2,.2,1)',
} as const
