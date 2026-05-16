import type { TableSkinId } from './tableSkins';
import type { ThemeId } from './themes';

export const PLAYER_SCREEN_GRADIENT_COLORS = ['#070f1a', '#0f2840', '#153252'] as const;
export const TURN_TRANSITION_TUTORIAL_BACKGROUND = '#0a1628';

export type TurnTransitionBackdrop = {
  kind: 'gradient' | 'solid';
  gradientColors?: typeof PLAYER_SCREEN_GRADIENT_COLORS;
  backgroundColor?: string;
  tableSurface: null;
};

export function resolveTurnTransitionBackdrop({
  isTutorial = false,
  tableThemeId,
  tableSkinId,
}: {
  isTutorial?: boolean;
  tableThemeId?: ThemeId | null;
  tableSkinId?: TableSkinId | null;
} = {}): TurnTransitionBackdrop {
  void tableThemeId;
  void tableSkinId;

  if (isTutorial) {
    return {
      kind: 'solid',
      backgroundColor: TURN_TRANSITION_TUTORIAL_BACKGROUND,
      tableSurface: null,
    };
  }

  return {
    kind: 'gradient',
    gradientColors: PLAYER_SCREEN_GRADIENT_COLORS,
    tableSurface: null,
  };
}
