/* eslint-disable */
// partner-standing-probe.js
// ---------------------------------------------------------------------------
// What the admin's decision DOES to the partner who is on the other end.
//
// A status the admin can set but the partner never sees is a label, not a
// control. Two things must hold, and the second is the one that matters:
//
//   1. a stood-down partner is TOLD, and told which of the two states it is —
//      "inactive" reads as temporary, "no longer a partner" does not
//   2. the badge says "Ended", not "Approved" — a status the admin changed must
//      change the label, not leave a claim the database no longer makes
//   3. the Submit tab STAYS and the form STAYS, but every field is disabled.
//      Removing the tab read as a bug; a form you can read but not fill is the
//      honest shape.
//   4. the submission path is actually closed. Disabling the fields is
//      presentation; this probe calls requestSubmit() directly, past the
//      disabled button, so the guard inside the handler is what gets measured.
//
// Run twice, same code, opposite fixtures — that is the negative control:
//   default          -> company terminated: banner shown, submit closed
//   ACTIVE_COMPANY=1 -> company active:     no banner,    submit open
//
// Usage: node partner-standing-probe.js [baseUrl]
//        ACTIVE_COMPANY=1 node partner-standing-probe.js [baseUrl]

const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:4173';
const ACTIVE_COMPANY = !!process.env.ACTIVE_COMPANY;

const PARTNER_ID = '33333333-3333-3333-3333-333333333333';
const FACTOR_ID = '22222222-2222-2222-2222-222222222222';
const APP_ID = '44444444-4444-4444-4444-444444444444';
const COMPANY_ID = 'company_gamma';
const STORAGE_KEY = 'sb-inyqjfgeecairaxbkxuo-auth-token';

const COMPANY_STATUS = ACTIVE_COMPANY ? 'active' : 'terminated';

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

function makeJwt(sub, aal) {
  const t = Math.floor(Date.now() / 1000);
  return [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({
      sub, aud: 'authenticated', role: 'authenticated',
      email: 'partner@test.local', aal, iat: t, exp: t + 3600, session_id: 'sess-1',
    }),
    'sig',
  ].join('.');
}

function mockUser() {
  const iso = new Date().toISOString();
  return {
    id: PARTNER_ID, aud: 'authenticated', role: 'authenticated',
    email: 'partner@test.local', email_confirmed_at: iso, phone: '', confirmed_at: iso,
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

async function setupMocks(context) {
  const t = Math.floor(Date.now() / 1000);
  const iso = new Date().toISOString();
  const userObj = mockUser();
  const counts = { projectWrites: 0 };

  await context.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  await context.route('**/rest/v1/profiles**', (route) => {
    const accept = route.request().headers()['accept'] || '';
    const row = {
      id: PARTNER_ID, email: 'partner@test.local', name: 'Test Partner', phone: '',
      role: 'partner', employee_id: null, company_id: COMPANY_ID, company_code: 'GAMM-303',
      assigned_zone_id: null, permissions: [], membership_tier: null,
      membership_status: 'none', partner_application_id: APP_ID,
      avatar_url: null, created_at: iso,
    };
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(accept.includes('vnd.pgrst.object') ? row : [row]),
    });
  });

  await context.route('**/rest/v1/partner_applications**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: APP_ID, user_id: PARTNER_ID, company_name: 'Gamma Facilities Inc.',
        industry: 'Property Management', contact_person: 'Test Partner', position: 'Manager',
        email: 'partner@test.local', phone: '0919 000 0001', website: '',
        address: '31 Annapolis Street', services_required: 'Turnover cleaning',
        estimated_volume: '20 units / month', proposal: 'Annual contract.',
        resume_name: null, resume_url: null, company_id: COMPANY_ID,
        status: 'approved', created_at: iso,
      }]),
    })
  );

  await context.route('**/rest/v1/partner_companies**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: COMPANY_ID, name: 'Gamma Facilities Inc.', code: 'GAMM-303',
        industry: 'Property Management', website: null, address: '31 Annapolis Street',
        contact_email: 'partner@test.local', contact_phone: '0919 000 0001',
        is_active: COMPANY_STATUS === 'active',
        status: COMPANY_STATUS,
        status_reason: null,
        status_changed_at: COMPANY_STATUS === 'active' ? null : iso,
        created_at: iso,
      }]),
    })
  );

  // Any attempt to open a project — this is the write that must never happen.
  await context.route('**/rest/v1/partner_projects**', (route) => {
    if (route.request().method() !== 'GET') counts.projectWrites += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await context.route('**/auth/v1/token**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: makeJwt(PARTNER_ID, 'aal2'),
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

  return counts;
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
  const counts = await setupMocks(context);

  const t = Math.floor(Date.now() / 1000);
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [
      STORAGE_KEY,
      JSON.stringify({
        access_token: makeJwt(PARTNER_ID, 'aal2'),
        token_type: 'bearer', expires_in: 3600, expires_at: t + 3600,
        refresh_token: 'rt-1', user: mockUser(),
      }),
    ]
  );

  const page = await context.newPage();
  const errors = [];
  const seen = [];
  page.on('pageerror', (e) => errors.push(e.stack || String(e.message)));
  page.on('request', (r) => {
    if (r.url().includes('partner_projects')) seen.push(`${r.method()} ${r.url().split('/rest/v1/')[1] || r.url()}`);
  });

  console.log(`\n=== partner-standing-probe: ${BASE}  [company = ${COMPANY_STATUS}] ===\n`);

  const results = [];
  const record = (name, detail, ok) => results.push({ name, detail, ok });

  await page.goto(`${BASE}/portal/partner`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const bodyText = await page.locator('body').innerText().catch(() => '');
  const submitTabs = await page.locator('button', { hasText: 'Submit Project' }).count();
  const standingBanner = /Partnership Ended/i.test(bodyText);
  // The badge is the only place the colon appears; the overview card heading
  // reads "Partnership Approved" without one, so this cannot match it.
  const badge = await page.locator('span', { hasText: 'Partnership:' }).first().innerText().catch(() => '');

  record(
    ACTIVE_COMPANY
      ? 'an active partner sees no standing warning'
      : 'a stood-down partner is told, and told which state it is',
    `banner = ${standingBanner}; body mentions "Partnership Ended" = ${/Partnership Ended/i.test(bodyText)}`,
    ACTIVE_COMPANY ? !standingBanner : (standingBanner && /has ended/i.test(bodyText))
  );

  record(
    ACTIVE_COMPANY
      ? 'the badge says Approved'
      : 'the badge says Ended, not Approved',
    `badge = "${badge.replace(/\s+/g, ' ').trim()}"`,
    ACTIVE_COMPANY ? /Partnership:\s*Approved/i.test(badge) : /Partnership:\s*Ended/i.test(badge)
  );

  // The page notice and the status card carry the same paragraph. Printing it
  // twice on one screen reads as a bug even when both copies are true, so
  // exactly one of them may be on screen.
  const endedMentions = (bodyText.match(/Partnership Ended/gi) || []).length;
  record(
    ACTIVE_COMPANY
      ? 'no standing block is printed at all'
      : 'the standing notice appears exactly once on the overview',
    `"Partnership Ended" occurrences = ${endedMentions}`,
    ACTIVE_COMPANY ? endedMentions === 0 : endedMentions === 1
  );

  // The tab stays on the bar in both cases — it is no longer a way of hiding
  // the submission path, so its presence is not a pass/fail signal on its own.
  record(
    'the Submit tab stays on the bar',
    `"Submit Project" controls on load = ${submitTabs}`,
    submitTabs > 0
  );

  // Open the form in both cases. In the ACTIVE case this proves the route is
  // genuinely open — without it, a "0 writes" result below could just mean the
  // probe never found the form.
  await page.locator('button', { hasText: 'Submit Project' }).first().click({ timeout: 8000 });
  await page.waitForTimeout(1200);

  const formReachable = await page.locator('form').count();
  const totalFields = await page.locator('form input, form textarea, form select').count();
  // `:disabled`, not `[disabled]`. The fields carry no disabled attribute of
  // their own — they are switched off by the disabled <fieldset> around them,
  // and only the pseudo-class knows that. Counting the attribute reports "8
  // enabled" on a form that cannot be typed into.
  const enabledFields = await page
    .locator('form input:not(:disabled), form textarea:not(:disabled), form select:not(:disabled)')
    .count();

  // And the effect itself: try to type. A field that refuses input is the thing
  // being claimed, so measure that rather than a class name.
  let typed = '(no field)';
  if (totalFields > 0) {
    const first = page.locator('form input').first();
    try {
      await first.fill('probe', { timeout: 1500 });
      typed = await first.inputValue();
    } catch {
      typed = '(refused)';
    }
  }

  record(
    ACTIVE_COMPANY
      ? 'the form is readable and fillable'
      : 'the form is still there, but no field can be filled in',
    `forms = ${formReachable}; fields = ${totalFields}; enabled = ${enabledFields}; typing gave "${typed}"`,
    ACTIVE_COMPANY
      ? formReachable === 1 && totalFields > 0 && enabledFields === totalFields && typed === 'probe'
      : formReachable === 1 && totalFields > 0 && enabledFields === 0 && typed === '(refused)'
  );

  // Now the part that matters: submit the form directly, past the disabled
  // button and the disabled fieldset. Only the guard inside the handler is
  // left standing — which is exactly what this is meant to measure.
  if (formReachable > 0) {
    await page.locator('form').first().evaluate((f) => {
      // Turn off constraint validation for the whole form. Clearing `required`
      // on inputs is not enough: a required <select> or <textarea> would still
      // block requestSubmit, and the handler would never run — which reads
      // exactly like "the write was refused".
      f.noValidate = true;
      f.querySelectorAll('input, select, textarea').forEach((el) => { el.required = false; });
      f.requestSubmit();
    });
    // The handler defers the write by 1s before inserting.
    await page.waitForTimeout(3000);
  }

  record(
    ACTIVE_COMPANY
      ? 'submitting from an active partner reaches the database'
      : 'a forced submit from a stood-down partner writes nothing',
    `forms on screen = ${formReachable}; partner_projects writes = ${counts.projectWrites}; requests = ${seen.join(' | ') || 'none'}`,
    ACTIVE_COMPANY ? counts.projectWrites === 1 : counts.projectWrites === 0
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
