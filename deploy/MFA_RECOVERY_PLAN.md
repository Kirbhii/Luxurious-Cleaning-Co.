# MFA recovery — design and decision record (P0 #1)

**Status: BUILT. Nothing has been executed against the database.**

The decision was made — **(B) self-service recovery codes** — and the whole path
is written: migration, edge function, client. The repo is committed and the
harness proves the flow in both directions.

**What is still yours to do: paste `09_MIGRATION_011_mfa_recovery.sql` and deploy
the edge function.** Until then the app degrades to "the feature is not there
yet", which is tested (harness scenario U) rather than hoped for.

---

## 1. The hole, precisely

Nothing in `src/` handled a lost authenticator.

- A staff member enrolls TOTP. Their phone is lost, wiped, or replaced.
- Their next sign-in is held at `/login` for a code they can no longer produce.
- The guard keeps them out of the portal — so they cannot reach the Security tab
  to turn the factor off. The lockout is complete and self-sustaining.
- Recovery today is **service-role SQL, run by hand**. If the person locked out is
  the admin — and there is exactly **one** admin — that is the whole business
  stranded, and the one person who could run the SQL is the one who cannot log in.

It is not theoretical: it is the direct consequence of the control working
correctly. Every account that enrolls is one lost phone away from it.

**And the UI lied about it.** `MfaSettings` said:

> "Keep the recovery codes your authenticator app offers somewhere safe. Losing
> the phone means losing the second factor."

Supabase TOTP issues **no recovery codes**. That sentence told the user to
safeguard something that does not exist — the same class of defect as the false
"Off" (`562b145`) and the false success toast (`a0871e2`). **Fixed**: the copy now
describes the codes this app actually issues.

---

## 2. The decision

| who is locked out | (A) admin-mediated | (B) self-service | (A) + (B) |
|---|---|---|---|
| cleaner / partner | ✅ | ✅ | ✅ |
| **the admin (there is one)** | ❌ **still stranded** | ✅ | ✅ |

**(A) alone does not close P0 #1**, because the person most likely to be locked
out is the one who cannot perform the reset. **(B) alone closes it for every
role.** Chosen: **(B) now**; (A) remains an optional convenience for later.

---

## 3. The security model

A recovery code is **not** a login credential.

| what the attacker has | result |
|---|---|
| the code alone | **nothing** — no session, no token |
| the password alone | denied — a factor is owed |
| password **and** code | access |

Redeeming a code does one thing: it **removes the second factor**. It never
returns a session. So the endpoint that redeems it can be unauthenticated — by
definition the caller cannot log in, which is why they are calling — and
`password + code` is still strictly stronger than the pre-enrollment state of
`password alone`.

The client honours this rather than working around it: **on success the aal1
session is signed out**, and the user signs in again with the password. The
step-up verdict is therefore re-resolved from the server, never asserted by the
login screen.

### Mitigations on the one new unauthenticated surface

| risk | mitigation |
|---|---|
| offline brute force if hashes leak | **bcrypt** (`gen_salt('bf', 10)`), not sha256 — ~10⁵× cost per guess |
| online brute force | 10 failed attempts per user per 15 minutes, then refused |
| account enumeration | identical response for "no such email" and "wrong code", **and the same one bcrypt spent either way** — timing is part of behaviour |
| codes at rest | only the bcrypt hash. The plaintext is shown once, at mint time, and never persisted |
| a stolen aal1 session minting its own way in | `replace_mfa_recovery_codes()` requires **aal2** — the database enforces it, not a frontend gate |
| a code burned while the factor survives | **the two-phase design below** |

### Why the code alphabet is Crockford base32

Codes get written on paper, read back weeks later, and typed by someone who has
already lost their phone. `I`, `L`, `O` and `U` are excluded because they are
the characters people misread. `O`/`I`/`L` are **folded** onto `0`/`1`/`1` before
the code is ever sent, so a misread code still works instead of failing.
32 symbols is exactly 5 bits, so 10 characters is exactly 50 bits.

---

## 4. The design change that matters: two functions, not one

The first draft had a single `redeem_mfa_recovery_code()` that verified,
consumed, **and burned every other code** in one call.

That is wrong, and the reason is the whole point of this feature. The factor is
deleted by the edge function through the GoTrue Admin API — **after** the
database has spoken. A single function would burn every code *before* that
deletion was known to have worked, so a failure in between would leave the user
locked out with **zero codes left**. That is precisely the state this migration
exists to remove.

Split in two:

```
verify_mfa_recovery_code(user, code)   -> is it valid?   NEVER consumes
consume_mfa_recovery_codes(user)       -> burn them all
```

and the invariant is now crisp:

> **Codes are burned only after the factor is confirmed gone.**

If the factor deletion fails, nothing is consumed and the user retries with the
same code. Burning the rest is still done — just at the moment it is true.

---

## 5. What was built

| file | what it is |
|---|---|
| `deploy/09_MIGRATION_011_mfa_recovery.sql` | paste-ready, with 6 verification queries |
| `LC/supabase/migrations/011_mfa_recovery.sql` | the canonical migration (same DDL) |
| `LC/supabase/functions/redeem-recovery-code/index.ts` | the one unauthenticated endpoint |
| `LC/src/lib/recoveryCodes.ts` | CSPRNG generation, folding, formatting |
| `LC/src/lib/supabase.ts` | `mfaRecoveryStatus`, `replaceMfaRecoveryCodes`, `redeemMfaRecoveryCode` |
| `LC/src/components/MfaSettings.tsx` | create / show-once / "N of M left" / replace, and the corrected copy |
| `LC/src/pages/Login.tsx` | "Lost your phone?" on the step-up screen |

**Order of operations in the edge function**, which is the load-bearing part:

1. confirm the admin MFA API exists — *before* touching anything, so an
   unsupported deployment costs the caller nothing
2. resolve the email to a user id
3. **verify** the code (does not consume)
4. delete the TOTP factors
5. **re-list and confirm** none remain — never assume
6. **consume** every code
7. return `{ ok: true }` — no session, no token

`mfa_recovery_status()` returns only `{total, remaining}`. The hashes are never
exposed to any client role.

---

## 6. Evidence

Harness is now **22 scenarios (A–U)**, all PASS locally.

| scenario | proves |
|---|---|
| **T** | a valid code removes the factor, **abandons the aal1 session**, and returns to sign-in — `sessionStored false` |
| **T-** | a refused code changes nothing — `sessionStored true`, still on the recovery screen, error shown |
| **U** | with migration 011 absent, **no recovery UI renders at all** and the factor still reports On |

Sensitivity controls, so none of this passes for free:

| control | result |
|---|---|
| `RECOVERY_FAIL=1` | T **FAILS** (`sessionStored true`) — proves T measures the success path |
| normal | T **PASSES** |

T also asserts at the request level: exactly one call to the endpoint, and the
code arrives as `0112345678` when the user typed `OIL2-345678`. That single
string proves the hyphen strip **and** the `O/I/L` fold happened before the wire.

**One honest note.** The first version of the control passed in both directions,
because `fail` (what the mock does) and `expectFail` (what the scenario claims)
were the same variable — so flipping the mock also flipped the assertion. The
control caught a real defect in the harness itself. They are now separate, and
the comment in `run.js` says why.

---

## 7. What is still open

1. **You paste the SQL** and send me the §10 verification output.
2. **You deploy the function:**
   `supabase functions deploy redeem-recovery-code --no-verify-jwt`
3. Existing staff must **create their codes** — enrollment already happened, so
   nobody has any yet. They appear in Security → Recovery codes.
4. **(A) admin-mediated reset**, if you still want it. Not needed to close P0 #1.
