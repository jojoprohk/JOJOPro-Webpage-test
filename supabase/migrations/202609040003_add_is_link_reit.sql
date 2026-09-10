-- 領展 (Link REIT) 場地標籤。
-- 由 admin / AI auto-detect 設定；前端可以 filter「只睇領展場地」。
-- 領展 = 原本 HOS 嘅商場，後來私有化上市嘅房委會前資產。
-- 客戶偏好領展原因：設施標準化、有冷氣／停車場、保安較好。

alter table venue_drafts
  add column if not exists is_link_reit boolean not null default false;

comment on column venue_drafts.is_link_reit is
  'Link REIT 領展場地標籤。true = 屬於領展旗下商場/屋邨商場（原本 HOS 出售畀領展嘅資產）。';

-- 加速 filter query
create index if not exists venue_drafts_link_reit_idx
  on venue_drafts (is_link_reit)
  where status = 'approved' and is_link_reit = true;
