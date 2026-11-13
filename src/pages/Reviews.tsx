import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, MessageSquarePlus, PenLine, Quote } from 'lucide-react';
import { useCurrentUser } from '../store';
import {
  fetchReviews,
  fetchMyReviews,
  deleteReview,
  isMissingTable,
  type ReviewRow,
} from '../lib/supabase';
import ReviewCard, { Stars } from '../components/ReviewCard';
import ReviewFormModal from '../components/ReviewFormModal';
import AuthPromptModal from '../components/AuthPromptModal';

/**
 * /reviews — every published review, plus the way to add one.
 *
 * The home page shows the newest three and links here. That split is
 * deliberate: a short strip on the landing page is a social proof cue, but a
 * reader who wants to check the record before booking needs to see all of it,
 * including the three-star ones. A page that only ever shows the best three
 * is advertising, not evidence.
 */
export default function Reviews() {
  const user = useCurrentUser();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [mine, setMine] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchReviews();
    if (error) {
      if (isMissingTable(error.message)) setTableMissing(true);
      setReviews([]);
    } else {
      setReviews(data);
      setTableMissing(false);
    }

    if (user) {
      const own = await fetchMyReviews(user.id);
      setMine(own.data);
    } else {
      setMine([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const average = useMemo(() => {
    if (reviews.length === 0) return null;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  // Counts per star, for the little distribution bar. Cheap to compute and it
  // tells a reader far more than a single average does.
  const distribution = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    reviews.forEach((r) => {
      buckets[Math.min(5, Math.max(1, r.rating)) - 1] += 1;
    });
    return buckets;
  }, [reviews]);

  function startWrite() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setFormOpen(true);
  }

  async function remove(id: string) {
    setBusyId(id);
    const { error } = await deleteReview(id);
    setBusyId(null);
    if (!error) {
      setReviews((prev) => prev.filter((r) => r.id !== id));
      setMine((prev) => prev.filter((r) => r.id !== id));
    }
  }

  const myIds = new Set(mine.map((r) => r.id));

  return (
    <div className="pt-16">
      {/* Header */}
      <section className="py-20 bg-navy-900 border-b border-gold-400/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-3">
            Client Reviews
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-cream-100 mb-5">
                What clients say
              </h1>
              <p className="text-cream-300 text-base sm:text-lg max-w-xl leading-relaxed">
                Every review below was written by a customer with an account. Reviews marked
                verified are tied to a booking that was actually completed.
              </p>
            </div>

            <button
              type="button"
              onClick={startWrite}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-400 px-6 py-3.5 text-sm font-bold text-navy-950 hover:bg-gold-300 transition-colors shrink-0 w-full sm:w-auto"
            >
              <PenLine size={15} aria-hidden="true" />
              Write a review
            </button>
          </div>

          {/* Summary */}
          {average !== null && (
            <div className="mt-10 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center max-w-2xl">
              <div className="flex items-center gap-4">
                <div className="font-display font-black text-5xl text-gold-400 leading-none">
                  {average.toFixed(1)}
                </div>
                <div>
                  <Stars rating={Math.round(average)} size={15} />
                  <div className="text-xs text-cream-300 mt-1">
                    {reviews.length} review{reviews.length === 1 ? '' : 's'}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = distribution[star - 1];
                  const pct = reviews.length ? (count / reviews.length) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2">
                      <span className="text-[11px] text-cream-300 w-3 text-right">{star}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-navy-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gold-400 transition-[width] duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-cream-300/70 w-6 tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* List */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-cream-300 text-sm">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Loading reviews…
            </div>
          ) : tableMissing ? (
            <div className="mx-auto max-w-xl rounded-2xl border border-gold-400/20 bg-navy-800 px-6 py-10 text-center">
              <Quote size={22} className="mx-auto mb-3 text-gold-400" aria-hidden="true" />
              <h2 className="font-serif text-xl text-cream-100 mb-2">Reviews are being set up</h2>
              <p className="text-sm text-cream-300 leading-relaxed">
                This page is ready, but the review store has not been switched on yet. Once it
                is, reviews written by customers will appear here automatically.
              </p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="mx-auto max-w-xl rounded-2xl border border-gold-400/20 bg-navy-800 px-6 py-12 text-center">
              <MessageSquarePlus size={22} className="mx-auto mb-3 text-gold-400" aria-hidden="true" />
              <h2 className="font-serif text-xl text-cream-100 mb-2">No reviews yet</h2>
              <p className="text-sm text-cream-300 leading-relaxed mb-6">
                If we have cleaned for you, your words would help the next person decide.
              </p>
              <button
                type="button"
                onClick={startWrite}
                className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-6 py-3 text-sm font-bold text-navy-950 hover:bg-gold-300 transition-colors"
              >
                <PenLine size={14} aria-hidden="true" /> Write the first review
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  busy={busyId === review.id}
                  onDelete={user && myIds.has(review.id) ? remove : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 bg-navy-800 border-t border-gold-400/10">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-serif text-3xl text-cream-100 mb-3">Ready to see for yourself?</h2>
          <p className="text-cream-300 text-sm leading-relaxed mb-7 max-w-lg mx-auto">
            Book a cleaning and find out why our clients keep coming back.
          </p>
          <Link
            to="/book"
            className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-7 py-3.5 text-sm font-bold text-navy-950 hover:bg-gold-300 transition-colors"
          >
            Book a Service <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <ReviewFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(review) => {
          setReviews((prev) => [review, ...prev]);
          setMine((prev) => [review, ...prev]);
        }}
      />

      <AuthPromptModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        redirectAfterLogin="/reviews"
      />
    </div>
  );
}
