/* eslint-disable */
// keyboard-probe.js
// ---------------------------------------------------------------------------
// Question: can the keyboard alone carry you through sign-in?
//
//   1. Enter in the password field submits the sign-in form.
//   2. On the OTP screen the first box is ALREADY focused — no click needed.
//   3. Typing all 6 digits fills the boxes but does NOT submit. Filling and
//      sending are deliberately separate acts, so a mistyped digit can still be
//      corrected before the code is spent. Enter is what submits.
//   4. On the recovery screen the input is already focused, and Enter submits.
//
// The observable is a REQUEST COUNT, not a rendered string. "Enter submitted"
// and "Enter did nothing" look identical on screen — only the wire tells them
// apart. So each check counts the request the flow is supposed to cause.
//
// Negative control: SKIP_ENTER=1 — the probe never presses Enter. Checks 1 and
// 4 MUST then fail, which is what proves the counter is measuring the keypress
// rather than passing for free.
//
// Usage: node keyboard-probe.js [baseUrl]
//        SKIP_ENTER=1 node keyboard-probe.js [baseUrl]

const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:4173';
const SKIP_ENTER = !!process.env.SKIP_ENTER;

const ADMIN_ID = '11111111-1111-1111-1111-111111111111';
const FACTOR_ID = '22222222-2222-2222-2222-222222222222';
const STORAGE_KEY = 'sb-inyqjfgeecairaxbkxuo-auth-token';

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function makeJwt(sub, aal) {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({
      sub, aud: 'authenticated', role: 'authenticated',
      email: 'admin@test.local', aal, iat: now, exp: now + 3600, session_id: 'sess-1',
    }),
    'sig',
  ].join('.');
}

function verifiedFactor() {
  const iso = new Date().toISOString();
  return {
    id: FACTOR_ID, friendly_name: null, factor_type: 'totp',
    status: 'verified', created_at: iso, updated_at: iso,
  };
}

function mockUser(factors) {
  const iso = new Date().toISOString();
  return {
    id: ADMIN_ID, aud: 'authenticated', role: 'authenticated',
    email: 'admin@test.local', email_confirmed_at: iso, phone: '', confirmed_at: iso,
    last_sign_in_at: iso,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {}, identities: [], created_at: iso, updated_at: iso,
    is_anonymous: false, factors,
  };
}

// Returns a `counts` object the checks read from. Mirrors run.js's setupMocks
// so the two harnesses cannot drift into testing different apps.
async function setupMocks(context) {
  const now = Math.floor(Date.now() / 1000);
  const iso = new Date().toISOString();
  const userObj = mockUser([verifiedFactor()]);
  const counts = { passwordLogins: 0, verifies: 0, challenges: 0, redeems: 0, sentCode: null };

  await context.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  // fetchProfile() uses .single() -> PostgREST answers with a bare OBJECT.
  await context.route('**/rest/v1/profiles**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: ADMIN_ID, email: 'admin@test.local', name: 'Test Admin', phone: '',
        role: 'admin', employee_id: null, company_id: null, company_code: null,
        assigned_zone_id: null, permissions: [], membership_tier: null,
        membership_status: 'none', partner_application_id: null,
        avatar_url: null, created_at: iso,
      }),
    })
  );

  await context.route('**/auth/v1/token**', (route) => {
    if (route.request().url().includes('grant_type=password')) counts.passwordLogins += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: makeJwt(ADMIN_ID, 'aal1'),
        token_type: 'bearer', expires_in: 3600, expires_at: now + 3600,
        refresh_token: 'rt-1', user: userObj,
      }),
    });
  });

  await context.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userObj) })
  );

  await context.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204, body: '' }));

  // challenge() and verify() share a prefix — branch on the URL, and count
  // each separately so a challenge can never be mistaken for a verification.
  await context.route('**/auth/v1/factors/**', (route) => {
    const url = route.request().url();
    if (url.endsWith('/verify')) {
      counts.verifies += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: makeJwt(ADMIN_ID, 'aal2'),
          token_type: 'bearer', expires_in: 3600, expires_at: now + 3600,
          refresh_token: 'rt-1', user: userObj,
        }),
      });
    }
    counts.challenges += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'challenge-1', type: 'totp', expires_at: (now + 300) * 1000 }),
    });
  });

  await context.route('**/functions/v1/redeem-recovery-code**', (route) => {
    counts.redeems += 1;
    try {
      counts.sentCode = JSON.parse(route.request().postData() || '{}').code ?? null;
    } catch {
      counts.sentCode = null;
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  return counts;
}

const activeElement = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    return el.getAttribute('aria-label') || el.getAttribute('type') || el.tagName;
  });

// Walk to the OTP screen using CLICKS only — the click on "Sign In" is not what
// checks 2 and 3 are about, and reaching the screen must not depend on the
// keyboard behaviour under test.
async function toOtpScreen(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('form').getByRole('button', { name: /Sign In/ }).waitFor({ timeout: 15000 });
  await page.locator('input[type=email]').fill('admin@test.local');
  await page.locator('input[type=password]').fill('not-a-real-password');
  await page.locator('form').getByRole('button', { name: /Sign In/ }).click();
  await page.locator('input[aria-label="MFA digit 1"]').waitFor({ timeout: 15000 });
}

async function check1_enterSubmitsLogin(browser) {
  const context = await browser.newContext();
  const counts = await setupMocks(context);
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('form').getByRole('button', { name: /Sign In/ }).waitFor({ timeout: 15000 });
  await page.locator('input[type=email]').fill('admin@test.local');
  await page.locator('input[type=password]').fill('not-a-real-password');

  if (!SKIP_ENTER) {
    await page.locator('input[type=password]').press('Enter');
  } else {
    await page.waitForTimeout(1200); // control: nothing is pressed at all
  }
  await page.waitForTimeout(2500);

  const reachedOtp = (await page.locator('input[aria-label^="MFA digit"]').count()) === 6;
  await context.close();

  return {
    name: 'Enter in the password field submits the sign-in form',
    detail: `POST /auth/v1/token (password) = ${counts.passwordLogins}, reached OTP screen = ${reachedOtp}`,
    ok: counts.passwordLogins >= 1 && reachedOtp,
  };
}

async function check2_otpFocusThenEnter(browser) {
  const context = await browser.newContext();
  const counts = await setupMocks(context);
  const page = await context.newPage();

  await toOtpScreen(page);

  const focusedOnArrival = await activeElement(page);

  // Type into whatever currently has focus — no click on any box.
  const verifiesBefore = counts.verifies;
  await page.keyboard.type('123456');
  await page.waitForTimeout(2000);

  const verifiesAfterTyping = counts.verifies;
  const boxes = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input[aria-label^="MFA digit"]'))
      .map((i) => i.value)
      .join('')
  );
  const stillOnOtp = (await page.locator('input[aria-label="MFA digit 1"]').count()) === 1;

  if (!SKIP_ENTER) {
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(3500);

  const verifiesAfterEnter = counts.verifies;
  const landedOnPortal = page.url().includes('/portal/admin');
  await context.close();

  return [
    {
      name: 'OTP screen: the first box is already focused (no click needed)',
      detail: `document.activeElement on arrival = ${focusedOnArrival}`,
      ok: focusedOnArrival === 'MFA digit 1',
    },
    {
      name: 'OTP screen: typing all 6 digits fills the boxes but does NOT submit',
      detail: `boxes = "${boxes}", verify requests ${verifiesBefore} -> ${verifiesAfterTyping}, still on the OTP screen = ${stillOnOtp}`,
      ok: boxes === '123456' && verifiesAfterTyping === 0 && stillOnOtp,
    },
    {
      name: 'OTP screen: Enter then submits the completed code',
      detail: `verify requests ${verifiesAfterTyping} -> ${verifiesAfterEnter}, landed on portal = ${landedOnPortal}`,
      ok: verifiesAfterEnter === 1 && landedOnPortal,
    },
  ];
}

async function check3_recoveryFocusAndEnter(browser) {
  const context = await browser.newContext();
  const counts = await setupMocks(context);
  const page = await context.newPage();

  await toOtpScreen(page);
  await page.locator('button', { hasText: 'Lost your phone?' }).first().click({ timeout: 10000 });

  const codeInput = page.locator('input[aria-label="Recovery code"]');
  await codeInput.waitFor({ timeout: 10000 });
  const focusedOnArrival = await activeElement(page);

  // Type with the keyboard, so a missing focus means the code never lands.
  await page.keyboard.type('OIL2-345678');
  // Read the field BEFORE submitting: a successful redeem clears it and swaps
  // the screen back to the sign-in form, so reading afterwards measures the
  // cleanup, not the typing.
  const typed = await codeInput.inputValue().catch(() => '');

  if (!SKIP_ENTER) {
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(3500);

  const redeems = counts.redeems;
  const sentCode = counts.sentCode;
  await context.close();

  return [
    {
      name: 'Recovery screen: the input is already focused (no click needed)',
      detail: `document.activeElement on arrival = ${focusedOnArrival}`,
      ok: focusedOnArrival === 'Recovery code',
    },
    {
      name: 'Recovery screen: Enter submits the code',
      detail: `typed "${typed}", code that reached the server = "${sentCode}", redeem requests = ${redeems}`,
      ok: typed.replace(/\s/g, '') === 'OIL2-345678' && sentCode === '0112345678' && redeems === 1,
    },
  ];
}

(async () => {
  const browser = await chromium.launch();
  console.log(`\n=== keyboard-probe: ${BASE}${SKIP_ENTER ? '  [NEGATIVE CONTROL: SKIP_ENTER]' : ''} ===\n`);

  const results = [];
  try {
    results.push(await check1_enterSubmitsLogin(browser));
    results.push(...(await check2_otpFocusThenEnter(browser)));
    results.push(...(await check3_recoveryFocusAndEnter(browser)));
  } catch (err) {
    console.error('probe crashed:', err);
    await browser.close();
    process.exit(2);
  }
  await browser.close();

  for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n        ${r.detail}`);

  const failed = results.filter((r) => !r.ok);
  console.log(
    failed.length === 0
      ? `\nRESULT: PASS — ${results.length}/${results.length} (the keyboard alone carries sign-in)`
      : `\nRESULT: FAIL — ${failed.length}/${results.length} failed: ${failed.map((r) => r.name).join(' | ')}`
  );
  process.exit(failed.length === 0 ? 0 : 1);
})();
