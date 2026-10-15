# Deployment Guide — Security Hardening

Two things need to reach your live Supabase project:

| # | Ano | Nasaan ang source | Paraan |
|---|-----|-------------------|--------|
| 1 | Database migration | `LC/supabase/migrations/007_security_hardening.sql` | SQL Editor (madali) |
| 2 | Edge function | `LC/supabase/functions/create-account/index.ts` | Supabase Dashboard (madali) |

**Wala kang kailangang i-install.** Sundan lang ang dalawang bahagi sa ibaba.

---

## ⚠️ Bakit hindi gumana yung nauna

Nag-paste ka ng:

```
supabase db push
supabase functions deploy create-account
```

sa **SQL Editor**. Yung error:

```
42601: syntax error at or near "supabase"
```

Ang SQL Editor ay para sa **SQL lang** (`SELECT`, `CREATE TABLE`, …). Ang
`supabase db push` ay isang **shell command** — tumatakbo ito sa terminal, hindi
sa database. Ganito dapat:

| Command | Saan | Para saan |
|---------|------|-----------|
| `supabase db push` | Terminal (bash / PowerShell) | I-apply ang migration files sa live DB |
| `supabase functions deploy create-account` | Terminal | I-upload ang edge function |

Kailangan din ng **Supabase CLI** at **naka-link na project** — wala ka pa nito
(sinuri ko: `supabase: command not found`, at walang `supabase/.temp/project-ref`).

Kaya **Dashboard route** ang susundan natin. Walang terminal.

---

## BAHAGI 1 — Database migration

### 1.1 Buksan ang SQL Editor

1. Pumunta sa **https://supabase.com/dashboard**
2. Piliin ang project mo (Luxurious Cleaning)
3. Sa kaliwang menu, hanapin ang **SQL Editor** (icon na parang `>_`)
4. Click **New query**

### 1.2 I-paste ang buong file

Buksan ito sa text editor:

```
C:\Users\charles\OneDrive\Desktop\LuxuriousCleaning\deploy\01_PASTE_IN_SQL_EDITOR.sql
```

**Kopyahin ang LAHAT** (Ctrl+A, Ctrl+C), tapos i-paste sa SQL Editor.

> **Importante:** Huwag i-paste lang ang unang linya. Kailangan ang **buong 372
> linya** — kasama yung mga `CREATE FUNCTION`, `DROP TRIGGER`, at `DO $$` blocks
> sa dulo.

### 1.3 Patakbuhin

Click **Run** (o `Ctrl+Enter`).

**Dapat itong magtagumpay** — `Success. No rows returned`.

Kung may error, tingnan ang **Troubleshooting** sa ibaba.

### 1.4 I-verify

Gumawa ng bagong query at i-paste ito:

```sql
-- Dapat 0 rows — hindi na mababasa ng client yung pin_hash
SELECT count(*) AS dapat_zero
  FROM information_schema.column_privileges
 WHERE table_name = 'profiles'
   AND grantee = 'authenticated'
   AND privilege_type = 'SELECT'
   AND column_name = 'pin_hash';

-- Dapat 'f' (false) — private na yung resumes bucket
SELECT public AS dapat_false FROM storage.buckets WHERE id = 'resumes';

-- Dapat 2 rows — yung dalawang trigger
SELECT tgname
  FROM pg_trigger
 WHERE tgrelid = 'public.profiles'::regclass
   AND NOT tgisinternal;

-- Dapat 5 rows — yung limang RPC
SELECT proname
  FROM pg_proc
 WHERE proname IN ('set_user_pin','verify_user_pin','has_user_pin',
                   'activate_own_membership','cancel_own_membership');
```

---

## BAHAGI 2 — Edge function (`create-account`)

### 2.1 Buksan ang Edge Functions

1. Sa parehong dashboard, hanapin ang **Edge Functions** sa kaliwang menu
2. Hanapin yung **`create-account`** sa listahan
3. Click ito

### 2.2 I-update ang code

1. Buksan ito sa text editor:
   `LC\supabase\functions\create-account\index.ts`
2. **Kopyahin lahat** (Ctrl+A, Ctrl+C)
3. Sa dashboard, click **Edit** (o yung code area)
4. **I-select lahat ng laman** (Ctrl+A) — importante ito, kundi madodoble ang code
5. I-paste yung bago
6. Click **Deploy**

### 2.3 I-set ang environment variable

Kailangan ng function na malaman ang site URL para sa password-reset links.

1. Sa **Edge Functions → create-account → Settings**
2. Hanapin ang **Environment variables** (o **Secrets**)
3. Magdagdag:

| Name | Value |
|------|-------|
| `PUBLIC_SITE_URL` | `https://luxuriouscleaning.ph` |

> Palitan ng totoong domain mo. Kung wala pa, gamitin yung Figma Make preview URL.

`SUPABASE_URL` at `SUPABASE_SERVICE_ROLE_KEY` ay **automatic** na — hindi mo na
kailangang idagdag.

### 2.4 I-verify

Sa **Edge Functions → create-account → Logs**, dapat walang error.

Para masubukan kung tumatanggap na ng auth check — buksan sa browser:

```
https://<project-ref>.supabase.co/functions/v1/create-account
```

Dapat itong magbalik ng **`{"error":"Method not allowed"}`** — ibig sabihin
tumatakbo siya. (GET, kaya tinatanggihan.)

Kung **`{"error":"Unauthorized: missing bearer token"}`** — mabuti rin yun,
ibig sabihin umaandar yung auth check.

---

## Sunod-sunod na checklist

- [ ] **Bahagi 1** — Na-paste at na-run sa SQL Editor
- [ ] **Bahagi 1.4** — Na-verify: 0 rows, `f`, 2 triggers, 5 RPCs
- [ ] **Bahagi 2.2** — Na-deploy yung bagong edge function
- [ ] **Bahagi 2.3** — Na-set yung `PUBLIC_SITE_URL`
- [ ] **Bahagi 2.4** — Nagbalik ng error message (hindi 404)

---

## Pagkatapos ng deployment — subukan ito

### Test 1: Hindi na maka-self-upgrade sa Gold

1. Mag-login bilang **customer** account
2. Buksan ang **browser console** (F12 → Console)
3. I-paste ito:

```js
// Palitan ng totoong user id mo (makikita sa console logs o sa profile)
const userId = 'ILAGAY_DITO_YUNG_UUID';

// Subukan nating gawing gold — dapat MA-BASTA ito
const { data, error } = await window.__supabase
  .from('profiles')
  .update({ membership_tier: 'gold', membership_status: 'active' })
  .eq('id', userId)
  .select()
  .single();

console.log('Result:', data, error);
```

**Inaasahan:** `membership_tier` ay **hindi magbabago** — mananatiling `null` o
ang dating value. Kung nagbago, **hindi umandar yung migration**.

> **Paalala:** kailangan ma-expose yung supabase client sa `window`. Kung hindi,
> gamitin yung normal na membership flow sa `/membership` page — dapat gumana pa
> rin yun (dahil tinatawag nito yung `activate_own_membership` RPC).

### Test 2: Hindi na public ang resume

1. Mag-apply sa `/training` na may resume attachment
2. Kunin yung file path (nasa `resume_url` column ng `training_applications`)
3. Subukang buksan ang public URL:

```
https://<project-ref>.supabase.co/storage/v1/object/public/resumes/<path>
```

**Inaasahan:** `{"statusCode":"404","error":"not_found"}` o `403`.

Sa admin dashboard, dapat **gumagana pa rin** yung link — gumagawa na siya ng
signed URL ngayon.

---

## Pag-rollback (kung may masira)

Yung migration ay **idempotent** — pwede mong i-run ulit nang walang problema.

Kung kailangan mong ibalik yung public bucket (hindi recommended):

```sql
UPDATE storage.buckets SET public = TRUE WHERE id = 'resumes';
DROP POLICY IF EXISTS "resumes: owner or admin read" ON storage.objects;
CREATE POLICY "resumes: public read"
  ON storage.objects FOR SELECT USING (bucket_id = 'resumes');
```

Kung kailangan mong i-disable yung column freeze (hindi recommended):

```sql
DROP TRIGGER IF EXISTS profiles_enforce_column_privileges ON public.profiles;
```

---

## Troubleshooting

### `ERROR: 42501: must be owner of table profiles`

Naka-login ka sa maling role. Sa SQL Editor, dapat automatic na `postgres`.
Kung hindi, i-run muna:

```sql
SET ROLE postgres;
```

### `ERROR: 42883: function public.current_user_role() does not exist`

Hindi pa na-apply yung `001_initial_schema.sql`. Kailangan mo munang i-run yun.
Sa SQL Editor, i-run muna:

```
LC\supabase\migrations\001_initial_schema.sql
```

tapos `002`, `003`, `004a`, `004b`, `005`, `006`, at sa huli `007`.

### `ERROR: 42P01: relation "storage.buckets" does not exist`

Hindi ito Supabase project — regular Postgres. Yung storage policies ay
Supabase-specific. Lumpuhin yung Bahagi 5 (section 5) ng migration.

### `ERROR: 42710: policy already exists`

Hindi dapat mangyari — may `DROP POLICY IF EXISTS` na. Kung nangyari,
i-run lang ulit yung buong file.

### Yung error sa SQL Editor na `42601: syntax error at or near "supabase"`

Ibig sabihin, nag-paste ka ng **shell command** sa SQL Editor. Balik sa
**BAHAGI 1** — SQL lang ang ipi-paste doon.

---

## Reference: ano ang binabago

| Ano | Dati | Ngayon |
|-----|------|--------|
| `pin_hash` | Mababasa ng client | Hindi na (`REVOKE SELECT`) |
| PIN hashing | SHA-256 sa browser | bcrypt sa database |
| `membership_tier` | Client pwedeng mag-edit | Frozen (trigger) |
| `role` | Client pwedeng mag-edit | Frozen (trigger) |
| `resumes` bucket | `public = true` | `public = false` |
| Resume access | Kahit sino may link | Owner o admin lang |
| Resume URL | Permanenteng public | Signed, 10 minuto |
| Resume read policy | Walang check | Owner folder check |
| Resume write policy | Kahit saang path | Sariling folder lang |
| `create-account` | Walang auth | Admin token required |
| `create-account` errors | Leak ng internal details | Generic lang |
| Edge function password | 12 chars, skewed | 16 chars, CSPRNG |
| Password delivery | Email plaintext | Reset link lang |
