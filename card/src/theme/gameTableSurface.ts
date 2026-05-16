import type { TableSurfacePresentation } from './tableSkins';

type ActiveTableSkinLike = {
  image?: unknown;
  surfacePresentation?: TableSurfacePresentation;
} | null | undefined;

export type ResolvedGameTableSurface = {
  source: unknown;
  presentation: TableSurfacePresentation;
  resizeMode: 'cover' | 'contain' | 'stretch';
};

export function resolveGameTableSurface(
  activeTableSkin: ActiveTableSkinLike,
  fallbackTableImage: unknown,
  options: { fallbackPresentation?: TableSurfacePresentation; platform?: string } = {},
): ResolvedGameTableSurface {
  void options;
  const source = activeTableSkin?.image ?? fallbackTableImage;
  const presentation = activeTableSkin?.surfacePresentation ?? options.fallbackPresentation ?? 'fill';
  const resizeMode = presentation === 'framed' ? 'contain' : 'stretch';

  return {
    source,
    presentation,
    resizeMode,
  };
}
