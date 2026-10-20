'use strict';
/**
 * Two targeted checks for the Oct 17 change.
 *
 *  A. The authenticator (OTP) screen in LIGHT mode must show the on-light
 *     wordmark. The defect was a raw <img src={image-3.png}> in Login.tsx, which
 *     drew "LUXURIOUS" in white on a card that the light theme turns white.
 *  B. The Users tab search must actually filter the table, and the count beside
 *     the heading must describe the same set the rows do.
 *
 * Runs against the SHIPPING theme: only localStorage['lcc-theme'] is set, no
 * palette is injected. If this passes, the app is right; if white-preview.js
 * disagrees, the preview is the thing that is wrong.
 *
 * Usage: BASE=http://127.0.0.1:4321 node verify-search-logo.js
 */
const { chromium } = require('playwright');
const wp = require('./white-preview');

const BASE = process.env.BASE || 'http://127.0.0.1:4321';
// The probe's subject is the light theme, but the same markup has to hold in
// dark — run THEME=dark to screenshot the other side rather than assume it.
const THEME = process.env.THEME === 'dark' ? 'dark' : 'light';
const AUTH_KEY = 'sb-inyqjfgeecairaxbkxuo-auth-token';
const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const FACTOR_ID = '22222222-2222-4222-8222-222222222222';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

function makeJwt(sub, aal) {
  const now = Math.floor(Date.now() / 1000);
  return (
    b64({ alg: 'HS256', typ: 'JWT' }) +
    '.' +
    b64({
      sub,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'admin@test.local',
      aal,
      iat: now,
      exp: now + 3600,
      session_id: 'sess-1',
    }) +
    '.sig'
  );
}

function verifiedFactor() {
  const iso = new Date().toISOString();
  return {
    id: FACTOR_ID,
    friendly_name: null,
    factor_type: 'totp',
    status: 'verified',
    created_at: iso,
    updated_at: iso,
  };
}

function mockUser(factors) {
  const iso = new Date().toISOString();
  return {
    id: ADMIN_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'admin@test.local',
    email_confirmed_at: iso,
    phone: '',
    confirmed_at: iso,
    last_sign_in_at: iso,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: iso,
    updated_at: iso,
    is_anonymous: false,
    factors,
  };
}

const USERS = [
  ['Test Admin', 'admin@test.local', 'admin', ''],
  ['Maria Santos', 'maria.santos@gmail.com', 'customer', '+63 917 000 0001'],
  ['Jose Rizal', 'jose.rizal@gmail.com', 'customer', '+63 917 000 0002'],
  ['Ana Cleaner', 'ana.cleaner@gmail.com', 'cleaner', '+63 917 000 0003'],
  ['Ben Cleaner', 'ben.cleaner@gmail.com', 'cleaner', '+63 917 000 0004'],
  ['Carla Partner', 'carla@partnerco.ph', 'partner', ''],
].map(([name, email, role, phone], i) => ({
  id: `user-${i}`,
  email,
  name,
  phone,
  role,
  employee_id: null,
  company_id: null,
  company_code: null,
  assigned_zone_id: null,
  permissions: [],
  membership_tier: role === 'customer' ? 'gold' : null,
  membership_status: 'none',
  partner_application_id: null,
  avatar_url: null,
  created_at: new Date(Date.now() - i * 86400000).toISOString(),
}));

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

/**
 * Is this computed colour near-white?
 *
 * The rgb() branch is the obvious one. The oklab branch is not optional:
 * Tailwind v4 writes an opacity modifier as color-mix(), and Chrome hands the
 * result back as oklab(...) — so the authenticator card, which is
 * bg-navy-900/95, reads as "oklab(0.999994 ...)" and a regex that only knows
 * rgb() calls it "not white". That exact blind spot is what once turned a dark
 * surface into a light one in white-preview.js. L runs 0..1, and a neutral
 * colour has a and b at ~0.
 */
function isNearWhite(css) {
  if (!css) return false;
  const rgb = /rgba?\(([^)]+)\)/.exec(css);
  if (rgb) {
    const p = rgb[1].split(',').map(Number);
    return p[0] >= 245 && p[1] >= 245 && p[2] >= 245;
  }
  const ok = /oklab\(([^)]+)\)/.exec(css);
  if (ok) {
    const p = ok[1].split('/')[0].trim().split(/\s+/).map(Number);
    return p[0] >= 0.98 && Math.abs(p[1] || 0) < 0.01 && Math.abs(p[2] || 0) < 0.01;
  }
  return false;
}

async function newLightContext(browser, role) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await wp.setupMocks(context, role);
  await context.addInitScript((theme) => {
    try {
      window.localStorage.setItem('lcc-theme', theme);
    } catch (e) {
      /* storage disabled — the markup default applies */
    }
  }, THEME);
  return context;
}

// ── A. authenticator screen ──────────────────────────────────────────────────
async function checkAuthenticatorLogo(browser) {
  const context = await newLightContext(browser, 'admin');

  const factors = [verifiedFactor()];
  const user = mockUser(factors);
  const now = Math.floor(Date.now() / 1000);
  const session = {
    access_token: makeJwt(ADMIN_ID, 'aal1'),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'rt-1',
    user,
  };

  // Registered AFTER wp.setupMocks, so these win (Playwright matches in reverse
  // registration order). An aal1 session plus a verified factor is exactly what
  // makes Login owe a step-up.
  await context.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) })
  );
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [AUTH_KEY, JSON.stringify(session)]
  );

  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  // Prove we are on the authenticator screen before judging its logo. A check
  // that passes on the wrong screen measures nothing.
  const onOtp = await page.locator('h1', { hasText: /Two-Factor Authentication/i }).count();
  check('A1 authenticator screen rendered', onOtp === 1, `h1 count ${onOtp}`);

  const info = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img[alt="Luxurious Cleaning Co."]')).map((el) => ({
      src: el.getAttribute('src') || '',
      display: getComputedStyle(el).display,
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height),
    }));
    // The card is bg-navy-900/95, so its class token is "bg-navy-900/95" and a
    // .bg-navy-900 selector matches nothing. Walk up from the wordmark to the
    // first ancestor that actually paints something instead of guessing a chain.
    let cardBg = null;
    let node = document.querySelector('img[alt="Luxurious Cleaning Co."]');
    while (node && node !== document.documentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        cardBg = bg;
        break;
      }
      node = node.parentElement;
    }
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      cardBg,
      imgs,
    };
  });

  check('A2 document is in the requested theme', info.theme === THEME, `data-theme=${info.theme}, wanted ${THEME}`);

  // The card is bg-navy-900/95, so the composited value carries an alpha rather
  // than being an exact rgb(255,255,255) — and Chrome reports it as oklab().
  const nearWhite = isNearWhite(info.cardBg);
  check(
    THEME === 'light' ? 'A3 authenticator card is near-white' : 'A3 authenticator card is dark',
    THEME === 'light' ? nearWhite : !nearWhite,
    `card background ${info.cardBg}`
  );

  const visible = info.imgs.filter((i) => i.display !== 'none');
  check('A4 exactly one wordmark visible', visible.length === 1, `${visible.length} visible of ${info.imgs.length} mounted`);

  // The point of the fix: the wordmark must be the file that contrasts with the
  // card. On the light card that is logo-onlight; on the dark card, image-3.
  const wantLightAsset = THEME === 'light';
  const isLightAsset = visible.length === 1 && /logo-onlight/.test(visible[0].src);
  check(
    `A5 visible wordmark matches the ${THEME} card`,
    visible.length === 1 && isLightAsset === wantLightAsset,
    visible.length === 1 ? visible[0].src.split('/').pop() : 'n/a'
  );
  check(
    'A6 wordmark has real size',
    visible.length === 1 && visible[0].h > 40 && visible[0].w > 100,
    visible.length === 1 ? `${visible[0].w}x${visible[0].h}` : 'n/a'
  );

  await page.screenshot({ path: `${__dirname}/_shots/otp-${THEME}.png`, fullPage: false });
  await context.close();
}

// ── B. Users tab search ─────────────────────────────────────────────────────
async function checkUsersSearch(browser) {
  const context = await newLightContext(browser, 'admin');

  // A richer roster than the preview's single row, so filtering is observable.
  await context.route('**/rest/v1/profiles**', (route) => {
    const accept = route.request().headers()['accept'] || '';
    const wantsObject = accept.includes('vnd.pgrst.object+json');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wantsObject ? USERS[0] : USERS),
    });
  });

  const page = await context.newPage();
  // Sign in through the real form, the way white-preview.js does: the mocked
  // /auth/v1/token is what stores the session, and seeding localStorage by hand
  // races the client's own session bootstrap.
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('input[type=email]').fill('admin@test.local');
  await page.locator('input[type=password]').fill('not-a-real-password');
  await page.locator('form').getByRole('button', { name: /Sign In/ }).click();
  await page.waitForTimeout(4000);
  if (!page.url().replace(BASE, '').startsWith('/portal')) {
    await page.goto(`${BASE}/portal/admin`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);
  }

  await page.getByRole('button', { name: /^Users/ }).first().click();
  await page.waitForTimeout(2500);

  const search = page.getByLabel('Search users');
  check('B1 search box present', (await search.count()) === 1, `count ${await search.count()}`);

  const rows = () => page.locator('tbody tr');
  const countLabel = async () =>
    (await page.locator('h2', { hasText: 'All Users' }).locator('..').innerText()).replace(/\s+/g, ' ').trim();

  const before = await rows().count();
  check('B2 all users listed before searching', before === USERS.length, `${before} rows, expected ${USERS.length}`);
  check('B3 count reads the full set', /6 total/.test(await countLabel()), await countLabel());

  await search.fill('cleaner');
  await page.waitForTimeout(600);
  const afterRole = await rows().count();
  check('B4 search filters by role word', afterRole === 2, `${afterRole} rows for "cleaner", expected 2`);

  await search.fill('gmail');
  await page.waitForTimeout(600);
  const afterEmail = await rows().count();
  check('B5 search matches email', afterEmail === 4, `${afterEmail} rows for "gmail", expected 4`);

  await search.fill('maria');
  await page.waitForTimeout(600);
  const afterName = await rows().count();
  check('B6 search matches name', afterName === 1, `${afterName} rows for "maria", expected 1`);
  check('B7 count follows the filter', /1 of 6/.test(await countLabel()), await countLabel());

  await search.fill('zzzznothing');
  await page.waitForTimeout(600);
  const empty = await page.locator('tbody tr td', { hasText: /No users match/ }).count();
  check('B8 empty state names the query', empty === 1, `empty-state rows ${empty}`);

  // Clear button must restore the full list.
  await page.getByLabel('Clear search').click();
  await page.waitForTimeout(600);
  const cleared = await rows().count();
  check('B9 clear button restores every row', cleared === USERS.length, `${cleared} rows after clear`);

  await search.fill('cleaner');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${__dirname}/_shots/users-search-${THEME}.png`, fullPage: false });

  await context.close();
}

// ── C. reset-password screen ────────────────────────────────────────────────
// Same defect class as A: a raw <img> replaced by the Logo component. Checked
// separately because it is a different route with its own layout.
async function checkResetPasswordLogo(browser) {
  const context = await newLightContext(browser, 'admin');
  const page = await context.newPage();
  await page.goto(`${BASE}/reset-password`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => ({
    path: window.location.pathname,
    theme: document.documentElement.getAttribute('data-theme'),
    h1: (document.querySelector('h1') || {}).textContent || '',
    imgs: Array.from(document.querySelectorAll('img[alt="Luxurious Cleaning Co."]')).map((el) => ({
      src: el.getAttribute('src') || '',
      display: getComputedStyle(el).display,
      h: Math.round(el.getBoundingClientRect().height),
    })),
  }));

  if (!/reset-password/.test(info.path)) {
    // Needs a recovery session to stay put; say so rather than count a skip as
    // a pass (rule: a probe that cannot see a category must name it).
    console.log(`SKIP  C1 reset-password not reachable without a recovery session (landed on ${info.path})`);
    await context.close();
    return;
  }

  const visible = info.imgs.filter((i) => i.display !== 'none');
  check('C1 reset-password screen rendered', /Reset/i.test(info.h1), info.h1.trim());
  check('C2 exactly one wordmark visible', visible.length === 1, `${visible.length} visible`);
  check(
    'C3 visible wordmark matches the theme',
    visible.length === 1 && /logo-onlight/.test(visible[0].src) === (THEME === 'light'),
    visible.length === 1 ? visible[0].src.split('/').pop() : 'n/a'
  );
  await page.screenshot({ path: `${__dirname}/_shots/reset-${THEME}.png`, fullPage: false });
  await context.close();
}

(async () => {
  const fs = require('fs');
  fs.mkdirSync(`${__dirname}/_shots`, { recursive: true });
  const browser = await chromium.launch();
  try {
    await checkAuthenticatorLogo(browser);
    await checkUsersSearch(browser);
    await checkResetPasswordLogo(browser);
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})();
