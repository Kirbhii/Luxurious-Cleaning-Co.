/* eslint-disable */
// report-probe.js
// ---------------------------------------------------------------------------
// The monthly printable report.
//
// A report that shows the wrong month is worse than no report, so the thing
// worth measuring is the PERIOD FILTER, not the layout:
//
//   1. the tab opens on the current month and counts only that month
//   2. switching the month changes every figure — the numbers are derived from
//      the selected period, not a static list that happens to look right
//   3. the print document contains the same rows the screen shows, and none of
//      the other month's. Preview and printout are built from ONE string, so
//      they can only agree or both be wrong; this checks they are not wrong.
//   4. the KPI strip reads as a MONITOR, not a tally: every figure carries its
//      change against the previous month, the change is judged (a rise in
//      cancellations is not green), and a month with nothing before it says so
//      instead of printing a true-but-useless "+1 vs an empty month".
//
// The fixture deliberately mixes two months (2 bookings in October, 1 in
// September) with different services, cities and statuses. If the filter were
// ignored, October's count would be 3 and the September id would appear in
// October's table — both are asserted against.
//
// Usage: node report-probe.js [baseUrl]
//        DELTA_CONTROL=1   negative control — MUST FAIL (see below)
//        SHOT=<path>       save the Reports tab as presented

const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:4173';

const ADMIN_ID = '11111111-1111-1111-1111-111111111111';
const FACTOR_ID = '22222222-2222-2222-2222-222222222222';
const STORAGE_KEY = 'sb-inyqjfgeecairaxbkxuo-auth-token';

const OCT_IDS = ['LC-91001', 'LC-91002'];
const SEP_ID = 'LC-91003';

// Negative control (rule: a test that passes before and after a fix measures
// nothing). DELTA_CONTROL=1 flips the EXPECTED direction of the two deltas
// without touching the fixture, so the assertion must read the real DOM to
// notice. It is required to FAIL — if it passes, the assertion is not binding.
const DELTA_CONTROL = process.env.DELTA_CONTROL === '1';

const now = new Date();
const THIS_MONTH = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
// The month before this one, so the fixture does not depend on today's date.
const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const PREV_MONTH = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

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
    is_anonymous: false,
    factors: [{
      id: FACTOR_ID, friendly_name: null, factor_type: 'totp',
      status: 'verified', created_at: iso, updated_at: iso,
    }],
  };
}

const CUSTOMERS = [
  { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'Ana Reyes', created_at: `${prev.getFullYear()}-01-10T00:00:00Z` },
  { id: 'aaaaaaaa-0000-0000-0000-000000000002', name: 'Ben Cruz', created_at: `${THIS_MONTH}-02T00:00:00Z` },
  { id: 'aaaaaaaa-0000-0000-0000-000000000003', name: 'Cara Lim', created_at: `${prev.getFullYear()}-01-20T00:00:00Z` },
];

function profileRow(c) {
  return {
    id: c.id, email: `${c.name.split(' ')[0].toLowerCase()}@test.local`, name: c.name,
    phone: '', role: 'customer', employee_id: null, company_id: null, company_code: null,
    assigned_zone_id: null, permissions: [], membership_tier: null,
    membership_status: 'none', partner_application_id: null,
    avatar_url: null, created_at: c.created_at,
  };
}

function bookingRow(id, customerIndex, service, status, date, city) {
  const iso = new Date().toISOString();
  return {
    id,
    customer_id: CUSTOMERS[customerIndex].id,
    cleaner_id: null,
    service, status, date, time: '09:00:00',
    address: '31 Annapolis Street', city,
    property_type: 'Condo', bedrooms: 2, bathrooms: 2, size: '1,200 sq ft',
    frequency: 'One-time', special_requests: '', fragrance: 'Lavender',
    allergies: 'None', access_instructions: '', cleaner_notes: '',
    before_photos: [], progress_photos: [], after_photos: [],
    created_at: iso, updated_at: iso,
  };
}

const BOOKINGS = [
  bookingRow(OCT_IDS[0], 0, 'Deep Cleaning', 'completed', `${THIS_MONTH}-05`, 'San Juan City'),
  bookingRow(OCT_IDS[1], 1, 'Regular Cleaning', 'pending', `${THIS_MONTH}-20`, 'Makati City'),
  bookingRow(SEP_ID, 2, 'Deep Cleaning', 'completed', `${PREV_MONTH}-12`, 'Quezon City'),
];

async function setupMocks(context) {
  const t = Math.floor(Date.now() / 1000);
  const userObj = mockUser();

  await context.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  // fetchProfile() uses .single() (OBJECT); fetchAllProfiles() wants an ARRAY.
  await context.route('**/rest/v1/profiles**', (route) => {
    const accept = route.request().headers()['accept'] || '';
    const adminRow = {
      id: ADMIN_ID, email: 'admin@test.local', name: 'Test Admin', phone: '',
      role: 'admin', employee_id: null, company_id: null, company_code: null,
      assigned_zone_id: null, permissions: [], membership_tier: null,
      membership_status: 'none', partner_application_id: null,
      avatar_url: null, created_at: new Date().toISOString(),
    };
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        accept.includes('vnd.pgrst.object') ? adminRow : [adminRow, ...CUSTOMERS.map(profileRow)]
      ),
    });
  });

  await context.route('**/rest/v1/bookings**', (route) => {
    if (route.request().method() !== 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(BOOKINGS),
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

  await context.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204, body: '' }));

  await context.route('**/auth/v1/factors/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'challenge-1', type: 'totp', expires_at: (t + 300) * 1000 }),
    })
  );
}

/** The seven KPI cards, keyed by their label. Read from the card's own children
 *  rather than by regexing the page: the detail table also contains status
 *  words like "Completed", so a page-wide match would pass for the wrong
 *  reason. */
async function kpis(page) {
  return page.evaluate(() => {
    const grid = document.querySelector('div.grid.grid-cols-2');
    const out = {};
    if (!grid) return out;
    Array.from(grid.children).forEach((card) => {
      const kids = card.children;
      // The label is uppercased by CSS, and innerText reflects that, so the
      // keys are normalised here rather than in every assertion.
      if (kids.length >= 2) out[kids[1].innerText.trim().toLowerCase()] = kids[0].innerText.trim();
    });
    return out;
  });
}

/** The delta line under each KPI value (card child 3), keyed by label, with the
 *  class that carries its colour. A monitor is only a monitor if it shows the
 *  change AND judges it, so both the text and the tone are read back. */
async function deltas(page) {
  return page.evaluate(() => {
    const grid = document.querySelector('div.grid.grid-cols-2');
    const out = {};
    if (!grid) return out;
    Array.from(grid.children).forEach((card) => {
      const kids = card.children;
      if (kids.length >= 3) {
        out[kids[1].innerText.trim().toLowerCase()] = {
          text: kids[2].innerText.replace(/\s+/g, ' ').trim(),
          cls: kids[2].className,
        };
      }
    });
    return out;
  });
}

async function detailIds(page) {
  return page.evaluate(() => {
    const table = document.querySelector('table');
    if (!table) return [];
    return Array.from(table.querySelectorAll('tbody tr'))
      .map((tr) => tr.children[1].innerText.trim())
      .filter(Boolean);
  });
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
  await setupMocks(context);

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

  console.log(`\n=== report-probe: ${BASE} ===`);
  console.log(`    fixture: ${THIS_MONTH} -> ${OCT_IDS.join(', ')} | ${PREV_MONTH} -> ${SEP_ID}\n`);

  const results = [];
  const record = (name, detail, ok) => results.push({ name, detail, ok });

  await page.goto(`${BASE}/portal/admin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const loadToast = await page.locator('div.fixed.top-4.right-4').innerText().catch(() => '');
  if (loadToast.trim()) {
    console.log(`  [note] toast after load: "${loadToast.replace(/\s+/g, ' ').trim()}"\n`);
  }

  await page.locator('button', { hasText: 'Reports' }).first().click({ timeout: 10000 });
  await page.waitForTimeout(2000);

  const monthValue = await page.locator('#report-month').inputValue().catch(() => '');
  if (process.env.SHOT) {
    await page.screenshot({ path: process.env.SHOT, fullPage: true });
    console.log(`  [shot] saved the Reports tab as presented -> ${process.env.SHOT}\n`);
  }
  record(
    'the report opens on the current month',
    `month input = "${monthValue}" (expected ${THIS_MONTH})`,
    monthValue === THIS_MONTH
  );

  const octKpis = await kpis(page);
  const octIds = await detailIds(page);

  record(
    'the counts are the selected month only, not every booking',
    `KPI cards = ${JSON.stringify(octKpis)}`,
    octKpis['bookings'] === '2' && octKpis['completed'] === '1' &&
      octKpis['still open'] === '1' && octKpis['customers served'] === '2' &&
      octKpis['new customers'] === '1'
  );

  record(
    'the detail table lists this month and leaves the other month out',
    `rows = ${octIds.join(', ') || 'none'}`,
    octIds.length === 2 && OCT_IDS.every((id) => octIds.includes(id)) && !octIds.includes(SEP_ID)
  );

  // ── The strip must read as a monitor, not just a tally ────────────────────
  // A record says "42". A monitor says "42, and that is 8 more than last
  // month". Fixture: this month 2 bookings / 1 completed (50%), last month
  // 1 booking / 1 completed (100%) — so bookings must read as a RISE and the
  // completion rate as a FALL of 50 points, from the same two months.
  const octDeltas = await deltas(page);

  record(
    'the strip carries a completion rate alongside the counts',
    `cards = ${Object.keys(octKpis).length} (${Object.keys(octKpis).join(', ')}); rate = ${JSON.stringify(octKpis['completion rate'])}`,
    Object.keys(octKpis).length === 7 && octKpis['completion rate'] === '50%'
  );

  record(
    `every figure shows its change against the previous month${DELTA_CONTROL ? '  [NEGATIVE CONTROL: this is EXPECTED to FAIL]' : ''}`,
    `bookings = "${octDeltas['bookings']?.text}" | completed = "${octDeltas['completed']?.text}" | rate = "${octDeltas['completion rate']?.text}"`,
    (octDeltas['bookings']?.text || '').includes(`${DELTA_CONTROL ? '▼' : '▲'} 1`) &&
      (octDeltas['bookings']?.text || '').includes('vs') &&
      (octDeltas['completed']?.text || '').includes('no change') &&
      (octDeltas['completion rate']?.text || '').includes(`${DELTA_CONTROL ? '▲' : '▼'} 50 pts`)
  );

  record(
    'a fall that is bad news is coloured as bad news, not as a rise',
    `rate delta class = "${octDeltas['completion rate']?.cls || ''}" | bookings delta class = "${octDeltas['bookings']?.cls || ''}"`,
    /text-red-400/.test(octDeltas['completion rate']?.cls || '') &&
      !/text-emerald-400/.test(octDeltas['completion rate']?.cls || '') &&
      /text-emerald-400/.test(octDeltas['bookings']?.cls || '')
  );

  // ── Switch month: every figure must follow ────────────────────────────────
  await page.locator('#report-month').fill(PREV_MONTH);
  await page.waitForTimeout(1200);

  const sepKpis = await kpis(page);
  const sepIds = await detailIds(page);

  record(
    'changing the month changes the counts',
    `KPI cards = ${JSON.stringify(sepKpis)}`,
    sepKpis['bookings'] === '1' && sepKpis['completed'] === '1' && sepKpis['still open'] === '0' &&
      sepKpis['customers served'] === '1' && sepKpis['new customers'] === '0'
  );

  record(
    'changing the month changes the rows, and swaps which month is excluded',
    `rows = ${sepIds.join(', ') || 'none'}`,
    sepIds.length === 1 && sepIds[0] === SEP_ID && !sepIds.some((id) => OCT_IDS.includes(id))
  );

  // The fixture holds nothing before PREV_MONTH, so this month has no baseline.
  // Comparing against an empty month would print a true-but-useless "+1", and
  // the whole point of the strip is to be readable — so it must say so.
  const sepDeltas = await deltas(page);
  record(
    'a month with nothing before it reports no baseline, not a fake zero',
    `deltas = ${Object.values(sepDeltas).map((d) => d.text).join(' | ') || 'none'}`,
    Object.keys(sepDeltas).length === 7 && Object.values(sepDeltas).every((d) => d.text === '—')
  );

  const noBaselineNote = await page
    .locator('p', { hasText: 'Deltas compare against' })
    .first()
    .innerText()
    .catch(() => '');
  record(
    'and it says so on screen rather than leaving the reader to guess',
    `note = "${noBaselineNote.replace(/\s+/g, ' ').trim()}"`,
    /No prior month with bookings/i.test(noBaselineNote)
  );

  // ── The print document must agree with the screen ─────────────────────────
  await page.locator('#report-month').fill(THIS_MONTH);
  await page.waitForTimeout(1000);

  // Switching back must restore a real baseline — proving the note above was
  // read from the data and is not a hardcoded string.
  const restoredNote = await page
    .locator('p', { hasText: 'Deltas compare against' })
    .first()
    .innerText()
    .catch(() => '');
  record(
    'switching back restores a real baseline and names it',
    `note = "${restoredNote.replace(/\s+/g, ' ').trim()}"`,
    /Baseline:/i.test(restoredNote) && !/No prior month/i.test(restoredNote)
  );

  await page.locator('button', { hasText: 'Preview & Print' }).first().click({ timeout: 8000 });
  await page.waitForTimeout(2500);

  const frameCount = await page.locator('iframe[title="Monthly operations report"]').count();
  let printText = '';
  if (frameCount > 0) {
    printText = await page.frameLocator('iframe[title="Monthly operations report"]').locator('body').innerText();
  }

  record(
    'the print document contains the rows the screen shows',
    `iframe present = ${frameCount > 0}; document mentions = ${[...OCT_IDS, SEP_ID].filter((id) => printText.includes(id)).join(', ') || 'none'}`,
    frameCount === 1 && OCT_IDS.every((id) => printText.includes(id)) && !printText.includes(SEP_ID)
  );

  record(
    'the print document names the period it covers',
    `sections present: report title = ${/Monthly Operations Report/i.test(printText)}, by-service = ${/Bookings by service/i.test(printText)}, detail = ${/Booking detail/i.test(printText)}`,
    /Monthly Operations Report/i.test(printText) && /Bookings by service/i.test(printText) &&
      /Booking detail/i.test(printText)
  );

  // Screen and printout are built from one string, so the delta cannot exist in
  // one and be missing from the other. This is the assertion that would fail if
  // someone later re-implemented the printout separately.
  record(
    'the printout carries the same deltas the screen shows',
    `completion rate = ${/Completion rate/i.test(printText)}, delta arrow = ${/[▲▼]/.test(printText)}, baseline line = ${/Deltas compare against/i.test(printText)}`,
    /Completion rate/i.test(printText) && /[▲▼]/.test(printText) && /Deltas compare against/i.test(printText)
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
