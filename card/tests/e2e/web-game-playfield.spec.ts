import { test, expect, type Page } from '../support/fixtures';

async function expectCenteredPlayfield(
  page: Page,
  testId: string,
  expectedWidth: number,
) {
  const playfield = page.getByTestId(testId);
  await expect(playfield).toBeVisible();

  const box = await playfield.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  expect(box.width).toBeGreaterThanOrEqual(expectedWidth - 1);
  expect(box.width).toBeLessThanOrEqual(expectedWidth + 1);

  const layoutViewportWidth = await page.evaluate(() => window.innerWidth);
  const expectedLeft = (layoutViewportWidth - expectedWidth) / 2;
  expect(Math.abs(box.x - expectedLeft)).toBeLessThanOrEqual(1);
}

async function getFanTranslateXValues(page: Page): Promise<number[]> {
  return await page.getByTestId('player-hand').evaluate((el) => {
    const values = Array.from(el.querySelectorAll('*'))
      .map((node) => (node instanceof HTMLElement ? node.style.transform : ''))
      .filter((value) => value && value.includes('translateX'))
      .map((value) => {
        const match = value.match(/translateX\(([-\d.]+)px\)/);
        return match ? Number.parseFloat(match[1]) : NaN;
      })
      .filter((value) => Number.isFinite(value));
    return values.slice(0, 16);
  });
}

async function openSinglePlayerSetup(
  page: Page,
  lobby: {
    goto: () => Promise<void>;
    playSinglePlayer: { click: () => Promise<void> };
    playPassAndPlay: { click: () => Promise<void> };
  },
) {
  await lobby.goto();
  await page.waitForTimeout(6_000);
  await expect(lobby.playSinglePlayer).toBeVisible({ timeout: 15_000 });
  await lobby.playSinglePlayer.click({ force: true });
  await page.waitForTimeout(2_500);
  if (!(await page.getByTestId('lobby-play-pass-and-play').isVisible({ timeout: 3_000 }).catch(() => false))) {
    const playBox = await lobby.playSinglePlayer.boundingBox();
    if (playBox) {
      await page.mouse.click(playBox.x + playBox.width / 2, playBox.y + playBox.height / 2);
    }
  }
  await expect(page.getByTestId('lobby-play-pass-and-play')).toBeVisible({ timeout: 15_000 });
  await lobby.playPassAndPlay.click({ force: true });
  await page.getByTestId('start-lets-play').click({ force: true });

  const guidanceSkip = page.getByTestId('start-guidance-skip');
  if (await guidanceSkip.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await guidanceSkip.click({ force: true });
    await expect(guidanceSkip).toBeHidden({ timeout: 10_000 });
  }
}

test.describe('Desktop Gameplay Playfield', () => {
  test.describe('1366x768', () => {
    test.use({ viewport: { width: 1366, height: 768 } });

    test('centers turn transition and game inside a 412px playfield', async ({ page, lobby, game }, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Mobile projects should remain full-width.');

      await openSinglePlayerSetup(page, lobby);
      await expectCenteredPlayfield(page, 'turn-transition-playfield', 412);
      await expect(page.getByTestId('turn-im-ready')).toBeVisible();

      await page.getByTestId('turn-im-ready').click();
      await game.waitReady();

      await expectCenteredPlayfield(page, 'game-screen-playfield', 412);
      await expect(game.playerHand).toBeVisible();
      await expect(game.opponentHand).toBeVisible();
      await expect(game.rollDiceButton).toBeVisible();
    });

    test('allows dragging the desktop fan with the mouse', async ({ page, lobby, game }, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Mobile projects use touch interactions.');

      await openSinglePlayerSetup(page, lobby);
      await page.getByTestId('turn-im-ready').click();
      await game.waitReady();
      await expect(game.playerHand).toBeVisible();

      const before = await getFanTranslateXValues(page);
      const handBox = await game.playerHand.boundingBox();

      expect(handBox).not.toBeNull();
      if (!handBox) return;

      await page.mouse.move(handBox.x + handBox.width / 2, handBox.y + handBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(handBox.x + handBox.width / 2 + 180, handBox.y + handBox.height / 2, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(1200);

      const after = await getFanTranslateXValues(page);
      expect(before.some((value) => value > 1)).toBe(false);
      expect(after.some((value) => value > 1)).toBe(true);
    });

    test('keeps the reset-equation control visible after rolling dice', async ({ page, lobby, game }, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Mobile projects should remain full-width.');

      await openSinglePlayerSetup(page, lobby);
      await page.getByTestId('turn-im-ready').click();
      await game.waitReady();

      await expectCenteredPlayfield(page, 'game-screen-playfield', 412);
      await expect(game.rollDiceButton).toBeVisible();
      await game.rollDiceButton.click();

      await expect(game.resetEquationButton).toBeVisible();
    });

    test('keeps the confirm button above the hand and allows clicking a hand card', async ({ page, lobby, game }, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Mobile projects use touch interactions.');

      const consoleLogs: string[] = [];
      page.on('console', (msg) => {
        consoleLogs.push(msg.text());
      });

      await openSinglePlayerSetup(page, lobby);
      await page.getByTestId('turn-im-ready').click();
      await game.waitReady();

      await game.rollDiceButton.click();
      await expect(page.getByTestId('confirm-equation')).toBeVisible();
      await expect(game.playerHand).toBeVisible();

      const confirmBox = await page.getByTestId('confirm-equation').boundingBox();
      const handBox = await game.playerHand.boundingBox();

      expect(confirmBox).not.toBeNull();
      expect(handBox).not.toBeNull();

      if (!confirmBox || !handBox) return;

      expect(confirmBox.y + confirmBox.height).toBeLessThanOrEqual(handBox.y);

      await page.locator('[data-testid^="hand-card-"]').nth(2).click({ force: true });
      await page.waitForTimeout(400);

      expect(consoleLogs.some((entry) => entry.includes('CARD TAP'))).toBe(true);
    });
  });

  test.describe('1440x900', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('keeps the same centered playfield on larger desktop windows', async ({ page, lobby, game }, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Mobile projects should remain full-width.');

      await openSinglePlayerSetup(page, lobby);
      await expectCenteredPlayfield(page, 'turn-transition-playfield', 412);

      await page.getByTestId('turn-im-ready').click();
      await game.waitReady();

      await expectCenteredPlayfield(page, 'game-screen-playfield', 412);
      await expect(game.playerHand).toBeVisible();
      await expect(game.diceArea).toBeVisible();

      const rollButtonBox = await game.rollDiceButton.boundingBox();
      const handBox = await game.playerHand.boundingBox();

      expect(rollButtonBox).not.toBeNull();
      expect(handBox).not.toBeNull();

      if (rollButtonBox && handBox) {
        expect(rollButtonBox.y + rollButtonBox.height).toBeLessThanOrEqual(handBox.y);
      }
    });
  });

  test.describe('1366x640', () => {
    test.use({ viewport: { width: 1366, height: 640 } });

    test('scales the playfield down instead of letting the table overlap the hand', async ({ page, lobby, game }, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Mobile projects should remain full-width.');

      await openSinglePlayerSetup(page, lobby);
      await page.getByTestId('turn-im-ready').click();
      await game.waitReady();

      const expectedScaledWidth = 412 * (640 / 768);
      await expectCenteredPlayfield(page, 'game-screen-playfield', expectedScaledWidth);

      await expect(game.rollDiceButton).toBeVisible();
      await game.rollDiceButton.click();
      await expect(game.equationArea).toBeVisible();
      await expect(game.playerHand).toBeVisible();

      const equationBox = await game.equationArea.boundingBox();
      const handBox = await game.playerHand.boundingBox();

      expect(equationBox).not.toBeNull();
      expect(handBox).not.toBeNull();

      if (equationBox && handBox) {
        expect(equationBox.y + equationBox.height).toBeLessThan(handBox.y);
      }
    });
  });
});
