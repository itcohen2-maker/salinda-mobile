import { test, expect } from '../support/fixtures';

test.describe('Start screen layout', () => {
  test('keeps the top header actions and parks the Slinda hero opposite the back button', async ({ page, lobby }) => {
    const expectCenteredShell = async (expectedWidth: number) => {
      const shell = page.getByTestId('app-web-shell');
      await expect(shell).toBeVisible({ timeout: 30_000 });
      const shellBox = await shell.boundingBox();
      const viewport = page.viewportSize();

      expect(shellBox).not.toBeNull();
      expect(viewport).not.toBeNull();

      if (shellBox && viewport) {
        expect(shellBox.width).toBeGreaterThanOrEqual(expectedWidth - 1);
        expect(shellBox.width).toBeLessThanOrEqual(expectedWidth + 1);
        expect(Math.abs(shellBox.x - (viewport.width - expectedWidth) / 2)).toBeLessThanOrEqual(1);
      }
    };

    const dismissGuidanceDialogIfVisible = async () => {
      await page.getByText(/Without guidance|׳‘׳׳™ ׳”׳“׳¨׳›׳”/).click({ force: true, timeout: 10_000 }).catch(() => {});
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15_000 }).catch(() => {});
    };

    await lobby.goto();
    await expectCenteredShell(412);
    await lobby.playSinglePlayer.click();
    await lobby.playPassAndPlay.click();
    await dismissGuidanceDialogIfVisible();
    await expectCenteredShell(412);

    const topActions = page.getByTestId('start-top-actions');
    const backButton = page.getByTestId('start-back-to-games');
    const hero = page.getByTestId('start-slinda-hero');
    const letsPlay = page.getByTestId('start-lets-play');
    const languageButton = page.getByText('English').first();

    await expect(topActions).toBeVisible({ timeout: 30_000 });
    await expect(backButton).toBeVisible();
    await expect(hero).toBeVisible();

    const actionButtons = topActions.locator('[role="button"]');
    await expect(actionButtons).toHaveCount(4);

    const topActionsBox = await topActions.boundingBox();
    const backButtonBox = await backButton.boundingBox();
    const heroBox = await hero.boundingBox();
    const languageBox = await languageButton.boundingBox();
    const viewport = page.viewportSize();

    expect(topActionsBox).not.toBeNull();
    expect(backButtonBox).not.toBeNull();
    expect(heroBox).not.toBeNull();
    expect(languageBox).not.toBeNull();
    expect(viewport).not.toBeNull();

    if (topActionsBox && backButtonBox && heroBox && languageBox && viewport) {
      expect(heroBox.y).toBeGreaterThanOrEqual(topActionsBox.y - 6);
      expect(heroBox.y + heroBox.height).toBeLessThanOrEqual(topActionsBox.y + topActionsBox.height + 6);
      expect(languageBox.y).toBeGreaterThanOrEqual(topActionsBox.y + topActionsBox.height - 2);

      const backCenterX = backButtonBox.x + backButtonBox.width / 2;
      const heroCenterX = heroBox.x + heroBox.width / 2;
      if (backCenterX <= viewport.width / 2) {
        expect(heroCenterX).toBeGreaterThanOrEqual(viewport.width / 2);
      } else {
        expect(heroCenterX).toBeLessThanOrEqual(viewport.width / 2);
      }
    }

    await letsPlay.scrollIntoViewIfNeeded();
    await expect(letsPlay).toBeVisible();

    await dismissGuidanceDialogIfVisible();
    await backButton.click({ force: true });
    await expect(lobby.playPassAndPlay).toBeVisible({ timeout: 15_000 });
  });
});
