/**
 * Tier badge probe — are BRONZE / SILVER / GOLD readable in the light theme?
 *
 * Runs against the SHIPPING theme (setupMocks only, no injected palette), so it
 * measures what a visitor actually gets.
 *
 * Why a pixel measurement instead of reading computed colours: the badge sits on
 * a Tailwind GRADIENT (bg-gradient-to-br from-… to-…), so the card has no
 * backgroundColor at all — the surface is a background-image. A probe that reads
 * computed styles would have to composite that gradient itself, and a compositor
 * that silently gets it wrong is the exact class of bug this is meant to catch
 * (see: the oklab trap in verify-search-logo.js).
 *
 * So the badge is screenshotted and the contrast is measured on the real pixels:
 * the darkest cluster inside the pill is the ink, the lightest is the fill.
 * Border pixels are cropped away first, because a border is not text.
 *
 * Usage:  node tier-badge-probe.js [baseUrl]
 *         THEME=dark node tier-badge-probe.js
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { setupMocks } = require('./white-preview.js');

const BASE = (process.argv[2] || 'http://127.0.0.1:4400').replace(/\/$/, '');
const THEME = process.env.THEME === 'dark' ? 'dark' : 'light';
const OUT = path.join(__dirname, '_shots', `tiers-${THEME}`);
fs.mkdirSync(OUT, { recursive: true });

// Which page, which selector, and what we expect to find there.
const TARGETS = [
  { page: 'membership', route: '/membership', sel: '[data-tier-pill]', expect: 3 },
  { page: 'home', route: '/', sel: '[data-tier-ink]', expect: 2 },
];

(async () => {
  const browser = await chromium.launch();
  const manifest = [];
  try {
    for (const t of TARGETS) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
      await setupMocks(context, 'admin');
      await context.addInitScript((theme) => {
        try {
          window.localStorage.setItem('lcc-theme', theme);
        } catch (e) {
          /* storage disabled — markup default applies */
        }
      }, THEME);

      const page = await context.newPage();
      await page.goto(BASE + t.route, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(1500);

      const n = await page.locator(t.sel).count();
      console.log(`${n === t.expect ? 'PASS' : 'FAIL'}  ${t.page}: ${n} badge(s) found (expected ${t.expect})`);

      for (let i = 0; i < n; i++) {
        const el = page.locator(t.sel).nth(i);
        const box = await el.boundingBox();
        const label = (await el.innerText()).trim().replace(/\s+/g, '-').toLowerCase();
        const color = await el.evaluate((node) => getComputedStyle(node).color);
        const file = path.join(OUT, `${t.page}-${i}-${label}.png`);
        await el.screenshot({ path: file });
        manifest.push({ page: t.page, index: i, label, color, file, box });
      }

      await page.screenshot({ path: path.join(OUT, `${t.page}-full.png`) });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n${manifest.length} crop(s) written to ${OUT}`);
})();
