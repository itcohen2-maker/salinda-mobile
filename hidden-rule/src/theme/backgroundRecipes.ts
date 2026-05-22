import {
  BACKGROUND_PRESETS,
  DEFAULT_BACKGROUND_PRESET_ID,
  type BackgroundPreset,
  type BackgroundPresetId,
} from './backgroundPresets'
import {
  INK_ARCHIVE_ART_DIRECTION,
  type ContrastLevel,
  type PresenceLevel,
  type ScreenTone,
  type ScreenToneId,
  type TextureDensity,
} from './artDirection'

type GradientStop = {
  color: string
  position: number
}

type SolidLayer = {
  kind: 'solid'
  color: string
}

type LinearGradientLayer = {
  kind: 'linear-gradient'
  angle: number
  stops: GradientStop[]
}

type RadialGradientLayer = {
  kind: 'radial-gradient'
  width: number
  height: number
  centerX: number
  centerY: number
  stops: GradientStop[]
}

type VignetteLayer = {
  kind: 'vignette'
  color: string
  opacity: number
  softness: number
}

type TextureLayer = {
  kind: 'texture'
  texture: 'paperDust' | 'archivalGrain'
  opacity: number
  blendMode: 'soft-light' | 'overlay'
}

export type BackgroundLayer =
  | SolidLayer
  | LinearGradientLayer
  | RadialGradientLayer
  | VignetteLayer
  | TextureLayer

export type ContentFrame = {
  top: number
  right: number
  bottom: number
  left: number
}

export type BackgroundRecipe = {
  id: string
  presetId: BackgroundPresetId
  screenToneId: ScreenToneId
  name: string
  description: string
  contrast: ContrastLevel
  brassPresence: PresenceLevel
  oxbloodPresence: PresenceLevel
  textureDensity: TextureDensity
  contentFrame: ContentFrame
  layers: BackgroundLayer[]
  notes: string[]
}

const SCREEN_CONTENT_FRAMES: Record<ScreenToneId, ContentFrame> = {
  gameplay: { top: 0.16, right: 0.11, bottom: 0.17, left: 0.11 },
  home: { top: 0.18, right: 0.12, bottom: 0.14, left: 0.12 },
  chapterIntro: { top: 0.2, right: 0.12, bottom: 0.14, left: 0.12 },
  rulesMeta: { top: 0.12, right: 0.08, bottom: 0.08, left: 0.08 },
}

function alpha(hex: string, opacity: number): string {
  const normalized = hex.replace('#', '')
  const source = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized

  const red = parseInt(source.slice(0, 2), 16)
  const green = parseInt(source.slice(2, 4), 16)
  const blue = parseInt(source.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`
}

function getTextureLayer(density: TextureDensity): TextureLayer | null {
  if (density === 'none') {
    return null
  }

  return {
    kind: 'texture',
    texture: 'paperDust',
    opacity: 0.05,
    blendMode: 'soft-light',
  }
}

function buildLayers(preset: BackgroundPreset, tone: ScreenTone): BackgroundLayer[] {
  const accent = preset.colors.accent ?? preset.colors.brass
  const layers: BackgroundLayer[] = [
    {
      kind: 'solid',
      color: preset.colors.bg,
    },
  ]

  if (tone.id === 'gameplay') {
    layers.push(
      {
        kind: 'radial-gradient',
        width: 0.88,
        height: 0.54,
        centerX: 0.5,
        centerY: 0.38,
        stops: [
          { color: alpha(preset.colors.ink, 0.42), position: 0 },
          { color: alpha(preset.colors.ink, 0.18), position: 0.42 },
          { color: alpha(preset.colors.ink, 0), position: 1 },
        ],
      },
      {
        kind: 'linear-gradient',
        angle: 180,
        stops: [
          { color: alpha(preset.colors.surface, 0.24), position: 0 },
          { color: alpha(preset.colors.bg, 0), position: 0.24 },
          { color: alpha(preset.colors.bg, 0.22), position: 1 },
        ],
      },
      {
        kind: 'vignette',
        color: '#07080B',
        opacity: 0.38,
        softness: 0.74,
      },
    )
  }

  if (tone.id === 'home') {
    layers.push(
      {
        kind: 'radial-gradient',
        width: 0.96,
        height: 0.72,
        centerX: 0.5,
        centerY: 0.3,
        stops: [
          { color: alpha(preset.colors.ink, 0.36), position: 0 },
          { color: alpha(preset.colors.surface, 0.16), position: 0.48 },
          { color: alpha(preset.colors.bg, 0), position: 1 },
        ],
      },
      {
        kind: 'radial-gradient',
        width: 0.92,
        height: 0.84,
        centerX: 0.5,
        centerY: 0.6,
        stops: [
          { color: alpha(preset.colors.brass, 0.08), position: 0 },
          { color: alpha(accent, 0.06), position: 0.56 },
          { color: alpha(preset.colors.bg, 0), position: 1 },
        ],
      },
      {
        kind: 'vignette',
        color: '#07080B',
        opacity: 0.34,
        softness: 0.78,
      },
    )
  }

  if (tone.id === 'chapterIntro') {
    layers.push(
      {
        kind: 'radial-gradient',
        width: 0.9,
        height: 0.66,
        centerX: 0.5,
        centerY: 0.44,
        stops: [
          { color: alpha(preset.colors.surface, 0.12), position: 0 },
          { color: alpha(preset.colors.bg, 0.18), position: 0.32 },
          { color: alpha(preset.colors.bg, 0.6), position: 1 },
        ],
      },
      {
        kind: 'radial-gradient',
        width: 0.78,
        height: 0.46,
        centerX: 0.5,
        centerY: 0.43,
        stops: [
          { color: alpha(accent, 0.16), position: 0 },
          { color: alpha(preset.colors.brass, 0.08), position: 0.4 },
          { color: alpha(preset.colors.bg, 0), position: 1 },
        ],
      },
      {
        kind: 'vignette',
        color: '#050608',
        opacity: 0.48,
        softness: 0.7,
      },
    )
  }

  if (tone.id === 'rulesMeta') {
    layers.push(
      {
        kind: 'linear-gradient',
        angle: 180,
        stops: [
          { color: preset.colors.surface, position: 0 },
          { color: preset.colors.bg, position: 1 },
        ],
      },
      {
        kind: 'radial-gradient',
        width: 1.2,
        height: 0.8,
        centerX: 0.5,
        centerY: 0,
        stops: [
          { color: alpha(preset.colors.ink, 0.12), position: 0 },
          { color: alpha(preset.colors.bg, 0), position: 1 },
        ],
      },
    )
  }

  const texture = getTextureLayer(tone.textureDensity)

  if (texture) {
    layers.push(texture)
  }

  return layers
}

export function buildBackgroundRecipe(
  presetId: BackgroundPresetId,
  screenToneId: ScreenToneId,
): BackgroundRecipe {
  const preset = BACKGROUND_PRESETS[presetId]
  const tone = INK_ARCHIVE_ART_DIRECTION.screenTones[screenToneId]

  return {
    id: `${presetId}-${screenToneId}`,
    presetId,
    screenToneId,
    name: `${preset.name} / ${tone.name}`,
    description: `${tone.purpose} Uses the ${preset.name} preset as the color source.`,
    contrast: tone.contrast,
    brassPresence: tone.brassPresence,
    oxbloodPresence: tone.oxbloodPresence,
    textureDensity: tone.textureDensity,
    contentFrame: SCREEN_CONTENT_FRAMES[screenToneId],
    layers: buildLayers(preset, tone),
    notes: [...preset.notes, ...tone.notes],
  }
}

export const DEFAULT_BACKGROUND_RECIPES: Record<ScreenToneId, BackgroundRecipe> = {
  gameplay: buildBackgroundRecipe(DEFAULT_BACKGROUND_PRESET_ID, 'gameplay'),
  home: buildBackgroundRecipe(DEFAULT_BACKGROUND_PRESET_ID, 'home'),
  chapterIntro: buildBackgroundRecipe(DEFAULT_BACKGROUND_PRESET_ID, 'chapterIntro'),
  rulesMeta: buildBackgroundRecipe(DEFAULT_BACKGROUND_PRESET_ID, 'rulesMeta'),
}
