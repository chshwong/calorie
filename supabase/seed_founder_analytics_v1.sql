-- Founder analytics seed setup
-- Run manually after migration in each environment.

-- 1) Add founder admins (allowlist)
insert into public.founder_admins (user_id)
values
  ('f0e891f3-a79f-47f4-a8b7-9aeff4c8e06a')
on conflict (user_id) do nothing;

-- Optional: additional founders
-- insert into public.founder_admins (user_id) values ('<ANOTHER_UUID>') on conflict (user_id) do nothing;

-- 2) Ensure founder settings singleton row exists
insert into public.founder_settings (id, digest_time_local, updated_at)
values (1, '07:00', now())
on conflict (id) do update
set digest_time_local = excluded.digest_time_local,
    updated_at = now();
