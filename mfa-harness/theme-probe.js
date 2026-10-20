/**
 * Theme probe — is the light/dark switch real?
 *
 * Runs against a built app with the network mocked (setupMocks from
 * white-preview), but WITHOUT the harness's own injected light palette: the
 * whole point is to exercise the theme that now ships in src/index.css.
 *
 * What it actually proves, in order of how easy each is to get wrong:
 *
 *   1. Pressing the control flips the document, and the SURFACES move with it.
 *      Checking only `data-theme` would pass even if the CSS never matched —
 *      the attribute is the input, not the outcome. So the computed background
 *      of the page, a card and the header are read and compared.
 *   2. The choice survives a reload.
 *   3. The saved theme is applied BEFORE the first paint. Without the inline
 *      script in index.html the attribute is still absent at
 *      domcontentloaded and a light user sees a dark flash on every load. This
 *      is checked by reading the attribute at the earliest moment the page is
 *      observable, not after waiting.
 *   4. Dark is the default, and the dark page is still the same dark it was.
 *
 *   node theme-probe.js [baseUrl]
 */
const path = require('path');
const { chromium } = require('playwright');
const { setupMocks } = require('./white-preview.js');

const BASE = (process.argv[2] || 'http://localhost:4202').replace(/\/$/, '');
const OUT = path.join(__dirname, '..', '..', '_theme_shots');

const ROUTES = [
  { name: 'home', role: 'admin', path: '/' },
  { name: 'services', role: 'admin', path: '/services' },
  { name: 'membership', role: 'admin', path: '/membership' },
  { name: 'admin-overview', role: 'admin', path: '/portal/admin' },
  { name: 'admin-security', role: 'admin', path: '/portal/admin', tab: 'Security' },
  { name: 'cleaner', role: 'cleaner', path: '/portal/cleaner' },
  { name: 'customer', role: 'customer', path: '/portal/customer' },
  { name: 'partner', role: 'partner', path: '/portal/partner' },
];

// What the page looks like right now, as the browser actually paints it.
function sample() {
  const bg = (el) => (el ? getComputedStyle(el).backgroundColor : null);
  const cards = [...document.querySelectorAll('div')].filter(
    (d) =>
      typeof d.className === 'string' &&
      /bg-navy-800/.test(d.className) &&
      /rounded-(xl|2xl)/.test(d.className)
  );
  const header = document.querySelector('header');
  // The portal's own painted surface, NOT document.body. The portal root is a
  // min-h-screen div that sits on top of body, so reading body answers a
  // question nobody asked — it is the colour BEHIND the page, not the page.
  const surface = document.querySelector('.portal-surface');
  // The wordmark is a raster with one file per theme, so "which one is showing"
  // is the only way to tell whether the swap actually happened. A logo that is
  // mounted but still white-on-white looks identical in the DOM.
  const logoDark = document.querySelector('.theme-dark-only');
  const logoLight = document.querySelector('.theme-light-only');
  const shows = (el) => (el ? getComputedStyle(el).display !== 'none' : null);
  return {
    theme: document.documentElement.getAttribute('data-theme'),
    body: bg(document.body),
    root: bg(document.getElementById('root')),
    card: bg(cards[0]),
    cardCount: cards.length,
    header: bg(header),
    surface: bg(surface),
    portalSurface: !!surface,
    logoDark: shows(logoDark),
    logoLight: shows(logoLight),
  };
}

let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures++;
  console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
}

async function signIn(page, role, target) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('form').getByRole('button', { name: /Sign In/ }).waitFor({ timeout: 15000 });
  await page.locator('input[type=email]').fill('admin@test.local');
  await page.locator('input[type=password]').fill('not-a-real-password');
  await page.locator('form').getByRole('button', { name: /Sign In/ }).click();
  await page.waitForTimeout(4000);
  if (!page.url().includes('/portal')) {
    await page.goto(BASE + target, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);
  }
  return page.url().includes('/portal');
}

(async () => {
  const browser = await chromium.launch();

  for (const r of ROUTES) {
    console.log(`\n── ${r.name}  (${r.path}${r.tab ? ' · ' + r.tab : ''})`);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await setupMocks(context, r.role);
    const page = await context.newPage();

    try {
      if (r.path.startsWith('/portal')) {
        const landed = await signIn(page, r.role, r.path);
        if (!landed) {
          console.log('   SKIP — could not reach the portal');
          await context.close();
          continue;
        }
      } else {
        await page.goto(BASE + r.path, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(1800);
      }

      if (r.tab) {
        const btn = page.getByRole('button', { name: new RegExp('^' + r.tab) }).first();
        if (await btn.count()) {
          await btn.click();
          await page.waitForTimeout(1000);
        }
      }

      // ── Dark, the default ────────────────────────────────────────────────
      const dark = await page.evaluate(sample);
      check('dark is the default', dark.theme === null || dark.theme === 'dark', `data-theme=${dark.theme}`);
      check('dark page is still the dark page', dark.body === 'rgb(14, 12, 9)', dark.body);

      // ── Toggle ───────────────────────────────────────────────────────────
      const toggle = page.getByRole('button', { name: /light mode|dark mode/i }).first();
      if ((await toggle.count()) === 0) {
        check('the control is on the page', false, 'no button matching /light mode|dark mode/');
        await context.close();
        continue;
      }
      await page.screenshot({ path: path.join(OUT, `${r.name}-dark.png`), fullPage: true });

      await toggle.click();
      await page.waitForTimeout(800); // the cross-fade is 340ms

      const light = await page.evaluate(sample);
      check('the document flipped', light.theme === 'light', `data-theme=${light.theme}`);
      check('the page surface moved', light.body !== dark.body, `${dark.body} -> ${light.body}`);
      check(
        'the card surface moved',
        light.cardCount === 0 || light.card !== dark.card,
        `${dark.card} -> ${light.card}`
      );
      check(
        'the header surface moved',
        !dark.header || light.header !== dark.header,
        `${dark.header} -> ${light.header}`
      );

      // The wordmark, in both directions. On a page with no logo at all both
      // values are null and the check is skipped rather than passed by accident.
      if (dark.logoDark !== null) {
        check('dark shows the white wordmark', dark.logoDark && !dark.logoLight);
        check('light shows the dark wordmark', light.logoLight && !light.logoDark);
      }

      const isPortal = r.path.startsWith('/portal');
      if (isPortal) {
        check('portal carries the marker', light.portalSurface);
        check('portal is pure white', light.surface === 'rgb(255, 255, 255)', light.surface);
        check('portal was NOT pure white in dark', dark.surface === 'rgb(14, 12, 9)', dark.surface);
      }

      await page.screenshot({ path: path.join(OUT, `${r.name}-light.png`), fullPage: true });

      // ── Persistence, and applied before the first paint ──────────────────
      // domcontentloaded, then read immediately: no waiting, because waiting
      // would let React set the attribute and hide a missing inline script.
      await page.goto(BASE + r.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const atFirstPaint = await page.evaluate(() =>
        document.documentElement.getAttribute('data-theme')
      );
      check(
        'light applied before the first paint',
        atFirstPaint === 'light',
        `data-theme at domcontentloaded = ${atFirstPaint}`
      );

      await page.waitForTimeout(1500);
      const afterReload = await page.evaluate(sample);
      check('the choice survived a reload', afterReload.theme === 'light', `data-theme=${afterReload.theme}`);

      // ── Back to dark ─────────────────────────────────────────────────────
      const back = page.getByRole('button', { name: /light mode|dark mode/i }).first();
      if (await back.count()) {
        await back.click();
        await page.waitForTimeout(800);
        const backToDark = await page.evaluate(sample);
        check('it goes back to dark', backToDark.theme === 'dark', `data-theme=${backToDark.theme}`);
        check('and the dark surface returns', backToDark.body === dark.body, backToDark.body);
      }
    } catch (e) {
      check('ran without throwing', false, e.message.split('\n')[0]);
    }

    await context.close();
  }

  await browser.close();
  console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
  process.exit(failures === 0 ? 0 : 1);
})();
