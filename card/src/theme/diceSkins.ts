// Dice skins — premium cosmetic faces for the gold dice.
//
// 'classic' is the free, built-in procedural gold die (rendered by GoldDieFace
// with no image). Premium skins supply 6 face images, indexed by die value 1..6.
// Asset filenames are mapped EXACTLY as delivered in the premium-assets package:
//   premium-assets/Dice/Solid Gold/die-solid-gold-{1..6}.png

import type { LeagueId } from './leagues';

export type DiceSkinId = 'classic' | 'dice_solid_gold' | 'dice_neon_matrix' | 'dice_ancient_stone';

export interface DiceSkin {
  id: DiceSkinId;
  /** Catalog id in public.cosmetics (matches migration 029 seed); null for the free default. */
  cosmeticId: string | null;
  name_he: string;
  name_en: string;
  price: number;
  /** Minimum league required to purchase (bronze = no gate). */
  requiredLeague: LeagueId;
  /** 6 face images indexed by value-1, or null for the procedural classic die. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  faces: any[] | null;
}

export const DICE_SKINS: Record<DiceSkinId, DiceSkin> = {
  classic: {
    id: 'classic',
    cosmeticId: null,
    name_he: 'זהב קלאסי',
    name_en: 'Classic Gold',
    price: 0,
    requiredLeague: 'bronze',
    faces: null,
  },
  dice_solid_gold: {
    id: 'dice_solid_gold',
    cosmeticId: 'dice_solid_gold',
    name_he: 'זהב מלא',
    name_en: 'Solid Gold',
    price: 300,
    requiredLeague: 'bronze',
    faces: [
      require('../../assets/premium/dice/solid-gold/die-solid-gold-1.png'),
      require('../../assets/premium/dice/solid-gold/die-solid-gold-2.png'),
      require('../../assets/premium/dice/solid-gold/die-solid-gold-3.png'),
      require('../../assets/premium/dice/solid-gold/die-solid-gold-4.png'),
      require('../../assets/premium/dice/solid-gold/die-solid-gold-5.png'),
      require('../../assets/premium/dice/solid-gold/die-solid-gold-6.png'),
    ],
  },
  dice_neon_matrix: {
    id: 'dice_neon_matrix',
    cosmeticId: 'dice_neon_matrix',
    name_he: 'ניאון מטריקס',
    name_en: 'Neon Matrix',
    price: 400,
    requiredLeague: 'gold',
    faces: [
      require('../../assets/premium/dice/neon-matrix/die-neon-matrix-1.png'),
      require('../../assets/premium/dice/neon-matrix/die-neon-matrix-2.png'),
      require('../../assets/premium/dice/neon-matrix/die-neon-matrix-3.png'),
      require('../../assets/premium/dice/neon-matrix/die-neon-matrix-4.png'),
      require('../../assets/premium/dice/neon-matrix/die-neon-matrix-5.png'),
      require('../../assets/premium/dice/neon-matrix/die-neon-matrix-6.png'),
    ],
  },
  dice_ancient_stone: {
    id: 'dice_ancient_stone',
    cosmeticId: 'dice_ancient_stone',
    name_he: 'אבן עתיקה',
    name_en: 'Ancient Stone',
    price: 350,
    requiredLeague: 'silver',
    faces: [
      require('../../assets/premium/dice/ancient-stone/die-ancient-stone-1.png'),
      require('../../assets/premium/dice/ancient-stone/die-ancient-stone-2.png'),
      require('../../assets/premium/dice/ancient-stone/die-ancient-stone-3.png'),
      require('../../assets/premium/dice/ancient-stone/die-ancient-stone-4.png'),
      require('../../assets/premium/dice/ancient-stone/die-ancient-stone-5.png'),
      require('../../assets/premium/dice/ancient-stone/die-ancient-stone-6.png'),
    ],
  },
};

export const DICE_SKIN_IDS = Object.keys(DICE_SKINS) as DiceSkinId[];

/** Resolve a stored id (may be null/legacy/unknown) to a valid skin id. */
export function resolveDiceSkinId(value: string | null | undefined): DiceSkinId {
  if (value && (DICE_SKINS as Record<string, DiceSkin>)[value]) return value as DiceSkinId;
  return 'classic';
}

/** The 6 face images for a skin, or null for the procedural classic die. */
export function diceSkinFaces(value: string | null | undefined): DiceSkin['faces'] {
  return DICE_SKINS[resolveDiceSkinId(value)].faces;
}
