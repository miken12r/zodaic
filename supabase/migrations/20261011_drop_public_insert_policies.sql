-- The "Service role can ..." insert policies on sign_takes and content_items
-- were created without a role restriction, so `with check (true)` let ANY
-- client (anon key or signed-in user) insert rows — e.g. fake articles with
-- arbitrary links straight into the News feed. The service role bypasses RLS
-- entirely, so edge functions (the only writers) never needed these policies.
-- With them gone, RLS denies all client inserts; reads are unchanged.
drop policy "Service role can write sign takes" on public.sign_takes;
drop policy "Service role can insert content items" on public.content_items;
