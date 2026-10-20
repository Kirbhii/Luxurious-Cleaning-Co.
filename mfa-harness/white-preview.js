/* eslint-disable */
// WHITE PREVIEW — renders the app with its theme tokens flipped to a light
// palette, and screenshots every page.
//
// This is a DESIGN PREVIEW, not a test. It asserts nothing and proves nothing.
// It exists to answer one question — "what would this look like on a white
// background?" — without changing a single line of the application.
//
// Why a token flip is enough to re-theme the whole app: Tailwind v4 compiles
// `bg-navy-900` to `background-color: var(--color-navy-900)` rather than inlining
// the hex. Verified against dist/assets/*.css before this file was written, and
// re-verified by the run that produced the screenshots. So redefining the tokens
// at :root repaints everything the tokens drive.
//
// What it does NOT cover: the 14 hex literals left in index.css and a handful of
// inline styles (index.css writes `background-color: #0E0C09` directly instead of
// using the token). Those are overridden by explicit rules below, which is why
// this file knows about `.page-wrapper` and `.page-header` by name. Any NEW
// hardcoded colour added to index.css will not be caught here — this preview
// cannot tell you about a literal it has never seen.
//
// Network is mocked, so the pages render empty but deterministically. Empty is
// the point: this is about type, colour and spacing, not about data.
//
// Usage:  node white-preview.js [baseUrl] [outDir]

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = (process.argv[2] || 'http://localhost:4173').replace(/\/$/, '');
const OUT = process.argv[3] || path.join(__dirname, '..', '..', '_white_preview');

// ONLY=01-home,12-portal-admin-security  ->  re-shoot just those, so a tweak to
// the palette does not cost a full 25-page pass. Unset means everything.
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const wanted = (name) => !ONLY || ONLY.includes(name);

// A portal is a screen with several tabs, and its screenshots are named after
// the TAB (`12-portal-admin-security`). Naming only the portal re-shoots all of
// them. Both spellings have to work, or ONLY silently skips the whole portal
// and the run reports "0 screenshot(s) written" as if nothing matched.
const slugOf = (portalName, tab) => `${portalName.replace(/^(\d+)-/, '$1-')}-${tab.toLowerCase()}`;
const wantedPortal = (p) =>
  !ONLY || ONLY.includes(p.name) || p.tabs.some((t) => ONLY.includes(slugOf(p.name, t)));

// ─── The light palette ───────────────────────────────────────────────────────
// The dark theme runs dark-surface -> light-text. Flipping it means the surface
// ramp inverts and the text ramp inverts with it. The values are chosen so that
// a card still reads as a distinct plane from the page behind it, which is the
// thing most naive light themes get wrong.
const LIGHT = `
:root {
  /* surfaces: 950 was the page, 800 was the card.
     The page stays near-white — he was explicit that the page is not what should
     change. The CARD is what has to stand out, so the card carries a warm cream
     tint drawn from the palette's own cream ramp instead of being pure white.
     A tinted card on a neutral page separates by HUE, not by brightness: the
     red and green channels stay high while blue drops, so it reads as warm paper
     rather than as a grey box, and nothing about the page moves. */
  --color-navy-950: #f6f5f2;
  --color-navy-900: #ffffff;
  --color-navy-800: #f4efe4;
  --color-navy-700: #eae3d4;
  --color-navy-600: #ded5c2;

  /* text: the cream ramp was near-white. Inverted it must be near-black, and
     300 stays the muted tone — dark enough to survive on white. The first
     attempt used #6b665d, which measures 4.46:1 on the navy-700 chip and is
     therefore a hair under AA; #5f5a51 clears it at 5.36:1. */
  --color-cream-50:  #14120f;
  --color-cream-100: #1a1815;
  --color-cream-200: #35312b;
  --color-cream-300: #5f5a51;
}

/* index.css writes these as literals, so the token flip cannot reach them. */
html, body, #root { background-color: #f6f5f2 !important; color: #1a1815 !important; }
.page-wrapper  { background-color: #f6f5f2 !important; }
.page-header   { background-color: #ffffff !important; border-bottom-color: rgba(0,0,0,0.08) !important; }
.skeleton      { background: #eceae5 !important; }

/* Card definition. The app draws card edges as border-gold-400/10 — gold at 10%,
   which disappears once the surface underneath is light. Raised to a warm 20%,
   plus a whisper of shadow, so the tinted card reads as a raised plane instead
   of a patch of colour. Both are still the palette's own gold and charcoal,
   just at an alpha that survives a light background.
   Whole-token match (~=) on purpose: a substring match on /5 would also catch
   /50 and quietly weaken every hover border. */
[class~="border-gold-400/10"] { border-color: rgba(150,112,35,0.20) !important; }
[class~="border-gold-400/5"]  { border-color: rgba(150,112,35,0.10) !important; }
[class*="bg-navy-800"][class*="rounded-xl"],
[class*="bg-navy-800"][class*="rounded-2xl"] {
  box-shadow: 0 1px 2px rgba(74,56,22,0.06), 0 1px 1px rgba(74,56,22,0.04);
}

/* A dark scrim over a light page is still correct for a modal, but 90% of a
   near-white token is nearly invisible. Pin the overlay to a real dark scrim. */
.fixed.inset-0 { background-color: rgba(20, 18, 15, 0.55) !important; }

/* ── Toasts keep their own dark surface ───────────────────────────────────────
   A toast is bg-emerald-900 / red-900 / amber-900 / blue-900 — stock Tailwind
   colours this file never touches — while its text is text-cream-100 and
   text-cream-300, which DO flip. So the message came out near-black on dark
   green. The ink is put back wherever the surface never moved.

   Done in CSS rather than in the page script because the script could not read
   the toast's background: Tailwind v4 writes an opacity modifier as color-mix()
   and Chrome returns that in a colour syntax the rgb() regex cannot parse, so
   the dark layer was silently dropped.

   animate-slide-in-right is on the toast and on nothing else. */
.animate-slide-in-right p:first-child,
.animate-slide-in-right button { color: #F4F0EB !important; }
.animate-slide-in-right p + p { color: rgba(168, 163, 157, 0.92) !important; }

/* ── Ink, not surface ─────────────────────────────────────────────────────────
   The token flip above treats navy-950 as "the page". In this app it is ALSO
   the ink that sits ON a gold button: more than thirty sites write
   bg-gold-400 ... text-navy-950, and a handful use it on red. Flipping the
   token to near-white to serve the first job turned every gold button into
   pale-on-gold — about 1.9:1, and 42 of the failures in the first audit.
   A colour that is used as TEXT has to stay dark when the theme flips, so it
   is pinned here rather than left to the token. */
[class~="text-navy-950"] { color: #1a1815 !important; }

/* ── Gold text stays GOLD ─────────────────────────────────────────────────────
   The audit is right that #F5A623 on a light surface is only about 1.9:1. I
   darkened every gold text to a readable bronze on that basis, and he rejected
   it: the accent stopped looking like the brand. He was explicit — put the
   bronze ones back to autumn yellow.

   So gold is NOT retinted here. It is the brand colour and it stays the brand
   colour; the cost is that small gold text on the light theme is faint. That is
   his call to make and it has been made. DO NOT re-darken it without asking.

   What is still fixed, because those were real bugs rather than a colour
   preference: the navy-950 ink on gold buttons above, and white text over a
   photograph (see the script in newPage — the Home service labels and the B2B
   block). */
`;

// ─── Home.tsx only ───────────────────────────────────────────────────────────
// Home is the ONE page in this app built on hardcoded hex values instead of the
// theme tokens: 145 of them, in arbitrary Tailwind classes like `bg-[#141210]`
// and `text-[#F5A623]`. The token flip above therefore cannot reach it, and the
// first run of this preview showed Home still fully dark while every other page
// re-themed cleanly.
//
// These rules translate that page's private palette by hand. They are scoped to
// the home route ON PURPOSE — `.text-white` and the greys appear on other pages
// too, and a global rewrite would misrepresent them.
//
// This is a PREVIEW of a light Home, not the change itself. Doing it for real
// means editing Home.tsx, and #F5A623 is also `--color-gold-400` — the same
// value written out by hand rather than referenced.
const HOME_LIGHT = `
[class~="bg-[#0E0C09]"]      { background-color: #f6f5f2 !important; }
[class~="bg-[#141210]"]      { background-color: #ffffff !important; }
[class~="bg-[#1C1916]"]      { background-color: #f4efe4 !important; }
[class~="bg-[#231F1A]"]      { background-color: #f4efe4 !important; }
[class~="bg-[#1C1612]"]      { background-color: #f4efe4 !important; }
[class~="bg-[#1a1612]"]      { background-color: #f1efea !important; }
[class~="bg-[#2A2018]"]      { background-color: #f1efea !important; }
[class~="bg-[#1E1B16]/90"]   { background-color: rgba(255,255,255,0.92) !important; }
[class~="bg-[#1C1612]/90"]   { background-color: rgba(255,255,255,0.92) !important; }
[class~="bg-[#232018]"]      { background-color: #ffffff !important; }
[class~="border-[#2a2520]"]  { border-color: #ddd8d0 !important; }

/* NOTE: no backticks anywhere in this comment. HOME_LIGHT is a JS template
   literal, so one backtick ends the string. That mistake has now been made
   twice in one session, here and in MonthlyReportModal. */

/* text-white sits on surfaces that were dark; inverted it must be near-black.
   text-[#1C1612] is deliberately left alone — it is the dark label ON a gold
   button, which stays dark in both themes.
   text-[#F5A623] is deliberately ABSENT: gold text stays gold, see the note on
   the gold rule above. */
.text-white                  { color: #1a1815 !important; }
[class~="text-[#A8A39D]"]    { color: #5f5a51 !important; }
[class~="text-[#8A847D]"]    { color: #5f5a51 !important; }
[class~="text-[#C5BEB5]"]    { color: #4a453e !important; }
[class~="text-[#D0C9B8]"]    { color: #4a453e !important; }

/* ── The hero stays DARK ──────────────────────────────────────────────────────
   Asked for directly: the top should stay a dark picture or gradient while the
   rest of the page goes light. That is a real and common pattern — dark hero,
   light body — so the hero is deliberately excluded from the light pass.

   The three scrim rules that used to sit above are gone rather than overridden:
   the hero is the ONLY place in Home that uses bg-[#0E0C09]/85 and the two
   gradient stops, so simply not rewriting them leaves the scrim intact.

   What still needed fixing is TEXT. The light rules above are page-wide, and
   .text-white is used by the hero headline AND by the body sections. So the
   hero's own colours are re-asserted here. These come AFTER the light rules and
   use a descendant selector, so they win on source order and on specificity.

   The nav is not involved: it is a fixed, solid bg-navy-950/97 bar driven by
   tokens, so it turns light with the rest of the chrome and stays readable. */
/* The scrim, LIGHTENED — dark but not black. He asked for a dark hero and then
   said it was too dark, so the photograph has to show through while the headline
   stays readable. These are the hero's own scrim classes rewritten with lower
   alpha, not removed: the flat overlay drops 0.85 to 0.52, the left gradient
   drops its /95 and /70 stops to 0.72 and 0.34, and the bottom fade softens so
   it no longer ends in a solid black band. */
[class~="min-h-screen"] [class~="bg-[#0E0C09]/85"] {
  background-color: rgba(14,12,9,0.55) !important;
}
[class~="min-h-screen"] [class*="from-[#0E0C09]"] {
  background-image: linear-gradient(to right,
    rgba(14,12,9,0.74), rgba(14,12,9,0.50), rgba(14,12,9,0.18)) !important;
}
[class~="min-h-screen"] [class*="from-[#141210]"] {
  background-image: linear-gradient(to top,
    rgba(20,18,16,0.88), rgba(20,18,16,0.46), rgba(20,18,16,0)) !important;
}

[class~="min-h-screen"] .text-white               { color: #ffffff !important; }
[class~="min-h-screen"] [class~="text-[#F5A623]"] { color: #F5A623 !important; }
[class~="min-h-screen"] [class~="text-[#C5BEB5]"] { color: #C5BEB5 !important; }
[class~="min-h-screen"] [class~="text-[#8A847D]"] { color: #8A847D !important; }
[class~="min-h-screen"] [class~="text-[#A8A39D]"] { color: #A8A39D !important; }

/* SURFACES as well as text. The feature strip pinned to the bottom of the hero
   is a dark bar — its blocks are bg-[#1E1B16]/90 over bg-[#0E0C09] — and the
   light rules above had repainted BOTH of them to near-white. The strip's own
   white text was then re-asserted by the rule directly above, which is how the
   page ended up with white words on a white bar: the exact patch he circled.

   Anything the hero owns keeps the hero's colours. The three py-24 sections
   further down the page use the same bg-[#0E0C09] class and are deliberately
   NOT covered — they are body, and they go light with the rest of the body. */
[class~="min-h-screen"] [class~="bg-[#1E1B16]/90"] { background-color: rgba(30,27,22,0.90) !important; }
[class~="min-h-screen"] [class~="bg-[#0E0C09]"]     { background-color: #0E0C09 !important; }
`;

// ─── Negative control ────────────────────────────────────────────────────────
// NEGATIVE=1 puts the four defects this palette was fixed for back on top, so
// the contrast probe can be SHOWN to still catch them.
//
// This matters because the palette and the probe were changed together. A probe
// that reports a clean pass only after being rewritten has proved nothing about
// itself — it may simply have stopped looking. With NEGATIVE=1 the same probe
// must light up again; if it does not, the pass is meaningless.
//
// The four, in the order they were found:
//   1. navy-950 flipped to near-white, so gold buttons went pale-on-gold
//   2. gold-400 used as text on a light surface (~1.9:1)
//   3. cream-300 left one hair under AA on the navy-700 chip (4.46:1)
//   4. the hero's feature strip repainted white while its text stayed white
const NEGATIVE = process.env.NEGATIVE === '1';
const NEG = NEGATIVE
  ? `
[class~="text-navy-950"] { color: #f6f5f2 !important; }
:root { --color-cream-300: #6b665d; }
[class~="min-h-screen"] [class~="bg-[#1E1B16]/90"] { background-color: rgba(255,255,255,0.92) !important; }
`
  : '';

// ─── Portals only ────────────────────────────────────────────────────────────
// Asked for directly: the staff and customer portals should sit on a plain
// WHITE page — no page tint at all — while the CARDS must still read as
// separate planes.
//
// That works because the card is already a warm cream (#f4efe4). Against the
// neutral off-white page the difference was a nudge; against pure white it is
// unmistakable, and the card also carries its own border and a 1px shadow. So
// the page goes to #ffffff and the card is left exactly as it is.
//
// The portal header band is bg-navy-900, which is already #ffffff, so the top
// of the page and the body finally agree.
//
// Scoped to the portals on purpose: Home keeps its own background.
const PORTAL_LIGHT = `
:root { --color-navy-950: #ffffff; }
html, body, #root, .page-wrapper { background-color: #ffffff !important; }
`;

const ADMIN_ID = '11111111-1111-1111-1111-111111111111';
const PUBLIC_ROUTES = [
  ['01-home', '/'],
  ['02-services', '/services'],
  ['03-about', '/about'],
  ['04-membership', '/membership'],
  ['05-partnerships', '/partnerships'],
  ['06-training', '/training'],
  ['07-contact', '/contact'],
  ['08-book', '/book'],
  ['09-login', '/login'],
  ['10-privacy', '/privacy'],
  ['11-terms', '/terms'],
];

// The admin tabs, in the order the tab bar renders them.
const ADMIN_TABS = ['Overview', 'Bookings', 'Users', 'Partners', 'Training', 'Messages', 'Reports', 'Security'];

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

// auth-js decodes the JWT client-side and never verifies the signature.
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

function mockUser(role) {
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
    factors: [],
  };
}

// Deliberately the same shape as run.js's setupMocks, trimmed to what a page
// render needs. No factor is enrolled, so sign-in lands straight on the portal
// with no step-up — this preview is about layout, not about the gate.
async function setupMocks(context, role) {
  const now = Math.floor(Date.now() / 1000);
  const iso = new Date().toISOString();
  const userObj = mockUser(role);

  await context.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  // PostgREST answers `.single()` with a bare OBJECT and a plain `.select()` with
  // an ARRAY — it decides from the Accept header. Returning one shape for both
  // breaks the other: an object where the Users tab expects a list makes `.map`
  // throw, which paints a "Failed to Load Users" toast over every screenshot.
  // That is what the first run of this preview did. Branch on the header instead
  // of guessing.
  const profileRow = {
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
  };
  await context.route('**/rest/v1/profiles**', (route) => {
    const accept = route.request().headers()['accept'] || '';
    const wantsObject = accept.includes('vnd.pgrst.object+json');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wantsObject ? profileRow : [profileRow]),
    });
  });

  // A partner with no approved application sees a gate with no tabs at all.
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
        access_token: makeJwt(ADMIN_ID, 'aal1'),
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: 'rt-1',
        user: userObj,
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
      body: JSON.stringify({ id: 'challenge-1', type: 'totp', expires_at: (now + 300) * 1000 }),
    })
  );
}

async function newPage(browser, role = 'admin', extra = '') {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript((css) => {
    const apply = () => {
      let el = document.getElementById('__light_preview');
      if (!el) {
        el = document.createElement('style');
        el.id = '__light_preview';
        (document.head || document.documentElement).appendChild(el);
      }
      el.textContent = css;
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
    else apply();
  }, LIGHT + extra + NEG);

  // ─── The ink only flips when the surface under it flips ────────────────────
  // The light rules swap the cream ramp to near-black page-wide. That is right
  // when the surface behind the text is a token that ALSO flipped — and wrong
  // when it is a colour that did not. The toast is bg-emerald-900 (a stock
  // Tailwind colour, untouched) with text-cream-100 (a token, flipped), so its
  // message came out dark-on-dark. Same shape of bug as the gold buttons.
  //
  // So: for any element whose colour is one of the flipped inks, composite the
  // surface actually behind it and put the ORIGINAL ink back when that surface
  // is dark. A photograph counts as dark — the answer there is unknowable, and
  // the original ink is the safer of the two.
  //
  // This is a preview-only repair. Nothing in src/ changes.
  await context.addInitScript(() => {
    // What each flipped ink was BEFORE the light theme darkened it.
    const ORIGINAL_INK = {
      'rgb(20, 18, 15)': '250, 250, 248', // cream-50  (was #FAFAF8)
      'rgb(26, 24, 21)': '244, 240, 235', // cream-100 (was #F4F0EB)
      'rgb(53, 49, 43)': '221, 216, 208', // cream-200 (was #DDD8D0)
      'rgb(95, 90, 81)': '168, 163, 157', // cream-300 (was #A8A39D)
    };

    const parse = (s) => {
      const m = /rgba?\(([^)]+)\)/.exec(s || '');
      if (!m) return null;
      const p = m[1].split(',').map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };

    // Is there a photograph behind this element? Either an ancestor with a url()
    // background, or one painted as a SIBLING underneath — the Home hero and the
    // B2B block both do the sibling thing, so an ancestor walk alone misses them.
    //
    // NOTE: this deliberately does NOT try to composite background colours. An
    // earlier version did, and it silently failed on the toast: Tailwind v4
    // writes an opacity modifier as color-mix(), and Chrome hands that back in a
    // colour syntax the rgb() regex above cannot read, so the dark layer was
    // dropped and the surface looked white. Structural checks cannot be fooled
    // that way. The toast's ink is fixed in CSS instead, next to the ink rule.
    const covers = (r, box) =>
      box.width > 1 &&
      box.height > 1 &&
      r.left >= box.left - 1 &&
      r.right <= box.right + 1 &&
      r.top >= box.top - 1 &&
      r.bottom <= box.bottom + 1;
    const onPhoto = (el) => {
      let n = el.parentElement;
      while (n) {
        const cs = getComputedStyle(n);
        if (cs.backgroundImage && cs.backgroundImage.includes('url(')) return true;
        n = n.parentElement;
      }
      const r = el.getBoundingClientRect();
      let a = el.parentElement;
      while (a) {
        for (const c of a.children) {
          if (c === el || c.contains(el)) continue;
          const cbi = getComputedStyle(c).backgroundImage;
          const isPhoto = c.tagName === 'IMG' || (cbi && cbi.includes('url('));
          if (isPhoto && covers(r, c.getBoundingClientRect())) return true;
        }
        a = a.parentElement;
      }
      return false;
    };

    const rescue = () => {
      document.querySelectorAll('*').forEach((el) => {
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
        let cs;
        try {
          cs = getComputedStyle(el);
        } catch (e) {
          return;
        }
        const fg = parse(cs.color);
        if (!fg) return;
        const key = `rgb(${Math.round(fg.r)}, ${Math.round(fg.g)}, ${Math.round(fg.b)})`;
        const orig = ORIGINAL_INK[key];
        if (!orig) return;
        if (!onPhoto(el)) return;
        el.style.setProperty('color', `rgba(${orig}, ${fg.a})`, 'important');
      });
    };
    const kick = () => {
      rescue();
      // The toast only appears once the mocked sign-in resolves, which lands
      // AFTER any fixed set of delays — a handful of timeouts kept missing it.
      // Poll instead of guessing, and stop once the page has settled.
      const iv = setInterval(rescue, 250);
      setTimeout(() => clearInterval(iv), 8000);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kick);
    else kick();
  });

  // ─── The light preview uses the dark-wordmark logo ─────────────────────────
  // The real file has "LUXURIOUS" in white and "CLEANING CO." in a pale tan, so
  // on a white page the first is invisible and the second barely there. The
  // built asset carries a content hash in its filename, so this matches on the
  // source name. Intercepted here rather than changed in src/ because the SAME
  // file is the correct one on the dark navbar — this is a preview, and the
  // live logo must not move. Built by make-logo-onlight.py.
  const LOGO_LIGHT = path.join(__dirname, 'logo-onlight.png');
  if (fs.existsSync(LOGO_LIGHT)) {
    await context.route('**/*image-3*', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', path: LOGO_LIGHT })
    );
  }

  await setupMocks(context, role);
  const page = await context.newPage();
  return { context, page };
}

async function shoot(page, name, label) {
  const file = path.join(OUT, `${name}.png`);
  try {
    // FOLD=1 shoots only what fits the viewport. A 6528px page downscaled to fit
    // a preview panel makes the hero unreadable, which is useless when the hero
    // is the thing being judged.
    await page.screenshot({ path: file, fullPage: !process.env.FOLD });
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    console.log(`  ${name.padEnd(22)} ${String(h).padStart(6)}px tall   ${label}`);
    return true;
  } catch (e) {
    console.log(`  ${name.padEnd(22)} FAILED  ${e.message.split('\n')[0]}`);
    return false;
  }
}

// Exported so other probes can render the SAME light palette instead of keeping
// their own copy of it. A second copy would drift the first time either changes,
// and the whole point of the contrast probe is that it audits the theme this
// file actually defines. `require.main === module` keeps the run below from
// firing on import.
async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  let shots = 0;

  console.log(`\n--- public pages (light tokens) ---`);
  for (const [name, route] of PUBLIC_ROUTES) {
    if (!wanted(name)) continue;
    const { context, page } = await newPage(browser, 'admin', route === '/' ? HOME_LIGHT : '');
    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1800);
      if (await shoot(page, name, route)) shots++;
    } catch (e) {
      console.log(`  ${name.padEnd(22)} NAVIGATION FAILED  ${e.message.split('\n')[0]}`);
    }
    await context.close();
  }

  // The three staff/customer portals plus the admin tabs. All four sign in
  // through the same form; only the role differs.
  const PORTALS = [
    { name: '12-portal-admin', role: 'admin', path: '/portal/admin', tabs: ADMIN_TABS },
    { name: '13-portal-cleaner', role: 'cleaner', path: '/portal/cleaner', tabs: ['Security'] },
    { name: '14-portal-partner', role: 'partner', path: '/portal/partner', tabs: ['Security'] },
    { name: '15-portal-customer', role: 'customer', path: '/portal/customer', tabs: [] },
  ];

  for (const p of PORTALS) {
    if (!wantedPortal(p)) continue;
    console.log(`\n--- ${p.path} (role: ${p.role}) ---`);
    const { context, page } = await newPage(browser, p.role, PORTAL_LIGHT);
    try {
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.locator('form').getByRole('button', { name: /Sign In/ }).waitFor({ timeout: 15000 });
      await page.locator('input[type=email]').fill('admin@test.local');
      await page.locator('input[type=password]').fill('not-a-real-password');
      await page.locator('form').getByRole('button', { name: /Sign In/ }).click();
      await page.waitForTimeout(4000);

      let landed = page.url().replace(BASE, '');
      if (!landed.startsWith('/portal')) {
        // A customer is routed to the home page after sign-in rather than into a
        // portal — that is the app's behaviour, not a failure of this preview.
        // The session is already stored, so the portal is one direct navigation
        // away. Without this the customer portal is simply never captured.
        await page.goto(BASE + p.path, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2500);
        landed = page.url().replace(BASE, '');
      }
      if (!landed.startsWith('/portal')) {
        console.log(`  could not reach ${p.path} (landed on ${landed}) — skipping`);
        await context.close();
        continue;
      }

      if (wanted(p.name) && (await shoot(page, p.name, `${landed} (default tab)`))) shots++;

      for (const tab of p.tabs) {
        const shotName = slugOf(p.name, tab);
        if (!wanted(p.name) && !wanted(shotName)) continue;
        const btn = page.getByRole('button', { name: new RegExp('^' + tab) }).first();
        if ((await btn.count()) === 0) {
          console.log(`  tab "${tab}" not present — skipped`);
          continue;
        }
        await btn.click();
        await page.waitForTimeout(1200);
        if (await shoot(page, shotName, `${landed} · ${tab}`)) shots++;
      }
    } catch (e) {
      console.log(`  FAILED  ${e.message.split('\n')[0]}`);
    }
    await context.close();
  }

  await browser.close();
  console.log(`\n--- ${shots} screenshot(s) written to ${OUT} ---`);
  process.exit(shots > 0 ? 0 : 1);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('preview error:', e);
    process.exit(2);
  });
}

module.exports = { LIGHT, HOME_LIGHT, PORTAL_LIGHT, setupMocks, newPage, PUBLIC_ROUTES, ADMIN_TABS };
