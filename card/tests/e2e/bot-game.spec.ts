import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';

async function dismissGuidanceAndAlerts(page: Page) {
  const skip = page.getByTestId('start-guidance-skip');
  const turnReady = page.getByTestId('turn-im-ready');
  // Wait for either guidance dialog or game turn screen — whichever comes first
  await expect(skip.or(turnReady)).toBeVisible({ timeout: 12_000 }).catch(() => {});
  if (await skip.isVisible({ timeout: 500 }).catch(() => false)) {
    await skip.click({ force: true });
  }
  const gotIt = page.getByRole('button', { name: /הבנתי|got it/i });
  if (await gotIt.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await gotIt.click();
  }
}

test.describe('Single-player vs Bot', () => {
  test.describe.configure({ mode: 'serial' });

  test('Given lobby, When user picks "Play with Bot", Then game screen renders with player and opponent hands', async ({
    page,
    lobby,
    game,
  }) => {
    test.setTimeout(180_000);
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForTimeout(6_000);
    await expect(lobby.openGameMenu).toBeVisible({ timeout: 30_000 });
    await lobby.openGameMenu.click({ force: true });
    await expect(lobby.playWithBot).toBeVisible({ timeout: 15_000 });
    await lobby.playWithBot.click({ force: true });
    await page.waitForTimeout(1_000);
    await expect(page.getByTestId('start-lets-play')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('start-lets-play').click({ force: true });
    await page.waitForTimeout(1_500);
    await dismissGuidanceAndAlerts(page);
    await expect(page.getByTestId('turn-im-ready')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('turn-im-ready').click({ force: true });

    await game.waitReady();
    await expect(game.playerHand).toBeVisible();
    await expect(game.opponentHand).toBeVisible();
  });

  test('shows bot-turn guidance instead of a blank locked screen', async ({
    page,
    lobby,
    game,
  }) => {
    test.setTimeout(180_000);
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForTimeout(6_000);
    await expect(lobby.openGameMenu).toBeVisible({ timeout: 30_000 });
    await lobby.openGameMenu.click({ force: true });
    await expect(lobby.playWithBot).toBeVisible({ timeout: 15_000 });
    await lobby.playWithBot.click({ force: true });
    await page.waitForTimeout(1_000);
    await expect(page.getByTestId('start-lets-play')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('start-lets-play').click({ force: true });
    await page.waitForTimeout(1_500);
    await dismissGuidanceAndAlerts(page);
    await expect(page.getByTestId('turn-im-ready')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('turn-im-ready').click({ force: true });
    await game.waitReady();
    await expect(game.rollDiceButton).toBeVisible({ timeout: 20_000 });
    await game.rollDiceButton.click();
    await expect(game.drawForfeitButton).toBeVisible({ timeout: 20_000 });
    await game.drawForfeitButton.click();

    await expect(page.getByTestId('bot-thinking-overlay')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('bot-speed-up')).toBeVisible({ timeout: 8_000 });
  });
});
