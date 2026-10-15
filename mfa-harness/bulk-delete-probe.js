/* eslint-disable */
// bulk-delete-probe.js
// ---------------------------------------------------------------------------
// The admin's bulk delete. Three things must hold, and only the wire can tell
// us two of them:
//
//   1. ticking N rows sends ONE delete, not N        (request count)
//   2. the PIN is asked ONCE for the batch, not N    (verify_user_pin count)
//   3. only the rows the database CONFIRMED it removed disappear from the
//      screen — a batch can be partly refused, and mirroring the ids we asked
//      for would be reporting a state we never read
//
// The mock deliberately deletes 2 of the 3 and refuses the third, because a
// clean all-or-nothing delete would pass even if the caller mirrored the
// requested ids. The refusal is what makes assertion 3 mean something.
//
// Negative control: PARTIAL_OK=1 makes the mock return all three ids, so the
// "one row survives" assertion MUST flip. Proves the probe reads the response.
//
// Usage: node bulk-delete-probe.js [baseUrl]
//        PARTIAL_OK=1 node bulk-delete-probe.js [baseUrl]

const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:4173';
const PARTIAL_OK = !!process.env.PARTIAL_OK;

const ADMIN_ID = '11111111-1111-1111-1111-111111111111';
const FACTOR_ID = '22222222-2222-2222-2222-222222222222';
const IDS = ['LC-90001', 'LC-90002', 'LC-90003'];
const REFUSED = IDS[2];
const STORAGE_KEY = 'sb-inyqjfgeecairaxbkxuo-auth-token';

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

function bookingRow(id) {
  const iso = new Date().toISOString();
  return {
    id,
    customer_id: '99999999-9999-9999-9999-999999999999',
    cleaner_id: null,
    service: 'Deep Cleaning',
    status: 'pending',
    date: '2026-10-20',
    time: '09:00:00',
    address: '31 Annapolis Street',
    city: 'San Juan City',
    property_type: 'Condo',
    bedrooms: 2, bathrooms: 2, size: '1,200 sq ft', frequency: 'One-time',
    special_requests: '', fragrance: 'Lavender', allergies: 'None',
    access_instructions: '', cleaner_notes: '',
    before_photos: [], progress_photos: [], after_photos: [],
    created_at: iso, updated_at: iso,
  };
}

async function setupMocks(context) {
  const now = Math.floor(Date.now() / 1000);
  const iso = new Date().toISOString();
  const userObj = mockUser();
  const counts = { deletes: 0, deleteUrl: '', pinChecks: 0, pinVerifies: 0, deletedIds: [] };

  await context.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  // Two different callers share this path and want different shapes.
  // fetchProfile() uses .single(), which sends
  // `Accept: application/vnd.pgrst.object+json` and gets a bare OBJECT back;
  // fetchAllProfiles() wants an ARRAY. Answering both with an object made the
  // admin dashboard throw on `.filter` and fire a red error toast that then sat
  // over the toolbar and swallowed every click.
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

  await context.route('**/rest/v1/bookings**', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(IDS.map(bookingRow)),
      });
    }
    // DELETE — the write under test. Capture the URL so we can prove all three
    // ids travelled in ONE request rather than three.
    counts.deletes += 1;
    counts.deleteUrl = route.request().url();
    counts.deletedIds = PARTIAL_OK ? [...IDS] : IDS.slice(0, 2);
    await new Promise((r) => setTimeout(r, 300));
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(counts.deletedIds.map(id => ({ id }))),
    });
  });

  await context.route('**/rest/v1/rpc/pin_lock_status**', (route) => {
    counts.pinChecks += 1;
    // Snake_case on purpose: pinLockStatus() reads `has_pin` / `is_locked` /
    // `seconds_remaining` / `attempts_left` straight off the RPC row, and a
    // set-returning function arrives as an array.
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ has_pin: true, is_locked: false, seconds_remaining: 0, attempts_left: 5 }]),
    });
  });

  await context.route('**/rest/v1/rpc/verify_user_pin**', (route) => {
    counts.pinVerifies += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: 'true' });
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

  return counts;
}

const cardsOnScreen = (page) =>
  page.evaluate((ids) => ids.filter((id) => document.body.innerText.includes('#' + id)), IDS);

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const counts = await setupMocks(context);

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

  console.log(`\n=== bulk-delete-probe: ${BASE}${PARTIAL_OK ? '  [NEGATIVE CONTROL: PARTIAL_OK]' : ''} ===\n`);

  const results = [];
  const record = (name, detail, ok) => results.push({ name, detail, ok });

  await page.goto(`${BASE}/portal/admin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Surface anything the dashboard complained about on load. A stray toast is
  // not just noise here: it sits over the toolbar and swallows clicks.
  const loadToast = await page.locator('div.fixed.top-4.right-4').innerText().catch(() => '');
  if (loadToast.trim()) {
    console.log(`  [note] toast after load: "${loadToast.replace(/\s+/g, ' ').trim()}"\n`);
  }

  await page.locator('button', { hasText: 'Bookings' }).first().click({ timeout: 10000 });
  await page.waitForTimeout(2500);

  const before = await cardsOnScreen(page);
  record('the bookings tab lists all three bookings', `visible = ${before.join(', ')}`, before.length === 3);

  // Tick every row via the "select all" control, exactly as an admin would.
  const selectAll = page.locator('input[aria-label="Select all bookings shown"]');
  const selectAllShown = await selectAll.count();
  if (selectAllShown > 0) {
    await selectAll.first().check({ timeout: 8000 });
  }
  await page.waitForTimeout(600);

  const toolbarText = await page.locator('div.border-red-400\\/25').innerText().catch(() => '');
  record(
    'ticking every row is reported as 3 selected',
    `toolbar = "${toolbarText.replace(/\s+/g, ' ').trim()}"`,
    /3\s*selected/.test(toolbarText)
  );

  // Delete the batch. Let any toast clear first — it overlays the toolbar.
  for (let i = 0; i < 20; i++) {
    const t = await page.locator('div.fixed.top-4.right-4').innerText().catch(() => '');
    if (!t.trim()) break;
    await page.waitForTimeout(500);
  }
  await page.locator('button', { hasText: 'Delete selected' }).first().click({ timeout: 8000 });
  await page.waitForTimeout(1200);

  const pinShown = await page.locator('input[type="password"]').count();
  const dialogShown = await page.locator('[role="dialog"]').count();
  const dialogText = await page.locator('[role="dialog"]').first().innerText().catch(() => '');
  console.log(
    `  [note] after "Delete selected": password inputs = ${pinShown}, dialogs = ${dialogShown}, ` +
      `pin_lock_status calls = ${counts.pinChecks}\n` +
      (dialogText ? `         dialog text: "${dialogText.replace(/\s+/g, ' ').trim().slice(0, 200)}"\n` : '')
  );
  if (pinShown > 0) {
    await page.locator('input[type="password"]').first().fill('1234');
    await page.locator('[role="dialog"]').getByRole('button', { name: /^Delete 3$/i }).click({ timeout: 8000 });
  }
  await page.waitForTimeout(3000);

  const after = await cardsOnScreen(page);
  const toastText = await page.locator('div.fixed.top-4.right-4').innerText().catch(() => '');

  record(
    'the whole batch went in ONE request, carrying all three ids',
    `DELETE requests = ${counts.deletes}; url ids = ${IDS.filter(id => decodeURIComponent(counts.deleteUrl).includes(id)).join(', ') || 'none'}`,
    counts.deletes === 1 && IDS.every(id => decodeURIComponent(counts.deleteUrl).includes(id))
  );

  record(
    'the PIN was asked ONCE for the batch, not once per row',
    `verify_user_pin calls = ${counts.pinVerifies}`,
    counts.pinVerifies === 1
  );

  record(
    PARTIAL_OK
      ? 'when the database removes all three, all three disappear'
      : 'only the rows the database CONFIRMED it removed disappear',
    `still on screen = ${after.join(', ') || 'none'}`,
    PARTIAL_OK ? after.length === 0 : after.length === 1 && after[0] === REFUSED
  );

  record(
    PARTIAL_OK ? 'a complete delete says so plainly' : 'a partly-refused delete says so, rather than claiming success',
    `toast = "${toastText.replace(/\s+/g, ' ').trim()}"`,
    PARTIAL_OK ? /Bookings Deleted/.test(toastText) : /Partly Deleted/.test(toastText)
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
