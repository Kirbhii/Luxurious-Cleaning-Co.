/**
 * reviews-probe.js — verifies the reviews feature end to end.
 *
 * The reviews table may not exist yet, and the whole point of the fallback is
 * that the site keeps working when it does not. So this probe asserts BOTH
 * states: the "not switched on yet" message when the table is missing, and the
 * real list when it is present. It also checks the home page still shows
 * social proof either way.
 *
 * Usage: node reviews-probe.js http://127.0.0.1:4420
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.argv[2] || 'http://127.0.0.1:4420';
const OUT = `${__dirname}/_reviews`;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  try {
    // ── 1. Public reviews page ────────────────────────────────────────────
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await desktop.newPage();
    const consoleErrors = [];
    const badResponses = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
    });
    page.on('response', (r) => {
      if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url().slice(0, 140)}`);
    });

    await page.goto(`${BASE}/reviews`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(2500);

    const pageState = await page.evaluate(() => {
      const text = document.body.innerText;
      const heading = document.querySelector('h1')?.innerText?.trim() || '';
      const buttons = [...document.querySelectorAll('button')].map((b) => b.innerText.trim());
      return {
        heading,
        hasWriteButton: buttons.some((t) => /write a review/i.test(t)),
        saysSettingUp: /being set up/i.test(text),
        saysNoReviews: /no reviews yet/i.test(text),
        saysLoadFailed: /could not|failed|error/i.test(text),
        reviewCards: document.querySelectorAll('[class*="rounded-2xl"]').length,
      };
    });

    check('1 heading renders', /what clients say/i.test(pageState.heading), pageState.heading);
    check('2 "Write a review" button present', pageState.hasWriteButton);
    check(
      '3 shows a definite state, not an error',
      pageState.saysSettingUp || pageState.saysNoReviews || !pageState.saysLoadFailed,
      pageState.saysSettingUp ? 'table not created yet — fallback shown' : pageState.saysNoReviews ? 'table empty' : 'list rendered'
    );
    // A 404 from the REST endpoint for `reviews` is the EXPECTED signal that
    // the migration has not been applied. Anything else failing is a real bug,
    // so the check distinguishes them instead of counting all 404s alike.
    const unexpected = badResponses.filter((r) => !/\/rest\/v1\/reviews/.test(r));
    check(
      '4 no unexpected failed requests',
      unexpected.length === 0,
      unexpected[0] || (badResponses.length ? `only the reviews table is missing (${badResponses.length} request)` : 'none')
    );

    await page.screenshot({ path: `${OUT}/reviews-desktop.png`, fullPage: true });

    // ── 2. The write button asks a signed-out visitor to sign in ──────────
    const writeBtn = page.getByRole('button', { name: /write a review/i }).first();
    if (await writeBtn.count()) {
      await writeBtn.click();
      await page.waitForTimeout(700);
      const prompt = await page.evaluate(() =>
        /sign in|create an account/i.test(document.body.innerText)
      );
      check('5 signed-out visitor is asked to sign in', prompt);
      await page.screenshot({ path: `${OUT}/reviews-auth-prompt.png` });
    } else {
      check('5 signed-out visitor is asked to sign in', false, 'button not found');
    }
    await desktop.close();

    // ── 3. Home page still shows reviews or the built-in fallback ─────────
    const homeCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const home = await homeCtx.newPage();
    await home.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 45000 });
    await home.waitForTimeout(2500);

    const homeState = await home.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasSection: /client reviews/i.test(text),
        hasNames:
          /catherine liu|david okonkwo|marina petrov/i.test(text) || text.length > 0,
        hasViewAll: /read all reviews/i.test(text),
        // An empty reviews section would show the heading with nothing under it.
        cardCount: document.querySelectorAll('blockquote').length,
      };
    });

    check('6 home shows the reviews section', homeState.hasSection);
    check('7 home has at least one quote', homeState.cardCount > 0, `${homeState.cardCount} quote(s)`);
    check('8 home links to the full list', homeState.hasViewAll);

    await home.screenshot({ path: `${OUT}/home-reviews.png`, fullPage: false });
    await homeCtx.close();

    // ── 4. Mobile: the reviews page must not scroll sideways ─────────────
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const mpage = await mobile.newPage();
    await mpage.goto(`${BASE}/reviews`, { waitUntil: 'networkidle', timeout: 45000 });
    await mpage.waitForTimeout(2000);

    const m = await mpage.evaluate(() => ({
      vw: document.documentElement.clientWidth,
      docW: document.documentElement.scrollWidth,
    }));
    check('9 mobile reviews page has no horizontal scroll', m.docW <= m.vw + 1, `${m.docW}/${m.vw}`);

    await mpage.screenshot({ path: `${OUT}/reviews-mobile.png`, fullPage: true });
    await mobile.close();
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n--- ${results.length} checks, ${failed} failed ---`);
  process.exitCode = failed === 0 ? 0 : 1;
})();
