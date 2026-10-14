-- Profiles privacy, step 2 of 2.
--
-- "Profiles are publicly viewable" (select using (true), all roles) exposed every
-- profile column — including birth_date — to anyone holding the app's anon key.
-- With it gone, users read only their own row from profiles ("Users can view own
-- profile"), and everyone else's public fields via public_profiles (step 1).
--
-- Apply after testers are on build #17+: older builds read other users straight
-- from profiles, so their People list and share author names go blank.
drop policy "Profiles are publicly viewable" on public.profiles;
