import type { BackgroundLayer, BackgroundRecipe } from '../theme'

function serializeStops(stops: { color: string; position: number }[]): string {
  return stops.map((stop) => `${stop.color} ${Math.round(stop.position * 100)}%`).join(', ')
}

function serializeLayer(layer: BackgroundLayer): string {
  if (layer.kind === 'solid') {
    return `linear-gradient(180deg, ${layer.color} 0%, ${layer.color} 100%)`
  }

  if (layer.kind === 'linear-gradient') {
    return `linear-gradient(${layer.angle}deg, ${serializeStops(layer.stops)})`
  }

  if (layer.kind === 'radial-gradient') {
    return `radial-gradient(${Math.round(layer.width * 100)}% ${Math.round(layer.height * 100)}% at ${Math.round(layer.centerX * 100)}% ${Math.round(layer.centerY * 100)}%, ${serializeStops(layer.stops)})`
  }

  if (layer.kind === 'vignette') {
    const innerOpacity = Math.max(0, layer.opacity * (1 - layer.softness))
    return `radial-gradient(120% 120% at 50% 50%, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, ${innerOpacity.toFixed(2)}) ${Math.round(layer.softness * 100)}%, ${layer.color} 100%)`
  }

  if (layer.texture === 'archivalGrain') {
    return `radial-gradient(140% 120% at 18% 18%, rgba(255, 255, 255, ${layer.opacity}) 0%, rgba(255, 255, 255, 0) 34%), radial-gradient(150% 130% at 82% 12%, rgba(255, 255, 255, ${Math.max(0, layer.opacity - 0.02)}) 0%, rgba(255, 255, 255, 0) 36%)`
  }

  return `radial-gradient(130% 115% at 18% 20%, rgba(255, 255, 255, ${layer.opacity}) 0%, rgba(255, 255, 255, 0) 26%), radial-gradient(150% 130% at 82% 12%, rgba(255, 255, 255, ${Math.max(0, layer.opacity - 0.02)}) 0%, rgba(255, 255, 255, 0) 32%), radial-gradient(135% 118% at 44% 88%, rgba(255, 255, 255, ${Math.max(0, layer.opacity - 0.03)}) 0%, rgba(255, 255, 255, 0) 30%)`
}

export function createBackgroundImage(recipe: BackgroundRecipe): string {
  return [...recipe.layers].reverse().map(serializeLayer).join(', ')
}

export function createBackgroundStyle(recipe: BackgroundRecipe): Record<string, string> {
  const baseLayer = recipe.layers.find((layer) => layer.kind === 'solid')

  return {
    backgroundColor: baseLayer && baseLayer.kind === 'solid' ? baseLayer.color : '#14161B',
    backgroundImage: createBackgroundImage(recipe),
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
  }
}

export function scaleContentFrame(
  recipe: BackgroundRecipe,
  width = 360,
  height = 720,
): { top: number; right: number; bottom: number; left: number } {
  return {
    top: Math.round(recipe.contentFrame.top * height),
    right: Math.round(recipe.contentFrame.right * width),
    bottom: Math.round(recipe.contentFrame.bottom * height),
    left: Math.round(recipe.contentFrame.left * width),
  }
}
