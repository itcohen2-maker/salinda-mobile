const { chromium } = require('@playwright/test');

const SHOT = (p) => `verify-shots/${p}.png`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function bodyText(page) {
  return (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ');
}

async function clickLabel(page, label, { exact = true } = {}) {
  const sel = exact ? `[aria-label="${label}"]` : `[aria-label*="${label}"]`;
  const els = await page.$$(sel);
  for (const el of els) {
    if (await el.isVisible()) { await el.click(); return true; }
  }
  return false;
}

async function clickText(page, text) {
  const els = await page.$$(`text=${text}`);
  for (const el of els) {
    if (await el.isVisible()) { await el.click(); return true; }
  }
  return false;
}

async function driveDiceStep(page, tag) {
  // 1) wait for roll → solve
  await sleep(2800);
  await page.screenshot({ path: SHOT(`${tag}-1-rolled`) });
  // 2) place first die (click all dice; only active registers)
  let dice = await page.$$('[aria-label^="הוסף קובייה"]');
  for (const d of dice) { try { await d.click(); await sleep(150); } catch {} }
  await sleep(400);
  // 3) place operator
  await clickLabel(page, 'מקם קלף סימן בחריץ הריק');
  await sleep(500);
  // 4) place second die
  dice = await page.$$('[aria-label^="הוסף קובייה"]');
  for (const d of dice) { try { await d.click(); await sleep(150); } catch {} }
  await sleep(500);
  await page.screenshot({ path: SHOT(`${tag}-2-equation`) });
  // 5) tap the centered target card — click center of lower fan area
  const vp = page.viewportSize();
  for (const yFrac of [0.74, 0.70, 0.78, 0.66, 0.82]) {
    await page.mouse.click(vp.width / 2, Math.round(vp.height * yFrac));
    await sleep(350);
    const t = await bodyText(page);
    if (t.includes('שגר')) break;
  }
  await sleep(300);
  await page.screenshot({ path: SHOT(`${tag}-3-cardpicked`) });
  // 6) launch
  await clickLabel(page, 'שגר');
  await sleep(1600);
  await page.screenshot({ path: SHOT(`${tag}-4-afterlaunch`) });
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 430, height: 880 } });
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  await page.goto('http://localhost:8081/?goldroom=1', { waitUntil: 'domcontentloaded' });
  await sleep(11000);
  await page.screenshot({ path: SHOT('00-hub') });
  console.log('HUB:', (await bodyText(page)).slice(0, 300));

  // open basics tile
  if (!(await clickText(page, 'היסודות והתרגול'))) console.log('!! basics tile not found');
  await sleep(1500);
  await page.screenshot({ path: SHOT('01-basics-welcome') });

  // spotlight: welcome -> deck
  await clickLabel(page, 'המשך ›'); await sleep(1200);
  await page.screenshot({ path: SHOT('02-deck') });
  await clickLabel(page, 'המשך ›'); await sleep(1200);
  await page.screenshot({ path: SHOT('03-fan') });
  // fan step: touch the fan
  const vp = page.viewportSize();
  await page.mouse.click(vp.width / 2, Math.round(vp.height * 0.8));
  await sleep(600);
  await clickLabel(page, 'המשך ›'); await sleep(1200);
  await page.screenshot({ path: SHOT('04-winfan') });
  // winFan: wait for fly animation
  await sleep(5000);
  await clickLabel(page, 'המשך ›'); await sleep(1200);
  await page.screenshot({ path: SHOT('05-dice') });
  // dice step: wait for dice anim, last button = gotIt
  await sleep(3500);
  if (!(await clickLabel(page, 'הבנתי, בוא נתקדם!'))) await clickLabel(page, 'המשך ›');
  await sleep(2000);
  await page.screenshot({ path: SHOT('06-practice-start') });
  console.log('PRACTICE START:', (await bodyText(page)).slice(0, 300));

  // ---- PLUS exercise ----
  await driveDiceStep(page, '07-plus');
  console.log('AFTER PLUS:', (await bodyText(page)).slice(0, 300));
  // FirstWinCelebration -> continue
  await clickLabel(page, 'המשך לשלב הבא'); await sleep(1800);
  await page.screenshot({ path: SHOT('08-after-firstwin') });

  // ---- MINUS exercise ----
  await driveDiceStep(page, '09-minus');

  // EXPECT: RewardChoiceOverlay (summary) "כל הכבוד! 🪙"
  await sleep(800);
  await page.screenshot({ path: SHOT('10-FINAL') });
  const finalText = await bodyText(page);
  console.log('FINAL TEXT:', finalText.slice(0, 400));
  const sawSummary = finalText.includes('רוצים לתרגל גם כפל וחילוק') || finalText.includes('סיימתם את שלב החובה');
  console.log('=== SUMMARY SCREEN PRESENT:', sawSummary, '===');

  await browser.close();
})().catch((e) => { console.log('FATAL:', e.message); process.exit(1); });
