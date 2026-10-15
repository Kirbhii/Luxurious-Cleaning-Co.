# PIN — Desisyon Bago ang Code

**Petsa:** 30 Set 2026
**Konteksto:** Natanong mo kung okay bang lagyan ng PIN ang admin / partner / cleaner
para sa seguridad. Tapos na ang testing, kaya desisyon na ang kailangan — hindi code.

---

## Ang problema sa "PIN bilang login credential"

Ito ang orihinal na plano: **pagkatapos mag-logout ng staff, ang PIN ang gagamitin niyang pang-login.**

Tiningnan ko ang code, at **hindi ito gagana sa existing na `verify_user_pin()`**:

```sql
CREATE OR REPLACE FUNCTION public.verify_user_pin(p_pin TEXT)
...
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
```

**Nangangailangan siya ng `auth.uid()`** — pero sa oras ng login, **wala pang session**, kaya `auth.uid()` ay NULL at **mag-e-error siya agad**. Dinisenyo siya para sa *post-login* na verification, hindi para sa authentication.

### Ano pa ang nakita ko

| Bagay | Estado |
|---|---|
| `signIn(email, password)` | Email + password lang — `signInWithPassword` |
| Login form `identifier` | `<input type="email">` — walang employee-ID path |
| Login form `companyCode` | Kinokolekta, pero **hindi ginagamit** sa login |
| Edge functions | **Isa lang** — `create-account`. Walang PIN login path |
| `hasPin` / `setPin` / `verifyUserPin` | **Zero** UI call sites — walang PIN UI kahit saan |

---

## Opsyon A — PIN bilang LOGIN CREDENTIAL

**Ito ang orihinal na plano. Malaki ang trabaho.**

Kailangan lahat ng ito:
1. **Bagong edge function** (service role) na mag-map ng identity → user
2. **Paraan ng pag-mint ng session** para sa user na walang password — hindi ito standard na Supabase flow (`admin.generateLink` o custom JWT, parehong mahirap)
3. **Identity scheme** — ang 4-digit PIN ay may **collisions** sa maraming staff. Kailangan ng `company_code + employee_id + PIN`
4. **Lockout** — 4 digits = 10,000 combos ≈ **~12.5 minuto** sa brute force
5. **Rate limiting** sa edge function
6. **PIN reset flow** — ano ang gagawin ng staff na nakalimot?
7. Login UI na tumatanggap ng PIN

**Rekomendasyon ko: huwag muna ito.** Malaking feature na may sariling design questions, at hindi pa kailangan ng negosyo sa ngayon — gumagana na ang email+password.

---

## Opsyon B — PIN bilang POST-LOGIN CONFIRMATION ✅ (inirerekomenda)

**Itago ang email+password login. Gamitin ang PIN para kumpirmahin ang sensitibong staff actions** — hal. mag-cancel ng booking, magpalit ng status ng ibang booking, mag-approve ng application.

Ito mismo ang **dinisenyuhan ng `verify_user_pin()`** — kaya gagamitin lang natin ang existing na function.

**Kailangan:**
1. Migration: `failed_pin_attempts INT`, `pin_locked_until TIMESTAMPTZ` sa `profiles`
2. Lockout logic sa `verify_user_pin()` (mandatory)
3. Set/change PIN UI sa Profile para sa staff roles
4. Isang confirm modal bago ang sensitibong action

**Bakit ito ang mas mabuti:**
- **~1/5 ng trabaho** ng Opsyon A
- Ginagamit ang existing na function — hindi nagsisimula sa wala
- Walang bagong auth mechanism na kailangang i-maintain
- Ang PIN ay nagdadagdag ng **totoong seguridad** (second factor sa aksyon) nang hindi ginagalaw ang login

---

## Ang lockout ay HINDI opsyonal

Kahit aling opsyon, ang lockout ay **kailangan**:

- 4-digit PIN = 10,000 combinations
- Sa ~13 attempts/segundo, **~12.5 minuto** lang ang buong keyspace
- Walang lockout, ang PIN ay **hindi mas mabuting seguridad kaysa wala** — nagbibigay lang ito ng maling kumpiyansa

Minimum na dapat:
- `failed_pin_attempts` counter
- `pin_locked_until` timestamp
- Lockout pagkatapos ng 5 failed attempts (hal. 15 minuto)
- Reset ang counter sa matagumpay na PIN

---

## Ano ang kailangan kong malaman para magsimula

Kung Opsyon B ang pipiliin mo, sabihin mo lang:

1. **Sino ang may PIN?** admin + partner + cleaner lahat, o admin lang muna?
2. **Alin ang sensitibong actions** na kailangan ng PIN? (cancel booking? status change? approve application?)
3. **Gaano katagal ang lockout** pagkatapos ng ilang failed attempts?

Kung Opsyon A pa rin ang gusto mo, sabihin mo — pero pag-usapan muna natin ang #3 (identity scheme) dahil doon nakasalalay ang lahat.
