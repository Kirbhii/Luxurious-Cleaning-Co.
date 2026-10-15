/* eslint-disable */
// Headless proof that the admin TOTP step-up screen actually renders.
//
// Supabase is mocked at the network layer so no real credentials are needed.
// Two scenarios:
//   with-factor     -> a verified totp factor exists -> expect the OTP screen
//   without-factor  -> no factors                   -> expect /portal/admin (no regression)
//
// Usage: node run.js <baseUrl>

const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:4173';

// Optional viewport override: VP=595x583 node run.js <url> I
// Lets a scenario be measured at the size the reporter actually sees.
const VIEWPORT = (() => {
  const raw = process.env.VP;
  if (!raw) return undefined;
  const [w, h] = raw.split('x').map(Number);
  return w && h ? { width: w, height: h } : undefined;
})();

const ADMIN_ID = '11111111-1111-1111-1111-111111111111';
const FACTOR_ID = '22222222-2222-2222-2222-222222222222';

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

// auth-js decodes the JWT client-side and never verifies the signature, so a
// hand-built token is enough. `aal: 'aal1'` is what a password-only session
// carries when a second factor is enrolled.
function makeJwt(sub, aal) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({
    sub,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'admin@test.local',
    aal,
    iat: now,
    exp: now + 3600,
    session_id: 'sess-1',
  });
  return `${header}.${payload}.sig`;
}

function verifiedFactor() {
  const now = new Date().toISOString();
  return {
    id: FACTOR_ID,
    friendly_name: null,
    factor_type: 'totp',
    status: 'verified',
    created_at: now,
    updated_at: now,
  };
}

// The shape /auth/v1/user (and the session payload) returns.
function mockUser(factors, role = 'admin') {
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

async function setupMocks(context, factors, role = 'admin') {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = makeJwt(ADMIN_ID, 'aal1');
  const iso = new Date().toISOString();
  const userObj = mockUser(factors, role);

  // Register the catch-all FIRST — Playwright matches in reverse registration
  // order, so later (more specific) routes win.
  await context.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  // fetchProfile() uses .single(), which sends
  // `Accept: application/vnd.pgrst.object+json` — PostgREST answers with a bare
  // OBJECT, not a one-element array. Returning an array here makes
  // profileToUser() read .name/.role off the array and yield undefined.
  await context.route('**/rest/v1/profiles**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: ADMIN_ID,
        email: 'admin@test.local',
        name: 'Test Admin',
        phone: '',
        role,
        employee_id: null,
        company_id: null,
        company_code: null,
        assigned_zone_id: null,
        permissions: [],
        membership_tier: null,
        membership_status: 'none',
        partner_application_id: null,
        avatar_url: null,
        created_at: iso,
      }),
    })
  );

  // A partner with no application gets a "No Partnership Application" gate with
  // NO tabs, so the Security tab is unreachable. Give the partner role an
  // approved application so the tabbed portal actually renders.
  if (role === 'partner') {
    await context.route('**/rest/v1/partner_applications**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'pa-test-1',
            user_id: ADMIN_ID,
            company_name: 'Test Partner Co.',
            industry: 'Real Estate',
            contact_person: 'Test Admin',
            position: 'Operations',
            email: 'admin@test.local',
            phone: '',
            website: '',
            address: 'Test address',
            services_required: 'Move-In/Move-Out',
            estimated_volume: '10 units per month',
            proposal: 'Test proposal',
            resume_name: null,
            resume_url: null,
            company_id: null,
            status: 'approved',
            created_at: iso,
          },
        ]),
      })
    );
  }

  await context.route('**/auth/v1/token**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: 'rt-1',
        user: userObj,
      }),
    })
  );

  await context.route('**/auth/v1/user**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(userObj),
    })
  );

  // supabase.auth.signOut() POSTs here (scope=global). This was the ONE auth
  // endpoint the mocks did not cover, so in the harness the request fell through
  // to the REAL network, which the sandbox blocks. supabase-js calls the endpoint
  // BEFORE it removes the local session, so `await signOut()` in every portal
  // blocked on that unmocked call — and `navigate('/login')` ran late. Scenario N
  // then read the URL 2500ms after the confirm click, found itself still on the
  // portal, and reported "logout did not land on /login" when the app had in fact
  // logged out. Mocking it makes the harness deterministic.
  //
  // LOGOUT_HANG makes the endpoint never answer. It used to be the negative
  // control proving N measured a completed logout: signOut() could not resolve,
  // the portal could not navigate, and N failed. It still is a control, but its
  // meaning flipped when the app grew a sign-out deadline — auth-js clears the
  // local session when a request FAILS but not when it never settles, so the app
  // now aborts after 5s, which drives it down that same failure path. Under
  // LOGOUT_HANG the session must therefore STILL be abandoned and the user still
  // returned to /login, and N must PASS. Verified both ways: LOGOUT_HANG=1
  // failed before the deadline existed and passes after, so N measures the
  // recovery rather than the network's cooperation.
  await context.route('**/auth/v1/logout**', (route) => {
    if (process.env.LOGOUT_HANG) return new Promise(() => {});
    return route.fulfill({ status: 204, body: '' });
  });

  // mfa.challenge() and mfa.verify() share a path prefix, so branch on the URL.
  // verify() returns a NEW session whose token is at aal2 — that is what makes
  // the store's re-resolve report "nothing owed" and let the guard open.
  await context.route('**/auth/v1/factors/**', (route) => {
    const url = route.request().url();
    if (url.endsWith('/verify')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: makeJwt(ADMIN_ID, 'aal2'),
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: now + 3600,
          refresh_token: 'rt-1',
          user: userObj,
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'challenge-1',
        type: 'totp',
        expires_at: (now + 300) * 1000,
      }),
    });
  });
}

async function run(browser, { label, factors, role = 'admin', loginPath = '/login', verify = false }) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  await setupMocks(context, factors, role);
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || String(e.message)));

  // Record EVERY history change. Polling page.url() misses a redirect that
  // lands on /portal/* and bounces back within a single frame — which is
  // exactly how the "dashboard flashes before the OTP screen" bug hid.
  const visited = [];
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) visited.push(f.url().replace(BASE, ''));
  });

  await page.goto(`${BASE}${loginPath}`, { waitUntil: 'networkidle' });
  await page.locator('form').getByRole('button', { name: /Sign In/ }).waitFor();

  await page.locator('input[type=email]').fill('admin@test.local');
  await page.locator('input[type=password]').fill('not-a-real-password');
  // Scoped to the <form> on purpose: the tab switcher above it is also
  // labelled "Sign In", and an unscoped match silently targets the wrong one.
  await page.locator('form').getByRole('button', { name: /Sign In/ }).click();

  // Optionally complete the step-up: type a code and submit it. Typing rather
  // than filling each box exercises the real auto-advance handler.
  let verifyAttempted = false;
  if (verify) {
    await page.locator('input[aria-label="MFA digit 1"]').waitFor({ timeout: 8000 });
    await page.locator('input[aria-label="MFA digit 1"]').click();
    await page.keyboard.type('123456');
    // Loose match on purpose: the button renders `Verify <ArrowRight/>`, so its
    // textContent carries the icon's whitespace and /^Verify$/ never matches.
    const verifyBtn = page.locator('button', { hasText: 'Verify' }).first();
    await verifyBtn.click({ timeout: 8000 });
    verifyAttempted = true;
  }

  await page.waitForTimeout(verify ? 4500 : 4000);

  const url = page.url();
  const h1 = await page
    .locator('h1')
    .first()
    .textContent()
    .catch(() => null);
  const otpDigits = await page.locator('input[aria-label^="MFA digit"]').count();
  const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 200);
  const sawPortal = visited.some((u) => u.startsWith('/portal'));

  await context.close();

  return {
    label,
    url: url.replace(BASE, ''),
    h1: (h1 || '').trim(),
    otpDigits,
    verifyAttempted,
    sawPortal,
    visited,
    errors,
    bodyText,
  };
}

// Reload / direct-navigation test: seed a stored aal1 session (as if the admin
// signed in with a password and then hit refresh) and go straight to the
// portal. If the dashboard renders, the second factor is bypassable.
async function runStoredSession(browser, { label, factors, path, role = 'admin', aal = 'aal1', clickSecurity = false, breakUser = false, recoveryMissing = false }) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  await setupMocks(context, factors, role);

  // Simulate the window between deploying the app and pasting migration 011:
  // PostgREST answers 404/PGRST202 for a function that is not in its schema
  // cache. Registered here (before breakUser) so it only affects the recovery
  // status call, not the factor lookup.
  if (recoveryMissing) {
    await context.route('**/rest/v1/rpc/mfa_recovery_status**', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'PGRST202',
          message:
            'Could not find the function public.mfa_recovery_status in the schema cache',
        }),
      })
    );
  }

  // Break the endpoint that listFactors() is built on. Registered LAST so it
  // wins — Playwright matches in reverse registration order. An aal2 stored
  // session still opens the portal without it (the assurance level is decoded
  // from the JWT locally), so only the Security panel feels the failure.
  if (breakUser) {
    await context.route('**/auth/v1/user**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal server error' }),
      })
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const session = {
    access_token: makeJwt(ADMIN_ID, aal),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'rt-1',
    user: mockUser(factors, role),
  };

  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    ['sb-inyqjfgeecairaxbkxuo-auth-token', JSON.stringify(session)]
  );

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || String(e.message)));

  // NOT networkidle: the portal keeps requests in flight, so networkidle never
  // settles and goto times out.
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Open the Security tab and look for the MFA panel specifically. Counting the
  // "Two-factor authentication" <h2> proves the component mounted for this role,
  // rather than merely that the tab exists.
  let mfaPanel = 0;
  let pinPanel = 0;
  let metrics = null;
  let panel = null;
  if (clickSecurity) {
    await page.locator('button', { hasText: 'Security' }).first().click({ timeout: 8000 });
    await page.waitForTimeout(2000);
    mfaPanel = await page.locator('h2', { hasText: /Two-factor authentication/i }).count();
    // PinSettings' own heading; reported for context, not asserted on, since its
    // text changes once a PIN exists.
    pinPanel = await page.locator('h2', { hasText: /Security/i }).count();
    // What the panel CLAIMS about the account's protection. This is the whole
    // point of the check: a panel that cannot read the factor must not answer
    // "Off", because that is a false statement about a security control.
    panel = await page.evaluate(() => {
      const text = document.body.innerText;
      // The PinSettings intro line, which must describe what THIS role's PIN
      // actually gates — not the admin's list of powers.
      const pinH = [...document.querySelectorAll('h2')].find((h) =>
        /Your PIN/i.test(h.textContent || '')
      );
      const pinP = pinH ? pinH.parentElement?.querySelector('p') : null;
      return {
        saysUnknown: /Unknown\. We could not check/.test(text),
        saysOff: /Off\. Your password is the only thing/.test(text),
        saysOn: /On\. A password alone/.test(text),
        hasCheckAgain: /Check again/.test(text),
        hasSetupButton: /Set up two-factor authentication/.test(text),
        // The recovery-codes section. It must vanish entirely when migration 011
        // has not been applied — offering a button that cannot work is the same
        // class of defect as a panel claiming a state it never read.
        hasRecovery: /Recovery codes/.test(text),
        pinCopy: pinP ? pinP.textContent.trim() : null,
      };
    });
    // How far below the fold the panel sits. A panel that exists in the DOM but
    // is never reachable by scrolling would still pass a count assertion, so
    // record the geometry: viewport height, document height, panel offset.
    metrics = await page.evaluate(() => {
      const findTop = (re) => {
        const el = [...document.querySelectorAll('h2')].find((h) => re.test(h.textContent || ''));
        return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null;
      };
      const scroller = document.scrollingElement || document.documentElement;
      return {
        vh: window.innerHeight,
        docH: scroller.scrollHeight,
        mfaTop: findTop(/Two-factor authentication/i),
        pinTop: findTop(/Your PIN/i),
      };
    });
  }

  const url = page.url();
  const h1 = await page
    .locator('h1')
    .first()
    .textContent()
    .catch(() => null);
  const otpDigits = await page.locator('input[aria-label^="MFA digit"]').count();
  const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 300);

  await context.close();
  return {
    label,
    url: url.replace(BASE, ''),
    h1: (h1 || '').trim(),
    otpDigits,
    mfaPanel,
    pinPanel,
    metrics,
    panel,
    sawPortal: false,
    visited: [url.replace(BASE, '')],
    errors,
    consoleErrs: [],
    bodyText,
  };
}

// Log out, then log back in — in the SAME page session.
//
// Every other scenario here starts from a fresh browser context, and that is
// precisely why none of them could see this bug. The store dedupes session
// publishes by user id (`lastResolvedUserId`), and that id is only cleared when
// Supabase emits SIGNED_OUT. A portal whose "Log out" button only dispatches
// local state never emits it, so the id stays cached and the *next* login
// publishes nothing: the password is accepted, the "Welcome back!" toast fires,
// and the user is left on the login screen with no portal and no OTP.
async function runLogoutLogin(browser, { label, factors = [], role = 'cleaner', aal = 'aal1', verify = false, breakUser = false }) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  await setupMocks(context, factors, role);

  // Diagnostic: make /auth/v1/user fail. listFactors() is built on getUser(),
  // so this is what a failing factor lookup looks like from the app's side.
  // Registered LAST so it wins — Playwright matches in reverse order.
  //
  // Count the lookups: this is the only way to OBSERVE that "Try again" actually
  // re-ran the effect in place, instead of inferring it from a sleep.
  let userLookups = 0;
  if (breakUser) {
    await context.route('**/auth/v1/user**', (route) => {
      userLookups += 1;
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal server error' }),
      });
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const session = {
    access_token: makeJwt(ADMIN_ID, aal),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'rt-1',
    user: mockUser(factors, role),
  };
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    ['sb-inyqjfgeecairaxbkxuo-auth-token', JSON.stringify(session)]
  );

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || String(e.message)));
  const visited = [];
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) visited.push(f.url().replace(BASE, ''));
  });

  const portal =
    role === 'cleaner' ? '/portal/cleaner' : role === 'partner' ? '/portal/partner' : '/portal/admin';

  // 1. The stored session should open the portal directly.
  await page.goto(`${BASE}${portal}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  const reachedPortalFirst = page.url().includes('/portal');

  // 2. Log out through the portal's OWN button, and confirm the dialog. The
  //    header button reads "Log out"; the dialog's confirm reads "Log Out", so
  //    scope the second click to the dialog or the header button wins.
  await page.locator('button', { hasText: /^Log out$/i }).first().click({ timeout: 8000 });
  await page.waitForTimeout(700);
  await page
    .locator('[role="dialog"]')
    .getByRole('button', { name: /^Log Out$/i })
    .click({ timeout: 8000 });
  // WAIT for the navigation instead of sleeping a fixed 2500ms and then reading
  // the URL — the exact race that made scenario P flake. A `page.url()` read after
  // a sleep reports "the app did not log out" whenever the app is merely slower
  // than the sleep, which is a harness defect wearing an app bug's face. Bounded,
  // so a real "logout does nothing" regression still fails rather than hanging.
  const logoutStart = Date.now();
  const landedOnLogin = await page
    .waitForURL('**/login**', { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  const logoutMs = Date.now() - logoutStart;
  const atLoginAfterLogout = landedOnLogin && page.url().includes('/login');

  // Read the stored session HERE — immediately after the logout lands and BEFORE
  // the re-sign-in below puts a fresh one back. This is the only moment at which
  // "the session was abandoned" is observable, and it is the assertion that
  // matters when the logout endpoint is black-holed: landing on /login proves
  // only that the app navigated, not that it let go of the session.
  const sessionStoredAfterLogout = await page.evaluate(
    () => !!window.localStorage.getItem('sb-inyqjfgeecairaxbkxuo-auth-token')
  );

  // 3. Sign back in with the same account.
  await page.locator('input[type=email]').waitFor({ timeout: 8000 });
  await page.locator('input[type=email]').fill(`${role}@test.local`);
  await page.locator('input[type=password]').fill('not-a-real-password');
  await page.locator('form').getByRole('button', { name: /Sign In/ }).click();
  await page.waitForTimeout(4500);

  // With a verified factor the fresh sign-in must be HELD at the OTP screen —
  // that is the whole point of the step-up, and it is what the reporter says is
  // missing. Count the inputs before trying to use them.
  let otpDigits = 0;
  if (verify) {
    otpDigits = await page.locator('input[aria-label^="MFA digit"]').count();
    if (otpDigits === 6) {
      await page.locator('input[aria-label="MFA digit 1"]').click();
      await page.keyboard.type('123456');
      await page.locator('button', { hasText: 'Verify' }).first().click({ timeout: 8000 });
      await page.waitForTimeout(4500);
    }
  }

  // The failure path must OFFER a retry, and the retry must re-run the challenge
  // effect in place — no reload, and above all no ejection. Only meaningful when
  // the lookup is broken, since that is the only way to reach the error state.
  let retryShown = 0;
  let retried = false;
  let lookupsBeforeRetry = -1;
  let lookupsAfterRetry = -1;
  if (breakUser) {
    const tryAgain = page.locator('button', { hasText: 'Try again' });
    // WAIT for the panel to paint before counting it. A raw count() after a fixed
    // sleep races the challenge effect: on a slower origin the error state is not
    // up yet, count() returns 0, and the scenario fails for the harness's OWN
    // reasons — a false "the app ejected" that is really "we looked too early".
    // Bounded, so a genuine "no retry is ever offered" regression still fails.
    await tryAgain.first().waitFor({ timeout: 15000 }).catch(() => {});
    retryShown = await tryAgain.count();
    if (retryShown > 0) {
      lookupsBeforeRetry = userLookups;
      // SKIP_RETRY_CLICK is the negative control for the counter assertion, the
      // same way POST_RELOAD_WAIT is for scenario S. With it set the button is
      // never clicked, so the counter cannot move and the scenario MUST fail —
      // which is what proves "the retry re-ran the effect" is measured and not
      // assumed. Verified: SKIP_RETRY_CLICK=1 -> `lookups 2 -> 2`, FAIL.
      if (!process.env.SKIP_RETRY_CLICK) {
        await tryAgain.first().click({ timeout: 8000 });
      }
      // "Try again" must re-run the effect IN PLACE. Poll the request counter
      // rather than trusting a sleep: if the count does not move, the button did
      // nothing, and the assertion below fails instead of passing on a guess.
      const deadline = Date.now() + 15000;
      while (userLookups <= lookupsBeforeRetry && Date.now() < deadline) {
        await page.waitForTimeout(200);
      }
      lookupsAfterRetry = userLookups;
      retried = true;
    }
  }

  // The decisive discriminator between "fail closed" and "eject": supabase-js
  // removes this key inside signOut(). If it is still there, the session was
  // NOT abandoned — which is the whole point of the fix.
  const sessionStored = await page.evaluate(
    () => !!window.localStorage.getItem('sb-inyqjfgeecairaxbkxuo-auth-token')
  );
  const h1 = await page.locator('h1').first().textContent().catch(() => null);
  // Still broken, so a correct retry shows the error again rather than ejecting.
  // Bounded wait for the same reason as above: the panel is re-rendering after the
  // retry, and a raw count() can land in the gap between the two renders.
  const tryAgainAfter = page.locator('button', { hasText: 'Try again' });
  await tryAgainAfter.first().waitFor({ timeout: 15000 }).catch(() => {});
  const stillHeld = await tryAgainAfter.count();

  const url = page.url();
  const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 220);

  await context.close();
  return {
    label,
    url: url.replace(BASE, ''),
    h1: (h1 || '').trim(),
    reachedPortalFirst,
    atLoginAfterLogout,
    logoutMs,
    sessionStoredAfterLogout,
    otpDigits,
    retryShown,
    retried,
    lookupsBeforeRetry,
    lookupsAfterRetry,
    stillHeld,
    sessionStored,
    visited,
    errors,
    bodyText,
  };
}

// Admin write path: does a write that matched ZERO rows still get reported as a
// success? The REST mock answers every PATCH with `[]`, which is exactly what
// PostgREST returns for a write that matched nothing — it has no affected-row
// count, so without a RETURNING clause an RLS-blocked write is indistinguishable
// from a successful one. The UI must not mirror the change locally or claim it
// worked.
async function runAdminWrite(browser, { label }) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  await setupMocks(context, [verifiedFactor()], 'admin');

  const APP_ID = '33333333-3333-3333-3333-333333333333';
  const PROGRAM_ID = '44444444-4444-4444-4444-444444444444';
  const iso = new Date().toISOString();

  // One ACCEPTED application, so the "Mark Completed" action renders at all.
  // Registered after the catch-all so it wins (reverse match order), and it
  // branches on method: GET returns the row, PATCH returns [] (zero rows).
  await context.route('**/rest/v1/training_applications**', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: APP_ID,
              program_id: PROGRAM_ID,
              user_id: null,
              name: 'Write Path Probe',
              email: 'probe@test.local',
              phone: '',
              experience: 'Test',
              resume_name: null,
              resume_url: null,
              status: 'accepted',
              created_at: iso,
            },
          ]),
        })
      : route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  await context.route('**/rest/v1/training_programs**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: PROGRAM_ID, name: 'Probe Program', duration: '1 week', description: '', created_at: iso },
      ]),
    })
  );

  // aal2 so the portal opens without a step-up; this scenario is about writes.
  const now = Math.floor(Date.now() / 1000);
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [
      'sb-inyqjfgeecairaxbkxuo-auth-token',
      JSON.stringify({
        access_token: makeJwt(ADMIN_ID, 'aal2'),
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: 'rt-1',
        user: mockUser([verifiedFactor()], 'admin'),
      }),
    ]
  );

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || String(e.message)));

  await page.goto(`${BASE}/portal/admin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  await page.locator('button', { hasText: 'Training' }).first().click({ timeout: 8000 });
  await page.waitForTimeout(1500);

  const completeBtn = page.locator('button', { hasText: 'Mark Completed' }).first();
  const actionAvailable = await completeBtn.count();
  if (actionAvailable) {
    await completeBtn.click({ timeout: 8000 });
    await page.waitForTimeout(700);
    await page
      .locator('[role="dialog"]')
      .getByRole('button', { name: /^Complete$/i })
      .click({ timeout: 8000 });
    await page.waitForTimeout(2500);
  }

  // Read the status badge off the card itself — a whole-page regex cannot tell
  // the badge apart from the "Mark Completed" button text or the toast.
  const badge = await page.evaluate(() => {
    const h = [...document.querySelectorAll('h3')].find((x) =>
      /Write Path Probe/.test(x.textContent || '')
    );
    const card = h ? h.closest('div.bg-navy-800') : null;
    const span = card ? card.querySelector('span.rounded-full') : null;
    return span ? span.textContent.trim() : null;
  });

  // The toast container is the LAST thing in the DOM, so slicing the whole page
  // text cuts it off. Read it directly instead.
  const toastText = await page
    .locator('div.fixed.top-4.right-4')
    .innerText()
    .catch(() => '');
  const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 300);
  await context.close();

  return {
    label,
    actionAvailable,
    badge,
    toastText,
    errorToast: /Could Not Update Training Record/.test(toastText),
    successToast: /Training Completed!/.test(toastText),
    errors,
    bodyText,
  };
}

// Is the "pendingMfa is not persisted" claim real?  ->  NO. This scenario
// exists to disprove it, and to keep it disproven.
//
// The claim (mine, in the Oct 6 audit, filed as P0 #3): the challenge id lives
// only in the store, so a reload during "Preparing…" loses it and — with no
// retry — the OTP screen can never appear.
//
// The counter-theory: a reload remounts Login, the challenge effect re-runs from
// scratch, and it simply issues a NEW challenge. Measured: the OTP screen comes
// back (6 inputs). The claim was wrong and has been RETRACTED.
//
// So this is not a bug test — it is a REGRESSION GUARD on an invariant that was
// never broken: "a reload during preparation must not strand the user."
// Do not delete it because "it already passes"; that is exactly its job.
//
// To make the check honest, hold the challenge request open so the "Preparing…"
// window is wide enough to reload inside, then reload and count the OTP inputs.
// The negative control (POST_RELOAD_WAIT shorter than the challenge delay) must
// FAIL — otherwise the assertion is passing for free.
async function runReloadDuringPrepare(browser, { label }) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  await setupMocks(context, [verifiedFactor()], 'cleaner');

  // Registered after the shared factors route so it wins (reverse match order).
  await context.route('**/auth/v1/factors/**', async (route) => {
    if (route.request().url().endsWith('/challenge')) {
      await new Promise((r) => setTimeout(r, 6000));
    }
    const now = Math.floor(Date.now() / 1000);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'challenge-1', type: 'totp', expires_at: (now + 300) * 1000 }),
    });
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || String(e.message)));

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('form').getByRole('button', { name: /Sign In/ }).waitFor();
  await page.locator('input[type=email]').fill('cleaner@test.local');
  await page.locator('input[type=password]').fill('not-a-real-password');
  await page.locator('form').getByRole('button', { name: /Sign In/ }).click();

  // We must actually land inside the window, or the test proves nothing.
  const preparing = page.getByText('Preparing your authenticator challenge');
  const sawPreparing = await preparing
    .waitFor({ timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  const otpBeforeReload = await page.locator('input[aria-label^="MFA digit"]').count();

  // The reload under test.
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Long enough for the (still delayed) challenge to come back after remount.
  // POST_RELOAD_WAIT is the negative control: set it shorter than the 6s
  // challenge delay and the OTP inputs cannot have arrived yet, so the
  // assertion must FAIL. That proves the check is sensitive to the challenge
  // actually being re-issued rather than passing for free.
  const postReloadWait = Number(process.env.POST_RELOAD_WAIT || 10000);
  await page.waitForTimeout(postReloadWait);

  const url = page.url();
  const otpAfterReload = await page.locator('input[aria-label^="MFA digit"]').count();
  const h1 = await page.locator('h1').first().textContent().catch(() => null);
  const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 200);

  await context.close();
  return {
    label,
    sawPreparing,
    otpBeforeReload,
    otpAfterReload,
    url: url.replace(BASE, ''),
    h1: (h1 || '').trim(),
    errors,
    bodyText,
  };
}

// ── T: the way out of the lockout ────────────────────────────────────────────
//
// P0 #1 in one screen. The password was accepted, the session is aal1, and the
// 6-digit code can never be produced because the phone is gone. Until now that
// was terminal: the guard holds the user at /login, and the Security tab that
// would let them turn the factor off is behind that same guard.
//
// The recovery code is NOT a login credential — redeeming it removes the second
// factor and returns no session. So the assertions are about exactly that:
//
//   success -> the factor is gone, the aal1 session is ABANDONED (not waved
//              through), and the user is back on the sign-in form. The password
//              is still owed, which is the whole security model.
//   failure -> nothing changes. Still on the recovery screen, session intact,
//              and an error is shown rather than a silent nothing.
//
// RECOVERY_FAIL=1 is the negative control, the same way SKIP_RETRY_CLICK and
// POST_RELOAD_WAIT are for P and S: with it the mock refuses the code, so the
// success assertions CANNOT hold. A scenario that passes in both directions is
// measuring nothing.
//
// `calls` and `sentCode` are the request-level evidence — the analogue of the
// /auth/v1/user counter in P. They prove the button did something and that the
// code reached the wire in normalised form, instead of inferring either from a
// sleep.
//
// `fail` and `expectFail` are deliberately SEPARATE. `fail` is what the mock
// does; `expectFail` is what the scenario claims should happen. Conflating them
// is not a style question: it means the RECOVERY_FAIL control flips the mock
// AND the assertion together, so the run passes in both directions and the
// control proves nothing. That is exactly what happened on the first attempt.
async function runRecoveryRedeem(browser, { label, fail = false, expectFail = fail }) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  await setupMocks(context, [verifiedFactor()], 'cleaner');

  let calls = 0;
  let sentCode = null;
  await context.route('**/functions/v1/redeem-recovery-code**', async (route) => {
    calls += 1;
    try {
      sentCode = JSON.parse(route.request().postData() || '{}').code ?? null;
    } catch {
      sentCode = null;
    }
    if (fail) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'That email and recovery code did not match. Check both and try again.',
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  // Seeded at aal1 WITH a verified factor: the state of someone who just typed
  // their password and is about to discover the problem.
  const now = Math.floor(Date.now() / 1000);
  const session = {
    access_token: makeJwt(ADMIN_ID, 'aal1'),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'rt-1',
    user: mockUser([verifiedFactor()], 'cleaner'),
  };
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    ['sb-inyqjfgeecairaxbkxuo-auth-token', JSON.stringify(session)]
  );

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || String(e.message)));

  await page.goto(`${BASE}/portal/cleaner`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Must actually be held at the OTP screen, or the rest of this measures
  // nothing. Count before trying to use it.
  const heldAtOtp =
    (await page.locator('input[aria-label^="MFA digit"]').count()) === 6;

  // Open the escape hatch.
  const link = page.locator('button', { hasText: 'Lost your phone?' });
  await link.first().waitFor({ timeout: 8000 }).catch(() => {});
  const linkShown = await link.count();
  if (linkShown > 0) await link.first().click({ timeout: 8000 });

  const codeInput = page.locator('input[aria-label="Recovery code"]');
  await codeInput.waitFor({ timeout: 8000 }).catch(() => {});
  const recoveryShown = await codeInput.count();

  // Optional evidence capture: SHOT=<path> saves the escape hatch exactly as it is
  // presented, before anything is typed into it. Reusing this scenario's mocks
  // rather than duplicating them keeps the picture from drifting away from the test.
  if (process.env.SHOT && recoveryShown > 0) {
    await page.screenshot({ path: process.env.SHOT });
  }

  if (recoveryShown > 0) {
    // Deliberately written with the characters the alphabet excludes: O, I and
    // L must fold to 0, 1 and 1, and the hyphen must be dropped. If either the
    // fold or the strip is missing, `sentCode` will not be '0112345678' and the
    // scenario fails — a hand-copied code that would otherwise be rejected.
    await codeInput.fill('OIL2-345678');
    await page.locator('button', { hasText: 'Use this code' }).first().click({ timeout: 8000 });
    await page.waitForTimeout(3500);
  }

  const url = page.url();
  const h1 = (await page.locator('h1').first().textContent().catch(() => '')) || '';
  const successShown = await page.getByText(/authenticator has been removed/i).count();
  const errorShown = await page.getByText(/did not match/i).count();

  // The same discriminator scenario P uses: supabase-js removes this key inside
  // signOut(). Present = the aal1 session was NOT abandoned.
  const sessionStored = await page.evaluate(
    () => !!window.localStorage.getItem('sb-inyqjfgeecairaxbkxuo-auth-token')
  );

  await context.close();
  return {
    label,
    expectFail,
    url: url.replace(BASE, ''),
    h1: h1.trim(),
    heldAtOtp,
    linkShown,
    recoveryShown,
    calls,
    sentCode,
    successShown,
    errorShown,
    sessionStored,
    errors,
  };
}

/**
 * Turning the second factor OFF. This had NO scenario until now, so the fact
 * that one click removed it — with no re-authentication at all — was invisible
 * to every run in this file.
 *
 * The observable is a REQUEST COUNT, not a rendered string. "The gate held" and
 * "the gate did nothing" look identical on screen; only the wire tells them
 * apart. `deletes` counts the actual `DELETE /auth/v1/factors/{id}` that
 * `unenrollMfa()` issues, so each assertion is about what reached the server.
 *
 * The three steps are ordered by how much they prove:
 *   1. no code typed  -> button inert, ZERO deletes even when force-clicked
 *   2. wrong code     -> refused, error shown, still ZERO deletes
 *   3. right code     -> exactly ONE delete, and the panel says Off
 *
 * NEGATIVE CONTROL: revert the component (`git stash push src/components/
 * MfaSettings.tsx`), rebuild, re-run — step 1 MUST fail, because the pre-fix
 * button was enabled with an empty code and the force-click would land. A
 * scenario that passes against both the old and the new component measures
 * nothing, and this one would have.
 */
async function runDisableMfa(browser, { label }) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  await setupMocks(context, [verifiedFactor()], 'admin');

  const VALID = '123456';
  const now = Math.floor(Date.now() / 1000);
  const deletes = [];
  let factorGone = false;

  // Registered AFTER setupMocks, so it wins — Playwright runs the most recently
  // registered matching handler first. Every branch is handled explicitly rather
  // than delegating, so this scenario does not depend on fallback semantics.
  await context.route('**/auth/v1/factors/**', (route) => {
    const req = route.request();
    const url = req.url();

    if (req.method() === 'DELETE') {
      deletes.push(url);
      factorGone = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }

    if (url.endsWith('/verify')) {
      let code = '';
      try {
        code = JSON.parse(req.postData() || '{}').code || '';
      } catch {
        /* not JSON — treated as a wrong code, which is the safe reading */
      }
      if (code !== VALID) {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error_code: 'mfa_verification_failed',
            message: 'Invalid TOTP code',
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: makeJwt(ADMIN_ID, 'aal2'),
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: now + 3600,
          refresh_token: 'rt-1',
          user: mockUser([verifiedFactor()], 'admin'),
        }),
      });
    }

    // challenge
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'challenge-1', type: 'totp', expires_at: (now + 300) * 1000 }),
    });
  });

  // After the DELETE the factor must stop being listed, or the component's own
  // read-back would correctly say "still on" and show an error — the assertion
  // would then be measuring the mock, not the app.
  await context.route('**/auth/v1/user**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        factorGone ? mockUser([], 'admin') : mockUser([verifiedFactor()], 'admin')
      ),
    })
  );

  const session = {
    access_token: makeJwt(ADMIN_ID, 'aal2'),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'rt-1',
    user: mockUser([verifiedFactor()], 'admin'),
  };
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    ['sb-inyqjfgeecairaxbkxuo-auth-token', JSON.stringify(session)]
  );

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || String(e.message)));

  await page.goto(`${BASE}/portal/admin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  await page.locator('button', { hasText: 'Security' }).first().click({ timeout: 8000 });
  await page.waitForTimeout(2000);

  const offLink = page.locator('button', { hasText: 'Turn off two-factor authentication' });
  await offLink.first().waitFor({ timeout: 8000 }).catch(() => {});
  const offLinkShown = await offLink.count();
  if (offLinkShown > 0) await offLink.first().click({ timeout: 8000 });
  await page.waitForTimeout(400);

  const codeInput = page.locator('input[aria-label="Confirmation code"]');
  await codeInput.waitFor({ timeout: 8000 }).catch(() => {});
  const codeInputShown = await codeInput.count();
  const confirmBtn = page.locator('button', { hasText: 'Yes, turn it off' });

  // Same evidence hook as scenario T: SHOT=<path> captures the confirm box as
  // actually presented, from this scenario's own mocks rather than a throwaway
  // script that could drift away from the test.
  if (process.env.SHOT && codeInputShown > 0) {
    await page.screenshot({ path: process.env.SHOT });
  }

  // ── 1. Nothing typed: the button must be inert ──────────────────────────────
  const disabledBeforeCode = codeInputShown > 0 ? await confirmBtn.first().isDisabled() : null;
  const deletesBeforeCode = deletes.length;
  // `await` matters: count() returns a Promise, and `Promise > 0` is always
  // false — which would silently skip the force-click and make the assertion
  // below pass for the wrong reason.
  const confirmBtnCount = await confirmBtn.count();
  if (confirmBtnCount > 0) {
    // Force-click past the disabled attribute. If the gate is missing the click
    // lands and a DELETE goes out; if it is present nothing happens either way.
    await confirmBtn.first().click({ force: true, timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(900);
  }
  const deletesAfterForcedClick = deletes.length;

  // ── 2. A wrong code must change nothing ────────────────────────────────────
  let wrongCodeError = 0;
  if (codeInputShown > 0) {
    await codeInput.fill('000000');
    await confirmBtn.first().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1800);
    wrongCodeError = await page.getByText(/not accepted/i).count();
  }
  const deletesAfterWrongCode = deletes.length;

  // ── 3. The right code removes it ───────────────────────────────────────────
  let successShown = 0;
  if (codeInputShown > 0) {
    await codeInput.fill(VALID);
    await confirmBtn.first().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2500);
    successShown = await page.getByText(/Two-factor authentication is off/i).count();
  }
  const deletesAfterValidCode = deletes.length;

  const url = page.url();
  await context.close();
  return {
    label,
    url: url.replace(BASE, ''),
    offLinkShown,
    codeInputShown,
    disabledBeforeCode,
    deletesBeforeCode,
    deletesAfterForcedClick,
    wrongCodeError,
    deletesAfterWrongCode,
    deletesAfterValidCode,
    successShown,
    errors,
  };
}

(async () => {
  const browser = await chromium.launch();
  const results = [];

  const scenarios = [
    { id: 'A', fn: () => run(browser, { label: 'A with-factor (login, totp enrolled)', factors: [verifiedFactor()] }) },
    { id: 'B', fn: () => run(browser, { label: 'B without-factor (login, no enrollment)', factors: [] }) },
    {
      id: 'C',
      fn: () =>
        runStoredSession(browser, {
          label: 'C stored-session reload -> /portal/admin (totp enrolled)',
          factors: [verifiedFactor()],
          path: '/portal/admin',
        }),
    },
    // Regression guard: Login no longer navigates itself, LoginRoute does.
    // Customers must still reach home, and must still honour ?redirect=.
    { id: 'D', fn: () => run(browser, { label: 'D customer login (no factors)', factors: [], role: 'customer' }) },
    {
      id: 'E',
      fn: () =>
        run(browser, {
          label: 'E customer login with ?redirect=/book',
          factors: [],
          role: 'customer',
          loginPath: '/login?redirect=/book',
        }),
    },
    // F/G/H complete the OTP step and check the post-verify DESTINATION.
    // This is the role-routing regression: confirmMfa used to hardcode
    // '/portal/admin', so a cleaner or partner was bounced to '/' by
    // ProtectedRoute's role check and could never finish their step-up.
    {
      id: 'F',
      fn: () =>
        run(browser, {
          label: 'F cleaner verifies OTP -> /portal/cleaner',
          factors: [verifiedFactor()],
          role: 'cleaner',
          verify: true,
        }),
    },
    {
      id: 'G',
      fn: () =>
        run(browser, {
          label: 'G partner verifies OTP -> /portal/partner',
          factors: [verifiedFactor()],
          role: 'partner',
          verify: true,
        }),
    },
    {
      id: 'H',
      fn: () =>
        run(browser, {
          label: 'H admin verifies OTP -> /portal/admin',
          factors: [verifiedFactor()],
          role: 'admin',
          verify: true,
        }),
    },
    // I/J/K — the Security tab must actually render the MFA panel for every
    // staff role, not just admin. Uses an aal2 stored session so the portal is
    // reachable, then opens Security and counts the panel heading.
    {
      id: 'I',
      fn: () =>
        runStoredSession(browser, {
          label: 'I cleaner Security tab renders MFA panel',
          factors: [verifiedFactor()],
          role: 'cleaner',
          aal: 'aal2',
          path: '/portal/cleaner',
          clickSecurity: true,
        }),
    },
    {
      id: 'J',
      fn: () =>
        runStoredSession(browser, {
          label: 'J partner Security tab renders MFA panel',
          factors: [verifiedFactor()],
          role: 'partner',
          aal: 'aal2',
          path: '/portal/partner',
          clickSecurity: true,
        }),
    },
    {
      id: 'K',
      fn: () =>
        runStoredSession(browser, {
          label: 'K admin Security tab renders MFA panel',
          factors: [verifiedFactor()],
          role: 'admin',
          aal: 'aal2',
          path: '/portal/admin',
          clickSecurity: true,
        }),
    },
    // L: the coverage gap that hid the local-only logout. Nothing else here
    // performs a logout, so a stale dedupe id was invisible to every run.
    {
      id: 'L',
      fn: () =>
        runLogoutLogin(browser, {
          label: 'L cleaner logout then login -> /portal/cleaner',
          factors: [],
          role: 'cleaner',
        }),
    },
    // M: same loop for the partner portal. Each portal has its OWN logout
    // handler, so fixing one file proves nothing about the others.
    {
      id: 'M',
      fn: () =>
        runLogoutLogin(browser, {
          label: 'M partner logout then login -> /portal/partner',
          factors: [],
          role: 'partner',
        }),
    },
    // N/O: the reporter's exact sequence — sign in, ENROL a factor, log out,
    // then sign in again. L and M pass with no factor enrolled, which is why
    // they did not see this. Seeded at aal2 so step 1 still opens the portal
    // (that is the state a just-enrolled session is in).
    {
      id: 'N',
      fn: () =>
        runLogoutLogin(browser, {
          label: 'N partner enrolled logout then login -> OTP then /portal/partner',
          factors: [verifiedFactor()],
          role: 'partner',
          aal: 'aal2',
          verify: true,
        }),
    },
    {
      id: 'O',
      fn: () =>
        runLogoutLogin(browser, {
          label: 'O cleaner enrolled logout then login -> OTP then /portal/cleaner',
          factors: [verifiedFactor()],
          role: 'cleaner',
          aal: 'aal2',
          verify: true,
        }),
    },
    // P: sensitivity test for the fail-closed path. If the factor lookup itself
    // fails, resolveStepUp fails CLOSED (mfaRequired = true) — correct, the gate
    // must not open. What must NOT happen is the session being ejected for it.
    // Before the fix Login answered a failed lookup with signOut(), which turned
    // one transient blip into an unrecoverable loop. After it, the aal1 session
    // survives, the user stays held at /login, and a retry is offered.
    {
      id: 'P',
      fn: () =>
        runLogoutLogin(browser, {
          label: 'P partner enrolled, /auth/v1/user broken -> held, not ejected',
          factors: [verifiedFactor()],
          role: 'partner',
          aal: 'aal2',
          breakUser: true,
        }),
    },
    // Q: the panel must never assert a security state it did not observe.
    // `refresh()` reads the factor through `getUser()`, so a failed read used to
    // set factorId to null and render "Off" — a false negative that makes a
    // working enrollment look like it never happened. With the read broken, the
    // panel must say Unknown and offer a re-check, NOT invite a fresh setup.
    {
      id: 'Q',
      fn: () =>
        runStoredSession(browser, {
          label: 'Q cleaner Security tab, factor lookup broken -> Unknown, not Off',
          factors: [verifiedFactor()],
          role: 'cleaner',
          aal: 'aal2',
          path: '/portal/cleaner',
          clickSecurity: true,
          breakUser: true,
        }),
    },
    // R: a write that matched no rows must not be reported as a success.
    // PostgREST has no affected-row count, so an RLS-blocked UPDATE comes back
    // as `[]` with no error unless the helper asks for a RETURNING clause. Before
    // the fix the admin handler dispatched the new status and fired
    // "Training Completed!" anyway — the badge flipped, and the row went back to
    // `accepted` on the next reload.
    { id: 'R', fn: () => runAdminWrite(browser, { label: 'R admin write matching 0 rows -> not reported as success' }) },
    // S: is the "pendingMfa is not persisted" claim real, or a false alarm?
    // Measured: false alarm — a reload remounts Login, the effect runs again from
    // scratch and issues a NEW challenge, so the OTP screen returns. The audit
    // item is retracted; this scenario stays as the regression guard.
    {
      id: 'S',
      fn: () =>
        runReloadDuringPrepare(browser, {
          label: 'S reload during "Preparing..." -> does the OTP screen recover?',
        }),
    },
    // T: the way out of the lockout — and its negative control.
    //
    // T runs twice on purpose. The first is the real flow: a valid recovery code
    // removes the second factor, and the aal1 session is then ABANDONED rather
    // than waved into the portal — password + code, in that order, is the model.
    // The second refuses the code, so the success assertions cannot hold. A test
    // that passes in both directions measures nothing, which is why this pair
    // ships together.
    {
      id: 'T',
      fn: () =>
        runRecoveryRedeem(browser, {
          label: 'T recovery code accepted -> factor removed, session abandoned',
          // SENSITIVITY CONTROL, the same shape as SKIP_RETRY_CLICK (P) and
          // POST_RELOAD_WAIT (S). With RECOVERY_FAIL=1 the mock refuses the code
          // while `expectFail` stays false, so the success assertions below
          // cannot hold and T itself must FAIL.
          // Verified: RECOVERY_FAIL=1 -> `session still stored true`, FAIL.
          fail: !!process.env.RECOVERY_FAIL,
          expectFail: false,
        }),
    },
    {
      id: 'T-',
      fn: () =>
        runRecoveryRedeem(browser, {
          label: 'T- control: recovery code refused -> nothing changes',
          fail: true,
          expectFail: true,
        }),
    },
    // U: the deploy window. The app ships before migration 011 is pasted, so for
    // a while the recovery-code functions do not exist. The panel must behave as
    // if the feature is absent — NOT render a button that errors, and above all
    // NOT let the missing function change what it says about the factor itself.
    // PostgREST answers 404/PGRST202 in that window, which is how the client
    // tells "not deployed" apart from "could not reach the server".
    {
      id: 'U',
      fn: () =>
        runStoredSession(browser, {
          label: 'U cleaner Security tab, migration 011 not applied -> no recovery UI, factor still On',
          factors: [verifiedFactor()],
          role: 'cleaner',
          aal: 'aal2',
          path: '/portal/cleaner',
          clickSecurity: true,
          recoveryMissing: true,
        }),
    },
    // V: turning the second factor OFF. Until this existed, nothing in this file
    // ever pressed that button — so the fact that it worked with no
    // re-authentication, one click from an unlocked screen, was untested.
    {
      id: 'V',
      fn: () => runDisableMfa(browser, { label: 'V disable MFA requires a code before it removes the factor' }),
    },
  ];

  // Optional filter so a single scenario can be debugged without a 2-minute run:
  //   node run.js http://localhost:4173 F,G
  const only = process.argv[3] ? process.argv[3].split(',') : null;

  for (const s of scenarios) {
    if (only && !only.includes(s.id)) continue;
    try {
      results.push(await s.fn());
    } catch (e) {
      results.push({
        label: s.id,
        url: '?',
        h1: '',
        otpDigits: -1,
        sawPortal: null,
        errors: [e && e.stack ? e.stack : String(e)],
        bodyText: '',
      });
    }
  }

  await browser.close();

  let pass = true;
  const failed = [];
  for (const r of results) {
    const isOtp = r.otpDigits === 6 && /Two-Factor/i.test(r.h1);
    let ok;
    let expectation;

    if (r.label.startsWith('A')) {
      expectation = 'OTP screen at /login, portal never painted';
      ok = isOtp && r.url.startsWith('/login') && r.sawPortal === false;
    } else if (r.label.startsWith('B')) {
      expectation = 'no OTP, landed on /portal/admin';
      ok = !isOtp && r.url.startsWith('/portal/admin');
    } else if (r.label.startsWith('C')) {
      expectation = 'held at /login with OTP, dashboard NOT rendered';
      ok = isOtp && !r.url.startsWith('/portal/admin');
    } else if (r.label.startsWith('D')) {
      expectation = 'customer lands on / (home), no OTP';
      ok = !isOtp && r.url === '/';
    } else if (r.label.startsWith('E')) {
      expectation = 'customer honours ?redirect=/book';
      ok = !isOtp && r.url.startsWith('/book');
    } else if (r.label.startsWith('F')) {
      expectation = 'cleaner verifies OTP, lands on /portal/cleaner';
      ok = r.url.startsWith('/portal/cleaner');
    } else if (r.label.startsWith('G')) {
      expectation = 'partner verifies OTP, lands on /portal/partner';
      ok = r.url.startsWith('/portal/partner');
    } else if (r.label.startsWith('H')) {
      expectation = 'admin verifies OTP, lands on /portal/admin';
      ok = r.url.startsWith('/portal/admin');
    } else if (/^[LMNO] /.test(r.label)) {
      const enrolled = r.label.startsWith('N') || r.label.startsWith('O');
      const want = r.label.startsWith('M') || r.label.startsWith('N') ? '/portal/partner' : '/portal/cleaner';
      expectation = enrolled
        ? `logout works, then the fresh sign-in is held at the OTP screen and lands in ${want}`
        : `logout works, then the same account logs back into ${want}`;
      ok =
        r.reachedPortalFirst === true &&
        r.atLoginAfterLogout === true &&
        // The session must actually be GONE at that moment, not merely navigated
        // away from. This is what fails if the sign-out deadline is ever removed:
        // the app would sit on the portal with the session still stored.
        r.sessionStoredAfterLogout === false &&
        (enrolled ? r.otpDigits === 6 : true) &&
        r.url.startsWith(want);
    } else if (r.label.startsWith('P')) {
      // Fail CLOSED for admission, never by ejecting the session.
      //   - held at /login, no portal, no OTP inputs (the gate still refuses)
      //   - the OTP panel is up with the error, and a retry is offered
      //   - the retry re-runs in place (still broken -> error shown again)
      //   - the stored session SURVIVES (supabase-js would have removed it in signOut)
      expectation =
        'a failing factor lookup does NOT eject: held at /login, retry offered, session intact';
      ok =
        r.reachedPortalFirst === true &&
        r.atLoginAfterLogout === true &&
        r.url.startsWith('/login') &&
        r.otpDigits === 0 &&
        /Two-Factor/i.test(r.h1) &&
        r.retryShown > 0 &&
        r.retried === true &&
        // The retry must actually RE-RUN the effect, not merely exist. Observed as
        // a second /auth/v1/user request — not inferred from a sleep.
        r.lookupsAfterRetry > r.lookupsBeforeRetry &&
        r.stillHeld > 0 &&
        r.sessionStored === true;
    } else if (r.label.startsWith('Q')) {
      // The panel may only report what it actually read. With the lookup broken
      // it must say Unknown and offer a re-check — and must NOT say Off, and must
      // NOT offer a fresh setup (that would have the user enroll a second factor
      // because we failed to read the first).
      expectation =
        'a failed factor lookup reports Unknown (never a false "Off"), with a re-check';
      ok =
        r.mfaPanel === 1 &&
        r.panel?.saysUnknown === true &&
        r.panel?.saysOff === false &&
        r.panel?.hasCheckAgain === true &&
        r.panel?.hasSetupButton === false;
    } else if (r.label.startsWith('R')) {
      // The write matched nothing, so nothing may change and nothing may claim
      // success: the badge stays `accepted`, an error is shown, and no success
      // toast fires.
      expectation =
        'a zero-row write leaves the record untouched and reports the failure';
      ok =
        r.actionAvailable > 0 &&
        String(r.badge).toLowerCase() === 'accepted' &&
        r.errorToast === true &&
        r.successToast === false;
    } else if (/^[IJK] /.test(r.label)) {
      const role = r.label.startsWith('I') ? 'cleaner' : r.label.startsWith('J') ? 'partner' : 'admin';
      const pin = r.panel?.pinCopy || '';
      // The PIN copy must describe what THIS role's PIN actually gates. A cleaner
      // reading about "approving partners, changing roles" is being told about
      // access they do not have — and a warning aimed at someone else is one the
      // user learns to click past.
      const copyOk =
        role === 'admin'
          ? /approving partners, changing roles/.test(pin)
          : role === 'cleaner'
            ? /marking a job as completed/i.test(pin) && !/approving partners/.test(pin)
            : /Nothing in the partner portal is protected by a PIN/i.test(pin) &&
              !/approving partners/.test(pin);
      // MFA is the account-level control; the PIN only guards individual actions.
      // The bigger one must not sit below the smaller one.
      const orderOk =
        r.metrics?.mfaTop != null && r.metrics?.pinTop != null && r.metrics.mfaTop < r.metrics.pinTop;
      expectation = `${role}: MFA panel present, ABOVE the PIN panel, and the PIN copy matches what this role's PIN gates`;
      ok = r.mfaPanel === 1 && orderOk && copyOk;
    } else if (r.label.startsWith('S')) {
      // RETRACTION GUARD (see the note above runReloadDuringPrepare). This is not
      // a fix — it pins an invariant: a reload while the challenge is in flight
      // must not strand the user. The claim that it DID was mine, and it was
      // wrong; the check stays so it can never quietly become true.
      expectation =
        'a reload during "Preparing..." re-issues the challenge and the OTP screen comes back';
      ok =
        r.sawPreparing === true &&
        r.otpBeforeReload === 0 &&
        r.otpAfterReload === 6 &&
        r.url.startsWith('/login');
    } else if (r.label.startsWith('T')) {
      // Both directions of the recovery flow. `heldAtOtp` guards the premise:
      // if the app was not actually stuck at the step-up, the rest of the
      // scenario is measuring an unrelated screen.
      //
      // `calls === 1 && sentCode === '0112345678'` is the request-level proof
      // that the submit worked AND that normalisation ran before the wire: the
      // input was 'OIL2-345678', so the hyphen was dropped and O/I/L folded to
      // 0/1/1. Without the fold, a hand-copied code is rejected.
      const codeOk = r.calls === 1 && r.sentCode === '0112345678';
      const premise = r.heldAtOtp === true && r.linkShown > 0 && r.recoveryShown > 0;
      if (r.expectFail) {
        expectation =
          'a refused recovery code changes nothing: still on the recovery screen, session intact';
        ok =
          premise &&
          codeOk &&
          r.errorShown > 0 &&
          r.successShown === 0 &&
          r.sessionStored === true &&
          /Two-Factor/i.test(r.h1);
      } else {
        expectation =
          'an accepted recovery code removes the factor, ABANDONS the aal1 session, and returns to sign-in';
        ok =
          premise &&
          codeOk &&
          r.successShown > 0 &&
          r.errorShown === 0 &&
          r.sessionStored === false &&
          r.url.startsWith('/login') &&
          /Welcome back/i.test(r.h1);
      }
    } else if (r.label.startsWith('U')) {
      // The feature is absent, and the panel must say nothing about it — while
      // still reporting the factor truthfully. A missing optional feature must
      // not corrupt the answer to the question the panel exists to answer.
      expectation =
        'with migration 011 absent: no recovery UI at all, and the factor still reports On';
      ok =
        r.mfaPanel === 1 &&
        r.panel?.saysOn === true &&
        r.panel?.hasRecovery === false;
    } else if (r.label.startsWith('V')) {
      // The premise matters as much as the assertions: if the panel never
      // rendered the off-link or the code field, the rest is measuring an
      // unrelated screen and would "pass" vacuously on an empty DOM.
      expectation =
        'the disable button is inert without a code, a wrong code is refused, and only a correct code issues the DELETE';
      const premise = r.offLinkShown > 0 && r.codeInputShown > 0;
      ok =
        premise &&
        r.disabledBeforeCode === true &&
        r.deletesBeforeCode === 0 &&
        r.deletesAfterForcedClick === 0 &&
        r.wrongCodeError > 0 &&
        r.deletesAfterWrongCode === 0 &&
        r.deletesAfterValidCode === 1 &&
        r.successShown > 0;
    } else {
      expectation = 'Security tab renders the MFA panel for this role';
      ok = r.mfaPanel === 1;
    }
    if (!ok) {
      pass = false;
      failed.push(r.label.split(/\s+/)[0]);
    }

    console.log('--------------------------------------------------');
    console.log(`scenario : ${r.label}`);
    console.log(`expected : ${expectation}`);
    console.log(`final url: ${r.url}`);
    console.log(`h1       : ${r.h1}`);
    if (r.otpDigits !== undefined) console.log(`otp digits: ${r.otpDigits}`);
    if (r.mfaPanel !== undefined) console.log(`mfa panels: ${r.mfaPanel}   pin panels: ${r.pinPanel}`);
    if (/^[LMNO] /.test(r.label)) {
      console.log(
        `logout   : opened portal ${r.reachedPortalFirst}, landed on /login after logout ${r.atLoginAfterLogout} (${r.logoutMs}ms), otp digits after re-login ${r.otpDigits}`
      );
    }
    if (r.label.startsWith('P')) {
      console.log(
        `fail-close: retry offered ${r.retryShown > 0}, retry clicked ${r.retried}, /auth/v1/user lookups ${r.lookupsBeforeRetry} -> ${r.lookupsAfterRetry}, still held after retry ${r.stillHeld > 0}, session still stored ${r.sessionStored}`
      );
    }
    if (r.label.startsWith('Q') && r.panel) {
      console.log(
        `panel says: unknown ${r.panel.saysUnknown}, off ${r.panel.saysOff}, on ${r.panel.saysOn}, re-check offered ${r.panel.hasCheckAgain}, setup offered ${r.panel.hasSetupButton}`
      );
    }
    if (r.label.startsWith('U') && r.panel) {
      console.log(
        `deploy gap: factor says On ${r.panel.saysOn}, recovery section rendered ${r.panel.hasRecovery}`
      );
    }
    if (r.label.startsWith('R')) {
      console.log(
        `write path: action available ${r.actionAvailable}, badge after ${JSON.stringify(r.badge)}, error toast ${r.errorToast}, success toast ${r.successToast}`
      );
    }
    if (r.label.startsWith('S')) {
      console.log(
        `reload    : saw "Preparing..." ${r.sawPreparing}, otp inputs before ${r.otpBeforeReload}, after reload ${r.otpAfterReload}`
      );
    }
    if (r.label.startsWith('T')) {
      console.log(
        `recovery  : held at OTP ${r.heldAtOtp}, link offered ${r.linkShown > 0}, form shown ${r.recoveryShown > 0}, requests ${r.calls}, code sent ${JSON.stringify(r.sentCode)}, success shown ${r.successShown > 0}, error shown ${r.errorShown > 0}, session still stored ${r.sessionStored}`
      );
    }
    if (r.label.startsWith('V')) {
      console.log(
        `disable   : off-link ${r.offLinkShown > 0}, code field ${r.codeInputShown > 0}, button disabled with no code ${r.disabledBeforeCode}, DELETEs before ${r.deletesBeforeCode} -> force-click ${r.deletesAfterForcedClick} -> wrong code ${r.deletesAfterWrongCode} -> valid code ${r.deletesAfterValidCode}, wrong-code error shown ${r.wrongCodeError > 0}, "is off" shown ${r.successShown > 0}`
      );
    }
    if (r.metrics) {
      const { vh, docH, mfaTop, pinTop } = r.metrics;
      const below = mfaTop === null ? 'n/a' : mfaTop - vh;
      console.log(
        `geometry : viewport ${vh}px, document ${docH}px, MFA panel ${mfaTop}px, PIN panel ${pinTop}px` +
          (mfaTop === null ? '' : ` (MFA ${below > 0 ? `${below}px below the fold` : 'in view'})`) +
          (mfaTop != null && pinTop != null ? `, MFA ${mfaTop < pinTop ? 'ABOVE' : 'BELOW'} PIN` : '')
      );
    }
    if (/^[IJK] /.test(r.label) && r.panel) {
      console.log(`pin copy : ${JSON.stringify(r.panel.pinCopy)}`);
    }
    console.log(`urls visited: ${JSON.stringify(r.visited)}`);
    console.log(`body text: ${JSON.stringify(r.bodyText)}`);
    if (r.errors.length) console.log(`page errors:\n  ${r.errors.join('\n  ')}`);
    console.log(`result   : ${ok ? 'PASS' : 'FAIL'}`);
  }
  console.log('==================================================');
  // Name the failures on the summary line, not only in the block above.
  //
  // Twice now a run has reported a bare "FAIL" and the failing scenario was lost
  // to a `grep '^result'` — once on production (P) and once locally. A count of
  // passes tells you THAT something broke and nothing about WHAT. The summary has
  // to be self-sufficient, because the summary is what gets read.
  console.log(
    pass
      ? `OVERALL: PASS (${results.length}/${results.length})`
      : `OVERALL: FAIL — failed: ${failed.join(', ')} (${results.length - failed.length}/${results.length} passed)`
  );
  process.exit(pass ? 0 : 1);
})().catch((e) => {
  console.error('harness error:', e);
  process.exit(2);
});
