import { test as base, expect, mergeTests, type Page } from '@playwright/test';
import { playerFactory, roomCodeFactory } from './factories';
import { LobbyPage } from '../page-objects/LobbyPage';
import { GamePage } from '../page-objects/GamePage';
import { TutorialPage } from '../page-objects/TutorialPage';

type GameFixtures = {
  lobby: LobbyPage;
  game: GamePage;
  tutorial: TutorialPage;
  player: ReturnType<typeof playerFactory>;
  roomCode: string;
};

const gameTest = base.extend<GameFixtures>({
  lobby: async ({ page }, use) => {
    // Seed returning-user state so tests don't hit the mandatory tutorial flow.
    // lobby-single-player testID only renders when lulos_tutorial_done is set.
    await page.addInitScript(() => {
      window.localStorage.setItem('lulos_tutorial_done', 'true');
      window.localStorage.setItem('lulos_welcome_player_screen_seen', 'true');
    });
    const lobby = new LobbyPage(page);
    await use(lobby);
  },
  game: async ({ page }, use) => {
    await use(new GamePage(page));
  },
  tutorial: async ({ page }, use) => {
    await use(new TutorialPage(page));
  },
  player: async ({}, use) => {
    await use(playerFactory());
  },
  roomCode: async ({}, use) => {
    await use(roomCodeFactory());
  },
});

export const test = mergeTests(gameTest);
export { expect };
export type { Page };
