-- One horoscope per sign per period. Without this, two Webstrology loads racing
-- each inserted a copy, and from then on every lookup (.single()) failed on the
-- duplicates and generated yet another: 7 copies for The Explorer's week of
-- 2026-11-08, 29 for The Dream's week of 2026-08-16. No shares reference
-- horoscope rows (checked 2026-11-12), so the extra copies can be deleted.

-- Keep the earliest copy of each (sign, period, period_start).
delete from public.horoscopes h
using public.horoscopes keep
where h.zodaic_sign_id = keep.zodaic_sign_id
  and h.period = keep.period
  and h.period_start = keep.period_start
  and (keep.generated_at, keep.id) < (h.generated_at, h.id);

create unique index horoscopes_sign_period_start_idx
  on public.horoscopes (zodaic_sign_id, period, period_start);
