# Testing Checklist — Luxurious Cleaning Co.

Gamitin ito pagkatapos ng security hardening deployment. Sundan ang order —
ang Test 1 at 2 ang pinaka-importante dahil bagong-bago ang logic nila.

Site: **https://luxurious-cleaning-co.vercel.app**

---

## TEST 1 — Membership activation (server-side na ngayon)

**Bakit:** Dati, sa browser nangyayari yung activation. Ngayon, sa server na
(`activate_own_membership` RPC). Ito yung pinaka-malaking pagbabago.

### Steps

1. Mag-login bilang **customer** account
2. Pumunta sa `/membership`
3. Piliin ang **Bronze** (o kahit anong tier) → click **Join / Avail**
4. Fill out yung form (pangalan, email, phone, address, city, barangay)
5. Submit → may **confirmation modal** → click **Confirm**

### Dapat lumabas

- ✅ Success toast: *"Welcome to Bronze Membership!"*
- ✅ May lumabas na popup/modal na nagsasabi ng success
- ✅ **Walang error message**

### Kung FAIL

Kung may toast na **"Sync Warning"** o *"profile sync failed"* — ibig sabihin
hindi nakarating sa server. Sabihin mo sa akin.

### Paano i-verify sa database (opsyonal)

Sa Supabase SQL Editor:

```sql
SELECT name, membership_tier, membership_status, updated_at
  FROM public.profiles
 WHERE membership_status = 'active';
```

Dapat may row na may `membership_tier = 'bronze'` at bagong `updated_at`.

---

## TEST 2 — Admin: i-approve yung membership

*(Kailangan ito para malaman kung nababasa pa ng admin yung profiles.)*

**Bakit:** Nag-revoke tayo ng table-level SELECT sa `profiles`. Kailangan
siguraduhing **gumagana pa rin ang admin views**.

### Steps

1. Mag-login bilang **admin** account
2. Pumunta sa `/portal/admin`
3. Click ang **Users** tab (mga tab: Overview, Bookings, Users, Partners, Training, Messages)
4. Tignan kung lumalabas yung mga pangalan

### Dapat lumabas

- ✅ Lumalabas yung listahan ng users **na may pangalan**
- ✅ Hindi blangko ang mga field (name, email, phone)
- ✅ Yung bagong-activated membership (Test 1) ay lumalabas

### Kung FAIL

Kung **blangko** yung mga pangalan o walang lumabas — ibig sabihin nasobrahan
natin yung pag-revoke. Sabihin mo agad.

---

## TEST 3 — Resume upload (private bucket)

**Bakit:** Ginawa nating private yung bucket. Dati, pwedeng buksan ng kahit sino
na may link. Ngayon, signed URL na (10 minuto).

### Steps

1. Mag-login bilang **customer**
2. Pumunta sa `/training`
3. Piliin ang isang program
4. Fill out: Full Name, Email, Phone
5. Sa **Resume (optional)** → mag-upload ng PDF o Word file
6. Submit

### Dapat lumabas

- ✅ Successful submission
- ✅ Walang error

### Pagkatapos — i-check sa admin

7. Mag-login bilang **admin** → `/portal/admin`
8. Click ang **Training** tab (para sa cleaner applications)
9. Hanapin yung application mo → click yung **resume filename button** (may file icon)

### Dapat lumabas

- ✅ **Bumukas yung PDF/Word** sa bagong tab
- ✅ Naglo-load siya — hindi "Access Denied" o "Not Found"

### Mahalagang test — i-verify na PRIVATE na

10. Sa admin, i-right-click yung file button → **Copy link address**
11. Buksan yung link sa **incognito window** (para walang login)

### Dapat lumabas

- ✅ **Hindi bumukas** — error, o blangko
- ❌ Kung bumukas pa rin → **hindi umandar yung fix**

*(Note: kung nakita mo yung `signedUrl` mula sa admin page, ito ay
panandaliang link — normal na mag-expire after 10 minuto.)*

---

## TEST 4 — Approve cleaner/partner (yung dating SIRA feature)

**Bakit:** Ito yung pinaka-malaking nahanap natin — **wala pang naka-deploy na
edge function** dati, kaya sira yung feature na ito. Ngayon gumagana na.

### Steps

1. Mag-submit muna ng application:
   - Buksan `/training` → mag-apply (kasama yung resume sa Test 3)
   - O `/partnerships` → mag-apply bilang partner
2. Mag-login bilang **admin** → `/portal/admin`
3. Click ang **Training** tab (cleaner) o **Partners** tab (partner)
4. Hanapin yung application → click **Approve** → may confirmation modal → **Approve**

### Dapat lumabas

- ✅ May lumabas na **credentials** (email + temporary password)
- ✅ May **Employee ID** (cleaner) o **Company Code** (partner)
- ✅ Success message

### Kung FAIL

Kung **walang lumabas** na credentials, o error — sabihin mo agad.

**Bakit importante:** dati, tahimik na nabibigo ito (may "fail-soft" sa code),
kaya hindi mo napansin. Ngayon dapat may lumabas na credentials.

---

## TEST 5 — Customer booking (regression test) — ✅ PASSED

**Bakit:** Sinuri lang natin yung security. Kailangan siguraduhing **hindi natin
nasira** yung normal na booking.

**Detalyadong hakbang:** `05_TEST5_booking_regression.sql` (9 sections, T5.0a–T5.8)
**Baseline check:** `05_TEST5_booking_regression.sql` T5.0c — migration status
**Deploy copies:** `06_MIGRATION_006_membership_benefits.sql`, `07_MIGRATION_009_booking_timeline.sql`

### Results — 30 Set 2026

| Section | Test | Result |
|---|---|---|
| T5.0a | Column privileges ng `bookings` | ✅ PASS |
| T5.0b | 5 RLS policies present | ✅ PASS |
| T5.0c | Migration status (002→008) | ⚠️ 006 MISSING → naayos |
| T5.1 | Gumawa ng booking | ✅ PASS |
| T5.1b | Nasa DB, tama ang member columns | ✅ PASS |
| T5.2 | Lumabas sa admin dashboard | ✅ PASS |
| T5.3 | Status update nag-persist | ✅ PASS |
| T5.4 | Delete habang `awaiting_review` | ✅ PASS |
| T5.5 | Delete habang `approved` | ✅ N/A — hindi maabot sa UI |
| T5.6 | Timeline nag-persist | ❌ FAIL → **NAAYOS** |
| T5.7 | Cleaner assignment FK + cleaner portal | ✅ PASS |

### Tatlong nahanap, isang totoong bug

**1. Migration 006 hindi na-apply** (nahanap ng T5.0c)
Ang `bookings.priority`, `member_tier`, `discount_percent` ay wala sa live DB.
Dahil graceful ang app (may fallback ang `insertBookingRow()`), walang error sa
UI — pero **hindi nase-save ang membership priority/tier/discount** ng bawat
booking. Tahimik na nawawalang feature.
**Ayos:** `06_MIGRATION_006_membership_benefits.sql` — ✅ applied, verified.

**2. Timeline hindi napi-persist** (nahanap ng T5.6) — *totoong bug*
Ang `booking_timeline` ay **0 rows** kahit may booking at status changes na.
Nasa React state lang ang timeline, kaya **nawawala ang buong history section
pagkatapos ng reload** (`CustomerPortal.tsx` ay naka-guard sa
`booking.timeline.length > 0`).
**Ayos:** `07_MIGRATION_009_booking_timeline.sql` — DB trigger (`log_booking_timeline`)
na fail-safe. ✅ applied, verified.

**3. Booking form hindi nakukuha ang profile** (nahanap sa gitna ng test)
Ang `/book` ay public route, kaya nag-mount ang `Booking` bago ma-resolve ang
auth at `''` ang nakuha ng `useState` para sa name/email/phone. Pagkatapos
mag-login, hindi na nag-update — kaya **naka-disable ang Continue button** at
**blangko ang Personal Information panel**.
**Ayos:** commit `9156692` — sync effect sa `Booking.tsx`. ✅ deployed, verified.

**Hindi bug:** ang "ghost booking" (T5.5). Ang UI guard
(`['pending','awaiting_review','cancelled']`) ay **subset** ng RLS DELETE policy,
kaya hindi ito maabot sa UI. Latent risk lang — hindi aktibong bug.

### Ano ang pinatunayan ng T5.7

Gumawa ng totoong cleaner account (signup → role dropdown → `cleaner`) at in-assign
sa isang booking. Kumpirmado:
- ✅ Naka-write ang `cleaner_id` bilang **valid UUID** (hindi NULL) — gumagana ang
  `isUuid()` guard at ang FK papuntang `profiles`
- ✅ `status` naging `cleaner_assigned`
- ✅ **Naka-log ang `Cleaner Assigned` sa timeline** — unang beses na na-test ang
  `cleaner_id` branch ng migration 009 trigger
- ✅ Nakita ng cleaner ang booking sa `/portal/cleaner` — gumagana ang RLS SELECT
  policy (`cleaner_id = auth.uid()`)
- ✅ Bonus: gumagana rin ang role dropdown ng migration 008 sa totoong account

### Manual UI check (mabilis na bersyon)

1. Mag-login bilang **customer** (yung may active membership)
2. Pumunta sa `/book` → dapat **may laman** ang Personal Information panel
3. Fill out lahat ng steps → Submit
4. Dapat: successful booking + discount (kung member) + priority badge
5. `/portal/customer` → lumabas ang booking
6. **I-reload** → dapat **nandiyan pa rin** ang timeline history
7. Admin dashboard → makita ang booking → palitan ang status → i-reload → nanatili

---

## TEST 6 — Profile update (yung pinaka-madaling masira)

**Bakit:** Nag-narrow tayo ng pwede i-update: `name`, `phone`, `avatar_url` lang.
Kailangan siguraduhing **gumagana pa** yung profile edit.

### Steps

1. Mag-login bilang **customer**
2. Pumunta sa `/portal/customer` → click ang **Profile** tab
3. Palitan yung **Name** o **Phone**
4. Save

### Dapat lumabas

- ✅ Success message: *"Profile updated successfully"*
- ✅ Nagbago yung pangalan sa navbar/dashboard

### Refresh test

5. I-refresh yung page (F5)

### Dapat lumabas

- ✅ **Nanatili** yung binago mo

### Kung FAIL

Kung may error na *"permission denied"* o hindi nag-save — sabihin mo agad.
Ibig sabihin, nasobrahan natin yung pag-restrict.

---

## TEST 7 — Yung security (dapat MABIGO)

Ito yung test na **dapat FAIL** — para makita mong gumagana yung proteksyon.

### Test 7a — Subukang maging Gold nang libre

**Paalala:** Yung app ay hindi nag-e-expose ng `supabase` client sa `window`,
kaya hindi basta-basta matatakbo sa console. Ang pinaka-madaling paraan ay
gamitin ang **membership cancel** flow — kung gumana ito, ibig sabihin
gumagana rin yung tamang daan, at ang direktang hack ay harang.

```js
// Sa console — i-check kung naka-expose (kadalasan wala)
typeof window.supabase
```

**Dapat lumabas:** `"undefined"`

**Ibig sabihin:** ✅ walang madaling daan para sa attacker mula sa console.

### Test 7b — Ang tunay na verification (sa database)

Ito ang **pinaka-tiyak na test**. Sa **Supabase SQL Editor**:

```sql
-- Tignan kung may nag-self-upgrade na hindi dumaan sa RPC
SELECT name, role, membership_tier, membership_status
  FROM public.profiles
 WHERE membership_status = 'active';
```

Tapos subukan ang **direktang attack** sa SQL Editor (naka-role ka bilang
`postgres`, kaya hindi ito ang aktwal na test ng trigger — pero makikita mo
kung anong values ang nasa table):

```sql
-- Ito yung inaasahang resulta pagkatapos ng lahat ng tests:
SELECT
  has_column_privilege('authenticated','public.profiles','role','UPDATE')             AS auth_can_edit_role,
  has_column_privilege('authenticated','public.profiles','membership_tier','UPDATE')  AS auth_can_edit_tier,
  has_column_privilege('authenticated','public.profiles','name','UPDATE')             AS auth_can_edit_name;
```

**Dapat lumabas:**

| auth_can_edit_role | auth_can_edit_tier | auth_can_edit_name |
|---|---|---|
| `false` | `false` | `true` |

**Ibig sabihin:** ✅ hindi pwedeng i-edit ng customer yung `role` o
`membership_tier`, pero pwede pa ring i-edit yung `name`. Ito yung depensa
sa SQL privilege layer, **doble** sa trigger.

### Test 7c — Yung pinaka-praktikal

1. Mag-login bilang customer na **walang** membership
2. Pumunta sa `/portal/customer` → **Membership** tab
3. Dapat **wala pang** active membership

*(Kung hindi ka naging Gold nang hindi dumaan sa `/membership` form, gumagana
yung proteksyon.)*

---

## TEST 8 — Edge function (verified na natin)

**Tapos na ito** — nakita mo na yung:

```json
{"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization header"}
```

Kaya **laktawan** na natin ito. ✅

---

## TEST 9 — PIN step-up (lockout + gated actions) — 🆕 30 Set 2026

**Ano ito:** ang PIN ay hindi login credential. Ito ay **step-up re-authentication** bago ang mapanganib na aksyon — proteksyon laban sa (a) nakabuwang session sa shared o iniwang device, at (b) hiram na session ng kapwa staff.

**⚠️ BAGO KA MAGSIMULA:**
- Gumamit ng **throwaway PIN** (hal. `135790`), hindi ang tunay na PIN mo. Sa P7 ay **sadya** nating i-lock ito.
- Ang **P1 ang pinakamahalagang test.** Kung sira ang inline na password check, **walang makakagawa ng unang PIN** — at hindi iyon lalabas sa SQL Editor, sa UI lang.
- Kailangan ng staff account (admin / cleaner / partner). Wala ito sa customer portal.

---

### SITTING 1 — ang Security tab

**⚠️ Mahalaga ang ORDER.** Ang panel ay may **dalawang mode**:
- **"Create Your PIN"** (walang PIN pa) → hihingi ng **account password**
- **"Change Your PIN"** (may PIN na) → hihingi ng **current PIN**

Kaya ang P2 at P3 ay **kailangang gawin bago ang P1** — o pagkatapos ng DB reset sa ibaba. Kapag nakagawa ka na ng PIN, hindi na lalabas ang password field.

**Phase A — habang "Create Your PIN" pa:**

| # | Gawin | Dapat |
|---|---|---|
| **P2** | Iwan blangko ang password → tingnan ang button | 🔒 Naka-**disabled** |
| **P3** | **Maling** password → Create PIN | ❌ `account password is incorrect` |
| **P1** | Tamang password → Create PIN | ✅ **"Your PIN has been created."** |

**Phase B — pagkatapos ng P1, "Change Your PIN" na:**

| # | Gawin | Dapat |
|---|---|---|
| **P4** | Iwan blangko ang **Current PIN** → tingnan ang button | 🔒 Naka-**disabled** |
| **P5b** | **Maling** Current PIN → Change PIN | ❌ `current PIN is incorrect` — at bawas ang attempts |
| **P5** | Tamang Current PIN + bagong PIN → Change PIN | ✅ **"Your PIN has been changed."** |

**⚠️ Tapat na paalala sa P2 at P4:** hindi nila na-te-test ang server. Hinaharang na ng UI (`canSubmit` sa `PinSettings.tsx` ay nangangailangan ng password / current PIN bago i-enable ang button). Ang **P3 at P5b** ang nagpapatunay na buhay at **totoo** ang server-side check — hindi lang basta tumatakbo.

**⚠️ Ang P5b ay kumakain ng isang attempt.** May 5 bago ma-lock, kaya safe — pero huwag ulit-ulitin.

**Kung kailangan mong bumalik sa "Create Your PIN"** (para sa P3 pagkatapos ng P1):

```sql
UPDATE public.profiles
   SET pin_hash = NULL, failed_pin_attempts = 0, pin_locked_until = NULL
 WHERE email = 'TEST_ADMIN_EMAIL';
```

### Results — 30 Set 2026

| # | Resulta | Petsa |
|---|---|---|
| **P1** | ✅ **PASSED** — "Your PIN has been created." | 30 Set, 17:31 |
| **P4** | ✅ PASSED — disabled ang button | 30 Set, 17:34 |
| **P5b** | ✅ PASSED — tinanggihan ang maling current PIN | 30 Set, 17:34 |
| **P5** | ✅ PASSED — "Your PIN has been changed." | 30 Set, 17:34 |
| **P8** | ✅ PASSED — tumakbo ang gated action | 30 Set, 17:36 |
| **P9** | ✅ PASSED — hinarang ang maling PIN | 30 Set, 17:36 |
| **P10** | ✅ PASSED — walang PIN prompt sa hindi-gated | 30 Set, 17:36 |
| **P7** | ✅ PASSED — `failed_pin_attempts = 5`, nag-lock | 30 Set, 17:42 |
| **P7b** | ✅ PASSED — tinanggihan ang tamang PIN habang naka-lock | 30 Set, 17:49 |
| **P3** | ⏳ **hindi pa na-test** — tingnan sa ibaba | |

**⚠️ Ang isang butas na natitira: P3.** Ang P1 na pumasa ay nagpapatunay na **nabasa** ang `auth.users.encrypted_password` at **tumugma** — ngunit consistent pa rin iyon sa isang implementation na laging `true`. Ang P3 (maling password → tatanggi) lang ang nagsasara niyan. Kailangan nito ng DB reset dahil "Change Your PIN" mode na ang panel.

**Ang P3 ay ang huling hindi pa nasusubukang branch ng `set_user_pin()`.**

### Ano ang napatunayan ng TEST 9

| Kung pumasa | Ibig sabihin |
|---|---|
| P1 | Buhay ang inline na bcrypt check — may paraan pa ring makagawa ng unang PIN |
| P5b | Totoo ang check laban sa current PIN — hindi nadadaanan ng basta-bastang pag-set |
| P7 · P7b | Server-side ang lockout at tinatanggihan kahit ang **tamang** PIN — hindi ito nadadaanan ng brute force |
| P8 · P9 | Buhay ang gate sa tamang PIN, at hinaharang ang mali |
| P10 | Hindi nasobrahan ang gating — hindi mapipilitang ibahagi ng staff ang PIN nila |

### ⚠️ Aral sa pag-test: i-verify ang email laban sa `role`

Dalawang beses kong isinulat ang **customer test email** sa isang SQL snippet bilang "admin email". **Customer pala iyon.** Ang resulta: `may_pin = false` at `naka_lock_pa = NULL` — naghanap tayo ng bug na wala naman.

**Bago magsulat ng email sa kahit anong query, tignan muna ang `profiles.role`:**

```sql
SELECT p.email, u.email AS auth_email, p.role,
       (p.pin_hash IS NOT NULL AND p.pin_hash <> '') AS may_pin,
       left(p.pin_hash, 4) AS hash_prefix, p.failed_pin_attempts, p.pin_created_at
FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id
ORDER BY (p.pin_hash IS NOT NULL) DESC;
```

### Para ma-test ang P3 (opsyonal, ~2 minuto)

```sql
UPDATE public.profiles
   SET pin_hash = NULL, failed_pin_attempts = 0, pin_locked_until = NULL
 WHERE email = 'TEST_ADMIN_EMAIL';
```

Pagkatapos: **Security tab** → "Create Your PIN" na ulit → **maling password** → dapat `account password is incorrect`. Tapos gawin muli ang PIN gamit ang **tamang** password.

**⚠️ Bakit mahalaga ang P1:** ito lang ang test na, kung bumagsak, **hindi magagamit ng kahit sino ang buong PIN feature** — at hindi ito lumalabas sa SQL Editor, sa UI lang. Ang P1 na pumasa ay nagpapatunay na:
- nababasa ang `auth.users.encrypted_password` (kung NULL iyon, tatanggi sana ang function),
- tumatakbo ang `extensions.crypt()` comparison,
- at may paraan pa ring makagawa ng unang PIN pagkatapos ng REVISYON 2.

**Ang natitirang butas:** ang P1 na pumasa ay **hindi pa** nagpapatunay na *totoo* ang comparison — consistent pa rin ito sa isang implementation na laging `true`. Iyon ang sinasagot ng **P3** (maling password → dapat tumanggi) at ng **P5b** (maling current PIN → dapat tumanggi).

---

### SITTING 2 — ang lockout at ang 5 gates (P7–P10)

**⚠️ Mahalaga ang ORDER.** Ang P7 ay maglo-lock ng PIN ng **15 minuto** at tatanggihan kahit ang tamang PIN. Kaya gawin ang P8–P10 **bago** ang P7.

**Phase C — habang hindi pa naka-lock:**

| # | Gawin | Dapat |
|---|---|---|
| **P8** | Gated action na may **TAMANG** PIN | ✅ Tumatakbo ang aksyon |
| **P9** | Gated action na may **MALING** PIN | ❌ Hindi tumatakbo · `Incorrect PIN` · bawas ang attempts |
| **P10** | **Hindi-gated**: assign cleaner · status → `in_progress` · save notes · upload photo · partner **reject** | ✅ **WALANG PIN prompt** |

*(Ang dating "P6 — verify correct PIN" ay nasasakop na ng P8: ang P8 ay nagbe-verify ng PIN at nagpapatakbo ng aksyon sa isang hakbang.)*

**Phase D — ang lockout, huling gawin:**

| # | Gawin | Dapat |
|---|---|---|
| **P7** | Gated action na may MALING PIN **×5** | ❌ Naka-lock pagkatapos ng ika-5 · countdown na 15:00 |
| **P7b** | Pagkatapos ma-lock, subukan ang **TAMANG** PIN | ❌ **Tumanggi pa rin** — ito ang punto ng lockout |

**Ang 5 gated na aksyon:**
1. Admin — pagpalit ng role ng user
2. Admin — pag-approve ng partnership (**`approved` lang**)
3. Admin — pag-delete ng booking
4. Admin — pag-delete ng training application
5. Cleaner — markahan na `completed`

**Kung may lumabas na PIN prompt sa P10** → nasobrahan ang gating. Sabihin agad.

---

### Reset kung na-lock ka sa sarili mo

Patakbuhin sa SQL Editor (nagpapatakbo ito bilang `postgres`, kaya lumalampas sa column privileges):

```sql
UPDATE public.profiles
   SET failed_pin_attempts = 0, pin_locked_until = NULL
 WHERE email = 'TEST_ADMIN_EMAIL';
```

---

### Ano ang pinatutunayan nito

| Kung pumasa | Ibig sabihin |
|---|---|
| P1 | Ang inline na bcrypt check sa `set_user_pin()` ay buhay — may paraan pa ring makagawa ng unang PIN |
| P3 | Server-side ang password check, hindi UI-only — hindi ito mababypass sa direktang RPC call |
| P7b | Ang lockout ay tumatanggihan **kahit tama** ang PIN — hindi ito nadadaanan ng brute force |
| P10 | Hindi nasobrahan ang gating — hindi mapipilitang ibahagi ng staff ang PIN nila |

---

## Buod — ano ang uunahin

| Test | Importansya | Bakit |
|---|---|---|
| **1** Membership | 🔴 Mataas | Bagong server-side logic |
| **2** Admin view | 🔴 Mataas | Baka nasobrahan yung revoke |
| **3** Resume | 🔴 Mataas | Bagong private bucket |
| **4** Approve | 🟡 Katamtaman | Dating sira — dapat gumana na |
| **5** Booking | 🟡 Katamtaman | Regression check |
| **6** Profile | 🟠 Mababa pero mabilis | Madaling masira |
| **7** Hack test | 🟢 Bonus | Para makita mong secure |
| **9** PIN step-up | ✅ **PASSED** | 9 sa 10 pumasa; P3 lang ang natitira |

**Minimum:** Subukan ang **1, 2, 3, at 6.** Kung pumasa lahat, malamang ok na.

**Ngayon:** ✅ **TEST 9 (PIN step-up) — 9 sa 10 pumasa.** Ang tanging hindi pa na-test ay **P3** (maling account password → tatanggi), na kailangan ng mabilisang DB reset. Tingnan ang TEST 9 sa itaas.

---

## Kung may FAIL — sabihin mo ito

Para mabilis kong ma-diagnose, sabihin mo:

1. **Alin** na test
2. **Ano** ang ginawa mo (yung last click)
3. **Ano** ang lumabas (exact na mensahe — o screenshot)
4. Kung may error sa browser console — i-paste mo

Huwag mo nang subukang ayusin mag-isa. Sabihin mo lang, at ako ang mag-aayos.
