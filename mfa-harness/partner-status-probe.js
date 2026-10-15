/* eslint-disable */
// partner-status-probe.js
// ---------------------------------------------------------------------------
// The admin's decision over a partner company: active / inactive / ended.
//
// What the wire has to show, because the screen alone cannot:
//
//   1. the decision reaches the database as ONE PATCH carrying the right id and
//      the right status — not a local-only change that looks identical on screen
//   2. when the database REFUSES the write (0 rows returned), the screen must
//      NOT report success, and the company must stay as it was. PostgREST
//      answers 200 for a 0-row update, so only the returned rows distinguish
//      "it worked" from "nothing happened".
//
// The mock keeps its own copy of the roster and applies the PATCH to it, so the
// app's re-read after the write is observable: if the app mirrored the change
// locally instead of re-reading, a refused write would still flip the pill.
//
// Negative control: DENY_WRITE=1 makes the mock answer the PATCH with [] (0 rows
// affected) and leave the roster untouched. The "refused" assertions MUST flip.
//
// Usage: node partner-status-probe.js [baseUrl]
//        DENY_WRITE=1 node partner-status-probe.js [baseUrl]

const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:4173';
const DENY_WRITE = !!process.env.DENY_WRITE;

const ADMIN_ID = '11111111-1111-1111-1111-111111111111';
const FACTOR_ID = '22222222-2222-2222-2222-222222222222';
const STORAGE_KEY = 'sb-inyqjfgeecairaxbkxuo-auth-token';

const ACTIVE_ID = 'company_alpha';
const INACTIVE_ID = 'company_beta';

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

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

function mockUser() {
  const iso = new Date().toISOString();
  return {
    id: ADMIN_ID, aud: 'authenticated', role: 'authenticated',
    email: 'admin@test.local', email_confirmed_at: iso, phone: '', confirmed_at: iso,
    last_sign_in_at: iso,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {}, identities: [], created_at: iso, updated_at: iso,
    is_anonymous: false,
    factors: [{
      id: FACTOR_ID, friendly_name: null, factor_type: 'totp',
      status: 'verified', created_at: iso, updated_at: iso,
    }],
  };
}

function companyRow(id, name, code, status) {
  const iso = new Date().toISOString();
  return {
    id, name, code,
    industry: 'Property Management',
    website: null,
    address: '31 Annapolis Street',
    contact_email: `${code.toLowerCase()}@test.local`,
    contact_phone: '0919 000 0000',
    is_active: status === 'active',
    status,
    status_reason: null,
    status_changed_at: status === 'active' ? null : iso,
    created_at: iso,
  };
}

async function setupMocks(context) {
  const now = Math.floor(Date.now() / 1000);
  const iso = new Date().toISOString();
  const userObj = mockUser();

  // The mock owns the roster, so a write that is refused really leaves it alone.
  const roster = [
    companyRow(ACTIVE_ID, 'Alpha Property Group', 'ALPH-101', 'active'),
    companyRow(INACTIVE_ID, 'Beta Estates', 'BETA-202', 'inactive'),
  ];
  const counts = { patches: 0, patchUrl: '', patchBody: '', gets: 0 };

  await context.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  // Two callers share this path and want different shapes: fetchProfile() uses
  // .single() and gets an OBJECT, fetchAllProfiles() wants an ARRAY.
  await context.route('**/rest/v1/profiles**', (route) => {
    const accept = route.request().headers()['accept'] || '';
    const row = {
      id: ADMIN_ID, email: 'admin@test.local', name: 'Test Admin', phone: '',
      role: 'admin', employee_id: null, company_id: null, company_code: null,
      assigned_zone_id: null, permissions: [], membership_tier: null,
      membership_status: 'none', partner_application_id: null,
      avatar_url: null, created_at: iso,
    };
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(accept.includes('vnd.pgrst.object') ? row : [row]),
    });
  });

  await context.route('**/rest/v1/partner_companies**', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      counts.gets += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(roster),
      });
    }
    // PATCH — the write under test.
    counts.patches += 1;
    counts.patchUrl = route.request().url();
    counts.patchBody = route.request().postData() || '';

    if (DENY_WRITE) {
      // 0 rows affected. PostgREST still answers 200; the body is the only tell.
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }

    const body = JSON.parse(counts.patchBody || '{}');
    const target = roster.find((c) => counts.patchUrl.includes(c.id));
    if (target) {
      target.status = body.status;
      target.is_active = body.status === 'active';
      target.status_changed_at = body.status_changed_at ?? iso;
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(target ? [{ id: target.id }] : []),
    });
  });

  await context.route('**/auth/v1/token**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: makeJwt(ADMIN_ID, 'aal2'),
        token_type: 'bearer', expires_in: 3600, expires_at: now + 3600,
        refresh_token: 'rt-1', user: userObj,
      }),
    })
  );

  await context.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userObj) })
  );

  await context.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204, body: '' }));

  await context.route('**/auth/v1/factors/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'challenge-1', type: 'totp', expires_at: (now + 300) * 1000 }),
    })
  );

  return { counts, roster };
}

/** The card for one company, as text, so we can read the buttons it offers. */
async function cardText(page, companyName) {
  return page.evaluate((name) => {
    const cards = Array.from(document.querySelectorAll('div.rounded-xl'));
    const card = cards.find((c) => c.innerText.includes(name));
    return card ? card.innerText.replace(/\s+/g, ' ').trim() : '';
  }, companyName);
}

/**
 * The STATUS PILL alone.
 *
 * Reading the whole card is not good enough: the "Mark Inactive" button
 * contains the word "Inactive", and "Active" is a substring of it, so a regex
 * over the card text matches whichever button happens to be there. That is a
 * check that would pass for the wrong reason. The pill is the only
 * `span.rounded-full` inside the card.
 */
async function cardPill(page, companyName) {
  return page.evaluate((name) => {
    const cards = Array.from(document.querySelectorAll('div.rounded-xl'));
    const card = cards.find((c) => c.innerText.includes(name));
    if (!card) return '(card not found)';
    const pill = card.querySelector('span.rounded-full');
    return pill ? pill.innerText.replace(/\s+/g, ' ').trim() : '(no pill)';
  }, companyName);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
  const { counts, roster } = await setupMocks(context);

  const now = Math.floor(Date.now() / 1000);
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [
      STORAGE_KEY,
      JSON.stringify({
        access_token: makeJwt(ADMIN_ID, 'aal2'),
        token_type: 'bearer', expires_in: 3600, expires_at: now + 3600,
        refresh_token: 'rt-1', user: mockUser(),
      }),
    ]
  );

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || String(e.message)));

  console.log(`\n=== partner-status-probe: ${BASE}${DENY_WRITE ? '  [NEGATIVE CONTROL: DENY_WRITE]' : ''} ===\n`);

  const results = [];
  const record = (name, detail, ok) => results.push({ name, detail, ok });

  await page.goto(`${BASE}/portal/admin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const loadToast = await page.locator('div.fixed.top-4.right-4').innerText().catch(() => '');
  if (loadToast.trim()) {
    console.log(`  [note] toast after load: "${loadToast.replace(/\s+/g, ' ').trim()}"\n`);
  }

  await page.locator('button', { hasText: 'Partners' }).first().click({ timeout: 10000 });
  await page.waitForTimeout(2000);

  const alphaBefore = await cardText(page, 'Alpha Property Group');
  const betaBefore = await cardText(page, 'Beta Estates');
  const alphaPillBefore = await cardPill(page, 'Alpha Property Group');
  const betaPillBefore = await cardPill(page, 'Beta Estates');

  if (process.env.SHOT) {
    await page.screenshot({ path: process.env.SHOT, fullPage: true });
    console.log(`  [shot] saved the Partners tab as presented -> ${process.env.SHOT}\n`);
  }

  record(
    'the roster shows both companies with the status the database reported',
    `Alpha pill = "${alphaPillBefore}"; Beta pill = "${betaPillBefore}"`,
    alphaPillBefore === 'Active' && betaPillBefore === 'Inactive'
  );

  record(
    'each company is offered only the decisions that apply to it',
    `Alpha = "${alphaBefore}" | Beta = "${betaBefore}"`,
    /Mark Inactive/.test(alphaBefore) && !/Reinstate/.test(alphaBefore) &&
      /Reinstate/.test(betaBefore) && !/Mark Inactive/.test(betaBefore)
  );

  // Clear any toast before clicking — they sit over the cards.
  for (let i = 0; i < 20; i++) {
    const t = await page.locator('div.fixed.top-4.right-4').innerText().catch(() => '');
    if (!t.trim()) break;
    await page.waitForTimeout(500);
  }

  // Mark the ACTIVE company inactive.
  await page.locator('button', { hasText: 'Mark Inactive' }).first().click({ timeout: 8000 });
  await page.waitForTimeout(1200);

  const dialogText = await page.locator('[role="dialog"]').first().innerText().catch(() => '');
  record(
    'the confirmation names the company and what will happen',
    `dialog = "${dialogText.replace(/\s+/g, ' ').trim().slice(0, 160)}"`,
    /Alpha Property Group/.test(dialogText) && /stood down/i.test(dialogText)
  );

  await page.locator('[role="dialog"]').getByRole('button', { name: /^Mark Inactive$/i }).click({ timeout: 8000 });
  await page.waitForTimeout(3000);

  record(
    'the decision reached the database as one PATCH with the right id and status',
    `PATCHes = ${counts.patches}; url has Alpha = ${counts.patchUrl.includes(ACTIVE_ID)}; body = ${counts.patchBody}`,
    counts.patches === 1 &&
      counts.patchUrl.includes(ACTIVE_ID) &&
      JSON.parse(counts.patchBody || '{}').status === 'inactive'
  );

  const alphaAfter = await cardText(page, 'Alpha Property Group');
  const alphaPillAfter = await cardPill(page, 'Alpha Property Group');
  const toastText = await page.locator('div.fixed.top-4.right-4').innerText().catch(() => '');

  record(
    DENY_WRITE
      ? 'a REFUSED write does not claim success, and the company stays as it was'
      : 'a successful write is re-read from the database and shown',
    `Alpha pill now = "${alphaPillAfter}"; toast = "${toastText.replace(/\s+/g, ' ').trim()}"`,
    DENY_WRITE
      ? /Status Update Failed/.test(toastText) && !/Partner Status Updated/.test(toastText) && alphaPillAfter === 'Active'
      : /Partner Status Updated/.test(toastText) && alphaPillAfter === 'Inactive'
  );

  // The roster the mock holds must agree with what the screen says. If the app
  // had mirrored the change locally, these would disagree under DENY_WRITE.
  const dbStatus = roster.find((c) => c.id === ACTIVE_ID).status;
  record(
    'what the screen shows matches what the database holds',
    `db = ${dbStatus}; screen pill = ${alphaPillAfter}`,
    (dbStatus === 'inactive') === (alphaPillAfter === 'Inactive')
  );

  if (errors.length) console.log('page errors:', errors.slice(0, 3));

  await browser.close();

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
