import { test, expect } from '../support/fixtures';

test.describe('Slinda turn-transition flow', () => {
  test('Given a Slinda-owned profile, when the player confirms a swap, then Slinda stays available for another swap', async ({
    page,
    lobby,
  }) => {
    const slindaOwned = true;
    const fakeUserId = 'e2e-slinda-test-user';

    // Seed a fake Supabase session so auth doesn't need real network access.
    // The key matches how @supabase/auth-js stores sessions via AsyncStorage on web.
    await page.addInitScript((userId) => {
      window.localStorage.setItem(
        'sb-isqxuchcmmabjosxjawt-auth-token',
        JSON.stringify({
          access_token: 'fake-e2e-access-token',
          token_type: 'bearer',
          expires_in: 86400,
          expires_at: Math.floor(Date.now() / 1000) + 86400,
          refresh_token: 'fake-e2e-refresh-token',
          user: {
            id: userId,
            aud: 'authenticated',
            role: 'authenticated',
            email: null,
            is_anonymous: true,
            app_metadata: { provider: 'anonymous', providers: ['anonymous'] },
            user_metadata: {},
            identities: [],
            created_at: '2025-01-01T00:00:00.000Z',
            updated_at: '2025-01-01T00:00:00.000Z',
          },
        }),
      );
    }, fakeUserId);

    // Mock auth endpoints as a safety net for token refresh attempts.
    await page.route('**/auth/v1/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fake-e2e-access-token',
          token_type: 'bearer',
          expires_in: 86400,
          expires_at: Math.floor(Date.now() / 1000) + 86400,
          refresh_token: 'fake-e2e-refresh-token',
          user: {
            id: fakeUserId,
            aud: 'authenticated',
            role: 'authenticated',
            email: null,
            is_anonymous: true,
            app_metadata: { provider: 'anonymous', providers: ['anonymous'] },
            user_metadata: {},
            identities: [],
            created_at: '2025-01-01T00:00:00.000Z',
            updated_at: '2025-01-01T00:00:00.000Z',
          },
        }),
      });
    });

    // Mock consume_slinda RPC to return 'not_owned'. This keeps slindaAttemptedThisTurn
    // as false after modal confirm (REPLACE_CARD_WITH_SLINDA is not dispatched), so the
    // Slinda button remains visible for the second open that the test asserts.
    await page.route('**/rest/v1/rpc/consume_slinda*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify('not_owned'),
      });
    });

    await page.route('**/rest/v1/profiles*', async (route) => {
      const url = new URL(route.request().url());
      const rawId = url.searchParams.get('id') ?? `eq.${fakeUserId}`;
      const userId = rawId.startsWith('eq.') ? rawId.slice(3) : rawId;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: userId,
          username: 'Tester',
          rating: 1000,
          wins: 0,
          losses: 0,
          total_coins: 250,
          slinda_owned: slindaOwned,
          themes_owned: [],
          table_skins_owned: [],
          active_card_back: 'default',
          active_table_theme: 'default',
          active_table_skin: 'classic_green',
        }),
      });
    });

    await lobby.goto();
    await lobby.playSinglePlayer.click();
    await page.getByTestId('lobby-play-friends').click();
    await lobby.playPassAndPlay.click();
    await page.getByTestId('start-lets-play').click({ force: true });
    await page.getByTestId('start-guidance-skip').click({ force: true });

    const openButton = page.getByTestId('turn-slinda-open');
    await expect(openButton).toBeVisible({ timeout: 30_000 });
    await openButton.click({ force: true });

    const modal = page.getByTestId('slinda-modal');
    const confirmButton = page.getByTestId('slinda-confirm');
    await expect(modal).toBeVisible();
    await expect(confirmButton).toHaveAttribute('aria-disabled', 'true');

    const options = page.locator('[data-testid^="slinda-option-"]');
    await expect(options.first()).toBeVisible();
    expect(await options.count()).toBeGreaterThan(0);
    await options.first().evaluate((node) => {
      (node as HTMLElement).click();
    });

    await expect(confirmButton).toHaveAttribute('aria-disabled', 'false');
    await confirmButton.click();

    await expect(modal).toBeHidden({ timeout: 15_000 });
    await expect(openButton).toBeVisible({ timeout: 15_000 });
    await openButton.click({ force: true });
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('slinda-cancel').click();
    await expect(modal).toBeHidden({ timeout: 15_000 });
    await expect(page.getByTestId('turn-im-ready')).toBeVisible();
  });
});
