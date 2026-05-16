const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push('PAGE: ' + err.message.slice(0,300)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('CON: ' + msg.text().slice(0,200)); });
  await page.goto('http://localhost:8081');
  await page.waitForTimeout(15000);
  await page.screenshot({ path: '_bmad-output/app-fresh.png' });
  const body = await page.evaluate(() => document.body.innerText.slice(0,200));
  console.log('BODY:', body.replace(/\n/g,' ').slice(0,100));
  console.log('ERRORS:', JSON.stringify(errors.slice(0,5)));
  await browser.close();
})();
