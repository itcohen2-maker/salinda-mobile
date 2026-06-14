import type { Page, Locator } from '@playwright/test';

export class GamePage {
  constructor(private readonly page: Page) {}

  readonly playerHand: Locator = this.page.getByTestId('player-hand');
  readonly opponentHand: Locator = this.page.getByTestId('opponent-hand');
  readonly equationArea: Locator = this.page.getByTestId('equation-area');
  readonly equationResultBox: Locator = this.page.getByTestId('equation-result-box');
  readonly diceArea: Locator = this.page.getByTestId('dice-area');
  readonly rollDiceButton: Locator = this.page.getByTestId('roll-dice');
  readonly resetEquationButton: Locator = this.page.getByTestId('reset-equation');
  readonly drawForfeitButton: Locator = this.page.getByTestId('draw-card-forfeit');

  card(value: number | string): Locator {
    return this.page.getByTestId(`card-${value}`);
  }

  async waitReady() {
    await Promise.any([
      this.playerHand.waitFor({ state: 'visible' }),
      this.equationArea.waitFor({ state: 'visible' }),
      this.diceArea.waitFor({ state: 'visible' }),
    ]);
  }
}
