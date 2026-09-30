import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Eye,
  EyeOff,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { pinLockStatus, setPin, isMissingRpc, type PinLockStatus } from '../lib/supabase';

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Shared "Security" panel for the staff portals (admin, cleaner, partner).
 *
 * Setting a PIN always requires proof the session alone does not carry:
 *   · a PIN already exists -> the CURRENT PIN
 *   · no PIN yet           -> the ACCOUNT PASSWORD
 *
 * Both checks live in the database (set_user_pin), so this panel is a
 * convenience layer, not the guard. It also reads pin_lock_status() so a
 * locked-out user is told they are locked instead of being invited to spend an
 * attempt discovering it.
 */
export default function PinSettings() {
  const [status, setStatus] = useState<PinLockStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState({ newPin: '', confirmPin: '', currentPin: '', password: '' });
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [secondsLeft, setSecondsLeft] = useState(0);

  const refresh = useCallback(async () => {
    const { status: next, error: err } = await pinLockStatus();

    if (err) {
      if (isMissingRpc(err.message)) {
        setUnavailable(err.message);
      } else {
        setLoadError(err.message);
      }
      setLoading(false);
      return;
    }

    setUnavailable(null);
    setLoadError(null);
    setStatus(next);
    setSecondsLeft(next?.secondsRemaining ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const locked = secondsLeft > 0;

  // Tick the lockout countdown down locally so we do not poll the database.
  useEffect(() => {
    if (!locked) return;
    const timer = window.setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [locked]);

  // When the countdown reaches zero, re-read the authoritative state.
  const wasLocked = useRef(false);
  useEffect(() => {
    if (locked) {
      wasLocked.current = true;
      return;
    }
    if (wasLocked.current) {
      wasLocked.current = false;
      void refresh();
    }
  }, [locked, refresh]);

  const hasPin = status?.hasPin ?? false;
  const canSubmit =
    !saving &&
    !locked &&
    /^\d{4,6}$/.test(form.newPin) &&
    form.newPin === form.confirmPin &&
    (hasPin ? form.currentPin.length > 0 : form.password.length > 0);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!/^\d{4,6}$/.test(form.newPin)) {
      setError('Your PIN must be 4 to 6 digits.');
      return;
    }
    if (form.newPin !== form.confirmPin) {
      setError('The two PINs do not match.');
      return;
    }

    setSaving(true);
    const { error: err } = await setPin(form.newPin, {
      currentPin: hasPin ? form.currentPin : undefined,
      password: hasPin ? undefined : form.password,
    });
    setSaving(false);

    // Re-read either way: a wrong current PIN consumes an attempt server-side,
    // so the attempt count on screen has to come from the database.
    await refresh();

    if (err) {
      setError(err.message);
      return;
    }

    setForm({ newPin: '', confirmPin: '', currentPin: '', password: '' });
    setSuccess(hasPin ? 'Your PIN has been changed.' : 'Your PIN has been created.');
  }

  if (loading) {
    return (
      <div className="max-w-2xl">
        <div className="bg-navy-800 border border-gold-400/10 rounded-2xl p-6 md:p-8 flex items-center gap-3 text-cream-300">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Checking your security settings…</span>
        </div>
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="max-w-2xl">
        <div className="bg-navy-800 border border-amber-400/25 rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center">
              <AlertTriangle size={18} className="text-amber-400" />
            </div>
            <div>
              <h2 className="font-serif text-2xl text-cream-100">Security</h2>
              <p className="text-xs text-cream-300 mt-1">Not available yet.</p>
            </div>
          </div>
          <p className="text-sm text-cream-300 leading-relaxed">
            The PIN security functions are not on the server yet, so a PIN cannot be set from here.
            This is expected until migration 010 has been applied to the database — nothing is
            broken, and your account is unaffected.
          </p>
          <p className="mt-3 text-xs text-cream-300/60 break-words">{unavailable}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-navy-800 border border-gold-400/10 rounded-2xl p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gold-400/10 flex items-center justify-center">
            <KeyRound size={18} className="text-gold-400" />
          </div>
          <div>
            <h2 className="font-serif text-2xl text-cream-100">
              {hasPin ? 'Change Your PIN' : 'Create Your PIN'}
            </h2>
            <p className="text-xs text-cream-300 mt-1">
              Your PIN confirms sensitive actions such as approving partners, changing roles, and
              deleting records.
            </p>
          </div>
        </div>

        {loadError && (
          <div className="mb-5 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs text-red-200">
            {loadError}
          </div>
        )}

        {locked && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3">
            <Lock size={15} className="text-red-300 mt-0.5 shrink-0" />
            <div className="text-xs text-red-200 leading-relaxed">
              <span className="font-semibold">Too many incorrect PINs.</span> For your protection the
              PIN is locked for another{' '}
              <span className="font-mono font-semibold">{formatCountdown(secondsLeft)}</span>. Even
              the correct PIN will be rejected until then.
            </div>
          </div>
        )}

        {!locked && hasPin && typeof status?.attemptsLeft === 'number' && status.attemptsLeft < 5 && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-400/25 bg-amber-400/10 px-4 py-3">
            <ShieldAlert size={15} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-200 leading-relaxed">
              {status.attemptsLeft} attempt{status.attemptsLeft === 1 ? '' : 's'} left before the PIN
              locks.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-xs font-medium text-cream-300 mb-1.5">
              {hasPin ? 'New PIN' : 'PIN'}
            </span>
            <input
              type={reveal ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={form.newPin}
              disabled={locked}
              onChange={e =>
                setForm(f => ({ ...f, newPin: e.target.value.replace(/\D/g, '').slice(0, 6) }))
              }
              placeholder="4–6 digits"
              className="w-full bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 tracking-[0.3em] placeholder-cream-300/40 placeholder:tracking-normal focus:outline-none focus:border-gold-400/50 disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-cream-300 mb-1.5">
              {hasPin ? 'Confirm new PIN' : 'Confirm PIN'}
            </span>
            <input
              type={reveal ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={form.confirmPin}
              disabled={locked}
              onChange={e =>
                setForm(f => ({ ...f, confirmPin: e.target.value.replace(/\D/g, '').slice(0, 6) }))
              }
              placeholder="Repeat your PIN"
              className="w-full bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 tracking-[0.3em] placeholder-cream-300/40 placeholder:tracking-normal focus:outline-none focus:border-gold-400/50 disabled:opacity-50"
            />
          </label>

          {hasPin ? (
            <label className="block">
              <span className="block text-xs font-medium text-cream-300 mb-1.5">
                Current PIN
                <span className="ml-2 text-cream-300/50">(required to change it)</span>
              </span>
              <input
                type={reveal ? 'text' : 'password'}
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={form.currentPin}
                disabled={locked}
                onChange={e =>
                  setForm(f => ({ ...f, currentPin: e.target.value.replace(/\D/g, '').slice(0, 6) }))
                }
                placeholder="Your existing PIN"
                className="w-full bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 tracking-[0.3em] placeholder-cream-300/40 placeholder:tracking-normal focus:outline-none focus:border-gold-400/50 disabled:opacity-50"
              />
            </label>
          ) : (
            <label className="block">
              <span className="block text-xs font-medium text-cream-300 mb-1.5">
                Account password
                <span className="ml-2 text-cream-300/50">(required for the first PIN)</span>
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={form.password}
                disabled={locked}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Your login password"
                className="w-full bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/50 disabled:opacity-50"
              />
              <span className="mt-1.5 block text-[11px] leading-relaxed text-cream-300/60">
                We ask for this so that someone who finds your unlocked screen cannot install their
                own PIN and use it to approve things in your name. It is checked on the server, never
                stored in the browser.
              </span>
            </label>
          )}

          <button
            type="button"
            onClick={() => setReveal(r => !r)}
            className="inline-flex items-center gap-1.5 text-xs text-cream-300 transition-colors hover:text-cream-100"
          >
            {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
            {reveal ? 'Hide' : 'Show'} PIN
          </button>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span
              className={`text-xs ${success ? 'text-emerald-400' : error ? 'text-red-400' : 'text-transparent'}`}
            >
              {success ?? error ?? '\u00A0'}
            </span>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              {saving ? 'Saving…' : hasPin ? 'Change PIN' : 'Create PIN'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-navy-800/60 border border-gold-400/10 rounded-2xl px-6 py-5">
        <h3 className="text-xs font-medium text-gold-400 uppercase tracking-[0.18em] mb-3">
          Choosing a PIN
        </h3>
        <ul className="space-y-2 text-xs text-cream-300 leading-relaxed">
          <li>
            <span className="text-cream-100 font-medium">Use 6 digits if you can.</span> A 4-digit PIN
            is only 10,000 combinations. With the 5-attempt lockout, 4 digits falls in about three
            weeks of steady guessing — 6 digits takes years.
          </li>
          <li>Avoid birthdays, house numbers, and repeating digits such as 111111.</li>
          <li>
            After five wrong PINs the PIN locks for 15 minutes, and the correct PIN is rejected too
            until the lock lifts.
          </li>
          <li>Your PIN is stored hashed on the server. Nobody — including administrators — can read it.</li>
        </ul>
      </div>
    </div>
  );
}
