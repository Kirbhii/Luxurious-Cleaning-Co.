// open-link-probe.js
// ---------------------------------------------------------------------------
// Question this answers: "when I open the deployed link, does an unlogged-in
// visitor get the logged-out site?"  Separate from run.js because run.js mocks
// the network on purpose and can therefore never answer it.
//
// Usage:  node open-link-probe.js [baseUrl]
//         SHOT=<path.png> node open-link-probe.js
// Exit 0 = a cold visitor lands on the public site, signed out.

const { chromium } = require('playwright');

const BASE = (process.argv[2] || 'https://luxurious-cleaning-co.vercel.app').replace(/\/+$/, '');
const SHOT = process.env.SHOT || '';

const results = [];
const pass = (m) => results.push(['PASS', m]);
const fail = (m) => results.push(['FAIL', m]);

(async () => {
  const browser = await chromium.launch();

  // A brand-new context has no cookies, no localStorage, no IndexedDB —
  // this is what a stranger's browser looks like.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  console.log(`\n=== open-link-probe: ${BASE} ===\n`);

  // ── 1. The link itself ────────────────────────────────────────────────────
  const resp = await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  console.log(`GET / -> ${resp && resp.status()}`);

  await page.waitForSelector('nav, header', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500); // let the session check settle

  const url = new URL(page.url());
  console.log(`landed on: ${url.pathname}`);

  if (url.pathname === '/') pass('opening the link keeps you on / (no forced redirect)');
  else fail(`opening the link redirected to ${url.pathname} — a stranger should stay on /`);

  // ── 2. What the nav offers ────────────────────────────────────────────────
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const hasSignIn = /\bSign In\b/.test(bodyText);
  const hasSignOut = /\bSign Out\b/.test(bodyText);
  const hasPortal = /\bPortal\b/.test(bodyText);

  if (hasSignIn) pass('nav offers "Sign In"');
  else fail('no "Sign In" in the nav — a visitor cannot tell how to log in');

  if (!hasSignOut) pass('nav does NOT offer "Sign Out"');
  else fail('nav offers "Sign Out" while nobody is signed in');

  if (!hasPortal) pass('nav does NOT offer "Portal"');
  else fail('nav offers "Portal" while nobody is signed in');

  // ── 3. Is anything stored that could resurrect a session? ─────────────────
  const stored = await page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      out[k] = (localStorage.getItem(k) || '').length;
    }
    return out;
  });
  const authKeys = Object.keys(stored).filter((k) => /^sb-.*-auth-token/.test(k));
  console.log('localStorage after a cold visit:', JSON.stringify(stored));

  if (authKeys.length === 0) pass('no Supabase auth token stored after a cold visit');
  else fail(`a session was written on a cold visit: ${authKeys.join(', ')}`);

  // ── 4. Is it actually the public site? ────────────────────────────────────
  const hasLanding = /Luxurious Cleaning/i.test(bodyText);
  if (hasLanding) pass('public landing content is rendered');
  else fail('landing content missing — page may be blank or broken');

  if (SHOT) {
    await page.screenshot({ path: SHOT, fullPage: false });
    console.log(`screenshot -> ${SHOT}`);
  }

  // ── 5. /login still presents the form ─────────────────────────────────────
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const loginUrl = new URL(page.url()).pathname;
  const emailVisible = await page.locator('input[type="email"]').count();
  const passVisible = await page.locator('input[type="password"]').count();

  if (loginUrl === '/login') pass('/login stays on /login for a visitor');
  else fail(`/login bounced to ${loginUrl}`);

  if (emailVisible > 0 && passVisible > 0) pass('/login renders the email + password form');
  else fail(`/login is missing inputs (email=${emailVisible}, password=${passVisible})`);

  if (consoleErrors.length === 0) pass('no console errors');
  else console.log('console errors:', consoleErrors.slice(0, 5));

  await browser.close();

  // ── Summary — the line names the failures ─────────────────────────────────
  const failed = results.filter(([s]) => s === 'FAIL');
  console.log('');
  for (const [s, m] of results) console.log(`  ${s}  ${m}`);
  console.log(
    failed.length === 0
      ? `\nRESULT: PASS — ${results.length}/${results.length} (a stranger sees the signed-out site)`
      : `\nRESULT: FAIL — ${failed.length}/${results.length} failed: ${failed.map(([, m]) => m).join(' | ')}`
  );
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error('probe crashed:', e);
  process.exit(2);
});
