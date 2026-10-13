import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, Smartphone, X, KeyRound, Copy, Check } from 'lucide-react';
import { useCurrentUser, type UserRole } from '../store';
import {
  enrollAdminMfa,
  challengeAdminMfa,
  verifyAdminMfa,
  unenrollMfa,
  verifiedTotpFactor,
  unverifiedTotpFactorIds,
  mfaRecoveryStatus,
  replaceMfaRecoveryCodes,
  type RecoveryStatus,
} from '../lib/supabase';
import {
  generateRecoveryCodes,
  formatRecoveryCode,
  RECOVERY_CODE_COUNT,
} from '../lib/recoveryCodes';

type Enrollment = { factorId: string; qrCode: string; secret: string };

/**
 * The "two-factor authentication" panel, shown in the Security tab of all three
 * staff portals (admin, cleaner, partner).
 *
 * This is the other half of the login step-up in Login.tsx: the login screen
 * can only ask for a code if a factor exists, and a factor only counts once a
 * code has been verified against it here. So an abandoned enrollment protects
 * nothing and must not be reported as if it did — hence the deliberate split
 * between "enrolled" and "verified".
 *
 * Nothing here is required. A staff member who never enrolls still signs in
 * with a password alone, exactly as before; enrolling is what makes the second
 * factor mandatory for that account.
 *
 * The stakes differ per role, so the explanatory copy does too. Read from the
 * store rather than a prop, so each portal can drop the component in unchanged.
 * A cleaner being told about "every applicant's résumé" would be reading about
 * access they do not have, which makes the warning easier to dismiss.
 */
const ROLE_COPY: Record<UserRole, { heading: string; stakes: string; disableWarning: string }> = {
  admin: {
    heading: 'Why this matters for an admin',
    stakes:
      "An admin account can read every customer's address and phone number, every applicant's résumé, and can change anyone's role. A leaked password is the whole business.",
    disableWarning:
      "Turning this off means a stolen password is enough to open your account again — including every customer address, phone number and applicant résumé you can read.",
  },
  cleaner: {
    heading: 'Why this matters for a cleaner',
    stakes:
      "A cleaner account can read customer addresses, phone numbers and entry instructions — the details that let someone walk up to a stranger's door.",
    disableWarning:
      'Turning this off means a stolen password is enough to open your account again — including the address and entry instructions for every home on your schedule.',
  },
  partner: {
    heading: 'Why this matters for a partner',
    stakes:
      "A partner account can read your company's project pipeline and the client sites attached to it.",
    disableWarning:
      "Turning this off means a stolen password is enough to open your account again — including your company's project pipeline and client sites.",
  },
  customer: {
    // Customers have no enrollment UI today; keep the map total so a role
    // change can never render `undefined` copy.
    heading: 'Why this matters',
    stakes: 'A second factor stops a stolen password from being enough to open this account.',
    disableWarning:
      'Turning this off means a stolen password is enough to open your account again.',
  },
};

export default function MfaSettings() {
  const copy = ROLE_COPY[useCurrentUser()?.role ?? 'admin'];
  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);
  // True when the last lookup failed. Deliberately NOT the same as "off" — see
  // refresh() below for why the difference is load-bearing.
  const [lookupFailed, setLookupFailed] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);

  // ── Recovery codes (migration 011) ─────────────────────────────────────────
  // `status` is a three-way result, not a number. See mfaRecoveryStatus() for
  // why: "the migration is not applied yet", "we could not reach the server"
  // and "this account has no codes" are three different things, and a panel that
  // renders all three as "0 codes" is reporting a state it never read.
  const [recovery, setRecovery] = useState<RecoveryStatus | null>(null);
  // The plaintext, held in memory only until the user confirms they have saved
  // it. Never sent anywhere except back to the server for hashing.
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [codesCopied, setCodesCopied] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  /**
   * Read this account's verified factor back from the server.
   *
   * `verifiedTotpFactor()` is a network call — it goes through `getUser()`. That
   * makes "we could not check" and "there is no factor" two different answers,
   * and conflating them is how a panel ends up asserting a security state it
   * never observed. Reporting "Off" for a failed lookup is a false negative on
   * the account's protection, and it is exactly what makes a working enrollment
   * look like it never happened.
   *
   * So on failure we keep the last known `factorId` and flag the uncertainty
   * instead of overwriting it with null. Returns the id (or null when there
   * genuinely is none) plus whether the read itself failed, so callers can
   * refuse to claim either state.
   */
  const refresh = useCallback(async (): Promise<{ id: string | null; failed: boolean }> => {
    const { factorId: id, error: err } = await verifiedTotpFactor();
    setLoading(false);
    if (err) {
      setLookupFailed(true);
      return { id: null, failed: true };
    }
    setLookupFailed(false);
    setFactorId(id);
    return { id, failed: false };
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Read how many recovery codes this account has.
   *
   * Deliberately separate from refresh(): the factor lookup and the recovery
   * lookup fail independently, and one failing must not corrupt the other's
   * answer. Nothing here touches `factorId`.
   */
  const loadRecovery = useCallback(async () => {
    setRecovery(await mfaRecoveryStatus());
  }, []);

  useEffect(() => {
    void loadRecovery();
  }, [loadRecovery]);

  /**
   * Mint a fresh set of codes and show them once.
   *
   * Called right after enrollment is confirmed — the session is aal2 at that
   * moment, which the database requires — and from "Replace codes" in the panel.
   * The plaintext is generated here, displayed, and then dropped from memory
   * when the user dismisses it; only the bcrypt hashes reach the server.
   */
  async function mintCodes(): Promise<boolean> {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const codes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
      const { count, error: err } = await replaceMfaRecoveryCodes(codes);
      if (err) {
        // A 28000 here means the session is not at aal2 — which should not
        // happen in a staff portal, but say the true thing rather than "failed".
        if (err.code === '28000') {
          setError(
            'Recovery codes can only be created while two-factor authentication is verified for this session. Sign in again with your authenticator, then retry.'
          );
        } else if (err.code === 'PGRST202') {
          setError('Recovery codes are not available yet on this deployment.');
        } else {
          setError('Could not create recovery codes. Please try again.');
        }
        return false;
      }

      setNewCodes(codes);
      setCodesCopied(false);
      setConfirmRegenerate(false);
      // Read the count back rather than assuming it matches what we sent.
      await loadRecovery();
      if (typeof count === 'number' && count !== codes.length) {
        console.warn('[MFA] recovery codes stored:', count, 'of', codes.length, 'submitted');
      }
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function copyCodes() {
    if (!newCodes) return;
    try {
      await navigator.clipboard.writeText(newCodes.map(formatRecoveryCode).join('\n'));
      setCodesCopied(true);
    } catch {
      // Clipboard access can be denied. The codes are on screen either way.
      setCodesCopied(false);
    }
  }

  async function beginEnrollment() {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      // Leftovers from an abandoned setup block a fresh enroll(), so clear them.
      for (const staleId of await unverifiedTotpFactorIds()) {
        await unenrollMfa(staleId);
      }

      const { data, error: err } = await enrollAdminMfa();
      if (err || !data) {
        setError(err?.message ?? 'Could not start enrollment. Please try again.');
        return;
      }

      const totp = (data as { id: string; totp?: { qr_code?: string; secret?: string } }).totp;
      setEnrollment({
        factorId: data.id,
        qrCode: totp?.qr_code ?? '',
        secret: totp?.secret ?? '',
      });
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnrollment() {
    if (!enrollment) return;
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const { data: challenge, error: challengeError } = await challengeAdminMfa(enrollment.factorId);
      if (challengeError || !challenge) {
        setError(challengeError?.message ?? 'Could not start the verification. Try again.');
        return;
      }

      const { error: verifyError } = await verifyAdminMfa(enrollment.factorId, challenge.id, code);
      if (verifyError) {
        setError('That code was not accepted. Use the current code from your app.');
        return;
      }

      setEnrollment(null);
      setCode('');

      // `verify()` returning no error means the code was accepted — it does NOT
      // prove the factor is now `verified`. Read it back before saying so. If it
      // is not there, the user has to find out NOW, while the QR is still in
      // front of them, rather than on their next sign-in when no code is asked
      // for and the panel quietly reads Off.
      const { id, failed } = await refresh();
      if (failed) {
        setError(
          'Your code was accepted, but we could not confirm it was saved. Reload the page to check.'
        );
        return;
      }
      if (!id) {
        setError(
          'Your authenticator was not saved. Please set it up again — until this panel reads On, your account still opens with a password alone.'
        );
        return;
      }

      // The session is aal2 right now — the code we just verified is what put it
      // there — and that is the only moment we are certain of it. So mint the
      // recovery codes HERE rather than trusting the user to come back for them.
      // Without codes, this enrollment is one lost phone away from a permanent
      // lockout, and the panel would be telling them to safeguard nothing.
      //
      // A failure here does not undo the enrollment: the factor is verified and
      // the message below says so either way.
      const minted = await mintCodes();

      setSuccess(
        minted
          ? 'Two-factor authentication is on. Your recovery codes are shown below — save them now, because this is the only time they are displayed.'
          : 'Two-factor authentication is on. You will be asked for a code each time you sign in.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnrollment() {
    const id = enrollment?.factorId;
    setEnrollment(null);
    setCode('');
    setError(null);
    // An unverified factor is dead weight that would block the next attempt.
    if (id) await unenrollMfa(id);
  }

  async function disable() {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: err } = await unenrollMfa(factorId);
      if (err) {
        setError(err.message);
        return;
      }
      setConfirmDisable(false);

      // The same rule in reverse: do not announce "off" until the server agrees.
      // Saying it was removed when it is still there would leave the user
      // believing a control is gone when it is not.
      const { id, failed } = await refresh();
      if (failed) {
        setError(
          'Two-factor authentication was removed, but we could not confirm it. Reload the page to check.'
        );
        return;
      }
      if (id) {
        setError('Two-factor authentication is still on. Please try again.');
        return;
      }

      setSuccess('Two-factor authentication is off. Sign-in will only ask for your password again.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl">
        <div className="bg-navy-800 border border-gold-400/10 rounded-2xl p-6 md:p-8 flex items-center gap-3 text-cream-300">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Checking your two-factor settings…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-navy-800 border border-gold-400/10 rounded-2xl p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              factorId ? 'bg-emerald-400/10' : 'bg-gold-400/10'
            }`}
          >
            {factorId ? (
              <ShieldCheck size={18} className="text-emerald-400" />
            ) : (
              <ShieldAlert size={18} className="text-gold-400" />
            )}
          </div>
          <div>
            <h2 className="font-serif text-2xl text-cream-100">Two-factor authentication</h2>
            <p className="text-xs text-cream-300 mt-1">
              {factorId
                ? 'On. A password alone can no longer open this account.'
                : lookupFailed
                  ? 'Unknown. We could not check your two-factor settings just now.'
                  : 'Off. Your password is the only thing standing between anyone and this account.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-200">
            {success}
          </div>
        )}

        {/* ── Enrollment in progress ───────────────────────────────────────── */}
        {enrollment && (
          <div className="space-y-5">
            <ol className="space-y-2 text-sm text-cream-300 leading-relaxed list-decimal list-inside">
              <li>Install an authenticator app — Google Authenticator, Authy, or 1Password.</li>
              <li>Scan this code with the app.</li>
              <li>Type the 6-digit code the app shows, below.</li>
            </ol>

            {enrollment.qrCode && (
              <div
                className="mx-auto w-fit rounded-xl bg-white p-3"
                // Supabase returns the QR as a ready-made SVG string. It comes
                // from our own auth server, never from user input.
                dangerouslySetInnerHTML={{ __html: enrollment.qrCode }}
              />
            )}

            {enrollment.secret && (
              <div className="rounded-lg border border-gold-400/15 bg-navy-700 px-4 py-3">
                <div className="text-[11px] font-medium text-cream-300 uppercase tracking-[0.18em] mb-1.5">
                  Can't scan? Enter this key
                </div>
                <code className="block break-all font-mono text-sm text-cream-100 tracking-wider">
                  {enrollment.secret}
                </code>
              </div>
            )}

            <label className="block">
              <span className="block text-xs font-medium text-cream-300 mb-1.5">
                6-digit code from the app
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                disabled={busy}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 tracking-[0.4em] placeholder-cream-300/40 placeholder:tracking-[0.4em] focus:outline-none focus:border-gold-400/50 disabled:opacity-50"
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={confirmEnrollment}
                disabled={busy || code.length !== 6}
                className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                {busy ? 'Verifying…' : 'Turn on two-factor'}
              </button>
              <button
                type="button"
                onClick={cancelEnrollment}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-xs text-cream-300 transition-colors hover:text-cream-100 disabled:opacity-50"
              >
                <X size={13} /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Already on ───────────────────────────────────────────────────── */}
        {!enrollment && factorId && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-4 py-3">
              <Smartphone size={15} className="text-emerald-300 mt-0.5 shrink-0" />
              <div className="text-xs text-emerald-100 leading-relaxed">
                An authenticator app is linked to this account. Each sign-in asks for a fresh
                6-digit code after your password.
              </div>
            </div>

            {confirmDisable ? (
              <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-4">
                <p className="text-xs text-red-200 leading-relaxed mb-3">
                  {copy.disableWarning}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={disable}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-400/40 px-4 py-2 text-xs font-semibold text-red-200 transition-colors hover:bg-red-400/15 disabled:opacity-60"
                  >
                    {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                    Yes, turn it off
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDisable(false)}
                    disabled={busy}
                    className="text-xs text-cream-300 transition-colors hover:text-cream-100 disabled:opacity-50"
                  >
                    Keep it on
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDisable(true)}
                className="text-xs text-cream-300 underline transition-colors hover:text-cream-100"
              >
                Turn off two-factor authentication
              </button>
            )}
          </div>
        )}

        {/* ── Recovery codes ───────────────────────────────────────────────── */}
        {/* Only ever shown once the account has a verified factor: recovery
            codes for an account with no second factor protect nothing. The
            heading is an h3 on purpose — the harness locates the two panels by
            their h2 text, and a second h2 starting "Two-factor…" would make
            "which panel is this?" ambiguous. */}
        {!enrollment && factorId && recovery?.state !== 'missing' && (
          <div className="mt-6 border-t border-gold-400/10 pt-6">
            <div className="flex items-center gap-2.5 mb-3">
              <KeyRound size={15} className="text-gold-400" />
              <h3 className="text-xs font-medium text-gold-400 uppercase tracking-[0.18em]">
                Recovery codes
              </h3>
            </div>

            {/* ── Just minted: show once ─────────────────────────────────── */}
            {newCodes ? (
              <div className="rounded-lg border border-gold-400/30 bg-gold-400/5 px-4 py-4">
                <p className="text-xs text-cream-200 leading-relaxed mb-3">
                  Save these now. Each one works <span className="text-cream-100">once</span>, and
                  this is the only time they are shown — we store only a hash, so we cannot show
                  them again.
                </p>

                <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {newCodes.map((c, i) => (
                    <li
                      key={c}
                      className="flex items-baseline gap-2 rounded bg-navy-700 px-3 py-2"
                    >
                      <span className="w-4 shrink-0 text-right text-[11px] text-cream-300/70">
                        {i + 1}
                      </span>
                      <code className="font-mono text-sm tracking-wider text-cream-100">
                        {formatRecoveryCode(c)}
                      </code>
                    </li>
                  ))}
                </ol>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={copyCodes}
                    className="inline-flex items-center gap-2 rounded-lg border border-gold-400/30 px-4 py-2 text-xs font-semibold text-cream-100 transition-colors hover:bg-gold-400/10"
                  >
                    {codesCopied ? <Check size={13} /> : <Copy size={13} />}
                    {codesCopied ? 'Copied' : 'Copy all'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Drop the plaintext. It has served its purpose, and
                      // keeping it in memory only widens the window in which a
                      // stray render or a devtools glance could expose it.
                      setNewCodes(null);
                      setCodesCopied(false);
                    }}
                    className="text-xs text-cream-300 underline transition-colors hover:text-cream-100"
                  >
                    I have saved them
                  </button>
                </div>
              </div>
            ) : recovery?.state === 'failed' ? (
              /* ── We do not know — say so, offer a re-read ───────────────── */
              <div className="space-y-3">
                <p className="text-xs text-cream-300 leading-relaxed">
                  We could not check your recovery codes just now. Nothing has been changed.
                </p>
                <button
                  type="button"
                  onClick={() => void loadRecovery()}
                  disabled={busy}
                  className="text-xs text-gold-400 underline transition-colors hover:text-gold-300 disabled:opacity-50"
                >
                  Check again
                </button>
              </div>
            ) : confirmRegenerate ? (
              /* ── Replacing destroys the old set — say so first ──────────── */
              <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-4">
                <p className="text-xs text-red-200 leading-relaxed mb-3">
                  This replaces your current codes. Any code you saved before will stop working
                  immediately, so only do this if you have lost them.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void mintCodes()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-400/40 px-4 py-2 text-xs font-semibold text-red-200 transition-colors hover:bg-red-400/15 disabled:opacity-60"
                  >
                    {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                    Yes, replace them
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRegenerate(false)}
                    disabled={busy}
                    className="text-xs text-cream-300 transition-colors hover:text-cream-100 disabled:opacity-50"
                  >
                    Keep the current codes
                  </button>
                </div>
              </div>
            ) : recovery && recovery.total > 0 ? (
              /* ── Have codes ─────────────────────────────────────────────── */
              <div className="space-y-3">
                <p className="text-xs text-cream-300 leading-relaxed">
                  <span className="text-cream-100">
                    {recovery.remaining} of {recovery.total}
                  </span>{' '}
                  unused.{' '}
                  {recovery.remaining === 0
                    ? 'You have used them all — replace them now, or a lost phone means a locked account.'
                    : 'Keep them somewhere you can reach without your phone.'}
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmRegenerate(true)}
                  className="text-xs text-cream-300 underline transition-colors hover:text-cream-100"
                >
                  Replace recovery codes
                </button>
              </div>
            ) : (
              /* ── No codes yet ───────────────────────────────────────────── */
              <div className="space-y-3">
                <p className="text-xs text-cream-300 leading-relaxed">
                  You have no recovery codes. If you lose the phone with your authenticator app,
                  these are the only way back into this account — without them you would need an
                  administrator to reset your two-factor settings by hand.
                </p>
                <button
                  type="button"
                  onClick={() => void mintCodes()}
                  disabled={busy}
                  className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                  {busy ? 'Creating…' : 'Create recovery codes'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Could not check ──────────────────────────────────────────────── */}
        {/* Shown instead of "Not set up" when the lookup failed. Offering a
            setup button here would invite the user to enroll a second factor
            because we could not read the first one. */}
        {!enrollment && !factorId && lookupFailed && (
          <div className="space-y-4">
            <p className="text-sm text-cream-300 leading-relaxed">
              We could not reach the authentication service, so we cannot tell whether
              two-factor authentication is on for this account. Your settings have not been
              changed.
            </p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setLoading(true);
                void refresh();
              }}
              disabled={busy}
              className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
            >
              <ShieldAlert size={14} />
              Check again
            </button>
          </div>
        )}

        {/* ── Not set up ───────────────────────────────────────────────────── */}
        {!enrollment && !factorId && !lookupFailed && (
          <div className="space-y-4">
            <p className="text-sm text-cream-300 leading-relaxed">
              Add a second step to signing in. After your password, the portal will ask for a
              6-digit code from an app on your phone — so a password on its own stops being enough.
            </p>
            <button
              type="button"
              onClick={beginEnrollment}
              disabled={busy}
              className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              {busy ? 'Starting…' : 'Set up two-factor authentication'}
            </button>
          </div>
        )}
      </div>

      <div className="bg-navy-800/60 border border-gold-400/10 rounded-2xl px-6 py-5">
        <h3 className="text-xs font-medium text-gold-400 uppercase tracking-[0.18em] mb-3">
          {copy.heading}
        </h3>
        <ul className="space-y-2 text-xs text-cream-300 leading-relaxed">
          <li>{copy.stakes}</li>
          <li>
            A code from your phone cannot be guessed, phished from a login page, or reused after 30
            seconds.
          </li>
          <li>
            Your recovery codes are the only way to remove a lost authenticator by yourself.
            Save them somewhere you can reach without your phone — an authenticator app does
            not issue them for you.
          </li>
          <li>
            The PIN on the Security tab is a separate thing — it guards individual sensitive
            actions, not the account itself.
          </li>
        </ul>
      </div>
    </div>
  );
}
