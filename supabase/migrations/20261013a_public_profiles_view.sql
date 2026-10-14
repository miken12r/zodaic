-- Profiles privacy + required fields, step 1 of 2 (safe for old app builds).
--
-- Adds public_profiles, which exposes only public fields of completed profiles;
-- app builds from #17 read other users' profiles through it. Step 2
-- (20261013b_close_profiles_policy.sql) drops the policy that leaked every
-- column, including birth_date.

-- Public fields only, and only for completed profiles (username, display name,
-- and birth date are required by the app's setup step) — so half-made accounts
-- never appear in People. Owned by the migration role, so it reads past RLS on
-- profiles (once step 2 leaves only the own-row policy); that's intended, and
-- why its columns are limited.
create view public.public_profiles as
  select id, username, display_name, primary_zodaic_sign_id, created_at
  from public.profiles
  where username is not null
    and display_name is not null
    and birth_date is not null;

-- Signed-in users may read it; nobody may write through it (a single-table view
-- is otherwise auto-updatable, which would bypass RLS on profiles).
revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to authenticated;

-- Usernames are unique regardless of case ("Mike" vs "mike").
create unique index profiles_username_lower_key on public.profiles (lower(username));
