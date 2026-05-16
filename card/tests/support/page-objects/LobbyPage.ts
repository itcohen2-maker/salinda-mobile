import type { Page, Locator } from '@playwright/test';

export class LobbyPage {
  constructor(private readonly page: Page) {}

  readonly openGameMenu: Locator = this.page.getByTestId('lobby-single-player');
  readonly playSinglePlayer: Locator = this.openGameMenu;
  readonly playSolo: Locator = this.page.getByTestId('lobby-play-solo');
  readonly playWithBot: Locator = this.page.getByTestId('lobby-play-bot');
  readonly playPassAndPlay: Locator = this.page.getByTestId('lobby-play-pass-and-play');
  readonly guidanceSkip: Locator = this.page.getByTestId('start-guidance-skip');
  readonly startPlayerCountRow: Locator = this.page.getByTestId('start-player-count-row');
  readonly startBotSettings: Locator = this.page.getByTestId('start-bot-settings');
  readonly createRoom: Locator = this.page.getByTestId('lobby-create-room');
  readonly joinRoom: Locator = this.page.getByTestId('lobby-join-room');
  readonly tutorialButton: Locator = this.page.getByTestId('lobby-tutorial');
  readonly languageToggle: Locator = this.page.getByTestId('lobby-language-toggle');

  async goto() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
  }
}
