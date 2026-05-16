const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8081');
  await new Promise(r => setTimeout(r, 9000));
  await page.getByTestId('lobby-single-player').click();
  await new Promise(r => setTimeout(r, 2500));
  // dismiss guidance modal if open
  const noBtns = await page.$$('text=בלי הדרכה');
  if (noBtns[0]) { await noBtns[0].click(); await new Promise(r => setTimeout(r, 500)); }
  // switch to pass-and-play
  const localBtn = await page.$$('text=משחק מקומי');
  if (localBtn[0]) { await localBtn[0].click(); await new Promise(r => setTimeout(r, 500)); }
  await page.screenshot({ path: '_bmad-output/local-game-screen.png' });
  const text = await page.evaluate(() => document.body.innerText.slice(0,600));
  console.log('TEXT:', text);
  await browser.close();
})();
