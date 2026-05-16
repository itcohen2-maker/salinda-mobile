import {
  PLAYER_SCREEN_GRADIENT_COLORS,
  TURN_TRANSITION_TUTORIAL_BACKGROUND,
  resolveTurnTransitionBackdrop,
} from './turnTransitionBackdrop';
import { TABLE_SKIN_IDS } from './tableSkins';
import { THEME_IDS } from './themes';

describe('resolveTurnTransitionBackdrop', () => {
  it('keeps the transition screen detached from all table skins and color themes', () => {
    const themeIds = [null, ...THEME_IDS];
    const tableSkinIds = [null, ...TABLE_SKIN_IDS];

    for (const tableThemeId of themeIds) {
      for (const tableSkinId of tableSkinIds) {
        const result = resolveTurnTransitionBackdrop({ tableThemeId, tableSkinId });

        expect(result).toEqual({
          kind: 'gradient',
          gradientColors: PLAYER_SCREEN_GRADIENT_COLORS,
          tableSurface: null,
        });
      }
    }
  });

  it('uses the tutorial solid background without rendering any table surface', () => {
    const result = resolveTurnTransitionBackdrop({
      isTutorial: true,
      tableThemeId: THEME_IDS[0],
      tableSkinId: TABLE_SKIN_IDS[0],
    });

    expect(result).toEqual({
      kind: 'solid',
      backgroundColor: TURN_TRANSITION_TUTORIAL_BACKGROUND,
      tableSurface: null,
    });
  });
});
