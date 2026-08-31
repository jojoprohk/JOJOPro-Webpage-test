-- 支援斷續開檔日期（例如逢週末市集）：
-- session_dates 逐日列齊每一個開檔日子；start_date/end_date 只表示
-- 最早同最遲日期，用嚟排序同顯示「9月至10月」。
-- 連續租用/開放嘅場地 session_dates 留空，照用 start_date/end_date。

alter table venue_drafts
  add column if not exists session_dates date[] not null default '{}';

create index if not exists idx_venue_drafts_session_dates
  on venue_drafts using gin (session_dates);

comment on column venue_drafts.session_dates is
  '個別開檔/有檔日期清單（斷續檔期逐日列齊）。連續租用則留空，靠 start_date/end_date。';
