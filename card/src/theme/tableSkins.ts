export type TableSkinId =
  | 'poker_red'
  | 'poker_gold'
  | 'poker_blue'
  | 'table_executive'
  | 'table_cyber_grid'
  | 'table_cosmic';
export type TableSurfacePresentation = 'fill' | 'framed';

import type { LeagueId } from './leagues';

export interface TableSkin {
  id: TableSkinId;
  name_he: string;
  name_en: string;
  price: number;
  /** Minimum league required to purchase (bronze = no gate). */
  requiredLeague: LeagueId;
  surfacePresentation: TableSurfacePresentation;
  // PNG with transparent background — golden poker table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  image: any;
}

export const TABLE_SKINS: Record<TableSkinId, TableSkin> = {
  poker_red: {
    id: 'poker_red',
    name_he: 'שולחן אדום',
    name_en: 'Red Table',
    price: 20,
    requiredLeague: 'bronze',
    surfacePresentation: 'framed',
    image: require('../../assets/table_royal_nobg.png'),
  },
  poker_gold: {
    id: 'poker_gold',
    name_he: 'שולחן זהב',
    name_en: 'Gold Table',
    price: 20,
    requiredLeague: 'bronze',
    surfacePresentation: 'framed',
    image: require('../../assets/table_golden_nobg.png'),
  },
  poker_blue: {
    id: 'poker_blue',
    name_he: 'שולחן כחול',
    name_en: 'Blue Table',
    price: 20,
    requiredLeague: 'bronze',
    surfacePresentation: 'framed',
    image: require('../../assets/table_ocean_nobg.png'),
  },
  table_executive: {
    id: 'table_executive',
    name_he: 'מנהלים',
    name_en: 'Executive',
    price: 400,
    requiredLeague: 'silver',
    surfacePresentation: 'framed',
    image: require('../../assets/premium/tables/table-executive.png'),
  },
  table_cyber_grid: {
    id: 'table_cyber_grid',
    name_he: 'סייבר-גריד',
    name_en: 'Cyber-Grid',
    price: 450,
    requiredLeague: 'gold',
    surfacePresentation: 'framed',
    image: require('../../assets/premium/tables/table-cyber-grid.png'),
  },
  table_cosmic: {
    id: 'table_cosmic',
    name_he: 'קוסמי',
    name_en: 'Cosmic',
    price: 600,
    requiredLeague: 'diamond',
    surfacePresentation: 'framed',
    image: require('../../assets/premium/tables/table-cosmic.png'),
  },
};

export const TABLE_SKIN_IDS: TableSkinId[] = [
  'poker_red', 'poker_gold', 'poker_blue',
  'table_executive', 'table_cyber_grid', 'table_cosmic',
];
export const DEFAULT_TABLE_SKIN_ID: TableSkinId = 'poker_red';

const LEGACY_TABLE_SKIN_ALIASES: Record<string, TableSkinId> = {
  classic_green: 'poker_red',
  green: 'poker_red',
};

export function resolveTableSkinId(value: string | null | undefined): TableSkinId | null {
  if (!value) return null;
  if (TABLE_SKIN_IDS.includes(value as TableSkinId)) return value as TableSkinId;
  return LEGACY_TABLE_SKIN_ALIASES[value] ?? null;
}
