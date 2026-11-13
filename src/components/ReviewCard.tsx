import { Star, BadgeCheck, EyeOff, Trash2 } from 'lucide-react';
import type { ReviewRow } from '../lib/supabase';

/**
 * One review, rendered the same way everywhere it appears.
 *
 * Why one component and not two: the home page and the reviews page must never
 * disagree about what a review looks like. Two copies drift — one gets a new
 * badge, the other does not, and the same review looks different depending on
 * which page you reached it from.
 *
 * Every colour here is a TOKEN (`bg-navy-800`, `text-gold-400`, …), never a hex
 * literal. The home page is built on hardcoded hex, but the tokens were chosen
 * to be the same colours, so this card matches it in dark mode and still
 * follows the light theme on the reviews page.
 */

/** Five stars, filled to `rating`. Empty stars stay visible so the score reads
 *  as "3 out of 5", not as "three stars, unknown total". */
export function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          aria-hidden="true"
          className={n <= rating ? 'fill-gold-400 text-gold-400' : 'fill-transparent text-cream-300/35'}
        />
      ))}
    </div>
  );
}

export default function ReviewCard({
  review,
  featured = false,
  onDelete,
  onToggleHidden,
  busy = false,
}: {
  review: ReviewRow;
  /** The middle card on the home page is amber, matching the old design. */
  featured?: boolean;
  onDelete?: (id: string) => void;
  onToggleHidden?: (id: string, hidden: boolean) => void;
  busy?: boolean;
}) {
  const when = new Date(review.created_at).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl p-6 sm:p-7 ${
        featured
          ? 'bg-gold-400'
          : 'bg-navy-800 border border-gold-400/10'
      } ${review.is_hidden ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <Stars rating={review.rating} />
        <div className="flex items-center gap-1.5">
          {review.is_hidden && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                featured ? 'bg-navy-950/15 text-navy-950' : 'bg-cream-300/15 text-cream-300'
              }`}
            >
              <EyeOff size={10} aria-hidden="true" /> Hidden
            </span>
          )}
          {review.verified && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                featured ? 'bg-navy-950/15 text-navy-950' : 'bg-gold-400/15 text-gold-400'
              }`}
            >
              <BadgeCheck size={10} aria-hidden="true" /> Verified
            </span>
          )}
        </div>
      </div>

      <blockquote
        className={`font-serif italic text-sm leading-relaxed mb-5 flex-1 ${
          featured ? 'text-navy-950/85' : 'text-cream-200'
        }`}
      >
        “{review.quote}”
      </blockquote>

      <div className="mt-auto">
        <div
          className={`text-xs font-black uppercase tracking-wide ${
            featured ? 'text-navy-950' : 'text-cream-100'
          }`}
        >
          {review.customer_name}
        </div>
        <div className={`text-[11px] mt-0.5 ${featured ? 'text-navy-950/65' : 'text-cream-300'}`}>
          {review.location || when}
        </div>
        {review.service && (
          <div
            className={`text-[11px] mt-1 font-semibold ${
              featured ? 'text-navy-950/80' : 'text-gold-400'
            }`}
          >
            {review.service}
          </div>
        )}
      </div>

      {(onDelete || onToggleHidden) && (
        <div
          className={`mt-4 flex items-center gap-2 border-t pt-3 ${
            featured ? 'border-navy-950/15' : 'border-cream-300/10'
          }`}
        >
          {onToggleHidden && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onToggleHidden(review.id, !review.is_hidden)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                featured
                  ? 'text-navy-950/80 hover:bg-navy-950/10'
                  : 'text-cream-300 hover:bg-cream-300/10 hover:text-cream-100'
              }`}
            >
              <EyeOff size={12} aria-hidden="true" />
              {review.is_hidden ? 'Show' : 'Hide'}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDelete(review.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                featured
                  ? 'text-navy-950/80 hover:bg-navy-950/10'
                  : 'text-red-400 hover:bg-red-400/10'
              }`}
            >
              <Trash2 size={12} aria-hidden="true" /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
