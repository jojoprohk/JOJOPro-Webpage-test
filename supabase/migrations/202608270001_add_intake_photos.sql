-- 支援 Telegram 圖片訊息：記低圖片檔案 ID（Telegram file_id），
-- 方便日後重抓同審核。實際圖片唔會存入資料庫。

alter table intake_items
  add column if not exists photo_file_ids text[] not null default '{}';

comment on column intake_items.photo_file_ids is
  'Telegram photo file_id list (largest size last). Used to fetch images for vision parsing.';
