/* eslint-disable */
// booking-write-probe.js
// ---------------------------------------------------------------------------
// The bug: seven booking writes were fire-and-forget. The optimistic
// `UPDATE_BOOKING` dispatch painted the new value, the request went out with
// `.then(({ error }) => console.error(...))`, and the failure scrolled past in a
// console nobody reads. The screen reported a state the database had refused.
//
// This drives the cleaner's "Mark as En Route" action with a PATCH that matches
// ZERO rows — the subtle case, because PostgREST answers `200` with `[]` rather
// than an error. `updateBookingRow` already converts that into a real error via
// its `.select('id')` RETURNING clause; what was missing was the call site
// caring.
//
// Observables, in order of what they prove:
//   1. the write was actually attempted   (otherwise nothing below means anything)
//   2. the badge goes to the NEW value     (the optimistic paint is real)
//   3. the badge comes BACK to the old one (the rollback happened)
//   4. an error toast is shown
//   5. no customer notification was sent   (nobody is told about a failed change)
//
// Negative control A: ALLOW_WRITE=1 — the PATCH returns one row, so every
//   assertion above must flip. Proves the probe reads the mock, not itself.
// Negative control B: run it against the pre-fix `CleanerPortal.tsx`
//   (`git stash push src/portals/CleanerPortal.tsx`, rebuild) — checks 3, 4 and
//   5 MUST fail. A probe that passes against both the old and the new code
//   measures nothing.
//
// Usage: node booking-write-probe.js [baseUrl]
//        ALLOW_WRITE=1 node booking-write-probe.js [baseUrl]

const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:4173';
const ALLOW_WRITE = !!process.env.ALLOW_WRITE;
const PATCH_DELAY = Number(process.env.PATCH_DELAY || 1200);

const CLEANER_ID = '11111111-1111-1111-1111-111111111111';
const FACTOR_ID = '22222222-2222-2222-2222-222222222222';
const BOOKING_ID = '55555555-5555-5555-5555-555555555555';
const STORAGE_KEY = 'sb-inyqjfgeecairaxbkxuo-auth-token';

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

function makeJwt(sub, aal) {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({
      sub, aud: 'authenticated', role: 'authenticated',
      email: 'cleaner@test.local', aal, iat: now, exp: now + 3600, session_id: 'sess-1',
    }),
    'sig',
  ].join('.');
}

function mockUser() {
  const iso = new Date().toISOString();
  return {
    id: CLEANER_ID, aud: 'authenticated', role: 'authenticated',
    email: 'cleaner@test.local', email_confirmed_at: iso, phone: '', confirmed_at: iso,
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

function bookingRow() {
  const iso = new Date().toISOString();
  return {
    id: BOOKING_ID,
    customer_id: '99999999-9999-9999-9999-999999999999',
    cleaner_id: CLEANER_ID,
    service: 'Deep Cleaning',
    status: 'confirmed',
    date: '2026-10-20',
    time: '09:00:00',
    address: '31 Annapolis Street',
    city: 'San Juan City',
    property_type: 'Condo',
    bedrooms: 2,
    bathrooms: 2,
    size: '1,200 sq ft',
    frequency: 'One-time',
    special_requests: '',
    fragrance: 'Lavender',
    allergies: 'None',
    access_instructions: 'Concierge will provide the key.',
    cleaner_notes: '',
    before_photos: [],
    progress_photos: [],
    after_photos: [],
    created_at: iso,
    updated_at: iso,
  };
}

async function setupMocks(context) {
  const now = Math.floor(Date.now() / 1000);
  const iso = new Date().toISOString();
  const userObj = mockUser();
  const counts = { patches: 0, notifications: 0 };

  await context.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  await context.route('**/rest/v1/profiles**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: CLEANER_ID, email: 'cleaner@test.local', name: 'Test Cleaner', phone: '',
        role: 'cleaner', employee_id: 'CLN-001', company_id: null, company_code: null,
        assigned_zone_id: null, permissions: [], membership_tier: null,
        membership_status: 'none', partner_application_id: null,
        avatar_url: null, created_at: iso,
      }),
    })
  );

  // Branch on method: GET returns the booking, PATCH is the write under test.
  await context.route('**/rest/v1/bookings**', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([bookingRow()]),
      });
    }
    counts.patches += 1;
    // Hold the response open so the optimistic paint is observable before the
    // rollback lands — otherwise the two are indistinguishable in a screenshot.
    await new Promise((r) => setTimeout(r, PATCH_DELAY));
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      // `[]` = the WHERE + RLS matched nothing. PostgREST calls that a 200.
      body: ALLOW_WRITE ? JSON.stringify([{ id: BOOKING_ID }]) : '[]',
    });
  });

  await context.route('**/rest/v1/notifications**', (route) => {
    if (route.request().method() === 'POST') counts.notifications += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await context.route('**/auth/v1/token**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: makeJwt(CLEANER_ID, 'aal2'),
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

// Read the badge off THIS booking's card. A whole-page regex cannot tell the
// badge apart from the "Mark as En Route" button or from the toast.
const readBadge = (page) =>
  page.evaluate((id) => {
    const marker = [...document.querySelectorAll('div')].find(
      (d) => d.children.length === 0 && (d.textContent || '').includes('#' + id)
    );
    const card = marker ? marker.closest('div.bg-navy-800') : null;
    const span = card ? card.querySelector('span.rounded-full') : null;
    return span ? span.textContent.trim() : null;
  }, BOOKING_ID);

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const counts = await setupMocks(context);

  // aal2 so the portal opens without a step-up; this probe is about writes.
  const now = Math.floor(Date.now() / 1000);
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [
      STORAGE_KEY,
      JSON.stringify({
        access_token: makeJwt(CLEANER_ID, 'aal2'),
        token_type: 'bearer', expires_in: 3600, expires_at: now + 3600,
        refresh_token: 'rt-1', user: mockUser(),
      }),
    ]
  );

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || String(e.message)));

  console.log(`\n=== booking-write-probe: ${BASE}${ALLOW_WRITE ? '  [NEGATIVE CONTROL A: ALLOW_WRITE]' : ''} ===\n`);

  await page.goto(`${BASE}/portal/cleaner`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const results = [];
  const record = (name, detail, ok) => results.push({ name, detail, ok });

  const badgeBefore = await readBadge(page);
  record('the job card rendered with its current status', `badge = ${badgeBefore}`, badgeBefore === 'Confirmed');

  // Drive the action exactly as a cleaner would.
  const nextBtn = page.locator('button', { hasText: 'Mark as En Route' }).first();
  const btnShown = await nextBtn.count();
  if (btnShown > 0) {
    await nextBtn.click({ timeout: 8000 });
    await page.waitForTimeout(600);
    await page
      .locator('[role="dialog"]')
      .getByRole('button', { name: /^Update$/i })
      .click({ timeout: 8000 });
  }

  // Mid-flight: `updateStatus` waits 800ms before it paints, and the PATCH is
  // held open for PATCH_DELAY after that. Poll across that window rather than
  // guessing a single instant — an early read sees "Confirmed" and cannot tell
  // "rolled back" from "never painted at all".
  const midDeadline = Date.now() + 800 + PATCH_DELAY - 300;
  let badgeOptimistic = null;
  while (Date.now() < midDeadline) {
    badgeOptimistic = await readBadge(page);
    if (badgeOptimistic === 'En Route') break;
    await page.waitForTimeout(100);
  }

  // Let the refused write come back and the rollback land.
  await page.waitForTimeout(PATCH_DELAY + 2500);
  const badgeAfter = await readBadge(page);

  const toastText = await page.locator('div.fixed.top-4.right-4').innerText().catch(() => '');

  await context.close();

  record('the write was actually attempted', `PATCH /rest/v1/bookings = ${counts.patches}`, counts.patches === 1);
  record('the optimistic paint is real (badge moves to the new value)', `badge mid-flight = ${badgeOptimistic}`, badgeOptimistic === 'En Route');
  record(
    ALLOW_WRITE ? 'a successful write KEEPS the new value' : 'a refused write ROLLS THE BADGE BACK',
    `badge after = ${badgeAfter}`,
    ALLOW_WRITE ? badgeAfter === 'En Route' : badgeAfter === 'Confirmed'
  );
  record(
    ALLOW_WRITE ? 'a successful write shows no error toast' : 'a refused write shows an error toast',
    `toast = "${toastText.replace(/\s+/g, ' ').trim()}"`,
    ALLOW_WRITE ? !/not saved/i.test(toastText) : /not saved/i.test(toastText)
  );
  record(
    ALLOW_WRITE ? 'a successful write DOES notify the customer' : 'a refused write does NOT notify the customer',
    `POST /rest/v1/notifications = ${counts.notifications}`,
    ALLOW_WRITE ? counts.notifications >= 1 : counts.notifications === 0
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
