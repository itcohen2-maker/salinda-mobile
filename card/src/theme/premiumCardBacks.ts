// Premium card backs — image-based card reverse designs sold via the unified
// cosmetics catalog (public.cosmetics, migration 029). 'classic' = the built-in
// default card back (no premium image). cosmeticId matches the catalog seed.

import type { LeagueId } from './leagues';

export type PremiumCardBackId = 'classic' | 'cardback_common' | 'cardback_rare' | 'cardback_epic';

export interface PremiumCardBack {
  id: PremiumCardBackId;
  cosmeticId: string | null;
  name_he: string;
  name_en: string;
  price: number;
  /** Minimum league required to purchase (bronze = no gate). */
  requiredLeague: LeagueId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  image: any | null;
}

export const PREMIUM_CARD_BACKS: Record<PremiumCardBackId, PremiumCardBack> = {
  classic: { id: 'classic', cosmeticId: null, name_he: 'קלאסי', name_en: 'Classic', price: 0, requiredLeague: 'bronze', image: null },
  cardback_common: {
    id: 'cardback_common', cosmeticId: 'cardback_common', name_he: 'נפוץ', name_en: 'Common', price: 150, requiredLeague: 'bronze',
    image: require('../../assets/premium/cardbacks/cardback-common.png'),
  },
  cardback_rare: {
    id: 'cardback_rare', cosmeticId: 'cardback_rare', name_he: 'נדיר', name_en: 'Rare', price: 300, requiredLeague: 'gold',
    image: require('../../assets/premium/cardbacks/cardback-rare.png'),
  },
  cardback_epic: {
    id: 'cardback_epic', cosmeticId: 'cardback_epic', name_he: 'אפי', name_en: 'Epic', price: 500, requiredLeague: 'champion',
    image: require('../../assets/premium/cardbacks/cardback-epic.png'),
  },
};

export const PREMIUM_CARD_BACK_IDS = Object.keys(PREMIUM_CARD_BACKS) as PremiumCardBackId[];

export function resolvePremiumCardBackId(value: string | null | undefined): PremiumCardBackId {
  if (value && (PREMIUM_CARD_BACKS as Record<string, PremiumCardBack>)[value]) return value as PremiumCardBackId;
  return 'classic';
}
