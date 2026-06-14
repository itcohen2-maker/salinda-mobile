// League badges — EARNED by rating, not purchased. Five tiers, Bronze → Champion.
// Thresholds are sensible defaults (no spec was provided); adjust when the league
// design lands. D2 (no retroactive punishment): a badge once reached is shown by
// the player's CURRENT rating; demotion logic, if any, is computed server-side
// against server UTC time (D3) — never client clocks.

export type LeagueId = 'bronze' | 'silver' | 'gold' | 'diamond' | 'champion';

export interface League {
  id: LeagueId;
  name_he: string;
  name_en: string;
  /** Inclusive minimum rating to be in this league. */
  minRating: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  badge: any;
}

// Ordered low → high.
export const LEAGUES: League[] = [
  { id: 'bronze',   name_he: 'ארד',     name_en: 'Bronze',   minRating: 0,    badge: require('../../assets/premium/badges/badge-1-bronze.png') },
  { id: 'silver',   name_he: 'כסף',     name_en: 'Silver',   minRating: 1100, badge: require('../../assets/premium/badges/badge-2-silver.png') },
  { id: 'gold',     name_he: 'זהב',     name_en: 'Gold',     minRating: 1300, badge: require('../../assets/premium/badges/badge-3-gold.png') },
  { id: 'diamond',  name_he: 'יהלום',   name_en: 'Diamond',  minRating: 1500, badge: require('../../assets/premium/badges/badge-4-diamond.png') },
  { id: 'champion', name_he: 'אלוף',    name_en: 'Champion', minRating: 1700, badge: require('../../assets/premium/badges/badge-5-champion.png') },
];

/** The league for a given rating (highest tier whose minRating is met). */
export function leagueForRating(rating: number | null | undefined): League {
  const r = Number.isFinite(Number(rating)) ? Number(rating) : 0;
  let current = LEAGUES[0];
  for (const l of LEAGUES) if (r >= l.minRating) current = l;
  return current;
}

/** 0-based tier index (bronze=0 … champion=4). Unknown ids → 0 (bronze). */
export function leagueRank(id: LeagueId | null | undefined): number {
  const i = LEAGUES.findIndex((l) => l.id === id);
  return i < 0 ? 0 : i;
}

/** True if the player's rating qualifies for an item that requires `required`. */
export function meetsLeague(rating: number | null | undefined, required: LeagueId | null | undefined): boolean {
  if (!required || required === 'bronze') return true;
  return leagueRank(leagueForRating(rating).id) >= leagueRank(required);
}
