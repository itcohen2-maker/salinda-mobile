import { test, expect, type Page } from '../support/fixtures';

async function seedReturningUser(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('lulos_tutorial_done', 'true');
    window.localStorage.setItem('lulos_welcome_player_screen_seen', 'true');
  });
}

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
        const targetWidth = Math.min(expectedWidth, viewport.width);
        expect(shellBox.width).toBeGreaterThanOrEqual(targetWidth - 1);
        expect(shellBox.width).toBeLessThanOrEqual(targetWidth + 1);
        expect(Math.abs(shellBox.x - (viewport.width - targetWidth) / 2)).toBeLessThanOrEqual(1);
      }
    };

    const dismissGuidanceDialogIfVisible = async () => {
      await page.getByText(/Without guidance|׳‘׳׳™ ׳”׳“׳¨׳›׳”/).click({ force: true, timeout: 10_000 }).catch(() => {});
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15_000 }).catch(() => {});
    };

    await seedReturningUser(page);
    await lobby.goto();
    await expectCenteredShell(412);
    await lobby.playSinglePlayer.click();
    await page.getByTestId('lobby-play-friends').click();
    await lobby.playPassAndPlay.click();
    await dismissGuidanceDialogIfVisible();
    await expectCenteredShell(412);

    const topActions = page.getByTestId('start-top-actions');
    const backButton = page.getByTestId('start-back-to-games');
    const hero = page.getByTestId('start-slinda-hero');
    const letsPlay = page.getByTestId('start-lets-play');

    await expect(topActions).toBeVisible({ timeout: 30_000 });
    await expect(backButton).toBeVisible();
    await expect(hero).toBeVisible();

    const actionButtons = topActions.locator('[role="button"]');
    await expect(actionButtons).toHaveCount(4);

    const topActionsBox = await topActions.boundingBox();
    const backButtonBox = await backButton.boundingBox();
    const heroBox = await hero.boundingBox();
    const viewport = page.viewportSize();

    expect(topActionsBox).not.toBeNull();
    expect(backButtonBox).not.toBeNull();
    expect(heroBox).not.toBeNull();
    expect(viewport).not.toBeNull();

    if (topActionsBox && backButtonBox && heroBox && viewport) {
      expect(heroBox.y).toBeGreaterThanOrEqual(topActionsBox.y - 6);
      expect(heroBox.y + heroBox.height).toBeLessThanOrEqual(topActionsBox.y + topActionsBox.height + 6);

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
    await expect(page.getByTestId('lobby-play-friends')).toBeVisible({ timeout: 15_000 });
  });

  test('keeps anonymous players on the online sign-in gate inside the narrow web shell', async ({ page, lobby }) => {
    const shell = page.getByTestId('app-web-shell');
    await seedReturningUser(page);
    await lobby.goto();
    await expect(shell).toBeVisible({ timeout: 30_000 });

    await lobby.playSinglePlayer.click();
    await page.getByTestId('lobby-play-friends').click();
    await lobby.joinRoom.click();
    const googleSignIn = page.getByTestId('auth-social-google-button');
    await expect(googleSignIn).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('table-card-empty-1')).toBeHidden();

    const shellBox = await shell.boundingBox();
    const signInBox = await googleSignIn.boundingBox();

    expect(shellBox).not.toBeNull();
    expect(signInBox).not.toBeNull();

    if (shellBox && signInBox) {
      expect(signInBox.x).toBeGreaterThanOrEqual(shellBox.x - 1);
      expect(signInBox.x + signInBox.width).toBeLessThanOrEqual(shellBox.x + shellBox.width + 1);
    }
  });
});
