import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';

async function dismissGuidanceAndAlerts(page: Page) {
  const skip = page.getByTestId('start-guidance-skip');
  if (await skip.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await skip.click();
  }

  const gotIt = page.getByRole('button', { name: /הבנתי|got it/i });
  if (await gotIt.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await gotIt.click();
  }
}

async function reachBuildingTurn(page: Page) {
  await page.getByTestId('turn-im-ready').click();
  await page.getByTestId('roll-dice').click();
  await expect(page.getByTestId('equation-area')).toBeVisible({ timeout: 20_000 });
}

test.describe('Local draw button', () => {
  test('solo draw-forfeit button ends the turn', async ({ lobby, game, page }) => {
    await lobby.goto();
    await lobby.openGameMenu.click();
    await lobby.playSolo.click();
    await page.getByTestId('start-lets-play').click();
    await dismissGuidanceAndAlerts(page);

    await reachBuildingTurn(page);
    await expect(game.drawForfeitButton).toBeVisible();
    await game.drawForfeitButton.click();

    await expect(page.getByTestId('equation-area')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByTestId('turn-im-ready')).toBeVisible({ timeout: 20_000 });
  });

  test('pass-and-play draw-forfeit button ends the turn', async ({ lobby, game, page }) => {
    await lobby.goto();
    await lobby.openGameMenu.click();
    await page.getByTestId('lobby-play-friends').click();
    await lobby.playPassAndPlay.click();
    await page.getByTestId('start-lets-play').click();
    await dismissGuidanceAndAlerts(page);

    await reachBuildingTurn(page);
    await expect(game.drawForfeitButton).toBeVisible();
    await game.drawForfeitButton.click();

    await expect(page.getByTestId('equation-area')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByTestId('turn-im-ready')).toBeVisible({ timeout: 20_000 });
  });

  test('vs-bot draw-forfeit button hands control to the bot', async ({ lobby, game, page }) => {
    await lobby.goto();
    await lobby.openGameMenu.click();
    await lobby.playWithBot.click();
    await page.getByTestId('start-lets-play').click();
    await dismissGuidanceAndAlerts(page);

    await reachBuildingTurn(page);
    await expect(game.drawForfeitButton).toBeVisible();
    await game.drawForfeitButton.click();

    await expect(page.getByTestId('equation-area')).toHaveCount(0, { timeout: 10_000 });
    await expect(game.drawForfeitButton).toHaveCount(0, { timeout: 10_000 });
  });
});
