export type BackgroundPresetId =
  | 'inkArchive'
  | 'coldEditorialOccult'
  | 'brassInstrument'
  | 'oxbloodChamber'

export type BackgroundPreset = {
  id: BackgroundPresetId
  name: string
  mood: string
  colors: {
    bg: string
    surface: string
    raised: string
    ink: string
    text: string
    brass: string
    accent?: string
  }
  notes: string[]
}

export const BACKGROUND_PRESETS: Record<BackgroundPresetId, BackgroundPreset> = {
  inkArchive: {
    id: 'inkArchive',
    name: 'Ink Archive',
    mood: 'Calm, scholarly, tactile, premium.',
    colors: {
      bg: '#14161B',
      surface: '#1C2128',
      raised: '#232A33',
      ink: '#2F3A4A',
      text: '#EDE4D3',
      brass: '#A88A58',
      accent: '#6A3434',
    },
    notes: [
      'Default recommendation for gameplay.',
      'Use ink-blue lift behind the play area, not bright glow.',
      'Keep texture extremely restrained.',
    ],
  },
  coldEditorialOccult: {
    id: 'coldEditorialOccult',
    name: 'Cold Editorial Occult',
    mood: 'Sharper, cleaner, more typographic.',
    colors: {
      bg: '#111318',
      surface: '#1B2027',
      raised: '#252C36',
      ink: '#38475B',
      text: '#F0E8DA',
      brass: '#9B8356',
      accent: '#5A6068',
    },
    notes: [
      'Best for a bolder and more modern tone.',
      'More negative space, less atmosphere.',
    ],
  },
  brassInstrument: {
    id: 'brassInstrument',
    name: 'Brass Instrument',
    mood: 'Mechanical, ritualized, antique precision.',
    colors: {
      bg: '#151413',
      surface: '#211D1A',
      raised: '#2A2420',
      ink: '#2C3543',
      text: '#ECE1D0',
      brass: '#B08A4C',
      accent: '#68492C',
    },
    notes: [
      'Useful if the UI should feel like a device, not a document.',
      'Keep linework structured and sparse.',
    ],
  },
  oxbloodChamber: {
    id: 'oxbloodChamber',
    name: 'Oxblood Chamber',
    mood: 'Darker and more theatrical.',
    colors: {
      bg: '#171214',
      surface: '#24191D',
      raised: '#2F2025',
      ink: '#2D3442',
      text: '#EDE4D3',
      brass: '#A5854F',
      accent: '#6A3434',
    },
    notes: [
      'Use sparingly for chapter intros or high-drama moments.',
      'Avoid making this the default gameplay look.',
    ],
  },
}

export const DEFAULT_BACKGROUND_PRESET_ID: BackgroundPresetId = 'inkArchive'
