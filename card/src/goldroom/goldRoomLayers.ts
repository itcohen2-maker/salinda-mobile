// ============================================================
// goldRoomLayers.ts — Migrated legacy tutorial layers 35–44.
//
// Layers 35–44 of the legacy watch-and-mimic tutorial ARE lesson-05
// ("op-cycle" — operation signs + the Salinda card). The legacy layer
// number is computed as (cumulative lesson steps × 4) + phase offset, so
// lesson-05 occupies layers 33–44:
//   • 35–36  place-op     — build `4 ? 3 = 7` by placing a SIGN card.
//   • 37–40  joker-place   — the SAME puzzle, solved with the SALINDA card.
//   • 41–44  important-tip  — acknowledgement only (folded into success).
//
// The exercise is rigged by the legacy host as dice 4,3,9 with operands
// 4 and 3 pre-filled and target 7 (InteractiveTutorialScreen → l5DiceRef
// `{ d1: 4, d2: 3, d3: 9 }`). We extract that content here as plain data
// so the onboarding lessons stay untouched, and render it through the
// Gold Room's single-track GoldEquationTrack (dark-gold, no timer, no
// green buttons).
// ============================================================

export type GoldLayerCard = 'sign' | 'salinda';

export interface GoldLayer {
  /** Stable id — mirrors the legacy lesson-05 step id. */
  id: string;
  /** Source layer range in the legacy tutorial, for traceability. */
  legacyLayers: readonly [number, number];
  /** Which special card this layer teaches. */
  card: GoldLayerCard;
  /** Round heading. */
  caption: string;
  /** Optional active-card chip. */
  chip?: string;
  /** The rigged exercise: the equation must reach exactly `target`. */
  target: number;
}

/** The landed dice for the layers-35–44 exercise (`4 ? 3 = 7`). */
export const GOLD_LAYER_SOURCES: number[] = [4, 3, 9];

/** The migrated, in-order gameplay layers (35–44). */
export const GOLD_LAYERS: readonly GoldLayer[] = [
  {
    id: 'place-op',
    legacyLayers: [35, 36],
    card: 'sign',
    caption: 'Build an equation that reaches the target',
    target: 7,
  },
  {
    id: 'joker-place',
    legacyLayers: [37, 40],
    card: 'salinda',
    caption: "Salinda Card's turn",
    chip: '👑 Salinda Card Active',
    target: 7,
  },
];
