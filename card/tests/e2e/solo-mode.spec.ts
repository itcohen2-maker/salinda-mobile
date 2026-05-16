import { test, expect } from '../support/fixtures';

test.describe('Solo mode', () => {
  test('Given the game entry screen, When the user starts a solo game, Then setup stays single-player and gameplay renders without opponents', async ({
    lobby,
    page,
  }) => {
    await lobby.goto();

    await expect(lobby.openGameMenu).toBeVisible({ timeout: 30_000 });
    await lobby.openGameMenu.click();

    await expect(lobby.playSolo).toBeVisible({ timeout: 15_000 });
    await lobby.playSolo.click();

    await expect(lobby.startPlayerCountRow).toHaveCount(0);
    await expect(lobby.startBotSettings).toHaveCount(0);

    await page.getByTestId('start-lets-play').click();
    await expect(lobby.guidanceSkip).toBeVisible({ timeout: 15_000 });
    await lobby.guidanceSkip.click();
    await expect(page.getByTestId('turn-im-ready')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('opponent-hand')).toHaveCount(0);
  });

  test('Given a solo building turn, When possible results are opened, Then the chip disappears until the turn ends', async ({
    lobby,
    page,
  }) => {
    await lobby.goto();

    await expect(lobby.openGameMenu).toBeVisible({ timeout: 30_000 });
    await lobby.openGameMenu.click();

    await expect(lobby.playSolo).toBeVisible({ timeout: 15_000 });
    await lobby.playSolo.click();

    await page.getByTestId('start-lets-play').click();
    await expect(lobby.guidanceSkip).toBeVisible({ timeout: 15_000 });
    await lobby.guidanceSkip.click();

    await page.getByTestId('turn-im-ready').click();
    await expect(page.getByTestId('roll-dice')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('roll-dice').click();
    await expect(page.getByTestId('equation-area')).toBeVisible({ timeout: 20_000 });

    const possibleResultsChip = page.getByTestId('possible-results-chip');
    await expect(possibleResultsChip).toBeVisible({ timeout: 10_000 });
    await possibleResultsChip.click();
    await expect(page.getByTestId('possible-results-chip')).toHaveCount(0, { timeout: 10_000 });
  });
});
