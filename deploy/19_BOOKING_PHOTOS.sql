-- ============================================================================
--  19_BOOKING_PHOTOS.sql  —  Where a cleaner's before / progress / after
--                            photos actually live
-- ============================================================================
--  WHAT THIS DOES
--    Creates one PRIVATE storage bucket, `booking-photos`, plus the rules that
--    decide who may read and write it. The app already knows how to use it —
--    this is the missing half.
--
--  WHY PRIVATE, NOT PUBLIC
--    These are pictures inside somebody's home. A public bucket means anyone
--    holding the link can open them forever. A private bucket means the screen
--    asks for a short-lived link each time it draws the photo, and the database
--    checks who is asking first.
--
--  WHO CAN DO WHAT
--    · Read   — the customer on that booking, the cleaner assigned to it, admin
--    · Write  — the cleaner assigned to it, admin
--    · Delete — the cleaner assigned to it, admin
--
--  HOW THE RULES KNOW WHICH BOOKING
--    Every file is stored under a folder named after the booking:
--        LC-12345/before_1730000000_a1b2c3.jpg
--    The policy reads that first folder, finds the booking, and checks whether
--    the person asking is on it. There is no way to read a photo of a booking
--    you are not part of.
--
--  SAFE TO RE-RUN. Every statement is idempotent.
-- ============================================================================

begin;

-- ── 1. The bucket ───────────────────────────────────────────────────────────
--  file_size_limit is a backstop only: the app shrinks a photo to roughly
--  200 KB before sending it, so anything near this cap did not come from the app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'booking-photos',
  'booking-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- ── 2. Who may touch an object in it ────────────────────────────────────────
drop policy if exists "booking photos: read" on storage.objects;
create policy "booking photos: read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'booking-photos'
    and exists (
      select 1
      from public.bookings b
      where b.id = (storage.foldername(name))[1]
        and (
          b.customer_id = auth.uid()
          or b.cleaner_id = auth.uid()
          or public.current_user_role() = 'admin'
        )
    )
  );

drop policy if exists "booking photos: write" on storage.objects;
create policy "booking photos: write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'booking-photos'
    and exists (
      select 1
      from public.bookings b
      where b.id = (storage.foldername(name))[1]
        and (
          b.cleaner_id = auth.uid()
          or public.current_user_role() = 'admin'
        )
    )
  );

drop policy if exists "booking photos: delete" on storage.objects;
create policy "booking photos: delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'booking-photos'
    and exists (
      select 1
      from public.bookings b
      where b.id = (storage.foldername(name))[1]
        and (
          b.cleaner_id = auth.uid()
          or public.current_user_role() = 'admin'
        )
    )
  );

-- ── 3. Report ───────────────────────────────────────────────────────────────
--  The single row you should read. PASS means the bucket exists, it is private,
--  and all three rules are on it.
select
  case
    when exists (
           select 1 from storage.buckets
           where id = 'booking-photos' and public = false
         )
     and (select count(*) from pg_policies
           where schemaname = 'storage'
             and tablename = 'objects'
             and policyname in (
               'booking photos: read',
               'booking photos: write',
               'booking photos: delete'
             )) = 3
    then 'PASS'
    else 'FAIL'
  end as verdict;

commit;
