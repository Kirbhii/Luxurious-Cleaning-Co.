/**
 * mobile-probe.js — screenshot every public route at phone width so the
 * mobile layout can be judged from real pixels instead of from the CSS.
 *
 * Why a probe and not just resizing a browser: a layout that "looks fine"
 * at 390px can still be broken — text clipped inside an absolutely
 * positioned strip, a horizontal scrollbar from one over-wide child, a
 * grid that never collapsed. Only a screenshot plus a scrollWidth check
 * finds those.
 *
 * Usage:
 *   node mobile-probe.js http://127.0.0.1:4390
 *   WIDTH=390 node mobile-probe.js http://127.0.0.1:4390
 *   ONLY=home,services node mobile-probe.js http://127.0.0.1:4390
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.argv[2] || 'http://127.0.0.1:4390';
const WIDTH = parseInt(process.env.WIDTH || '390', 10);
const HEIGHT = parseInt(process.env.HEIGHT || '844', 10);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map((s) => s.trim()) : null;
const OUT = `${__dirname}/_mobile`;

const ROUTES = [
  { slug: 'home', path: '/' },
  { slug: 'services', path: '/services' },
  { slug: 'about', path: '/about' },
  { slug: 'membership', path: '/membership' },
  { slug: 'partnerships', path: '/partnerships' },
  { slug: 'training', path: '/training' },
  { slug: 'contact', path: '/contact' },
  { slug: 'book', path: '/book' },
  { slug: 'login', path: '/login' },
  { slug: 'privacy', path: '/privacy' },
  { slug: 'terms', path: '/terms' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  const report = [];

  for (const route of ROUTES) {
    if (ONLY && !ONLY.includes(route.slug)) continue;

    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text().slice(0, 160));
    });

    try {
      await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(1800);

      // Find every element that overflows the viewport horizontally. This is
      // what produces the sideways scroll a phone user hits by accident.
      const metrics = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const docW = document.documentElement.scrollWidth;
        const bodyW = document.body.scrollWidth;

        const offenders = [];
        document.querySelectorAll('body *').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          // Allow 1px of subpixel rounding before calling it an overflow.
          if (r.right > vw + 1 || r.left < -1) {
            const cls = typeof el.className === 'string' ? el.className.slice(0, 90) : '';
            offenders.push({
              tag: el.tagName.toLowerCase(),
              cls,
              left: Math.round(r.left),
              right: Math.round(r.right),
              width: Math.round(r.width),
            });
          }
        });

        // Keep the widest few — those are the ones that actually cause the
        // scrollbar; a 2px overhang on a decorative element does not.
        offenders.sort((a, b) => b.right - a.right);

        // Clipped text: an element whose content is taller than its own box
        // while overflow is hidden. That is text the user cannot read.
        const clipped = [];
        document.querySelectorAll('body *').forEach((el) => {
          const cs = getComputedStyle(el);
          if (cs.overflow !== 'hidden' && cs.overflowY !== 'hidden') return;
          if (el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 0) {
            const txt = (el.innerText || '').trim().slice(0, 60);
            if (txt) {
              clipped.push({
                tag: el.tagName.toLowerCase(),
                cls: typeof el.className === 'string' ? el.className.slice(0, 70) : '',
                text: txt,
                scrollH: el.scrollHeight,
                clientH: el.clientHeight,
              });
            }
          }
        });

        return { vw, docW, bodyW, offenders: offenders.slice(0, 8), clipped: clipped.slice(0, 8) };
      });

      await page.screenshot({ path: `${OUT}/${route.slug}-top.png`, fullPage: false });
      await page.screenshot({ path: `${OUT}/${route.slug}-full.png`, fullPage: true });

      const hScroll = metrics.docW > metrics.vw + 1;
      report.push({
        slug: route.slug,
        path: route.path,
        viewport: metrics.vw,
        scrollWidth: metrics.docW,
        hScroll,
        offenders: metrics.offenders,
        clipped: metrics.clipped,
        errors,
      });

      const flag = hScroll ? 'H-SCROLL' : 'ok';
      console.log(
        `${hScroll ? 'FAIL' : 'PASS'}  ${route.slug.padEnd(13)} ${String(metrics.docW).padStart(4)}px / ${metrics.vw}px  ${flag}  offenders=${metrics.offenders.length} clipped=${metrics.clipped.length}`
      );
    } catch (err) {
      console.log(`ERROR ${route.slug}: ${err.message.split('\n')[0]}`);
      report.push({ slug: route.slug, path: route.path, error: err.message.split('\n')[0] });
    } finally {
      await page.close();
    }
  }

  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(`\n--- ${report.length} route(s) checked, report -> _mobile/report.json ---`);

  await browser.close();
})();
