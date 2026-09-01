-- 開 Row Level Security 做防呆：anon key 預設乜都讀唔到寫唔到。
-- 審核同公開讀取全部經 server route 用 service role key（bypass RLS），
-- 所以呢度刻意唔加任何 anon policy。
-- 公開只讀 policy 會喺 slice 4（公開 listing 頁）一併設計。

alter table intake_items enable row level security;
alter table venue_drafts enable row level security;
