-- ============================================================
-- Luxurious Cleaning Co. — Initial Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID extension (already enabled on Supabase by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE public.user_role AS ENUM ('customer', 'cleaner', 'partner', 'admin');
CREATE TYPE public.membership_tier AS ENUM ('bronze', 'silver', 'gold');
CREATE TYPE public.membership_status AS ENUM ('none', 'active', 'pending');
CREATE TYPE public.booking_status AS ENUM (
  'pending', 'confirmed', 'cleaner_assigned',
  'en_route', 'in_progress', 'completed',
  'cancelled', 'rescheduled', 'awaiting_quote'
);
CREATE TYPE public.application_status AS ENUM (
  'submitted', 'under_review', 'approved', 'rejected'
);
CREATE TYPE public.training_app_status AS ENUM (
  'submitted', 'under_review', 'accepted', 'scheduled', 'completed', 'rejected'
);
CREATE TYPE public.partner_project_status AS ENUM (
  'lead_submitted', 'received', 'contacted', 'quote',
  'approved', 'scheduled', 'cleaning', 'completed'
);

-- ============================================================
-- PROFILES TABLE
-- Extends Supabase auth.users with role-specific data.
-- One row per auth user. Created automatically via trigger.
-- ============================================================

CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  role            public.user_role NOT NULL DEFAULT 'customer',

  -- Cleaner-specific
  employee_id     TEXT UNIQUE,           -- e.g. "CLN-001"
  assigned_zone_id TEXT,                 -- e.g. "TOR-CENTRAL"

  -- Partner-specific
  company_id      TEXT,                  -- links to partner_companies.id
  company_code    TEXT,                  -- e.g. "APEX-001"

  -- Admin-specific
  permissions     TEXT[] NOT NULL DEFAULT '{}',
  -- e.g. '{manage_users,approve_partners,manage_bookings}'

  -- Membership (customers)
  membership_tier   public.membership_tier,
  membership_status public.membership_status NOT NULL DEFAULT 'none',

  -- Meta
  partner_application_id TEXT,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PARTNER COMPANIES
-- ============================================================

CREATE TABLE public.partner_companies (
  id              TEXT PRIMARY KEY DEFAULT 'company_' || gen_random_uuid()::text,
  name            TEXT NOT NULL,
  code            TEXT UNIQUE NOT NULL,   -- e.g. "APEX-001"
  industry        TEXT,
  website         TEXT,
  address         TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MFA / TOTP SETTINGS  (admin only)
-- Supabase Auth handles TOTP natively via supabase.auth.mfa.*
-- This table stores admin-specific MFA enforcement policy.
-- ============================================================

CREATE TABLE public.admin_mfa_policy (
  profile_id      UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  mfa_required    BOOLEAN NOT NULL DEFAULT TRUE,
  mfa_verified_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BOOKINGS
-- ============================================================

CREATE TABLE public.bookings (
  id                  TEXT PRIMARY KEY,            -- e.g. "LC-10293"
  customer_id         UUID NOT NULL REFERENCES public.profiles(id),
  cleaner_id          UUID REFERENCES public.profiles(id),
  service             TEXT NOT NULL,
  status              public.booking_status NOT NULL DEFAULT 'pending',
  date                DATE NOT NULL,
  time                TIME NOT NULL,
  address             TEXT NOT NULL,
  city                TEXT NOT NULL,
  property_type       TEXT NOT NULL DEFAULT '',
  bedrooms            INT NOT NULL DEFAULT 1,
  bathrooms           INT NOT NULL DEFAULT 1,
  size                TEXT NOT NULL DEFAULT '',
  frequency           TEXT NOT NULL DEFAULT 'One-time',
  special_requests    TEXT NOT NULL DEFAULT '',
  fragrance           TEXT NOT NULL DEFAULT '',
  allergies           TEXT NOT NULL DEFAULT '',
  access_instructions TEXT NOT NULL DEFAULT '',
  cleaner_notes       TEXT NOT NULL DEFAULT '',
  before_photos       TEXT[] NOT NULL DEFAULT '{}',
  progress_photos     TEXT[] NOT NULL DEFAULT '{}',
  after_photos        TEXT[] NOT NULL DEFAULT '{}',
  -- partner_id lets partners see bookings scoped to their company
  partner_company_id  TEXT REFERENCES public.partner_companies(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BOOKING TIMELINE EVENTS
-- ============================================================

CREATE TABLE public.booking_timeline (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  event       TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  actor       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  link        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PARTNER APPLICATIONS
-- ============================================================

CREATE TABLE public.partner_applications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES public.profiles(id),
  company_name        TEXT NOT NULL,
  industry            TEXT NOT NULL DEFAULT '',
  contact_person      TEXT NOT NULL,
  position            TEXT NOT NULL DEFAULT '',
  email               TEXT NOT NULL,
  phone               TEXT NOT NULL DEFAULT '',
  website             TEXT NOT NULL DEFAULT '',
  address             TEXT NOT NULL DEFAULT '',
  services_required   TEXT NOT NULL DEFAULT '',
  estimated_volume    TEXT NOT NULL DEFAULT '',
  proposal            TEXT NOT NULL DEFAULT '',
  status              public.application_status NOT NULL DEFAULT 'submitted',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PARTNER PROJECTS
-- ============================================================

CREATE TABLE public.partner_projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id        TEXT NOT NULL REFERENCES public.partner_companies(id),
  name              TEXT NOT NULL,
  address           TEXT NOT NULL DEFAULT '',
  size              TEXT NOT NULL DEFAULT '',
  units             TEXT NOT NULL DEFAULT '',
  turnover_date     DATE,
  preferred_date    DATE,
  requirements      TEXT NOT NULL DEFAULT '',
  additional_info   TEXT NOT NULL DEFAULT '',
  status            public.partner_project_status NOT NULL DEFAULT 'lead_submitted',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRAINING PROGRAMS
-- ============================================================

CREATE TABLE public.training_programs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  requirements      TEXT NOT NULL DEFAULT '',
  duration          TEXT NOT NULL DEFAULT '',
  objectives        TEXT[] NOT NULL DEFAULT '{}',
  schedule          TEXT NOT NULL DEFAULT '',
  slots             INT NOT NULL DEFAULT 10,
  slots_available   INT NOT NULL DEFAULT 10,
  price             NUMERIC(10, 2),          -- NULL = free
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRAINING APPLICATIONS
-- ============================================================

CREATE TABLE public.training_applications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  UUID NOT NULL REFERENCES public.training_programs(id),
  user_id     UUID REFERENCES public.profiles(id),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT NOT NULL DEFAULT '',
  experience  TEXT NOT NULL DEFAULT '',
  status      public.training_app_status NOT NULL DEFAULT 'submitted',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CONTACT MESSAGES
-- ============================================================

CREATE TABLE public.contact_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT NOT NULL DEFAULT '',
  subject     TEXT NOT NULL DEFAULT '',
  message     TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_partner_apps_updated_at
  BEFORE UPDATE ON public.partner_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_partner_projects_updated_at
  BEFORE UPDATE ON public.partner_projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_training_apps_updated_at
  BEFORE UPDATE ON public.training_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP TRIGGER
-- Reads `role` from auth.users raw_user_meta_data.
-- Pass { role: 'customer' | 'cleaner' | 'partner' | 'admin' }
-- in the options.data field when calling supabase.auth.signUp().
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _role public.user_role;
BEGIN
  -- Default to 'customer' if no role supplied
  _role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::public.user_role,
    'customer'
  );

  INSERT INTO public.profiles (
    id,
    email,
    name,
    phone,
    role,
    employee_id,
    company_code,
    permissions
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    _role,
    NULLIF(NEW.raw_user_meta_data->>'employee_id', ''),
    NULLIF(NEW.raw_user_meta_data->>'company_code', ''),
    CASE WHEN _role = 'admin'
      THEN ARRAY['manage_users','approve_partners','manage_bookings']
      ELSE '{}'
    END
  );

  -- Enforce MFA policy row for admins
  IF _role = 'admin' THEN
    INSERT INTO public.admin_mfa_policy (profile_id, mfa_required)
    VALUES (NEW.id, TRUE);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_companies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_mfa_policy    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_timeline    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_projects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_programs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages    ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role without re-querying profiles repeatedly
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ── profiles ────────────────────────────────────────────────
-- Users can read/update only their own profile.
-- Admins can read all profiles.

CREATE POLICY "profiles: own read"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.current_user_role() = 'admin');

CREATE POLICY "profiles: own update"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── partner_companies ────────────────────────────────────────
CREATE POLICY "companies: admin full access"
  ON public.partner_companies FOR ALL
  USING (public.current_user_role() = 'admin');

CREATE POLICY "companies: partner read own"
  ON public.partner_companies FOR SELECT
  USING (
    id = public.current_company_id()
    OR public.current_user_role() = 'admin'
  );

-- ── bookings ─────────────────────────────────────────────────
-- Customer sees their own bookings.
-- Cleaner sees bookings assigned to them.
-- Partner sees bookings scoped to their company.
-- Admin sees all.

CREATE POLICY "bookings: customer"
  ON public.bookings FOR SELECT
  USING (
    customer_id = auth.uid()
    OR cleaner_id = auth.uid()
    OR partner_company_id = public.current_company_id()
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY "bookings: customer insert"
  ON public.bookings FOR INSERT
  WITH CHECK (customer_id = auth.uid() OR public.current_user_role() = 'admin');

CREATE POLICY "bookings: update"
  ON public.bookings FOR UPDATE
  USING (
    customer_id = auth.uid()
    OR cleaner_id = auth.uid()
    OR public.current_user_role() IN ('admin', 'partner')
  );

CREATE POLICY "bookings: admin delete"
  ON public.bookings FOR DELETE
  USING (public.current_user_role() = 'admin');

-- ── booking_timeline ─────────────────────────────────────────
CREATE POLICY "timeline: read if booking visible"
  ON public.booking_timeline FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND (
          b.customer_id = auth.uid()
          OR b.cleaner_id = auth.uid()
          OR b.partner_company_id = public.current_company_id()
          OR public.current_user_role() = 'admin'
        )
    )
  );

CREATE POLICY "timeline: insert"
  ON public.booking_timeline FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND (
          b.cleaner_id = auth.uid()
          OR public.current_user_role() = 'admin'
        )
    )
  );

-- ── notifications ────────────────────────────────────────────
CREATE POLICY "notifications: own"
  ON public.notifications FOR ALL
  USING (user_id = auth.uid() OR public.current_user_role() = 'admin');

-- ── partner_applications ─────────────────────────────────────
CREATE POLICY "partner_apps: own or admin"
  ON public.partner_applications FOR SELECT
  USING (user_id = auth.uid() OR public.current_user_role() = 'admin');

CREATE POLICY "partner_apps: insert"
  ON public.partner_applications FOR INSERT
  WITH CHECK (TRUE); -- Allow unauthenticated inquiries too

CREATE POLICY "partner_apps: update admin"
  ON public.partner_applications FOR UPDATE
  USING (public.current_user_role() = 'admin');

-- ── partner_projects ─────────────────────────────────────────
CREATE POLICY "partner_projects: partner or admin"
  ON public.partner_projects FOR SELECT
  USING (
    partner_id = public.current_company_id()
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY "partner_projects: insert partner"
  ON public.partner_projects FOR INSERT
  WITH CHECK (
    partner_id = public.current_company_id()
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY "partner_projects: update"
  ON public.partner_projects FOR UPDATE
  USING (
    partner_id = public.current_company_id()
    OR public.current_user_role() = 'admin'
  );

-- ── training_programs ────────────────────────────────────────
CREATE POLICY "training_programs: public read"
  ON public.training_programs FOR SELECT
  USING (TRUE);

CREATE POLICY "training_programs: admin write"
  ON public.training_programs FOR ALL
  USING (public.current_user_role() = 'admin');

-- ── training_applications ────────────────────────────────────
CREATE POLICY "training_apps: own or admin"
  ON public.training_applications FOR SELECT
  USING (user_id = auth.uid() OR public.current_user_role() = 'admin');

CREATE POLICY "training_apps: insert"
  ON public.training_applications FOR INSERT
  WITH CHECK (TRUE); -- Allow unauthenticated applicants

CREATE POLICY "training_apps: update admin"
  ON public.training_applications FOR UPDATE
  USING (public.current_user_role() = 'admin');

-- ── contact_messages ────────────────────────────────────────
CREATE POLICY "contact: insert public"
  ON public.contact_messages FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "contact: admin read"
  ON public.contact_messages FOR SELECT
  USING (public.current_user_role() = 'admin');

CREATE POLICY "contact: admin update"
  ON public.contact_messages FOR UPDATE
  USING (public.current_user_role() = 'admin');

-- ── admin_mfa_policy ─────────────────────────────────────────
CREATE POLICY "mfa: own or admin"
  ON public.admin_mfa_policy FOR ALL
  USING (profile_id = auth.uid() OR public.current_user_role() = 'admin');

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_bookings_customer  ON public.bookings(customer_id);
CREATE INDEX idx_bookings_cleaner   ON public.bookings(cleaner_id);
CREATE INDEX idx_bookings_partner   ON public.bookings(partner_company_id);
CREATE INDEX idx_bookings_status    ON public.bookings(status);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_timeline_booking   ON public.booking_timeline(booking_id);
CREATE INDEX idx_profiles_role      ON public.profiles(role);
CREATE INDEX idx_profiles_employee  ON public.profiles(employee_id);
CREATE INDEX idx_profiles_company   ON public.profiles(company_id);
