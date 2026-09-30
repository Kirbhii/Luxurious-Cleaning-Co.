import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, ShieldAlert, Lock, Loader2, X, AlertTriangle, KeyRound } from 'lucide-react';
import { pinLockStatus, verifyUserPin, isMissingRpc, type PinLockStatus } from '../lib/supabase';

type PinPromptModalProps = {
  title: string;
  message: string;
  confirmLabel: string;
  /** Runs only after the PIN has been verified. */
  onConfirm: () => void;
  onCancel: () => void;
};

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Reusable step-up gate. Wrap any sensitive action so it only runs after the
 * user re-enters their PIN.
 *
 * Usage:
 *   {pendingAction && (
 *     <PinPromptModal
 *       title="Delete this booking?"
 *       message="This also removes its full timeline. This cannot be undone."
 *       confirmLabel="Delete Booking"
 *       onConfirm={() => { doTheDelete(); setPendingAction(null); }}
 *       onCancel={() => setPendingAction(null)}
 *     />
 *   )}
 *
 * FAILS CLOSED. If the PIN functions are missing from the server (migration 010
 * not applied) or the PIN state cannot be read, the action is NOT allowed
 * through. A gate that silently opens when it cannot check is worse than no
 * gate, because it still looks like one.
 */
export default function PinPromptModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: PinPromptModalProps) {
  const [status, setStatus] = useState<PinLockStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const { status: next, error: err } = await pinLockStatus();

    if (err) {
      setUnavailable(
        isMissingRpc(err.message)
          ? 'The PIN security functions are not on the server yet, so this action cannot be confirmed. Apply migration 010 first.'
          : err.message
      );
      setLoading(false);
      return;
    }

    setUnavailable(null);
    setStatus(next);
    setSecondsLeft(next?.secondsRemaining ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (loading) return;
    inputRef.current?.focus();
  }, [loading]);

  const locked = secondsLeft > 0;

  useEffect(() => {
    if (!locked) return;
    const timer = window.setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [locked]);

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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (verifying || locked || pin.length < 4) return;

    setVerifying(true);
    setError(null);
    const { valid, error: err } = await verifyUserPin(pin);
    setVerifying(false);

    if (valid) {
      onConfirm();
      return;
    }

    setPin('');
    // A wrong PIN burns an attempt server-side, so the count has to come from
    // the database — and it may have just tipped into a lockout.
    await refresh();
    setError(err?.message ?? 'Incorrect PIN');
    inputRef.current?.focus();
  }

  const hasPin = status?.hasPin ?? false;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/65 px-5 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-prompt-title"
        className="relative w-full max-w-sm rounded-2xl border border-gold-400/25 bg-navy-900 px-6 py-7 shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close PIN dialog"
          onClick={onCancel}
          className="absolute right-4 top-4 text-cream-300 transition-colors hover:text-cream-100"
        >
          <X size={16} />
        </button>

        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-gold-400/30 bg-gold-400/10 text-gold-400">
          <KeyRound size={21} />
        </div>

        <h2 id="pin-prompt-title" className="text-lg font-semibold text-cream-100">
          {title}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-cream-300">{message}</p>

        {loading ? (
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-cream-300">
            <Loader2 size={14} className="animate-spin" />
            Checking…
          </div>
        ) : unavailable ? (
          <>
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2.5">
              <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] leading-relaxed text-amber-200">{unavailable}</p>
            </div>
            <div className="mt-5">
              <button
                type="button"
                onClick={onCancel}
                className="w-full rounded-md border border-gold-400/20 bg-navy-800 px-4 py-2.5 text-xs font-medium text-cream-300 transition-colors hover:border-gold-400/40 hover:text-cream-100"
              >
                Close
              </button>
            </div>
          </>
        ) : !hasPin ? (
          <>
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2.5">
              <ShieldAlert size={14} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] leading-relaxed text-amber-200">
                You have not set a PIN yet. Create one in <span className="font-semibold">Security</span>{' '}
                before using actions that need confirmation.
              </p>
            </div>
            <div className="mt-5">
              <button
                type="button"
                onClick={onCancel}
                className="w-full rounded-md border border-gold-400/20 bg-navy-800 px-4 py-2.5 text-xs font-medium text-cream-300 transition-colors hover:border-gold-400/40 hover:text-cream-100"
              >
                Close
              </button>
            </div>
          </>
        ) : locked ? (
          <>
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2.5">
              <Lock size={14} className="text-red-300 mt-0.5 shrink-0" />
              <p className="text-[11px] leading-relaxed text-red-200">
                <span className="font-semibold">PIN locked.</span> Try again in{' '}
                <span className="font-mono font-semibold">{formatCountdown(secondsLeft)}</span>. The
                correct PIN is rejected until then.
              </p>
            </div>
            <div className="mt-5">
              <button
                type="button"
                onClick={onCancel}
                className="w-full rounded-md border border-gold-400/20 bg-navy-800 px-4 py-2.5 text-xs font-medium text-cream-300 transition-colors hover:border-gold-400/40 hover:text-cream-100"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <label className="block">
              <span className="block text-xs font-medium text-cream-300 mb-1.5">Your PIN</span>
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="4–6 digits"
                className="w-full bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 tracking-[0.3em] placeholder-cream-300/40 placeholder:tracking-normal focus:outline-none focus:border-gold-400/50"
              />
            </label>

            <div className="min-h-[1rem] text-[11px] leading-relaxed">
              {error && <span className="text-red-400">{error}</span>}
              {!error && typeof status?.attemptsLeft === 'number' && status.attemptsLeft < 5 && (
                <span className="text-amber-300">
                  {status.attemptsLeft} attempt{status.attemptsLeft === 1 ? '' : 's'} left.
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md border border-gold-400/20 bg-navy-800 px-4 py-2.5 text-xs font-medium text-cream-300 transition-colors hover:border-gold-400/40 hover:text-cream-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={verifying || pin.length < 4}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-gold-400 px-4 py-2.5 text-xs font-semibold text-navy-950 transition-colors hover:bg-gold-300 disabled:opacity-60"
              >
                {verifying ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                {verifying ? 'Checking…' : confirmLabel}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
