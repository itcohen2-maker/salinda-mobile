import type {
  ClassroomBandConfig,
  ClassroomBotDifficulty,
  ClassroomDifficultyStage,
  ClassroomFraction,
  ClassroomLaunchConfig,
  ClassroomLiveSettings,
  DifficultyBand,
} from './classroomTypes';

const RANGE_12_FRACTIONS: ClassroomFraction[] = ['1/2', '1/3'];
const RANGE_25_FRACTIONS: ClassroomFraction[] = ['1/2', '1/3', '1/4', '1/5'];

export const CLASSROOM_BAND_CONFIG: Record<DifficultyBand, ClassroomBandConfig> = {
  support: {
    difficultyBand: 'support',
    stageIds: ['A', 'B'],
    rangeMax: 12,
    enabledOperators: ['+', '-'],
    allowFractions: true,
    teacherLabel: 'Support',
  },
  core: {
    difficultyBand: 'core',
    stageIds: ['C', 'D'],
    rangeMax: 25,
    enabledOperators: ['+', '-'],
    allowFractions: true,
    teacherLabel: 'Core',
  },
  bridge: {
    difficultyBand: 'bridge',
    stageIds: ['E', 'F'],
    rangeMax: 12,
    enabledOperators: ['x', '÷'],
    allowFractions: true,
    teacherLabel: 'Bridge',
  },
  challenge: {
    difficultyBand: 'challenge',
    stageIds: ['G', 'H'],
    rangeMax: 25,
    enabledOperators: ['x', '÷'],
    allowFractions: true,
    teacherLabel: 'Challenge',
  },
};

export function clampClassroomGroupSize(value: number): 3 | 4 | 5 {
  if (value <= 3) return 3;
  if (value >= 5) return 5;
  return 4;
}

export function normalizeClassroomGroupCount(value: number): number {
  if (!Number.isFinite(value)) return 4;
  return Math.max(1, Math.min(8, Math.round(value)));
}

export function normalizeClassroomDuration(value: number): number {
  if (!Number.isFinite(value)) return 12;
  return Math.max(10, Math.min(20, Math.round(value)));
}

export function botDifficultyForBand(band: DifficultyBand): ClassroomBotDifficulty {
  switch (band) {
    case 'support':
      return 'easy';
    case 'challenge':
      return 'hard';
    default:
      return 'medium';
  }
}

export function fractionsForBand(band: DifficultyBand, allowFractions: boolean): ClassroomFraction[] {
  if (!allowFractions) return [];
  const cfg = CLASSROOM_BAND_CONFIG[band];
  return cfg.rangeMax === 12 ? [...RANGE_12_FRACTIONS] : [...RANGE_25_FRACTIONS];
}

export function stageForBand(band: DifficultyBand): ClassroomDifficultyStage {
  return CLASSROOM_BAND_CONFIG[band].stageIds[0];
}

export function buildClassroomLaunchConfig(
  settings: ClassroomLiveSettings,
  difficultyBand: DifficultyBand = settings.difficultyBand,
): ClassroomLaunchConfig {
  const cfg = CLASSROOM_BAND_CONFIG[difficultyBand];
  const showFractions = settings.allowFractions && cfg.allowFractions !== false;
  return {
    mode: 'vs-bot',
    difficulty: cfg.rangeMax === 12 ? 'easy' : 'full',
    difficultyBand,
    gradeBand: settings.gradeBand,
    conceptFocus: settings.conceptFocus,
    durationMinutes: settings.durationMinutes,
    showFractions,
    fractionKinds: fractionsForBand(difficultyBand, showFractions),
    mathRangeMax: cfg.rangeMax,
    enabledOperators: [...cfg.enabledOperators],
    difficultyStage: stageForBand(difficultyBand),
    botDifficulty: botDifficultyForBand(difficultyBand),
  };
}

export function nextLowerDifficultyBand(band: DifficultyBand): DifficultyBand {
  switch (band) {
    case 'challenge':
      return 'bridge';
    case 'bridge':
      return 'core';
    case 'core':
      return 'support';
    default:
      return 'support';
  }
}

export function nextHigherDifficultyBand(band: DifficultyBand): DifficultyBand {
  switch (band) {
    case 'support':
      return 'core';
    case 'core':
      return 'bridge';
    case 'bridge':
      return 'challenge';
    default:
      return 'challenge';
  }
}
