import type { Locator } from '@playwright/test';
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

function expectedDesktopPlayfieldWidth(viewportHeight: number): number {
  return 412 * Math.max(0.5, Math.min(1, viewportHeight / 900));
}

function expectedMobileCompactRatio(viewportHeight: number): number {
  return Math.max(0, Math.min(1, (844 - viewportHeight) / (844 - 568)));
}

function expectedMobileGoldActionButtonTop(viewportHeight: number): number {
  const ratio = expectedMobileCompactRatio(viewportHeight);
  return Math.max(96, Math.min(680, viewportHeight - Math.round(140 + ratio * 40)));
}

function expectedMobileTableMetrics(viewportHeight: number) {
  const ratio = expectedMobileCompactRatio(viewportHeight);
  return {
    tableTop: Math.round(205 - ratio * 55),
    tableHeight: Math.round(240 - ratio * 30),
    handBottom: Math.round(Math.max(40, Math.min(195, 195 - ratio * 155))),
    handStripHeight: 140,
  };
}

async function expectFullWidthElement(page: Page, testId: string) {
  const element = page.getByTestId(testId);
  await expect(element).toBeVisible();

  const box = await element.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const layoutViewportWidth = await page.evaluate(() => window.innerWidth);
  expect(box.width).toBeGreaterThanOrEqual(layoutViewportWidth - 1);
  expect(box.width).toBeLessThanOrEqual(layoutViewportWidth + 1);
  expect(Math.abs(box.x)).toBeLessThanOrEqual(1);
}

async function tapCenter(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function getIframeCanvasChecksum(iframeLocator: Locator): Promise<number | null> {
  const iframeHandle = await iframeLocator.elementHandle();
  expect(iframeHandle).not.toBeNull();
  const frame = await iframeHandle?.contentFrame();
  if (!frame) return null;

  try {
    await frame.waitForSelector('canvas', { timeout: 5_000 });
    return await frame.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return -1;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 101) {
        sum = (sum + data[i] * 3 + data[i + 1] * 5 + data[i + 2] * 7 + data[i + 3]) % 1000000007;
      }
      return sum;
    });
  } catch {
    return null;
  }
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
  await page.addInitScript(() => {
    window.localStorage.setItem('lulos_tutorial_done', 'true');
  });
  await lobby.goto();
  await page.waitForTimeout(6_000);
  await expect(lobby.playSinglePlayer).toBeVisible({ timeout: 15_000 });
  await lobby.playSinglePlayer.click({ force: true });
  await page.waitForTimeout(2_500);
  const playWithFriends = page.getByTestId('lobby-play-friends');
  if (await playWithFriends.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await playWithFriends.click({ force: true });
    await page.waitForTimeout(1_000);
  }
  if (!(await page.getByTestId('lobby-play-pass-and-play').isVisible({ timeout: 3_000 }).catch(() => false))) {
    const playBox = await lobby.playSinglePlayer.boundingBox({ timeout: 1_000 }).catch(() => null);
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
      await expect(page.getByTestId('mobile-web-focus-toggle')).toBeHidden();
      const expectedWidth = expectedDesktopPlayfieldWidth(768);
      await expectCenteredPlayfield(page, 'turn-transition-playfield', expectedWidth);
      await expect(page.getByTestId('turn-im-ready')).toBeVisible();

      await page.getByTestId('turn-im-ready').click();
      await game.waitReady();

      await expectCenteredPlayfield(page, 'game-screen-playfield', expectedWidth);
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

      await expectCenteredPlayfield(page, 'game-screen-playfield', expectedWidth);
      await expect(game.rollDiceButton).toBeVisible();
      await game.rollDiceButton.click();

      await expect(game.resetEquationButton).toBeVisible();
      await expect(game.equationResultBox).toBeVisible();
      await expect(game.equationResultBox).toHaveAttribute('data-result-state', 'placeholder');
    });

    test('keeps the hand clickable before the confirm button appears', async ({ page, lobby, game }, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Mobile projects use touch interactions.');

      const consoleLogs: string[] = [];
      page.on('console', (msg) => {
        consoleLogs.push(msg.text());
      });

      await openSinglePlayerSetup(page, lobby);
      await page.getByTestId('turn-im-ready').click();
      await game.waitReady();

      await game.rollDiceButton.click();
      await expect(page.getByTestId('confirm-equation')).toHaveCount(0);
      await expect(game.playerHand).toBeVisible();

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
        expect(Math.abs(rollButtonBox.y - 760)).toBeLessThanOrEqual(4);
        expect(rollButtonBox.y).toBeGreaterThan(handBox.y);
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

      const expectedScaledWidth = expectedDesktopPlayfieldWidth(640);
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

  test.describe('390x568 mouse viewport', () => {
    test.use({ viewport: { width: 390, height: 568 }, isMobile: false, hasTouch: false });

    test('lets mouse clicks build the equation even where the hand strip overlaps the table', async ({ page, lobby, game }, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'This regression covers desktop mouse input in a phone-sized web viewport.');

      await openSinglePlayerSetup(page, lobby);
      await page.getByTestId('turn-im-ready').click();
      await game.waitReady();

      await game.rollDiceButton.click();
      await expect(game.equationArea).toBeVisible();
      await page.waitForTimeout(2_600);

      await page.getByTestId('equation-dice-pool-0').click();
      await page.getByTestId('equation-dice-pool-1').click();
      await page.getByTestId('equation-op-slot-1').click();

      await expect.poll(async () => game.equationArea.innerText()).toContain('+');
    });
  });
});

test.describe('Mobile Gameplay Playfield', () => {
  test('fills the mobile viewport and keeps the gold dice button animated', async ({ page, lobby, game }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'Mobile-only full-width regression.');

    await page.addInitScript(() => {
      window.localStorage.setItem('lulos_tutorial_done', 'true');
      Object.defineProperty(Element.prototype, 'requestFullscreen', { value: undefined, configurable: true });
      Object.defineProperty(Element.prototype, 'webkitRequestFullscreen', { value: undefined, configurable: true });
    });
    await lobby.goto();
    await expect(lobby.openGameMenu).toBeVisible({ timeout: 30_000 });
    await expectFullWidthElement(page, 'app-web-shell');
    await tapCenter(page, lobby.openGameMenu);
    if (!(await lobby.playSolo.isVisible({ timeout: 2_000 }).catch(() => false))) {
      await lobby.openGameMenu.click({ force: true });
    }
    await expect(lobby.playSolo).toBeVisible({ timeout: 15_000 });
    await tapCenter(page, lobby.playSolo);
    await tapCenter(page, page.getByTestId('start-lets-play'));
    const guidanceSkip = page.getByTestId('start-guidance-skip');
    if (await guidanceSkip.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await tapCenter(page, guidanceSkip);
      await expect(guidanceSkip).toBeHidden({ timeout: 10_000 });
    }

    await expectFullWidthElement(page, 'app-web-shell');
    await expectFullWidthElement(page, 'turn-transition-playfield');
    await expect(page.getByTestId('turn-im-ready')).toBeVisible();

    await tapCenter(page, page.getByTestId('turn-im-ready'));
    await game.waitReady();

    await expectFullWidthElement(page, 'app-web-shell');
    await expectFullWidthElement(page, 'game-screen-playfield');
    await expect(game.rollDiceButton).toBeVisible({ timeout: 20_000 });
    await expect(game.diceArea).toBeVisible();
    await expect(page.getByTestId('equation-table-shell')).toBeVisible();

    const viewportMetrics = await page.evaluate(() => ({
      width: Math.round(window.innerWidth),
      height: Math.round(window.visualViewport?.height || window.innerHeight),
    }));
    const expectedTable = expectedMobileTableMetrics(viewportMetrics.height);
    const tableBox = await page.getByTestId('equation-table-shell').boundingBox();
    const handBox = await game.playerHand.boundingBox();
    expect(tableBox).not.toBeNull();
    expect(handBox).not.toBeNull();
    if (tableBox && handBox) {
      expect(Math.abs(tableBox.y - expectedTable.tableTop)).toBeLessThanOrEqual(5);
      expect(Math.abs(tableBox.height - expectedTable.tableHeight)).toBeLessThanOrEqual(5);
      expect(Math.abs(tableBox.width - (viewportMetrics.width - 24))).toBeLessThanOrEqual(4);
      expect(Math.abs(handBox.y - (viewportMetrics.height - expectedTable.handBottom - expectedTable.handStripHeight))).toBeLessThanOrEqual(6);
      expect(Math.max(0, tableBox.y + tableBox.height - handBox.y)).toBeLessThanOrEqual(tableBox.height * 0.28);
    }

    const diceAreaBox = await game.diceArea.boundingBox();
    expect(diceAreaBox).not.toBeNull();
    const expectedDiceTop = expectedMobileGoldActionButtonTop(viewportMetrics.height);
    if (diceAreaBox) {
      expect(Math.abs(diceAreaBox.y - expectedDiceTop)).toBeLessThanOrEqual(4);
    }

    const diceIframe = game.rollDiceButton.locator('iframe').first();
    await expect(diceIframe).toBeVisible();
    await expect(diceIframe).toHaveAttribute('srcdoc', /requestAnimationFrame\(loop\)/);
    await page.waitForTimeout(250);
    const before = await getIframeCanvasChecksum(diceIframe);
    if (before == null) return;
    await page.waitForTimeout(180);
    const afterIframe = game.rollDiceButton.locator('iframe').first();
    const after = await getIframeCanvasChecksum(afterIframe);
    if (after == null) return;
    expect(after).not.toBe(before);
  });
});
