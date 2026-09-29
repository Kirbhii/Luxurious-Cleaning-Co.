// Supabase Edge Function: create-account
// This function creates auth accounts for approved cleaners and partners.
// Deploy: supabase functions deploy create-account
//
// ─── SECURITY ────────────────────────────────────────────────────────────────
// This function uses the SERVICE ROLE key, which bypasses RLS and can mint
// auth users. It therefore MUST authenticate the caller and confirm the caller
// is an admin before doing anything. The previous version had no auth check at
// all, which let anyone on the internet create cleaner/partner accounts and
// read back the generated password.
//
// Required: the client must send `Authorization: Bearer <admin access token>`.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Constant-shape JSON error helper. Never leaks internal details to the caller. */
function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only POST is meaningful here.
  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405)
  }

  try {
    // ── 1. Authenticate the caller ───────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

    if (!token) {
      return jsonError('Unauthorized: missing bearer token', 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return jsonError('Server misconfiguration', 500)
    }

    // Verify the token by asking the auth server who it belongs to. This is a
    // real signature + expiry check, not a decode-and-trust.
    const authClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: userData, error: userError } = await authClient.auth.getUser(token)
    if (userError || !userData?.user) {
      return jsonError('Unauthorized: invalid or expired token', 401)
    }
    const callerId = userData.user.id

    // Service-role client for the privileged work below.
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── 2. Confirm the caller is an admin ────────────────────────────────────
    const { data: callerProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', callerId)
      .single()

    if (profileError || !callerProfile) {
      return jsonError('Unauthorized: caller profile not found', 403)
    }
    if (callerProfile.role !== 'admin') {
      return jsonError('Forbidden: admin role required', 403)
    }

    // ── 3. Validate input ────────────────────────────────────────────────────
    let body: { applicationType?: unknown; applicationId?: unknown }
    try {
      body = await req.json()
    } catch {
      return jsonError('Invalid JSON body', 400)
    }

    const { applicationType, applicationId } = body

    if (typeof applicationType !== 'string' || typeof applicationId !== 'string') {
      return jsonError('Missing or invalid applicationType/applicationId', 400)
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId)) {
      return jsonError('applicationId must be a UUID', 400)
    }

    // ── 4. Generate a temporary password (uniform, CSPRNG-backed) ────────────
    // Uses rejection sampling so every character is uniformly distributed
    // (the old `byte % charset.length` skewed the distribution).
    const generatePassword = () => {
      const length = 16
      const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
      const maxUnbiased = Math.floor(256 / charset.length) * charset.length
      let password = ''
      const buf = new Uint8Array(1)
      while (password.length < length) {
        crypto.getRandomValues(buf)
        if (buf[0] >= maxUnbiased) continue // reject biased values
        password += charset[buf[0] % charset.length]
      }
      return password
    }

    const password = generatePassword()

    let email = ''
    let name = ''
    let phone = ''
    let role: 'cleaner' | 'partner' = 'cleaner'
    let employeeId = ''
    let companyCode = ''
    let companyId: string | null = null

    // ── 5. Fetch the approved application ────────────────────────────────────
    if (applicationType === 'cleaner') {
      const { data: application, error: fetchError } = await supabaseClient
        .from('training_applications')
        .select('*')
        .eq('id', applicationId)
        .single()

      if (fetchError || !application) {
        return jsonError('Cleaner application not found', 404)
      }
      if (application.status !== 'approved') {
        return jsonError('Application is not approved', 409)
      }

      email = application.email
      name = application.name
      phone = application.phone
      role = 'cleaner'
      employeeId = `CLN-${Date.now().toString().slice(-6)}`
    } else if (applicationType === 'partner') {
      const { data: application, error: fetchError } = await supabaseClient
        .from('partner_applications')
        .select('*')
        .eq('id', applicationId)
        .single()

      if (fetchError || !application) {
        return jsonError('Partner application not found', 404)
      }
      if (application.status !== 'approved') {
        return jsonError('Application is not approved', 409)
      }

      email = application.email
      name = application.contact_person
      phone = application.phone
      role = 'partner'
      companyCode = `COMP-${Date.now().toString().slice(-6)}`

      // Reuse the company if this application already created one, otherwise
      // create it. Prevents duplicate companies when an admin retries.
      if (application.company_id) {
        companyId = application.company_id
        const { data: existing } = await supabaseClient
          .from('partner_companies')
          .select('code')
          .eq('id', companyId)
          .single()
        if (existing?.code) companyCode = existing.code
      } else {
        const { data: company, error: companyError } = await supabaseClient
          .from('partner_companies')
          .insert({
            name: application.company_name,
            code: companyCode,
            industry: application.industry,
            website: application.website,
            address: application.address,
            contact_email: email,
            contact_phone: phone,
            is_active: true,
          })
          .select()
          .single()

        if (companyError || !company) {
          console.error('Company creation error:', companyError)
          return jsonError('Failed to create company record', 500)
        }
        companyId = company.id
      }
    } else {
      return jsonError('Invalid applicationType. Must be "cleaner" or "partner"', 400)
    }

    if (!email) {
      return jsonError('Application has no email address', 422)
    }

    // ── 6. Create the auth user ──────────────────────────────────────────────
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        phone,
        role,
        employee_id: employeeId || '',
        company_code: companyCode || '',
      },
    })

    if (authError || !authData?.user) {
      console.error('Auth creation error:', authError)
      // Surface a duplicate-email case distinctly; keep other errors generic.
      const isDuplicate =
        authError?.message?.toLowerCase().includes('already') ||
        authError?.status === 422
      return jsonError(
        isDuplicate ? 'An account with this email already exists' : 'Failed to create auth account',
        isDuplicate ? 409 : 500
      )
    }

    // ── 7. Link the profile to the partner company ───────────────────────────
    if (role === 'partner' && companyId) {
      const { error: linkError } = await supabaseClient
        .from('profiles')
        .update({ company_id: companyId })
        .eq('id', authData.user.id)
      if (linkError) {
        console.error('Profile company link error:', linkError)
      }
    }

    // ── 8. Send the welcome/recovery email ───────────────────────────────────
    // We deliberately do NOT email the plaintext password. Instead we send a
    // Supabase recovery link so the user sets their own password on first use.
    try {
      const siteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? ''
      if (siteUrl) {
        await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: `${siteUrl}/reset-password`,
        })
      }
    } catch (emailError) {
      console.warn('Email send warning (non-critical):', emailError)
    }

    // ── 9. Respond ───────────────────────────────────────────────────────────
    // The temporary password is returned to the authenticated admin only, so
    // it can be relayed out-of-band if the recovery email cannot be delivered.
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account created successfully',
        userId: authData.user.id,
        email,
        password,
        employeeId: employeeId || undefined,
        companyCode: companyCode || undefined,
        name,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return jsonError('Internal server error', 500)
  }
})
