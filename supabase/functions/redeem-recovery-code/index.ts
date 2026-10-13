// Supabase Edge Function: redeem-recovery-code
// Deploy: supabase functions deploy redeem-recovery-code --no-verify-jwt
//
// ─── WHAT THIS IS ────────────────────────────────────────────────────────────
// The one unauthenticated endpoint in this app, and the last piece of P0 #1.
//
// A staff member who loses their phone can never reach aal2, so the login guard
// holds them at /login — and the Security tab, where they could turn the factor
// off, sits behind that same guard. Without this, the lockout is complete and
// self-sustaining, and the only recovery is service-role SQL run by hand.
//
// ─── WHY UNAUTHENTICATED IS ACCEPTABLE HERE ──────────────────────────────────
// A recovery code is NOT a login credential. This function never mints a
// session and never returns a token. It does exactly one thing: remove the
// second factor, and only when the caller proves they hold a valid code for
// that account.
//
//     password alone            -> denied (a factor is owed)
//     recovery code alone       -> nothing at all
//     password + recovery code  -> access
//
// By definition the caller cannot log in — that is why they are calling — so the
// endpoint cannot require a session. `password + code` is still strictly
// stronger than the pre-enrollment state of `password alone`.
//
// ─── WHY --no-verify-jwt ─────────────────────────────────────────────────────
// The caller is at aal1 (they just typed their password, and the step-up is
// exactly what they cannot complete). Supabase's default JWT verification would
// still accept that token, but the flow must also work for someone whose session
// has already been dropped, so verification is off and the recovery code is the
// only credential this endpoint trusts.
//
// ─── ORDER OF OPERATIONS — the load-bearing part ─────────────────────────────
//   1. verify the code        (DB, service_role, does NOT consume)
//   2. delete the TOTP factors (GoTrue Admin API)
//   3. confirm none remain    (re-list — never assume)
//   4. consume every code     (DB, service_role)
//
// Step 4 runs only after step 3 has been OBSERVED to succeed. If it ran any
// earlier, a failure between the two would burn every code and leave the user
// locked out with none left — precisely the state this whole feature exists to
// remove. If the delete fails, we return an error and burn nothing, so the user
// can retry with the same code.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * One generic failure for every "it did not work" case.
 *
 * "No account with that email" and "that code is wrong" must be
 * indistinguishable, or this endpoint becomes an account-enumeration oracle.
 * The database also spends one bcrypt in both cases, so the timing matches too.
 */
const GENERIC_FAILURE =
  'That email and recovery code did not match. Check both and try again.'

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    // ── 0. Config + the admin MFA API, checked BEFORE anything is touched ────
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return json({ error: 'Recovery is unavailable right now. Please try again later.' }, 500)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Fail before touching anything if the admin API cannot manage MFA at all.
    // Doing this first means an unsupported deployment costs the caller nothing:
    // no code is checked, no attempt is recorded, no code is burned. And it is a
    // constant answer regardless of the email, so it leaks nothing.
    const mfaAdmin = admin.auth.admin.mfa
    if (!mfaAdmin || typeof mfaAdmin.listFactors !== 'function' || typeof mfaAdmin.deleteFactor !== 'function') {
      console.error('auth.admin.mfa is unavailable in this supabase-js build')
      return json(
        { error: 'Recovery is unavailable right now. Please try again later.' },
        501
      )
    }

    // ── 1. Validate input ───────────────────────────────────────────────────
    let body: { email?: unknown; code?: unknown }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const code = typeof body.code === 'string' ? body.code : ''

    if (!email || !code) {
      return json({ error: GENERIC_FAILURE }, 400)
    }
    // Shape check only — whether the account exists is not this layer's business.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: GENERIC_FAILURE }, 400)
    }

    // ── 2. Resolve the account ──────────────────────────────────────────────
    // profiles carries the email; auth.users is not reachable through PostgREST.
    // A miss is not an error the caller may see — it becomes the generic failure.
    const { data: profileRows, error: profileError } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .limit(1)

    if (profileError) {
      console.error('profile lookup failed:', profileError.message)
      return json({ error: 'Recovery is unavailable right now. Please try again later.' }, 500)
    }

    const userId: string | null = profileRows?.[0]?.id ?? null

    // ── 3. Verify the code (never consumes) ─────────────────────────────────
    // A null userId is passed through deliberately: the database still spends one
    // bcrypt so the response time cannot distinguish "no such account" from
    // "wrong code". It returns false, and we fall through to the generic failure.
    const { data: verified, error: verifyError } = await admin.rpc('verify_mfa_recovery_code', {
      p_user_id: userId,
      p_code: code,
    })

    if (verifyError) {
      console.error('verify_mfa_recovery_code failed:', verifyError.message)
      return json({ error: 'Recovery is unavailable right now. Please try again later.' }, 500)
    }

    if (verified !== true || !userId) {
      return json({ error: GENERIC_FAILURE }, 400)
    }

    // ── 4. Remove the second factor ─────────────────────────────────────────
    const { data: listed, error: listError } = await mfaAdmin.listFactors({ userId })
    if (listError) {
      console.error('listFactors failed:', listError.message)
      return json(
        { error: 'We could not read your two-factor settings, so nothing was changed. Try again.' },
        500
      )
    }

    // Only TOTP is ours; anything else is left alone.
    const totpFactors = (listed?.factors ?? []).filter((f) => f.factor_type === 'totp')

    for (const factor of totpFactors) {
      const { error: deleteError } = await mfaAdmin.deleteFactor({ userId, id: factor.id })
      if (deleteError) {
        // Nothing has been consumed yet, so the same code still works. Say so.
        console.error('deleteFactor failed:', deleteError.message)
        return json(
          {
            error:
              'Your code was accepted, but we could not remove the authenticator. Nothing was used up — please try again.',
          },
          500
        )
      }
    }

    // ── 5. Confirm, do not assume ───────────────────────────────────────────
    // "No error" is not evidence the factor is gone. This project has already
    // been bitten twice by treating an unverified state as a verified one
    // (562b145, a0871e2) — read it back before telling anyone it worked.
    const { data: after, error: reListError } = await mfaAdmin.listFactors({ userId })
    if (reListError) {
      console.error('re-list after delete failed:', reListError.message)
      return json(
        {
          error:
            'We could not confirm the authenticator was removed. Nothing was used up — please try again.',
        },
        500
      )
    }

    const remaining = (after?.factors ?? []).filter((f) => f.factor_type === 'totp')
    if (remaining.length > 0) {
      console.error('factors still present after delete:', remaining.length)
      return json(
        {
          error:
            'Your authenticator could not be removed. Nothing was used up — please try again, or ask an administrator.',
        },
        500
      )
    }

    // ── 6. Burn every code — only now ───────────────────────────────────────
    const { error: consumeError } = await admin.rpc('consume_mfa_recovery_codes', {
      p_user_id: userId,
    })
    if (consumeError) {
      // The factor IS gone, which is the outcome the user asked for. A stale
      // code is inert once no factor exists, and the next mint wipes them, so
      // this is logged rather than reported as a failure.
      console.error('consume_mfa_recovery_codes failed (non-fatal):', consumeError.message)
    }

    // ── 7. Done ─────────────────────────────────────────────────────────────
    // No session. No token. The caller still has to sign in with the password.
    return json({ ok: true }, 200)
  } catch (error) {
    console.error('Unexpected error:', error)
    return json({ error: 'Recovery is unavailable right now. Please try again later.' }, 500)
  }
})
