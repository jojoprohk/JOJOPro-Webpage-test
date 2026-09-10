-- Extend venue_drafts.area_type CHECK constraint to accept `exhibition`.
-- Stage 1 launch stabilization：AI / filters / review UI 已 expose 呢個 area_type，
-- 但 base migration 嘅 CHECK 漏咗。一旦寫入 `exhibition` 就會違反 constraint。
--
-- 安全做法：先 drop 舊 constraint，再加返一個擴充版；唔改歷史 migration。
-- 任何時候都唔可以將「drop + add」喺同一個 statement 入面（會短暫 break RLS）。
-- 用 transaction 包住，Supabase SQL editor 跑應該即時生效。

begin;

alter table venue_drafts
  drop constraint if exists venue_drafts_area_type_check;

alter table venue_drafts
  add constraint venue_drafts_area_type_check
  check (
    area_type in (
      'mall',
      'market',
      'street',
      'industrial',
      'pop_up_event',
      'private_venue',
      'other',
      'exhibition',
      'unknown'
    )
  );

commit;
