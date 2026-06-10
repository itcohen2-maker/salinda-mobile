const { chromium } = require('@playwright/test');
const SHOT = (p) => `verify-shots2/${p}.png`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REF = 'isqxuchcmmabjosxjawt';

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 430, height: 880 } });
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
  const sub = '00000000-0000-4000-8000-000000000abc';
  const jwt = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
    sub, role: 'authenticated', aud: 'authenticated', exp,
    is_anonymous: false, app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { username: 'TestUser' },
  })}.signaturestub`;
  const user = {
    id: sub, aud: 'authenticated', role: 'authenticated', email: 'test@salinda.dev',
    is_anonymous: false,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { username: 'TestUser' },
    identities: [{ id: sub, user_id: sub, provider: 'email', identity_data: { email: 'test@salinda.dev' } }],
  };
  const session = {
    access_token: jwt, refresh_token: 'stub-refresh', expires_in: 31536000,
    expires_at: exp, token_type: 'bearer', user,
  };

  await page.addInitScript(([key, val, sess]) => {
    try {
      window.localStorage.setItem('salinda_intro_seen', 'true');
      window.localStorage.setItem(key, val);
      // RN AsyncStorage on web also reads localStorage; ensure intro flag present.
    } catch (e) {}
  }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);

  // Bypass invite gate; tolerate other supabase calls.
  await page.route('**/rpc/check_invite_access*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ allowed: true, status: 'admin' }) }));

  await page.goto('http://localhost:8081/', { waitUntil: 'domcontentloaded' });
  await sleep(12000);
  await page.screenshot({ path: SHOT('lobby'), fullPage: true });
  const text = await page.evaluate(() => document.body.innerText);
  console.log('LOBBY TEXT:', text.replace(/\n+/g, ' | ').slice(0, 600));
  const hasBtn = !!(await page.$('[data-testid="home-feedback-user"]'))
    || text.includes('Send feedback') || text.includes('שלח פידבק');
  console.log('=== FEEDBACK BUTTON VISIBLE:', hasBtn, '===');

  // If visible, click it and capture the inline feedback card.
  if (hasBtn) {
    const btn = (await page.$('[data-testid="home-feedback-user"]')) || (await page.$('text=Send feedback'));
    if (btn) { await btn.click({ force: true }); await sleep(1200); await page.screenshot({ path: SHOT('feedback-card'), fullPage: true }); }
  }
  await browser.close();
})().catch((e) => { console.log('FATAL:', e.message); process.exit(1); });
