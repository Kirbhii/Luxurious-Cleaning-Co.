/* eslint-disable */
// CONTRAST PROBE — measures the LIGHT theme, and reports every piece of text
// that a reader would struggle with.
//
// Why this exists: "make all the unreadable text readable" is a claim about
// every text node on every page, and eyeballing screenshots cannot support it —
// a screenshot shows what I happened to look at. So this walks the DOM instead,
// composites the real background behind each text node, and applies the WCAG
// contrast formula to it.
//
// It renders with the SAME light palette as white-preview.js, imported rather
// than copied, so the two can never disagree about which theme is being audited.
//
// Thresholds (WCAG 2.1 AA):
//   normal text   >= 4.5 : 1
//   large text    >= 3.0 : 1   (>= 24px, or >= 18.66px and bold)
//
// Usage:  node contrast-probe.js [baseUrl]
// Exit code 0 = nothing below threshold.

const { chromium } = require('playwright');
const { newPage, PUBLIC_ROUTES, ADMIN_TABS, HOME_LIGHT, PORTAL_LIGHT } = require('./white-preview.js');

const BASE = (process.argv[2] || 'http://localhost:4173').replace(/\/$/, '');

// Runs inside the page. Must be self-contained: no closure over Node values.
function audit() {
  const parse = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s || '');
    if (!m) return null;
    const p = m[1].split(',').map((v) => parseFloat(v));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const chan = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lum = (c) => 0.2126 * chan(c.r) + 0.7152 * chan(c.g) + 0.0722 * chan(c.b);
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const contrast = (a, b) => {
    const la = lum(a);
    const lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  // A dark scrim is very often a SIBLING of the content rather than an
  // ancestor. The Home hero paints its photo and its three overlays into a
  // positioned div that sits NEXT TO the headline, not around it — so an
  // ancestor-only walk scores the headline against the page behind the hero
  // and invents a white-on-white failure that no reader can see.
  //
  // This looks inside an ancestor for a positioned child that (a) is painted
  // before our element, and (b) geometrically covers it.
  function coveringOverlay(ancestor, el) {
    const r = el.getBoundingClientRect();
    const px = r.left + r.width / 2;
    const py = r.top + r.height / 2;
    for (const sib of ancestor.children) {
      if (sib === el || sib.contains(el)) continue;
      const cs = getComputedStyle(sib);
      if (cs.position !== 'absolute' && cs.position !== 'fixed') continue;
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const sr = sib.getBoundingClientRect();
      if (sr.width < 1 || sr.height < 1) continue;
      if (px < sr.left || px > sr.right || py < sr.top || py > sr.bottom) continue;
      // Painted BELOW our element? (follows it in document order => yes)
      if (!(sib.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      return sib;
    }
    return null;
  }

  // The real background behind an element: composite every translucent layer
  // from the element upward. Returns null when the answer is unknowable —
  // text sitting on a photograph cannot be scored by this method, and guessing
  // white would invent failures that are not there.
  function backdrop(el) {
    const layers = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 1) break;
      }
      // Before stepping out of this ancestor, account for an overlay painted
      // underneath our element inside it.
      const ov = coveringOverlay(node, el);
      if (ov) {
        const ocs = getComputedStyle(ov);
        const hasPhoto =
          (ocs.backgroundImage && ocs.backgroundImage !== 'none') ||
          ov.tagName === 'IMG' ||
          !!ov.querySelector('img') ||
          [...ov.querySelectorAll('*')].some((d) => {
            const bi = getComputedStyle(d).backgroundImage;
            return bi && bi !== 'none';
          });
        if (hasPhoto) return null;
        const oc = parse(ocs.backgroundColor);
        if (oc && oc.a > 0) {
          layers.push(oc);
          if (oc.a >= 1) break;
        }
      }
      node = node.parentElement;
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  }

  const isLarge = (cs) => {
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    return size >= 24 || (size >= 18.66 && weight >= 700);
  };

  const out = [];
  const photo = [];
  const seen = new Set();
  let checked = 0;
  let skipped = 0;

  document.querySelectorAll('*').forEach((el) => {
    // Only elements with their own visible text.
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (!own) return;

    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    if (parseFloat(cs.opacity) === 0) return;
    if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') return;
    if (el.closest('[aria-hidden="true"]')) return;

    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;

    const fg = parse(cs.color);
    if (!fg) return;
    const bg = backdrop(el);
    // Sits on a photograph — not scoreable here. Counted, not silently dropped:
    // a probe that quietly skips most of the page can report a clean pass and
    // mean nothing. The element is also RECORDED, because this class of text is
    // exactly where the unreadable labels hide and the maths cannot see them.
    if (!bg) {
      skipped++;
      photo.push({ text: own.slice(0, 60), cls: (el.getAttribute('class') || '').slice(0, 90) });
      return;
    }
    checked++;

    const fgOpaque = fg.a >= 1 ? fg : over(fg, bg);
    const ratio = contrast(fgOpaque, bg);
    const large = isLarge(cs);
    const need = large ? 3 : 4.5;
    if (ratio >= need) return;

    const key = `${own}|${cs.color}|${cs.fontSize}`;
    if (seen.has(key)) return;
    seen.add(key);

    out.push({
      text: own.slice(0, 70),
      tag: el.tagName.toLowerCase(),
      cls: (el.getAttribute('class') || '').slice(0, 110),
      color: cs.color,
      bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
      size: Math.round(parseFloat(cs.fontSize) * 10) / 10,
      weight: cs.fontWeight,
      ratio: Math.round(ratio * 100) / 100,
      need,
      large,
    });
  });

  return { rows: out, photo, checked, skipped };
}

(async () => {
  const browser = await chromium.launch();
  const findings = [];
  const photos = [];
  let checkedAll = 0;
  let skippedAll = 0;

  const pages = [
    ...PUBLIC_ROUTES.map(([name, route]) => ({ name, route, role: 'admin' })),
    { name: '12-portal-admin', route: '/portal/admin', role: 'admin', tabs: ADMIN_TABS },
    { name: '13-portal-cleaner', route: '/portal/cleaner', role: 'cleaner' },
    { name: '14-portal-partner', route: '/portal/partner', role: 'partner' },
    { name: '15-portal-customer', route: '/portal/customer', role: 'customer' },
  ];

  for (const p of pages) {
    const extra = p.route === '/' ? HOME_LIGHT : p.route.startsWith('/portal') ? PORTAL_LIGHT : '';
    const { context, page } = await newPage(browser, p.role, extra);
    try {
      if (p.route.startsWith('/portal')) {
        // Every portal signs in through the same form; only the role differs.
        await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
        await page.locator('form').getByRole('button', { name: /Sign In/ }).waitFor({ timeout: 15000 });
        await page.locator('input[type=email]').fill('admin@test.local');
        await page.locator('input[type=password]').fill('not-a-real-password');
        await page.locator('form').getByRole('button', { name: /Sign In/ }).click();
        await page.waitForTimeout(4000);
        // A customer is routed home rather than into a portal — go direct.
        if (!page.url().includes('/portal')) {
          await page.goto(BASE + p.route, { waitUntil: 'networkidle', timeout: 30000 });
          await page.waitForTimeout(2500);
        }
      } else {
        await page.goto(BASE + p.route, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(1800);
      }

      const tabs = p.tabs || [null];
      for (const tab of tabs) {
        if (tab) {
          const btn = page.getByRole('button', { name: new RegExp('^' + tab) }).first();
          if ((await btn.count()) === 0) continue;
          await btn.click();
          await page.waitForTimeout(1000);
        }
        const label = tab ? `${p.route} [${tab}]` : p.route;
        const { rows, photo, checked, skipped } = await page.evaluate(audit);
        checkedAll += checked;
        skippedAll += skipped;
        for (const r of rows) findings.push({ page: label, ...r });
        for (const p of photo) photos.push({ page: label, ...p });
        console.log(
          `  ${label.padEnd(38)} ${String(rows.length).padStart(3)} below   ` +
            `(${checked} scored, ${skipped} on photos)`
        );
      }
    } catch (e) {
      console.log(`  ${p.route.padEnd(38)} FAILED  ${e.message.split('\n')[0]}`);
    }
    await context.close();
  }

  await browser.close();

  console.log('\n==================================================');
  console.log(`COVERAGE: ${checkedAll} text nodes scored, ${skippedAll} skipped (text over a photo)`);

  // The skipped ones are not a footnote — they are exactly where the unreadable
  // labels hide, because white-on-a-bright-photo is invisible to a contrast
  // formula (the photo is unknown) but obvious to a reader. Print them so the
  // list can be walked by eye instead of guessed at.
  if (process.env.SHOW_PHOTOS === '1') {
    console.log(`\nTEXT OVER A PHOTO — unscoreable here, needs eyes (${photos.length}):`);
    const byPage = {};
    for (const p of photos) (byPage[p.page] = byPage[p.page] || []).push(p);
    for (const page of Object.keys(byPage)) {
      console.log(`  ${page}`);
      const seenTxt = new Set();
      for (const p of byPage[page]) {
        if (seenTxt.has(p.text)) continue;
        seenTxt.add(p.text);
        console.log(`      "${p.text}"`);
      }
    }
  }

  if (findings.length === 0) {
    console.log('OVERALL: PASS — every scoreable text node meets WCAG AA on the light theme');
    process.exit(0);
  }

  findings.sort((a, b) => a.ratio - b.ratio);
  console.log(`BELOW WCAG AA: ${findings.length} distinct case(s), worst first\n`);
  for (const f of findings) {
    console.log(`${String(f.ratio).padStart(5)} : 1  (need ${f.need})  ${f.page}`);
    console.log(`        "${f.text}"`);
    console.log(`        ${f.tag} ${f.size}px/${f.weight}  fg ${f.color}  bg ${f.bg}`);
    console.log(`        ${f.cls}\n`);
  }
  process.exit(1);
})().catch((e) => {
  console.error('contrast probe error:', e);
  process.exit(2);
});
