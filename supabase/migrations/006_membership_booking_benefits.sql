-- ─── Membership benefit wiring on bookings ────────────────────────────────
-- Member bookings carry queue priority, the member tier snapshot, and the
-- auto-applied member discount so benefits are visible in-app and in the DB.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS member_tier public.membership_tier,
  ADD COLUMN IF NOT EXISTS discount_percent INT NOT NULL DEFAULT 0;

-- Keep priority values tidy (normal = guest/standard, high = member, urgent = gold urgent request)
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_priority_check
  CHECK (priority IN ('normal', 'high', 'urgent')) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_bookings_priority ON public.bookings(priority);
