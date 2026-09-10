-- 每個樓盤草稿維持自己嘅有序展示相列表。
-- 結構（JSON 陣列）：
--   { "kind": "telegram", "fileId": "<tg file_id>" }  真實場地/IG 相
--   { "kind": "stock", "src": "/stock/<type>.svg" }   按場地類型配嘅通用代表相
-- 純文字截圖（OCR 用）唔入呢個列表。
-- additive：舊草稿 photos 為空陣列，讀取時向後相容 fallback 用場地類型 stock 相。

alter table venue_drafts
  add column if not exists photos jsonb not null default '[]'::jsonb;

comment on column venue_drafts.photos is
  'Ordered public photos for this listing: [{kind:"telegram",fileId} | {kind:"stock",src}]. Text screenshots excluded.';
