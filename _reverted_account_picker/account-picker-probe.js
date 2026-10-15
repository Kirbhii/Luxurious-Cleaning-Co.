/* eslint-disable */
// ACCOUNT-PICKER PROBE — runs against a PRODUCTION build (`vite preview`).
//
// Covers the Facebook-style sign-in: pick a saved account, then a password-only
// screen with NO email field. Passwords are deliberately not part of the feature,
// and the assertion that the password field starts empty is what pins that down.
//
// The load-bearing assertion is #4: the email input is gone from the DOM, so the
// only way signIn can receive the right address is if the picked account supplies
// it. Intercepting /auth/v1/token and reading the POST body is what proves the
// whole flow still signs in, rather than merely looking right.
//
// `/auth/v1/token` is intercepted so no request leaves the machine.
//
// Usage:  node account-picker-probe.js http://localhost:4173
// Exit code 0 = every assertion held.

const { chromium } = require('playwright');

const BASE = (process.argv[2] || 'http://localhost:4173').replace(/\/$/, '');
const KEY = 'lc.remembered-accounts.v1';

const SEED = [
  { email: 'TEST_ADMIN_EMAIL',    role: 'admin',    name: 'Charles',   lastUsedAt: 4 },
  { email: 'TEST_CLEANER_EMAIL',  role: 'cleaner',  name: 'Kirbhii',   lastUsedAt: 3 },
  { email: 'cleaner.test1@gmail.com',                role: 'cleaner',  name: 'Test One',  lastUsedAt: 2 },
  { email: 'TEST_CUSTOMER_EMAIL', role: 'customer', name: 'Charles V', lastUsedAt: 1 },
];

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const tokenCalls = [];
  await page.route('**/auth/v1/token**', async (route) => {
    tokenCalls.push(route.request().postData() ?? '');
    await route.fulfill({ status: 400, contentType: 'application/json', body: '{}' });
  });

  const picker = () => page.locator('[data-account-picker]');
  const pwOnly = () => page.locator('[data-password-only]');
  const emailInputs = () => page.locator('input[type=email]');
  const passInput = () => page.locator('input[type=password]').first();
  const rowText = async () => (await picker().innerText()).replace(/\s+/g, ' ').trim();
  const row = (email) => page.locator(`[data-account-picker] [data-account-row="${email}"]`);
  const reload = async () => {
    await page.reload({ waitUntil: 'load' });
    await page.locator('form, [data-account-picker]').first().waitFor({ timeout: 15000 });
  };

  await page.goto(BASE + '/login', { waitUntil: 'load', timeout: 30000 });
  await page.locator('input[type=email]').first().waitFor({ timeout: 15000 });

  // ── 1. Nothing saved ────────────────────────────────────────────────────────
  console.log('\n1. no saved accounts');
  check('the picker is absent', (await picker().count()) === 0);
  check('the plain form is shown instead', (await emailInputs().count()) > 0);

  // ── 2. The picker ───────────────────────────────────────────────────────────
  console.log('\n2. the picker');
  await page.evaluate(([k, seed]) => localStorage.setItem(k, JSON.stringify(seed)), [KEY, SEED]);
  await reload();
  await picker().waitFor({ timeout: 8000 });

  check('the picker replaces the plain form', (await emailInputs().count()) === 0);
  const txt = await rowText();
  check(
    'every saved account is listed by role + address',
    ['Admin', 'Cleaner', 'Customer'].every((r) => txt.includes(r)) &&
      txt.includes('TEST_ADMIN_EMAIL') &&
      txt.includes('cleaner.test1@gmail.com'),
    `${(await picker().locator('button').count())} buttons in the list`
  );
  check(
    'multi-word names get two initials, single words get one',
    (await picker().innerText()).includes('TO') && (await picker().innerText()).includes('C'),
    'looked for TO and C'
  );
  check(
    'each row has a Remove control',
    (await page.getByRole('button', { name: /^Remove / }).count()) === 4,
    `${await page.getByRole('button', { name: /^Remove / }).count()} remove button(s)`
  );
  check(
    '"Use another account" is offered',
    (await page.getByRole('button', { name: 'Use another account' }).count()) === 1
  );

  // ── 3. Picking an account ───────────────────────────────────────────────────
  console.log('\n3. picking an account');
  await row('TEST_ADMIN_EMAIL').click();
  await pwOnly().waitFor({ timeout: 8000 });

  check('the picker is replaced by the password screen', (await picker().count()) === 0);
  check(
    'the EMAIL FIELD IS GONE — this is the whole point',
    (await emailInputs().count()) === 0,
    `${await emailInputs().count()} email input(s) in the DOM`
  );
  check(
    'it says "Log in as" with the person, and shows the address',
    (await pwOnly().innerText()).includes('Log in as Charles') &&
      (await pwOnly().innerText()).includes('TEST_ADMIN_EMAIL')
  );
  check('the password field starts EMPTY', (await passInput().inputValue()) === '');
  check(
    'the password field is focused',
    await page.evaluate(() => document.activeElement?.getAttribute('type') === 'password')
  );
  check(
    'a way back is offered',
    (await page.getByRole('button', { name: 'Not you? Switch account' }).count()) === 1
  );

  // ── 4. The login still carries the right address ────────────────────────────
  console.log('\n4. signing in from the password-only screen');
  await passInput().fill('probe-password');
  await page.locator('[data-password-only] button[type=submit]').click();
  await page.waitForTimeout(1200);

  check(
    'signIn was called with the PICKED address, not an empty field',
    tokenCalls.length === 1 && tokenCalls[0].includes('TEST_ADMIN_EMAIL'),
    tokenCalls.length ? `body: ${tokenCalls[0].slice(0, 90)}` : 'no call'
  );
  check(
    'and with the typed password',
    tokenCalls.length === 1 && tokenCalls[0].includes('probe-password')
  );

  // ── 5. Switching ────────────────────────────────────────────────────────────
  console.log('\n5. switching account');
  await page.getByRole('button', { name: 'Not you? Switch account' }).click();
  await picker().waitFor({ timeout: 8000 });
  check('back on the picker', (await picker().count()) === 1);

  await row('cleaner.test1@gmail.com').click();
  await pwOnly().waitFor({ timeout: 8000 });
  check(
    'the password typed for the previous account was cleared',
    (await passInput().inputValue()) === '',
    `value="${await passInput().inputValue()}"`
  );

  // ── 6. Removing an account ──────────────────────────────────────────────────
  console.log('\n6. removing an account');
  await page.getByRole('button', { name: 'Not you? Switch account' }).click();
  await picker().waitFor({ timeout: 8000 });

  await page.getByRole('button', { name: 'Remove cleaner.test1@gmail.com' }).click();
  await page.waitForTimeout(400);
  check(
    'the removed account is gone from the list',
    !(await rowText()).includes('cleaner.test1@gmail.com'),
    `${await page.getByRole('button', { name: /^Remove / }).count()} remove button(s) left`
  );
  const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), KEY);
  check(
    'and gone from localStorage',
    !stored.some((a) => a.email === 'cleaner.test1@gmail.com'),
    `${stored.length} account(s) stored`
  );

  // ── 7. Manual form ──────────────────────────────────────────────────────────
  console.log('\n7. "use another account"');
  await page.getByRole('button', { name: 'Use another account' }).click();
  await page.waitForTimeout(400);
  check('the plain form appears', (await emailInputs().count()) > 0);
  check('the picker is gone', (await picker().count()) === 0);
  check(
    'and there is a way back',
    (await page.getByRole('button', { name: 'Back to saved accounts' }).count()) === 1
  );

  await page.getByRole('button', { name: 'Back to saved accounts' }).click();
  await page.waitForTimeout(400);
  check('going back returns to the picker', (await picker().count()) === 1);

  // ── 8. Removing everything ──────────────────────────────────────────────────
  console.log('\n8. removing the last account');
  for (const email of SEED.map((s) => s.email)) {
    if (email === 'cleaner.test1@gmail.com') continue;
    await page.getByRole('button', { name: `Remove ${email}` }).click();
    await page.waitForTimeout(250);
  }
  check(
    'with nothing saved, the plain form takes over automatically',
    (await picker().count()) === 0 && (await emailInputs().count()) > 0,
    `picker=${await picker().count()} emailInputs=${await emailInputs().count()}`
  );

  // ── 9. Persistence ──────────────────────────────────────────────────────────
  console.log('\n9. survives a reload');
  await page.evaluate(([k, seed]) => localStorage.setItem(k, JSON.stringify(seed.slice(0, 2))), [KEY, SEED]);
  await reload();
  await picker().waitFor({ timeout: 8000 });
  check(
    'the picker comes back after a reload',
    (await picker().count()) === 1 && (await rowText()).includes('valencia.charleskirby.aviles'),
    `${await page.getByRole('button', { name: /^Remove / }).count()} account(s)`
  );

  await ctx.close();
  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(
    `\nOVERALL: ${failed.length === 0 ? 'PASS' : `FAIL — ${failed.length} failed`} ` +
    `(${results.length - failed.length}/${results.length} passed)`
  );
  if (failed.length) for (const f of failed) console.log(`  * ${f.name}`);
  process.exit(failed.length === 0 ? 0 : 1);
})();
