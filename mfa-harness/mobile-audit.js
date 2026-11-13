/**
 * mobile-audit.js — finds the mobile problems a screenshot alone hides.
 *
 * A page can look fine at 390px and still be unpleasant on a phone:
 *   - text below 12px is hard to read on a 6-inch screen
 *   - a tap target under 40px is a miss waiting to happen
 *   - a fixed pixel height silently clips whatever does not fit
 *   - a 3- or 4-column grid that never collapsed squeezes its content
 *
 * This reports COUNTS and the worst offenders per route, so a fix can be
 * aimed instead of guessed.
 *
 * Usage: node mobile-audit.js http://127.0.0.1:4390
 */
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:4390';
const WIDTH = parseInt(process.env.WIDTH || '390', 10);
const HEIGHT = parseInt(process.env.HEIGHT || '844', 10);

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
];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });

  for (const route of ROUTES) {
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(1200);

      const result = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;

        const tinyText = [];
        const smallTargets = [];
        const clippedFixed = [];
        const wideGrids = [];

        const visible = (el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
        };

        const label = (el) => {
          const t = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
          return t.slice(0, 40);
        };

        // 1. Text smaller than 12px
        document.querySelectorAll('body *').forEach((el) => {
          if (!visible(el)) return;
          const hasOwnText = [...el.childNodes].some(
            (n) => n.nodeType === 3 && n.textContent.trim().length > 0
          );
          if (!hasOwnText) return;
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs > 0 && fs < 12) {
            tinyText.push({ size: fs, text: label(el), tag: el.tagName.toLowerCase() });
          }
        });

        // 2. Tap targets smaller than 40x40
        document.querySelectorAll('a, button, [role="button"], input, select, textarea').forEach((el) => {
          if (!visible(el)) return;
          const r = el.getBoundingClientRect();
          if (r.height < 40 || r.width < 40) {
            smallTargets.push({
              w: Math.round(r.width),
              h: Math.round(r.height),
              text: label(el),
              tag: el.tagName.toLowerCase(),
            });
          }
        });

        // 3. Fixed-height elements whose content overflows and is hidden
        document.querySelectorAll('body *').forEach((el) => {
          if (!visible(el)) return;
          const cs = getComputedStyle(el);
          if (cs.overflow !== 'hidden' && cs.overflowY !== 'hidden') return;
          if (el.scrollHeight > el.clientHeight + 8) {
            clippedFixed.push({
              scrollH: el.scrollHeight,
              clientH: el.clientHeight,
              text: label(el),
              cls: typeof el.className === 'string' ? el.className.slice(0, 60) : '',
            });
          }
        });

        // 4. Multi-column grids still multi-column at phone width
        document.querySelectorAll('body *').forEach((el) => {
          if (!visible(el)) return;
          const cs = getComputedStyle(el);
          if (cs.display !== 'grid') return;
          const cols = cs.gridTemplateColumns.split(' ').filter(Boolean).length;
          if (cols >= 3) {
            const r = el.getBoundingClientRect();
            const childW = r.width / cols;
            wideGrids.push({
              cols,
              childW: Math.round(childW),
              text: label(el).slice(0, 30),
              cls: typeof el.className === 'string' ? el.className.slice(0, 60) : '',
            });
          }
        });

        return {
          vw,
          tinyTextCount: tinyText.length,
          tinyText: tinyText.slice(0, 6),
          smallTargetCount: smallTargets.length,
          smallTargets: smallTargets.slice(0, 6),
          clippedCount: clippedFixed.length,
          clipped: clippedFixed.slice(0, 6),
          wideGridCount: wideGrids.length,
          wideGrids: wideGrids.slice(0, 6),
        };
      });

      console.log(`\n=== ${route.slug} (${route.path}) ===`);
      console.log(
        `tiny<12px=${result.tinyTextCount}  tap<40px=${result.smallTargetCount}  clipped=${result.clippedCount}  grid>=3col=${result.wideGridCount}`
      );

      if (result.tinyText.length) {
        console.log('  tiny text:');
        result.tinyText.forEach((t) => console.log(`    ${t.size}px  "${t.text}"`));
      }
      if (result.smallTargets.length) {
        console.log('  small targets:');
        result.smallTargets.forEach((t) => console.log(`    ${t.w}x${t.h}  ${t.tag}  "${t.text}"`));
      }
      if (result.clipped.length) {
        console.log('  clipped:');
        result.clipped.forEach((c) =>
          console.log(`    ${c.scrollH}>${c.clientH}  "${c.text}"  .${c.cls}`)
        );
      }
      if (result.wideGrids.length) {
        console.log('  wide grids:');
        result.wideGrids.forEach((g) => console.log(`    ${g.cols}col (${g.childW}px each)  .${g.cls}`));
      }
    } catch (err) {
      console.log(`ERROR ${route.slug}: ${err.message.split('\n')[0]}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
})();
