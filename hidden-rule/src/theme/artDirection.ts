export type ScreenToneId = 'gameplay' | 'home' | 'chapterIntro' | 'rulesMeta'

export type ContrastLevel = 'quiet' | 'medium' | 'dramatic'
export type PresenceLevel = 'none' | 'low' | 'medium'
export type TextureDensity = 'none' | 'light'

export type ScreenTone = {
  id: ScreenToneId
  name: string
  purpose: string
  contrast: ContrastLevel
  brassPresence: PresenceLevel
  oxbloodPresence: PresenceLevel
  textureDensity: TextureDensity
  notes: string[]
}

export type ArtDirection = {
  workingName: string
  mood: string[]
  visualRules: string[]
  buttonHierarchy: string[]
  motionDirection: string[]
  avoid: string[]
  screenTones: Record<ScreenToneId, ScreenTone>
}

export const INK_ARCHIVE_ART_DIRECTION: ArtDirection = {
  workingName: 'Ink Archive',
  mood: ['calm', 'intelligent', 'deliberate', 'slightly secretive', 'tactile', 'editorial'],
  visualRules: [
    'Cards remain the hero element in every gameplay composition.',
    'Color appears on meaning and hierarchy, not as a constant decorative layer.',
    'Brass stays reserved for confirmation, focus, and structural emphasis.',
    'Surfaces should feel matte, quiet, and archival rather than glossy.',
    'Ornament is sparse and structural.',
    'Negative space is part of the style, not leftover space.',
  ],
  buttonHierarchy: [
    'Primary uses a brass-framed plaque treatment.',
    'Secondary uses an inscribed dark panel with an ivory hairline.',
    'Premium is ceremonial and must stay rare.',
  ],
  motionDirection: [
    'Idle states are mostly still.',
    'Press states feel tactile instead of bouncy.',
    'Reveals should feel deliberate and editorial.',
    'No sparkle loops or noisy ambient animation.',
  ],
  avoid: [
    'Casino green felt as a dominant surface.',
    'High-gloss pill buttons.',
    'Neon edges and purple fantasy haze.',
    'Noisy textures or cluttered props.',
    'Crowded HUD framing around the card stage.',
  ],
  screenTones: {
    gameplay: {
      id: 'gameplay',
      name: 'Gameplay Background',
      purpose: 'Keep the card stage legible and central.',
      contrast: 'medium',
      brassPresence: 'low',
      oxbloodPresence: 'none',
      textureDensity: 'light',
      notes: [
        'Use a deep charcoal base.',
        'Add an ink-blue lift behind the card stage, not a glow.',
        'Edge vignette can exist, but it should stay soft.',
      ],
    },
    home: {
      id: 'home',
      name: 'Home Background',
      purpose: 'Create a ceremonial stage for logo and primary CTA.',
      contrast: 'medium',
      brassPresence: 'medium',
      oxbloodPresence: 'low',
      textureDensity: 'light',
      notes: [
        'This screen can be slightly more atmospheric than gameplay.',
        'Negative space should remain open for title and CTA.',
      ],
    },
    chapterIntro: {
      id: 'chapterIntro',
      name: 'Chapter Intro Background',
      purpose: 'Frame a premium chapter title and a ceremonial action.',
      contrast: 'dramatic',
      brassPresence: 'medium',
      oxbloodPresence: 'medium',
      textureDensity: 'light',
      notes: [
        'Use darker staging with controlled falloff.',
        'Oxblood can appear as undertone, never as the main fill.',
      ],
    },
    rulesMeta: {
      id: 'rulesMeta',
      name: 'Rules Or Meta Background',
      purpose: 'Prioritize reading clarity and a calmer surface.',
      contrast: 'quiet',
      brassPresence: 'low',
      oxbloodPresence: 'none',
      textureDensity: 'none',
      notes: [
        'Keep contrast flatter and typography-first.',
        'This screen should feel quieter than gameplay.',
      ],
    },
  },
}

export const DEFAULT_SCREEN_TONE_ID: ScreenToneId = 'gameplay'
