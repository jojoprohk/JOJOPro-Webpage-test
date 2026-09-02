-- Slice 4：公開 listing 頁「回報資料過期」功能。
-- 回報只係累積計數，等 Mercy 喺審核頁／Supabase 跟進，唔會自動下架。

alter table venue_drafts
  add column if not exists report_count integer not null default 0;

alter table venue_drafts
  add column if not exists last_reported_at timestamptz;

comment on column venue_drafts.report_count is
  '公開頁「回報資料過期」次數。只供 Mercy 參考，唔自動觸發下架。';

comment on column venue_drafts.last_reported_at is
  '最近一次被公開頁回報過期嘅時間（UTC）。';

-- 原子遞增回報計數。只對已批准（公開中）嘅 listing 生效，
-- 搵唔到（唔存在 / 非 approved）會靜默回傳 null，唔報錯。
create or replace function increment_report_count(
  listing_id uuid,
  reported_at timestamptz
)
returns uuid
language plpgsql
as $$
declare
  updated_id uuid;
begin
  update venue_drafts
    set report_count = report_count + 1,
        last_reported_at = reported_at
    where id = listing_id
      and status = 'approved'
    returning id into updated_id;
  return updated_id;
end;
$$;
