import { test, expect } from '../support/fixtures';
import { setLocale } from '../support/helpers/locale';
import { failOnConsoleError } from '../support/helpers/network';

/**
 * Tutorial E2E
 *
 * Flow under test:
 *   Home lobby -> Tutorial button -> TutorialGameScreen
 *
 * The deep lesson-by-lesson walkthrough (NEXT_VARIANT, fractions opt-in gate)
 * is currently unit-tested in src/tutorial/__tests__/tutorialFlow.test.ts.
 * The E2E here verifies the user can enter the tutorial and reach the first
 * speech bubble, proving the wiring is alive end-to-end.
 */

test.describe('Tutorial entry flow', () => {
  test('Given English locale, When user opens tutorial from home, Then the tutorial intro opens', async ({
    page,
  }) => {
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

    await setLocale(page, 'en');
    const assertNoErrors = await failOnConsoleError(page);

    await page.goto('/');
    await expectCenteredShell(412);
    await page.getByTestId('lobby-tutorial').click({ timeout: 30_000 });

    await expect(page.getByText(/welcome!/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/let's go!/i)).toBeVisible({ timeout: 30_000 });
    await expectCenteredShell(412);
    assertNoErrors();
  });

  test('Given Hebrew locale, When user enters tutorial, Then the tutorial intro is visible', async ({
    page,
  }) => {
    await setLocale(page, 'he');
    await page.goto('/');
    await page.getByTestId('lobby-tutorial').click({ timeout: 30_000 });

    await expect(page.getByText(/welcome|ברוכים הבאים/i)).toBeVisible({ timeout: 30_000 });
  });

  test('Given Hebrew locale on iPhone layout, When tutorial opens, Then exit stays top-left, the meter hugs the left edge, and sound stays bottom-right', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-safari', 'iPhone-specific header regression');

    await setLocale(page, 'he');
    await page.goto('/');
    await page.getByTestId('lobby-tutorial').click({ timeout: 30_000 });

    await expect(page.getByText(/welcome|ברוכים הבאים/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('tutorial-header-exit')).toBeVisible();
    await expect(page.getByTestId('tutorial-header-exit')).toContainText('X');
    await expect(page.getByTestId('tutorial-header-sound')).toBeVisible();
    await expect(page.getByTestId('tutorial-header-meter')).toBeVisible();
    await expect(page.getByText(/^#\d+$/)).toHaveCount(0);

    const [exitBox, soundBox, meterBox] = await Promise.all([
      page.getByTestId('tutorial-header-exit').boundingBox(),
      page.getByTestId('tutorial-header-sound').boundingBox(),
      page.getByTestId('tutorial-header-meter').boundingBox(),
    ]);

    expect(exitBox).not.toBeNull();
    expect(soundBox).not.toBeNull();
    expect(meterBox).not.toBeNull();

    const safeExitBox = exitBox!;
    const safeSoundBox = soundBox!;
    const safeMeterBox = meterBox!;
    const viewport = page.viewportSize();

    const exitCenterX = safeExitBox.x + safeExitBox.width / 2;
    const meterCenterX = safeMeterBox.x + safeMeterBox.width / 2;

    expect(safeMeterBox.y).toBeGreaterThan(safeExitBox.y + safeExitBox.height - 2);
    expect(meterCenterX).toBeLessThan(exitCenterX - 15);
    expect(safeExitBox.width).toBeGreaterThan(70);
    expect(safeExitBox.height).toBeGreaterThan(28);
    expect(safeExitBox.y).toBeLessThan(30);
    expect(safeExitBox.x + safeExitBox.width / 2).toBeLessThan((viewport?.width ?? 0) * 0.35);
    expect(safeMeterBox.x + safeMeterBox.width).toBeLessThan((viewport?.width ?? 0) * 0.18);
    expect(safeSoundBox.x + safeSoundBox.width / 2).toBeGreaterThan((viewport?.width ?? 0) * 0.65);
    expect(safeSoundBox.y + safeSoundBox.height / 2).toBeGreaterThan((viewport?.height ?? 0) * 0.75);
  });
});

test.describe('Tutorial fractions opt-in gate', () => {
  test.skip(
    true,
    'Reaches lesson 4 boundary via real clicks - needs deterministic fast-forward harness ' +
      'or data-testid("tutorial-jump-to-lesson") to be feasible. Reducer logic is covered by ' +
      'src/tutorial/__tests__/tutorialFlow.test.ts.'
  );

  test('Given user has reached the wild-card lesson, When they tap "Next lesson", Then the fractions opt-in dialog opens', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByText('Optional Fractions Module')).toBeVisible();
  });

  test('Given the opt-in dialog is open, When user taps "Not now", Then they jump to free play (lesson 6)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByText(/free play|round 6|lesson 6/i)).toBeVisible();
  });
});
