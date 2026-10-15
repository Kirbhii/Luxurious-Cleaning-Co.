-- Promote an existing account to admin.
-- Run in the Supabase SQL Editor AFTER creating the user from
-- Authentication -> Users -> Add user (auto-confirm ON).
--
-- Never INSERT into auth.users by hand: you also need the matching
-- auth.identities row, or signInWithPassword rejects the account.
-- Replace the email below first.

-- 1. Look before you write.
select id, email, role from public.profiles where email = 'REPLACE_ME@example.com';

-- 2. Promote.
update public.profiles
set role = 'admin',
    permissions = array['manage_users', 'approve_partners', 'manage_bookings']
where email = 'REPLACE_ME@example.com';

-- 3. The admin MFA policy row. handle_new_user() adds this only when the profile
--    is first created, so a promoted account would be missing it.
insert into public.admin_mfa_policy (profile_id, mfa_required)
select p.id, true
from public.profiles p
where p.email = 'REPLACE_ME@example.com'
on conflict (profile_id) do update set mfa_required = true;

-- 4. The one row to read. The editor shows the last result only.
select case
         when p.role = 'admin'
          and p.permissions @> array['manage_users', 'approve_partners', 'manage_bookings']
          and coalesce(m.mfa_required, false)
         then 'PASS'
         else 'FAIL'
       end as verdict
from public.profiles p
left join public.admin_mfa_policy m on m.profile_id = p.id
where p.email = 'REPLACE_ME@example.com';
