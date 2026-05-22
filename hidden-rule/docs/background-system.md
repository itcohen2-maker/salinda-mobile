# Hidden Rule Background System

This file turns the art-direction notes into implementation guidance.

## Source of Truth

- `src/theme/backgroundPresets.ts`
  Holds the palette presets, including `Ink Archive` as the default.
- `src/theme/artDirection.ts`
  Holds the mood, screen-tone intent, and visual rules.
- `src/theme/materialTokens.ts`
  Holds shared typography, text, brass, surface, texture, and motion tokens.
- `src/theme/backgroundRecipes.ts`
  Builds reusable background recipes for gameplay, home, chapter intro, and rules/meta screens.

## Default Working Direction

Use `Ink Archive` as the base look.

This means:

- charcoal first
- ink-blue lift behind important content
- restrained brass
- oxblood only as an undertone
- texture that reads as paper dust, not as a visible pattern

## Screen Roles

### Gameplay

Keep the center open for cards.
The radial lift should support the play area without looking like a glow effect.

### Home

Allow slightly more ceremony for the logo and main CTA.
The stage can feel richer than gameplay, but it still needs negative space.

### Chapter Intro

This is the most dramatic screen role.
Use deeper falloff and a little more oxblood/brass tension, while keeping the scene clean.

### Rules / Meta

Flatten the surface.
Reading clarity matters more than atmosphere here.

## Asset Guidance

When exporting bitmap layers or textures into `assets/backgrounds`, keep the naming aligned to the recipes:

- `gameplay-ink-archive`
- `home-ink-archive`
- `chapter-intro-ink-archive`
- `rules-meta-ink-archive`

If texture is required, keep it separate from the base color field so it can be tuned independently.

## Implementation Rule

Build screens from recipe layers first.
Only add decorative assets if the screen still feels too empty after the recipe is applied.
