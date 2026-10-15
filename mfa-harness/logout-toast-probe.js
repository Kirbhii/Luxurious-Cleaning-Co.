/* eslint-disable */
// logout-toast-probe.js
// ---------------------------------------------------------------------------
// What the user is TOLD when they sign out.
//
// The sign-out request carries a 5s deadline, so a server that never answers can
// no longer trap the user. But "the button now works" is only half the claim.
// The other half is the MESSAGE: when the deadline fires, the session is gone
// from THIS device while the server never confirmed the revocation — and saying
// "You have been successfully signed out" would state a fact the app never read.
//
// Both halves are measured here, in one run, through the SAME flow:
//   healthy server   -> plain success, no caveat
//   black-holed      -> the caveat, and NOT the success wording
//   both             -> the stored session is gone either way
//
// The healthy case is what stops the caveat from being the only thing the probe
// can see: without it, a toast hardcoded to the caveat would pass.
//
// TOAST_CONTROL=1 swaps the expected wording and MUST FAIL — that is what proves
// the assertions read the rendered toast instead of agreeing with themselves.
//
// Usage: node logout-toast-probe.js [baseUrl]
//        TOAST_CONTROL=1   negative control — MUST FAIL
//        SHOT=<path>       save the signed-out screen as presented

const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:4173';

const ADMIN_ID = '11111111-1111-1111-1111-111111111111';
const STORAGE_KEY = 'sb-inyqjfgeecairaxbkxuo-auth-token';
const TOAST_CONTROL = process.env.TOAST_CONTROL === '1';

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

function makeJwt(sub, aal) {
  const t = Math.floor(Date.now() / 1000);
  return [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({
      sub, aud: 'authenticated', role: 'authenticated',
      email: 'admin@test.local', aal, iat: t, exp: t + 3600, session_id: 'sess-1',
    }),
    'sig',
  ].join('.');
}

function mockUser() {
  const iso = new Date().toISOString();
  return {
    id: ADMIN_ID, aud: 'authenticated', role: 'authenticated',
    email: 'admin@test.local', email_confirmed_at: iso, phone: '', confirmed_at: iso,
    last_sign_in_at: iso,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {}, identities: [], created_at: iso, updated_at: iso,
    is_anonymous: false, factors: [],
  };
}

function adminRow() {
  return {
    id: ADMIN_ID, email: 'admin@test.local', name: 'Test Admin', phone: '',
    role: 'admin', employee_id: null, company_id: null, company_code: null,
    assigned_zone_id: null, permissions: [], membership_tier: null,
    membership_status: 'none', partner_application_id: null,
    avatar_url: null, created_at: new Date().toISOString(),
  };
}

async function setupMocks(context, hangLogout) {
  const t = Math.floor(Date.now() / 1000);
  const userObj = mockUser();

  await context.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  // fetchProfile() uses .single() (OBJECT); fetchAllProfiles() wants an ARRAY.
  await context.route('**/rest/v1/profiles**', (route) => {
    const accept = route.request().headers()['accept'] || '';
    const row = adminRow();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(accept.includes('vnd.pgrst.object') ? row : [row]),
    });
  });

  await context.route('**/auth/v1/token**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: makeJwt(ADMIN_ID, 'aal2'),
        token_type: 'bearer', expires_in: 3600, expires_at: t + 3600,
        refresh_token: 'rt-1', user: userObj,
      }),
    })
  );

  await context.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userObj) })
  );

  // The whole point: a server that accepts the connection and then says nothing,
  // forever. Not an error — an error would already take the failure path.
  await context.route('**/auth/v1/logout**', (route) => {
    if (hangLogout) return new Promise(() => {});
    return route.fulfill({ status: 204, body: '' });
  });
}

/** Sign out through the public header, and report what the user was told. */
async function runCase(browser, hangLogout) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await setupMocks(context, hangLogout);

  const t = Math.floor(Date.now() / 1000);
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [
      STORAGE_KEY,
      JSON.stringify({
        access_token: makeJwt(ADMIN_ID, 'aal2'),
        token_type: 'bearer', expires_in: 3600, expires_at: t + 3600,
        refresh_token: 'rt-1', user: mockUser(),
      }),
    ]
  );

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || String(e.message)));

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  // Open the user menu, then the dropdown's own "Sign Out". The confirmation
  // dialog is rendered OUTSIDE <header> on purpose, so scoping the second click
  // to the dialog keeps the two identically-labelled buttons apart.
  const menuButton = page.locator('header div.relative.hidden > button').first();
  await menuButton.waitFor({ timeout: 10000 });
  await menuButton.click();
  await page.waitForTimeout(500);
  await page.locator('header button', { hasText: 'Sign Out' }).first().click({ timeout: 8000 });
  await page.waitForTimeout(500);
  await page
    .locator('[role="dialog"]')
    .getByRole('button', { name: 'Sign Out' })
    .first()
    .click({ timeout: 8000 });

  // Wait for a toast rather than sleeping a guessed interval. Bounded, so a
  // sign-out that never reports anything still fails instead of hanging.
  const toastBox = page.locator('div.fixed.top-4.right-4');
  await toastBox.waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(300);

  const toast = (await toastBox.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  const sessionStored = await page.evaluate(
    () => !!window.localStorage.getItem('sb-inyqjfgeecairaxbkxuo-auth-token')
  );
  const url = page.url().replace(BASE, '');

  if (process.env.SHOT && hangLogout) {
    await page.screenshot({ path: process.env.SHOT, fullPage: true });
  }

  await context.close();
  return { toast, sessionStored, url, errors };
}

(async () => {
  const browser = await chromium.launch();

  console.log(`\n=== logout-toast-probe: ${BASE} ===\n`);

  const results = [];
  const record = (name, detail, ok) => results.push({ name, detail, ok });

  const healthy = await runCase(browser, false);
  const hung = await runCase(browser, true);

  await browser.close();

  // The control swaps which wording each case must show.
  const successWord = TOAST_CONTROL ? 'could not reach the server' : 'successfully signed out';
  const caveatWord = TOAST_CONTROL ? 'successfully signed out' : 'could not reach the server';

  record(
    `a healthy server gets a plain success, with no caveat${TOAST_CONTROL ? '  [NEGATIVE CONTROL: this is EXPECTED to FAIL]' : ''}`,
    `toast = "${healthy.toast}"`,
    healthy.toast.toLowerCase().includes(successWord) &&
      !healthy.toast.toLowerCase().includes(caveatWord)
  );

  record(
    `a server that never answers gets the caveat, NOT a false success${TOAST_CONTROL ? '  [NEGATIVE CONTROL: this is EXPECTED to FAIL]' : ''}`,
    `toast = "${hung.toast}"`,
    hung.toast.toLowerCase().includes(caveatWord) &&
      !hung.toast.toLowerCase().includes(successWord)
  );

  record(
    'the session is dropped from the device either way',
    `stored session after logout: healthy = ${healthy.sessionStored}, hung = ${hung.sessionStored}`,
    healthy.sessionStored === false && hung.sessionStored === false
  );

  record(
    'and the user is returned to a signed-out view either way',
    `url after logout: healthy = "${healthy.url}", hung = "${hung.url}"`,
    !healthy.url.includes('/portal') && !hung.url.includes('/portal')
  );

  const pageErrors = [...healthy.errors, ...hung.errors];
  if (pageErrors.length) console.log('page errors:', pageErrors.slice(0, 3), '\n');

  for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n        ${r.detail}`);

  const failed = results.filter((r) => !r.ok);
  console.log(
    failed.length === 0
      ? `\nRESULT: PASS — ${results.length}/${results.length}`
      : `\nRESULT: FAIL — ${failed.length}/${results.length} failed: ${failed.map((r) => r.name).join(' | ')}`
  );
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error('probe crashed:', e);
  process.exit(2);
});
