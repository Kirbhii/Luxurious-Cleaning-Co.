/* eslint-disable */
// GUEST PROBE — real network, no mocks, against a live URL.
//
// Why this exists: `13_HARDEN_revoke_anon_from_all_functions.sql` revoked EXECUTE
// from `anon` on every public function. The role that could be harmed by that is
// `anon` — i.e. a logged-out visitor — so this walks every public route with a
// real browser and reports:
//
//   * every API response with status >= 400 (and the SQLSTATE if the body has one)
//   * any response carrying `42501 permission denied` — the hardening's signature
//   * console errors, which is how a swallowed fetch failure shows up in the UI
//
// The harness (`run.js`) mocks the network on purpose, so it cannot see this.
// This one deliberately does not mock anything.
//
// Usage:  node guest-probe.js [baseUrl]
// Exit code 0 = no API error on any public route.

const { chromium } = require('playwright');

const BASE = (process.argv[2] || 'https://luxurious-cleaning-co.vercel.app').replace(/\/$/, '');

const ROUTES = [
  '/',
  '/services',
  '/about',
  '/membership',
  '/partnerships',
  '/training',
  '/contact',
  '/book',
  '/privacy',
  '/terms',
  '/login',
];

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  const apiCalls = [];
  let routeCount = 0;

  for (const route of ROUTES) {
    routeCount++;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    const consoleErrors = [];

    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
    });

    page.on('response', async (res) => {
      const url = res.url();
      if (!/\/rest\/v1\/|\/auth\/v1\/|\/functions\/v1\//.test(url)) return;
      const status = res.status();
      const path = url.replace(BASE, '').split('?')[0];
      let sqlstate = null;
      let message = null;
      if (status >= 400) {
        try {
          const body = await res.text();
          const j = JSON.parse(body);
          sqlstate = j.code ?? null;
          message = (j.message ?? '').slice(0, 200);
        } catch { /* non-JSON error body */ }
      }
      apiCalls.push({ route, path, status, sqlstate, message });
      if (status >= 400) {
        problems.push(`${route}  ${status}  ${path}  ${sqlstate ?? ''} ${message ?? ''}`.trim());
      }
    });

    let navError = null;
    try {
      await page.goto(BASE + route, { waitUntil: 'load', timeout: 30000 });
      // Bounded settle: the store's DB load fires after auth resolves.
      await page.waitForTimeout(2500);
    } catch (e) {
      navError = e.message.split('\n')[0];
    }

    let bodyText = '';
    try { bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' '); } catch { /* ignore */ }

    const rendered = bodyText.length > 200;
    if (navError) problems.push(`${route}  NAVIGATION FAILED  ${navError}`);
    if (!rendered) problems.push(`${route}  BLANK/NEAR-EMPTY PAGE  (bodyText ${bodyText.length} chars)`);

    // A 42501 in the UI usually surfaces as a visible error banner or a toast.
    if (/permission denied|42501/i.test(bodyText)) {
      problems.push(`${route}  UI SHOWS A PERMISSION ERROR`);
    }
    for (const ce of consoleErrors) {
      if (/permission denied|42501/i.test(ce)) problems.push(`${route}  CONSOLE 42501  ${ce}`);
    }

    console.log(
      `  ${route.padEnd(14)} rendered=${rendered ? 'yes' : 'NO '} ` +
      `bodyChars=${String(bodyText.length).padStart(5)} consoleErrors=${consoleErrors.length}`
    );

    await ctx.close();
  }

  await browser.close();

  console.log('\n--- API calls observed from a logged-out browser ---');
  if (apiCalls.length === 0) {
    console.log('  (none — the guest paths made no API calls at all)');
  } else {
    const seen = new Map();
    for (const c of apiCalls) {
      const k = `${c.path} ${c.status} ${c.sqlstate ?? ''}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    for (const [k, n] of seen) console.log(`  ${k}   x${n}`);
  }

  console.log(`\n--- routes walked: ${routeCount} ---`);
  if (problems.length === 0) {
    console.log('OVERALL: PASS — every public route rendered, no API error, no 42501');
    process.exit(0);
  }
  console.log(`OVERALL: FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.log(`  * ${p}`);
  process.exit(1);
})();
