# jojopro Slice 3：審核 Queue（Mercy 批准／修改／拒絕草稿）

日期：2026-09-01
狀態：已完成（待 Mercy 跑 2 條 migration 同設 REVIEW_SECRET，見 PROGRESS.md 第 6 節）
前置：Slice 1（AI parser）、Slice 2（Telegram 收料）已完成並全綠

## 1. 目標

令 `needs_review` 狀態嘅場地草稿，可以由 Mercy 喺一個簡單網頁：

- 睇到 AI 抽咗咩欄位、邊啲係低信心；
- 批准（轉 `approved`）、拒絕（轉 `rejected`）、或修改後批准；
- 批准／拒絕時記低 `last_reviewed_at`。

呢個係單人內部工具，唔係公開產品。原則：**最細、最快、夠用**，唔整華麗 dashboard。

## 2. 呢個 slice 唔做

- 唔做公開 listing 頁（slice 4）。
- 唔做 IG／FB 草稿生成（slice 5）。
- 唔做批量操作、排序篩選花款、版本歷史、審核活動 log。
- 唔做多人帳號、角色權限、邀請。
- 唔做自動發布；批准只係改 status。
- 唔喺瀏覽器暴露 service role key。

## 3. 先要修嘅 bug

`venue_drafts.intake_item_id` 而家係 `unique`。但一則貼文可拆多個場地
（roster / multi-venue），一個 intake 會插多過一行草稿，會觸發唯一約束衝突。

新 migration `202609010001_drop_intake_unique.sql`：

- 刪除自動產生嘅唯一 index `venue_drafts_intake_item_id_key`；
- 保留 foreign key（一個 draft 仍必須屬於一個 intake）；
- 改建普通 index `idx_venue_drafts_intake_item` on `intake_item_id`。

## 4. 存取把關（單人最細方案）

- 用一個 shared review secret，放 `REVIEW_SECRET`（server 環境變數）。
- 審核頁 `/review`：client 提示輸入密碼；密碼只經 HTTPS POST 去 server route，
  server 用 `timingSafeEqual` 比對（同 Telegram webhook secret 一樣做法）。
- 驗證成功後，server route 發一個**httpOnly + Secure + SameSite=Lax 嘅 signed
  session cookie**（HMAC 簽名，secret 用 `REVIEW_SECRET`，內含過期時間）。
- 所有審核 API route 驗 cookie 簽名同過期；唔通過一律 401。
- Server 端照用 service role client 寫庫；瀏覽器永遠唔會見到 service role key。

唔用 Supabase Auth（單人唔使開通整套 auth），但 RLS 都要做：

新 migration `202609010002_review_rls.sql`：

- `enable row level security` 兩個表；
- 預設**冇任何 anon policy**（即 anon key 咩都讀唔到寫唔到）；
- 公開只讀會喺 slice 4 先用 service role 於 server route 發布，唔靠 anon policy；
- 審核寫入全部經 service role server route，繞過 RLS（service role 本來就 bypass）。

即係：開 RLS 係防呆（防止日後誤把 anon key 放上公開頁），而家所有存取都喺 server。

## 5. 檔案結構

```text
apps/web/src/
  app/
    review/
      page.tsx                 # 審核 queue 頁（client component）
    api/
      review/
        session/route.ts       # POST 驗密碼 -> set cookie；DELETE 登出
        drafts/route.ts        # GET 列出 needs_review 草稿（要 cookie）
        drafts/[id]/route.ts   # PATCH 批准/拒絕/更新欄位（要 cookie）
  lib/
    review-auth.ts             # cookie 簽名/驗證、timing-safe 比對
    review-repository.ts       # listDrafts / updateDraft / setReviewStatus
supabase/migrations/
  202609010001_drop_intake_unique.sql
  202609010002_review_rls.sql
apps/web/tests/
  review-auth.test.ts
  review-repository.test.ts
```

## 6. API 行為

- `GET /api/review/drafts?status=needs_review`
  - 回傳草稿列表（連同 source_label、received_at、raw_content 摘要、相 file ids）；
  - 最新排前面；低信心欄位一併回傳，等 UI 高亮。
- `PATCH /api/review/drafts/[id]`
  - body：`{ action: "approve" | "reject", fields?: { ...可改欄位 } }`；
  - approve / reject 都寫 `status` 同 `last_reviewed_at = now()`；
  - 有 `fields` 就先更新欄位再轉狀態；
  - reject 可附 `review_note`。
  - server 用欄位白名单驗證，唔接受任意欄位寫入。

## 7. UI 要點（review/page.tsx）

- 未登入：一個密碼輸入框。
- 已登入：列出 needs_review 草稿卡，每張顯示：
  - 標題、地區、場地名、日期（連 session_dates）、價錢、尺寸、聯絡、限制 flags；
  - **低信心／待確認欄位用黃色標示**；
  - 原始貼文 raw_content 可展開對照；
  - 相：用 Telegram file_id 經 server route 代理顯示（唔暴露 bot token）。
- 每張卡三個掣：批准、拒絕、（改欄位後）儲存。
- 操作後即從列表移除，並顯示成功／失敗。

## 8. 驗證

- `npm test`：新增 review-auth（簽名/驗證/過期/錯密碼）同 review-repository（list、
  approve、reject、欄位白名單）單元測試，用注入嘅假 supabase client，唔打真 API。
- `npm run typecheck` 全綠。
- 兩條 migration 要可喺 Supabase SQL Editor 直接 run（`if exists` / `if not exists`）。
- 手動 smoke：本地 `next dev`，用 `/review` 輸入密碼，對一筆假草稿做批准／拒絕，
  喺 Supabase 確認 status 同 last_reviewed_at 有更新。

## 9. 環境變數

`.env.example` 加：

```env
REVIEW_SECRET=
```

`REVIEW_SECRET` 用 `openssl rand -hex 32` 產生，只放 `.env.local`，唔入 git。

## 10. 完成定義

- 兩條 migration 可 run；
- `/review` 用密碼登入後可列出、修改、批准、拒絕草稿；
- 冇 cookie 或錯密碼時所有 review API 回 401；
- 測試同 typecheck 全綠；
- 一個 intake 多個草稿唔再撞唯一約束。
