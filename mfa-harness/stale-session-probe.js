// stale-session-probe.js
// ---------------------------------------------------------------------------
// The cold-visitor probe proves a stranger sees the signed-out site.
// This proves the *other* half: a dead session sitting in localStorage cannot
// render you as signed in. That is the failure mode behind "I thought I logged
// out, but opening the link still showed me logged in".
//
// It plants a well-formed but EXPIRED Supabase session under the real storage
// key, loads the site, and asserts the app refuses to treat it as a user.
//
// Usage:  node stale-session-probe.js [baseUrl]
// Exit 0 = a stale session is rejected and cleaned up.

const { chromium } = require('playwright');

const BASE = (process.argv[2] || 'https://luxurious-cleaning-co.vercel.app').replace(/\/+$/, '');
const KEY = 'sb-inyqjfgeecairaxbkxuo-auth-token';

const results = [];
const pass = (m) => results.push(['PASS', m]);
const fail = (m) => results.push(['FAIL', m]);

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const expiredJwt = [
  b64url({ alg: 'HS256', typ: 'JWT' }),
  b64url({
    sub: '00000000-0000-0000-0000-000000000000',
    role: 'authenticated',
    aud: 'authenticated',
    iat: 1700000000,
    exp: 1700003600, // long past
  }),
  'not-a-real-signature',
].join('.');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  console.log(`\n=== stale-session-probe: ${BASE} ===\n`);

  // Seed the storage before any app code runs.
  await ctx.addInitScript(
    ([k, jwt]) => {
      localStorage.setItem(
        k,
        JSON.stringify({
          access_token: jwt,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: 1700003600,
          refresh_token: 'stale-refresh-token',
          user: {
            id: '00000000-0000-0000-0000-000000000000',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'nobody@example.com',
            app_metadata: { provider: 'email', providers: ['email'] },
            user_metadata: { name: 'Nobody' },
            created_at: '2023-11-14T00:00:00Z',
          },
        })
      );
    },
    [KEY, expiredJwt]
  );

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav, header', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(4000); // give the refresh attempt time to fail

  const path = new URL(page.url()).pathname;
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const hasSignIn = /\bSign In\b/.test(bodyText);
  const hasSignOut = /\bSign Out\b/.test(bodyText);
  const hasPortal = /\bPortal\b/.test(bodyText);

  console.log(`landed on: ${path}`);

  if (path === '/') pass('stale session does not redirect anywhere');
  else fail(`stale session redirected to ${path}`);

  if (hasSignIn) pass('nav offers "Sign In" despite the planted token');
  else fail('no "Sign In" — the stale token is being trusted');

  if (!hasSignOut) pass('nav does NOT offer "Sign Out"');
  else fail('nav offers "Sign Out" from a dead token — the nav is not reading a real user');

  if (!hasPortal) pass('nav does NOT offer "Portal"');
  else fail('nav offers "Portal" from a dead token');

  const leftover = await page.evaluate((k) => localStorage.getItem(k), KEY);
  if (!leftover) pass('the dead session was removed from localStorage');
  else fail('the dead session is still in localStorage after load');

  // A direct hit on a guarded route must also be refused.
  await page.goto(BASE + '/portal/admin', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const adminPath = new URL(page.url()).pathname;
  if (adminPath === '/login' || adminPath === '/') pass(`/portal/admin bounced to ${adminPath}`);
  else fail(`/portal/admin served with a dead token (stayed on ${adminPath})`);

  await browser.close();

  const failed = results.filter(([s]) => s === 'FAIL');
  console.log('');
  for (const [s, m] of results) console.log(`  ${s}  ${m}`);
  console.log(
    failed.length === 0
      ? `\nRESULT: PASS — ${results.length}/${results.length} (a stale session cannot log you in)`
      : `\nRESULT: FAIL — ${failed.length}/${results.length} failed: ${failed.map(([, m]) => m).join(' | ')}`
  );
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error('probe crashed:', e);
  process.exit(2);
});
