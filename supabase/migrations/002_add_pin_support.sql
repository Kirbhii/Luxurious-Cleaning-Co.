-- ============================================================
-- Add PIN Support for Staff Users (Cleaner, Admin, Partner)
-- Run this migration if you already have the initial schema
-- ============================================================

-- Add PIN columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS pin_created_at TIMESTAMPTZ;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.pin_hash IS 'bcrypt hash of 4-6 digit PIN for staff authentication';
COMMENT ON COLUMN public.profiles.pin_created_at IS 'Timestamp when PIN was first created or last updated';
