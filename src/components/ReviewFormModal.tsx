import { useEffect, useState } from 'react';
import { X, Star, Loader2 } from 'lucide-react';
import { createReview, type ReviewRow } from '../lib/supabase';
import { useCurrentUser } from '../store';

/**
 * The form a customer uses to write a review.
 *
 * Two decisions worth stating:
 *
 * 1. The name is taken from the signed-in profile and is NOT editable. A review
 *    is attached to a real account; letting the author retype the name turns a
 *    verified review into an anonymous one, which is the opposite of what the
 *    "Verified" badge promises.
 *
 * 2. The submit button is disabled until the text is long enough. The database
 *    also enforces a 10-character minimum, so this is not the only guard — but
 *    a form that lets you submit and then tells you no is a worse form.
 */

const MIN_QUOTE = 10;
const MAX_QUOTE = 1200;

export default function ReviewFormModal({
  open,
  onClose,
  onCreated,
  bookingId,
  service,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (review: ReviewRow) => void;
  /** Set when the review is about one specific completed booking. */
  bookingId?: string | null;
  /** Prefills the service line, e.g. "Deep Cleaning". */
  service?: string;
}) {
  const user = useCurrentUser();
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [quote, setQuote] = useState('');
  const [location, setLocation] = useState('');
  const [serviceText, setServiceText] = useState(service ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset each time the sheet opens. A stale draft from the last review is
  // worse than an empty form: it looks like the text was saved when it was not.
  useEffect(() => {
    if (!open) return;
    setRating(5);
    setHover(0);
    setQuote('');
    setLocation('');
    setServiceText(service ?? '');
    setError(null);
    setSaving(false);
  }, [open, service]);

  if (!open) return null;

  const trimmed = quote.trim();
  const tooShort = trimmed.length < MIN_QUOTE;
  const tooLong = trimmed.length > MAX_QUOTE;

  async function submit() {
    if (!user || tooShort || tooLong || saving) return;
    setSaving(true);
    setError(null);

    const { data, error: err } = await createReview({
      userId: user.id,
      customerName: user.name || user.email,
      location: location.trim() || undefined,
      rating,
      quote: trimmed,
      service: serviceText.trim() || undefined,
      bookingId: bookingId ?? null,
    });

    setSaving(false);

    if (err || !data) {
      // The most common real cause is the table not existing yet, which is an
      // operator problem, not a user problem — say so plainly instead of
      // showing a raw Postgres string.
      const message = err?.message ?? 'Something went wrong.';
      setError(
        message.includes('does not exist') || message.includes('42P01')
          ? 'Reviews are not switched on yet. Please try again later.'
          : message
      );
      return;
    }

    onCreated(data);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-form-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-gold-400/20 bg-navy-900 p-6 sm:p-7"
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 id="review-form-title" className="font-serif text-xl text-cream-100">
              Write a review
            </h2>
            <p className="text-xs text-cream-300 mt-1">
              {user ? `Posting as ${user.name || user.email}` : 'Please sign in to post a review.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close review form"
            className="shrink-0 text-cream-300 hover:text-cream-100 -m-2 p-2"
          >
            <X size={18} />
          </button>
        </div>

        {/* Rating — big targets, because this is the one control people
            actually want to tap on a phone. */}
        <div className="mb-5">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-gold-400 mb-2">
            Your rating
          </label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                aria-pressed={rating === n}
                className="p-1.5 -m-0.5 rounded transition-transform hover:scale-110"
              >
                <Star
                  size={26}
                  aria-hidden="true"
                  className={
                    n <= (hover || rating)
                      ? 'fill-gold-400 text-gold-400'
                      : 'fill-transparent text-cream-300/35'
                  }
                />
              </button>
            ))}
            <span className="ml-2 text-sm text-cream-300">
              {hover || rating} / 5
            </span>
          </div>
        </div>

        <div className="mb-4">
          <label
            htmlFor="review-quote"
            className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-gold-400 mb-2"
          >
            Your review
          </label>
          <textarea
            id="review-quote"
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            rows={4}
            placeholder="What was the service like? What stood out?"
            className="w-full rounded-xl border border-gold-400/20 bg-navy-950 px-4 py-3 text-sm text-cream-100 placeholder:text-cream-300/50 focus:border-gold-400/60 focus:outline-none resize-y"
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className={`text-[11px] ${tooShort ? 'text-cream-300' : 'text-emerald-400'}`}>
              {tooShort ? `At least ${MIN_QUOTE} characters` : 'Looks good'}
            </span>
            <span className={`text-[11px] ${tooLong ? 'text-red-400' : 'text-cream-300/70'}`}>
              {trimmed.length} / {MAX_QUOTE}
            </span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label
              htmlFor="review-service"
              className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-gold-400 mb-2"
            >
              Service <span className="text-cream-300/60 normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id="review-service"
              value={serviceText}
              onChange={(e) => setServiceText(e.target.value)}
              placeholder="Deep Cleaning"
              className="w-full rounded-xl border border-gold-400/20 bg-navy-950 px-4 py-3 text-sm text-cream-100 placeholder:text-cream-300/50 focus:border-gold-400/60 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="review-location"
              className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-gold-400 mb-2"
            >
              Area <span className="text-cream-300/60 normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id="review-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="San Juan City"
              className="w-full rounded-xl border border-gold-400/20 bg-navy-950 px-4 py-3 text-sm text-cream-100 placeholder:text-cream-300/50 focus:border-gold-400/60 focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs text-red-300">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gold-400/25 px-5 py-3 text-sm font-semibold text-cream-200 hover:border-gold-400/50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!user || tooShort || tooLong || saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-400 px-6 py-3 text-sm font-bold text-navy-950 hover:bg-gold-300 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {saving ? 'Posting…' : 'Post review'}
          </button>
        </div>
      </div>
    </div>
  );
}
