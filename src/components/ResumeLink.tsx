import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { getResumeSignedUrl } from '../lib/supabase';

type ResumeLinkProps = {
  /** Storage path (preferred) OR a legacy public URL from older records. */
  path: string | null;
  name: string;
  /** Visual variant — the review modal uses a slightly larger button. */
  size?: 'sm' | 'md';
};

/**
 * Renders an attachment button for an applicant resume.
 *
 * The `resumes` bucket is private (migrations 003 + 007): files are reachable
 * only by the uploader and admins. A stored public URL therefore no longer
 * resolves, so we mint a short-lived signed URL when the user clicks.
 *
 * Records created before the bucket was locked down may still hold a public
 * URL — those are opened directly.
 */
export default function ResumeLink({ path, name, size = 'sm' }: ResumeLinkProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const btnBase =
    'inline-flex items-center gap-2 font-medium border rounded-lg transition-colors disabled:opacity-60';
  const btnSize = size === 'md' ? 'text-sm px-4 py-2.5' : 'text-xs px-3 py-1.5';

  async function handleOpen() {
    if (!path) return;
    setError(null);

    // Legacy record that already holds a full public URL.
    if (/^https?:\/\//i.test(path)) {
      window.open(path, '_blank', 'noopener,noreferrer');
      return;
    }

    setBusy(true);
    const { url, error: signError } = await getResumeSignedUrl(path);
    setBusy(false);

    if (signError || !url) {
      setError('Could not open this file. It may have been removed.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  if (error) {
    return (
      <span
        className={`${btnBase} ${btnSize} text-cream-300/60 border-gold-400/10`}
        title={error}
      >
        <FileText size={size === 'md' ? 15 : 13} /> {name} (unavailable)
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={busy}
      className={`${btnBase} ${btnSize} text-gold-400 hover:text-gold-300 border-gold-400/25 hover:border-gold-400/50`}
    >
      {busy ? (
        <Loader2 size={size === 'md' ? 15 : 13} className="animate-spin" />
      ) : (
        <FileText size={size === 'md' ? 15 : 13} />
      )}
      {name}
    </button>
  );
}
