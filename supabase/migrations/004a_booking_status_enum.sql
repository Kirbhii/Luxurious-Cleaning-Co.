-- ─── Booking status enum values ─────────────────────────────────────────────
-- RUN THIS FILE FIRST, alone, before 004b.
-- Postgres requires new enum values to be committed before they can be used
-- anywhere else, so these two lines must run in their own batch.

-- 1. Booking statuses used by the app but missing from the enum
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'awaiting_review';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'rejected';
