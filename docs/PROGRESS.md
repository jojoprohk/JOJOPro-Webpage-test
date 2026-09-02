# JoPoJo 開發進度（單一交接文件）

最後更新：2026-09-02
狀態：Stage 1 — 收料 pipeline、審核頁（slice 3）同公開 listing 頁（slice 4）已完成；
IG／FB 草稿生成（slice 5）未做

> 呢份文件係任何新對話／新 agent 接手時**第一份要讀**嘅檔。
> 配套規格：`docs/specs/2026-08-23-jopojo-ai-ops-mvp-design.md`、結構規範 `docs/PROJECT_STRUCTURE.md`、長遠方向 `docs/vision/long-term-vision.md`。

---

## 1. 點跑／點驗證

喺 repo root `/Users/mercy/Documents/ChatGPT/New project`：

```bash
# 跑全部測試（packages/ai + apps/web）
npm test

# 型別檢查
npm run typecheck

# 打包實際收料伺服器（輸出 server/dist/telegram-webhook.cjs）
node server/build.mjs
```

測試目前：78 個全綠（packages/ai 15、apps/web 63）。

注意：本地 sandbox 若唔畀寫 `node_modules/.vite` 或 `*.tsbuildinfo`，
用 `vitest run --no-cache` 同 `tsc --noEmit --incremental false` 即可，唔影響結果。

dev server 注意：Next.js 16 預設 Turbopack 同本專案 webpack alias 唔相容，
`npm run dev` 已固定用 `next dev --webpack`。圖片代理同 Telegram 收料共用
`TELEGRAM_BOT_TOKEN`；審核頁登入要 `REVIEW_SECRET`（`.env.local`，2026-09-02 已補設）。

環境設定見 `docs/operations/telegram-intake-setup.md`。真實 key 只放 `.env.local`（已 gitignore），**唔可以入 git**。

---

## 2. 已完成（對照 MVP spec 第 13 節實作順序）

1. **項目結構 + 資料庫 schema** — npm workspaces monorepo；`supabase/migrations/`：
   - `202608230001_create_intake_tables.sql`（intake_items + venue_drafts）
   - `202608270001_add_intake_photos.sql`（photo_file_ids）
   - `202608270002_add_session_dates.sql`（斷續檔期 session_dates）
   - `202609010001_drop_intake_unique.sql`、`202609010002_review_rls.sql`（slice 3）
   - `202609020001_add_report_count.sql`（slice 4：回報計數＋`increment_report_count` RPC）
2. **Telegram 收料 webhook** — `apps/web/src/app/api/intake/telegram/route.ts`
   - secret-token header 驗證、chat 白名單（`TELEGRAM_ALLOWED_CHAT_IDS`）
   - 文字 + caption + 圖片；無內容訊息 ignored 唔入庫
3. **AI parser** — `packages/ai/src/`
   - 結構化欄位 + 信心分數 + low/unconfirmed fields；非場地貼文 rejected
   - `roster.ts`：「樂妹式」一行一場清單用規則拆解（比靠 LLM 列舉穩定）
   - 一則貼文可拆多個場地（multi-venue entries）
   - 斷續檔期用 session_dates，自動推導 start/end
   - 圖片 vision OCR（`telegram-photo.ts` 下載相 → base64 → LLM）
4. **獨立收料伺服器** — `server/telegram-webhook.ts` + `server/venue-batch.ts`
   - 唔使 Next.js 都可跑；esbuild bundle 成 cjs
   - **批次合併**：90 秒安靜窗口內嘅相＋文合成一個 intake 先解析
   - 解析後直接 Telegram 回覆列表，等 Mercy 快速核對
   - OpenAI-compatible LLM（可 Groq 可其他 provider）
5. **審核 queue 頁（slice 3）** — `/review`
   - 單一密碼登入（`REVIEW_SECRET`）+ httpOnly 簽名 cookie（`review-auth.ts`）
   - 列出 `needs_review` 草稿，低信心欄位黃色高亮，可改欄位後批准／拒絕
   - API：`/api/review/session`、`/api/review/drafts`、`/api/review/drafts/[id]`
   - 寫入全部經 server service role，欄位白名單防任意寫入；開咗 RLS 防呆
   - **要 Mercy 做兩步先用到**（見第 6 節）
6. **公開 listing 頁（slice 4）** — `/`
   - 審核頁一批准（`status = approved`）即公開，唔使二次發布
   - 搜尋（地區／場地／關鍵字）＋篩選：邊日有檔、最高預算、可賣食品、冷氣、急放／特價
   - **過期場地預設隱藏**（連續檔睇 `end_date`、斷續檔睇 `session_dates`，香港時區今日為準）
   - listing 卡：日期、地區、場地、價錢原文、尺寸（註明「實際尺寸請向負責人確認」）、
     限制 badges、來源、最後更新時間；WhatsApp／聯絡掣
   - 「回報資料過期」：`POST /api/listings/[id]/report`，原子遞增 `report_count`
     （SQL RPC `increment_report_count`），唔自動下架；client localStorage 防重複點
   - 公開 DTO 走白名單，**唔回傳** raw_content／信心分數／低信心欄位／review_note
   - server component 直接用 service role 讀庫，篩選用原生 GET form（無 JS 都用到）
   - 純函數 `lib/listing-filter.ts`：篩選／排序／日期判定／WhatsApp link 正規化
7. **審核批量操作＋批准狀態＋圖片（slice 4.1）**
   - 審核頁分「待審核／已批准」兩個分頁；批准後卡頂顯示綠色「已批准，已發布」、
     拒絕顯示紅色，短暫顯示後移除；「已批准」分頁列出已上線場地
   - 批量：每卡 checkbox＋全選，底部操作列「批量批准／批量拒絕」（逐張 PATCH 現有 API）
   - 圖片：兩個 server 代理 route，**bot token 同 file_id 唔落瀏覽器**
     - 公開 `/api/photos/listing/[id]/[index]`：只 approved draft 先有相
     - 審核 `/api/photos/intake/[intakeId]/[index]`：要 review cookie
     - 重用 `telegram-photo.ts` 抽出嘅 `downloadTelegramPhoto()`
   - 審核卡顯示縮圖（可點大圖）；公開 listing 卡第一張做封面＋其餘縮圖列
   - 公開 DTO 只加 `photoCount`（安全），唔回傳 intake id／file_id；**唔使 migration**

---

## 3. 未做（下一步，按順序）

8. **IG／FB 帖文草稿生成（slice 5，下一步）** — 7 種草稿類型（見 spec 第 10 節），
   初期人手貼，唔好做全自動發布。
9. Instagram 連結處理打磨（photo OCR 同公開顯示相已做底）。

---

## 6. 啟用步驟（Mercy 一次性做）

1. **跑 migration**：喺 Supabase SQL Editor 逐條 run
   - `supabase/migrations/202609010001_drop_intake_unique.sql`（拆多場地唔再撞唯一約束）
   - `supabase/migrations/202609010002_review_rls.sql`（開 RLS）
   - `supabase/migrations/202609020001_add_report_count.sql`（slice 4 回報計數＋RPC）
2. **設密碼**：`openssl rand -hex 32` 產生一串，放入 `apps/web/.env.local`：
   `REVIEW_SECRET=<你產生嘅密碼>`（呢串就係登入密碼，可另改易記嘅，但唔好入 git）。
3. **開網站**：`apps/web` 跑 `npm run dev`，瀏覽器開 `http://localhost:3000/review`，
   輸入密碼就見到待審核草稿。

注意：審核頁暫時**唔會顯示相**（要另做一個用 bot token 代理相嘅 route），文字欄位齊全。

圖片處理、IG 連結處理已基本有底（photo OCR 已做），可喺第 5 步一併打磨。

---

## 4. 鐵律（唔可以違反）

- 一人公司、現金成本最低；唔碰錢、唔碰合約、唔做擔保／Verified Badge、唔做站內 chat。
- 原始訊息、電話、API key、token、個人資料**唔入 git**；公開 listing 必須有來源同最後更新時間。
- AI 唔可以靜默猜測；唔肯定就入 low-confidence，等 Mercy 審。
- 改流程規則前，先改文件再改代碼。

---

## 5. 對話／交接守則（防止 thread「爆死」）

- **長對話會因上下文爆 token 而永久死亡**（尤其貼過多圖／長文）。呢個係模型供應商限制，唔係項目問題。
- 預防：大檔用**檔案路徑**叫 agent 讀，唔好貼全文／反覆貼圖；一個階段完就開新 thread。
- 補救：開新對話 → 俾 repo 路徑 → 叫佢先讀 `docs/PROGRESS.md`、`docs/specs/`、`git log`。
- **每完成一塊就 git commit（只本地，唔 push）並更新本文件**，令進度唔依賴單一對話記憶。
- 對話偏長時，agent 要主動提 Mercy 開新 thread 交接。
