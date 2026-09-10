-- 每週精選手動控制欄位。
-- 由 review page 嘅 admin 設定；pickFeatured 會用呢兩欄排序，唔再用自動 tier score。
-- 設計：
--   is_featured = true  → 進入精選卡 pool；按 featured_at DESC 排序（最新先）
--   featured_at NULL    → 唔入精選（但保留 is_featured 狀態供日後重啟用）
-- 6 個以上同時 featured → 最舊（featured_at 最細）跌出 5 個 window

alter table venue_drafts
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_at timestamptz null;

comment on column venue_drafts.is_featured is
  'Admin toggle: 是否加入本週精選卡。true = 入 pool，false = 唔入。';
comment on column venue_drafts.featured_at is
  '最近一次設為 featured 嘅時間。NULL 表示從未 featured（被淘汰後亦會保留歷史）。';

-- 加速精選 query：篩 approved + featured，排序由新到舊。
create index if not exists venue_drafts_featured_idx
  on venue_drafts (featured_at desc)
  where is_featured = true and status = 'approved';
