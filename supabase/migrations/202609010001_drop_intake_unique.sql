-- 一則貼文可以拆出多個場地草稿（roster / multi-venue），
-- 所以 venue_drafts.intake_item_id 唔可以再係 unique。
-- 保留 foreign key（每個草稿仍必須屬於一個 intake），改做普通 index。

alter table venue_drafts
  drop constraint if exists venue_drafts_intake_item_id_key;

-- 上面 constraint 名喺某啲 Supabase 版本可能係自動 index 名，一併清走。
drop index if exists venue_drafts_intake_item_id_key;

create index if not exists idx_venue_drafts_intake_item
  on venue_drafts(intake_item_id);
