-- Pre-launch safety bounds (P1-C + P1-D).
--
-- P1-D: cap session_dates length per draft. LLMs occasionally hallucinate
--   long date lists; without a CHECK constraint one bad response can
--   inflate a row to hundreds of KB. 60 entries = ~2 years of daily
--   dates, which is well above any legitimate popup event.
--
-- P1-C: keep is_featured=true rows to the newest 5 (by featured_at DESC).
--   The review-page UI prevents this from happening, but admin can also
--   hand-edit rows in Supabase Studio. This function is exposed so the
--   review PATCH handler can call it via RPC, and an idempotent sweep
--   pass can be run manually if data has drifted.

ALTER TABLE venue_drafts
  DROP CONSTRAINT IF EXISTS session_dates_max_len;
ALTER TABLE venue_drafts
  ADD CONSTRAINT session_dates_max_len
  CHECK (session_dates IS NULL OR array_length(session_dates, 1) <= 60);

-- Reusable sweep: keep only the 5 newest is_featured=true approved rows
-- as featured. Anything older gets demoted but keeps its featured_at
-- timestamp for audit (set to NULL only on explicit toggle).
create or replace function enforce_featured_window()
returns integer
language plpgsql
as $$
declare
  demoted integer;
begin
  with ranked as (
    select id,
      row_number() over (order by featured_at desc) as rn
    from venue_drafts
    where is_featured = true
      and status = 'approved'
      and featured_at is not null
  )
  update venue_drafts vd
    set is_featured = false
    from ranked
    where vd.id = ranked.id
      and ranked.rn > 5;
  get diagnostics demoted = row_count;
  return demoted;
end;
$$;

comment on function enforce_featured_window() is
  'Demotes is_featured=true approved drafts that fall outside the top 5 by featured_at DESC. Returns the number of rows demoted.';
