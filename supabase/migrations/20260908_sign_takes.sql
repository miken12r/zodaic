-- ZodAIc Sign Takes — persona-voiced, lampoon-style headline+blurb per classified
-- article. One row per (content_item, sign). This sprint only ever writes the sign the
-- article is already classified as, but zodaic_sign_id is its own column (not just
-- inferred via content_items.zodaic_sign_id) so a later multi-voice "debate" sprint can
-- add rows for OTHER signs reacting to the same article without a breaking schema change.

create table public.sign_takes (
  id uuid default gen_random_uuid() primary key,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  zodaic_sign_id int not null references public.zodaic_signs(id),
  persona_version int not null default 1,
  headline text not null,
  blurb text not null,
  generation_source text not null default 'on_demand' check (generation_source in ('batch', 'on_demand')),
  model text,
  created_at timestamptz default now()
);

-- One take per article+sign for now (regeneration overwrites in place via upsert, same
-- cache-once pattern as content_items.lens_text — no history retention this sprint).
create unique index sign_takes_content_sign_idx on public.sign_takes (content_item_id, zodaic_sign_id);
create index sign_takes_created_idx on public.sign_takes (created_at desc);

alter table public.sign_takes enable row level security;
create policy "Anyone can read sign takes" on public.sign_takes for select using (true);
create policy "Service role can write sign takes" on public.sign_takes for insert with check (true);
