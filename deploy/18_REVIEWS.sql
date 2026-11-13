-- ============================================================================
--  18_REVIEWS.sql  —  Client reviews, written by customers, shown on the site
-- ============================================================================
--  WHAT THIS DOES
--    Adds one table, `reviews`, so a customer can write a review in the portal
--    and have it appear on the home page without anyone editing code.
--
--  WHO CAN DO WHAT (enforced by the database, not by the app)
--    · Anyone, signed in or not, can READ a review that is not hidden.
--    · A signed-in customer can WRITE a review, but only as themselves.
--    · A customer can EDIT or DELETE their own review.
--    · An admin can hide, unhide, edit or delete any review.
--    · Only an admin can change `is_hidden` or `verified` — a trigger blocks
--      everyone else, so a customer cannot mark their own review "verified".
--
--  WHY `verified` EXISTS
--    A review tied to a completed booking is marked verified, because the
--    person really did receive that service. A review written without a
--    booking stays unverified. The home page shows both, but the badge tells
--    the reader which is which.
--
--  SAFE TO RE-RUN. Every statement is idempotent.
-- ============================================================================

begin;

-- ── 1. The table ────────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  -- TEXT, not uuid. A booking id is generated in the app as `LC-123456`
  -- (see genBookingId in src/store.tsx), not a UUID, so a uuid column here
  -- fails with 42804 "Key columns booking_id and id are of incompatible types".
  booking_id    text references public.bookings (id) on delete set null,
  customer_name text not null check (char_length(trim(customer_name)) between 2 and 80),
  location      text check (location is null or char_length(location) <= 80),
  rating        smallint not null check (rating between 1 and 5),
  quote         text not null check (char_length(trim(quote)) between 10 and 1200),
  service       text check (service is null or char_length(service) <= 80),
  verified      boolean not null default false,
  is_hidden     boolean not null default false,
  created_at    timestamptz not null default now()
);

comment on table  public.reviews          is 'Customer-written reviews. Public read; own write; admin moderate.';
comment on column public.reviews.verified is 'True when the review is tied to a completed booking by this customer.';
comment on column public.reviews.is_hidden is 'Admin-only toggle. Hidden reviews still exist but are not shown publicly.';

-- The home page asks for the newest visible reviews, so index exactly that.
create index if not exists reviews_visible_recent_idx
  on public.reviews (created_at desc)
  where is_hidden = false;

-- One review per booking. A customer cannot post the same job five times.
create unique index if not exists reviews_one_per_booking_idx
  on public.reviews (booking_id)
  where booking_id is not null;

-- ── 2. Row-Level Security ───────────────────────────────────────────────────
alter table public.reviews enable row level security;

-- READ — visible reviews are public; you always see your own; admin sees all.
drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews
  for select
  using (
    is_hidden = false
    or user_id = auth.uid()
    or public.current_user_role() = 'admin'
  );

-- WRITE — you may only insert a row that belongs to you.
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- EDIT — your own, or any if admin.
drop policy if exists reviews_update on public.reviews;
create policy reviews_update on public.reviews
  for update
  to authenticated
  using (user_id = auth.uid() or public.current_user_role() = 'admin')
  with check (user_id = auth.uid() or public.current_user_role() = 'admin');

-- DELETE — your own, or any if admin.
drop policy if exists reviews_delete on public.reviews;
create policy reviews_delete on public.reviews
  for delete
  to authenticated
  using (user_id = auth.uid() or public.current_user_role() = 'admin');

-- ── 3. Derive `verified` on insert, freeze moderation columns on update ────
--  `verified` is NOT taken from the client. A browser can claim anything, so
--  the database decides: a review is verified only when it points at a booking
--  that belongs to the same user AND that booking actually reached
--  'completed'. Anything else stays unverified, whatever the request said.
create or replace function public.reviews_derive_verified()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.verified := exists (
    select 1
    from public.bookings b
    where b.id = new.booking_id
      and b.customer_id = new.user_id
      and b.status = 'completed'
  );

  -- A new review is never born hidden; hiding is an admin action.
  new.is_hidden := false;

  return new;
end;
$$;

drop trigger if exists reviews_derive_verified_trg on public.reviews;
create trigger reviews_derive_verified_trg
  before insert on public.reviews
  for each row
  execute function public.reviews_derive_verified();

--  RLS decides which ROWS you may touch. It cannot say "you may edit this row,
--  but not these two columns" — that is what a trigger is for. Without this,
--  a customer could update their own review and set is_hidden = false on a
--  review an admin had hidden, or mark themselves verified.
create or replace function public.reviews_guard_moderation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  is_admin boolean := (public.current_user_role() = 'admin');
begin
  if is_admin then
    return new;
  end if;

  if new.is_hidden is distinct from old.is_hidden then
    raise exception 'Only an admin can hide or unhide a review.'
      using errcode = '42501';
  end if;

  if new.verified is distinct from old.verified then
    raise exception 'Only an admin can change the verified flag.'
      using errcode = '42501';
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'A review cannot be reassigned to another user.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_guard_moderation_trg on public.reviews;
create trigger reviews_guard_moderation_trg
  before update on public.reviews
  for each row
  execute function public.reviews_guard_moderation();

-- ── 4. Grants ───────────────────────────────────────────────────────────────
--  The table itself is governed by RLS, so `authenticated` needs the ordinary
--  table grants; `anon` needs SELECT only, so a visitor can read the reviews
--  on the public site before signing in.
revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;

--  The guard function is a trigger, never called directly. Revoke EXECUTE from
--  both roles so it cannot be invoked over RPC. (See rule 7 in MEMORY.md:
--  EXECUTE is a UNION of PUBLIC + direct role grants — revoke from BOTH.)
revoke all on function public.reviews_guard_moderation() from public;
revoke all on function public.reviews_guard_moderation() from anon, authenticated;
revoke all on function public.reviews_derive_verified() from public;
revoke all on function public.reviews_derive_verified() from anon, authenticated;

-- ── 5. Report ───────────────────────────────────────────────────────────────
--  The single row you should read. PASS means the table, the four policies,
--  the trigger and the grants are all in place.
select
  case
    when (select count(*) from pg_policies
           where schemaname = 'public' and tablename = 'reviews') = 4
     and (select count(*) from pg_trigger
           where tgname in ('reviews_guard_moderation_trg', 'reviews_derive_verified_trg')) = 2
     and (select relrowsecurity from pg_class where oid = 'public.reviews'::regclass)
    then 'PASS'
    else 'FAIL'
  end as verdict;

commit;
