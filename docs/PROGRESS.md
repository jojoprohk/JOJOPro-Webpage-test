# jojopro 開發進度（單一交接文件）

最後更新：2026-09-04（晚）
狀態：Stage 1 — 收料 pipeline、審核頁（slice 3）、公開 listing 頁（slice 4）、
18 區自動歸類＋審核頁相／內容自由編輯（slice 6）已完成（待跑一條 migration）；
公開頁視覺打磨（ambient WebGL 背景＋全站圓角＋stock 相片系統＋展銷位新類型）已落地；
IG／FB 草稿生成（slice 5）未做

> 呢份文件係任何新對話／新 agent 接手時**第一份要讀**嘅檔。
> 配套規格：`docs/specs/2026-08-23-jojopro-ai-ops-mvp-design.md`、結構規範 `docs/PROJECT_STRUCTURE.md`、長遠方向 `docs/vision/long-term-vision.md`。

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

測試目前：94 個全綠（packages/ai 25、apps/web 69）。

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

10. **18 區自動歸類＋審核頁自由編輯（slice 6，2026-09-04 完成）**
    - **地區**：`packages/ai/src/districts.ts` 提供 18 區標準清單＋地標／口語名推理
      （`inferDistrict`／`normalizeDistrict`）。AI prompt 要求 `district` 必須係 18 區標準名；
      parser／roster 統一：LLM/規則出自由文字（「葵涌」「旺角」）會自動正規化做標準區名
      （「葵青區」「油尖旺區」），由場名／標題地標再兜底；推理唔到就 null 並標 low-confidence，
      審核頁地區欄高亮。柴灣→東區、九龍灣→觀塘區等已知錯位已修正。
    - **審核頁地區欄**：由自由輸入改做 18 區下拉（可留空＝未分區）。
    - **每樓盤展示相**：`venue_drafts` 加 `photos jsonb`（見 migration 202609040001）。
      元素 `{kind:"telegram",fileId}`（真實場地／IG 相）或 `{kind:"stock",src}`（類型代表相）。
      AI 用 `realVenuePhotoIndexes` 標記邊幾張附圖係真實場地相（純文字海報截圖只 OCR、唔展示）；
      冇真實相就按 `areaType` 自動配本地代表相（`apps/web/public/stock/*.svg`，7 張向量插畫，免版權）。
      舊草稿 `photos` 為空時讀取自動 fallback 代表相，向後相容。
    - **審核頁相編輯**：可逐張刪除、左右調位、加入 Telegram 原始相、加入／換類型代表相；
      另加「儲存改動」掣（action `save`，只存唔改 status，唔使批准都可以先改）。
    - 公開／審核出相改由 `photo-service` 按 `draft.photos` 分流：telegram→Telegram 下載、
      stock→讀本地 `public/stock`。新 route：`/api/photos/draft/[id]/[index]`（審核，要登入）。
11. **公開頁視覺打磨（slice 7，2026-09-04 晚）**
    - 桃紅／淺粉紅 ambient WebGL 背景（`apps/web/src/app/components/site-background.tsx`）
      - 兩層 fbm 雲各自 drift；速度 ×0.32 慢漂；零依賴
      - `prefers-reduced-motion` 單格靜態；visibility hidden 時暫停
      - 喺 `layout.tsx` fixed 喺 body 底，`.page-content` z-index 1
    - 全站統一圓角尺度（CSS 變數喺 `:root`）：`--radius-sm: 8px` / `--radius: 12px` / `--radius-lg: 16px` / `--radius-pill: 999px`
      - 場地卡同精選相簿改用獨立圓角框 + gap（原本共用邊框會出黑角）
      - 按鈕、輸入框、篩選、提示框、審核卡、登入卡、tabs、彈窗、badge pill 全圓
      - 場地卡 hover 浮起＋淡陰影
    - Stock 相片系統（`packages/ai/src/stock-photos.ts` + `apps/web/public/stock/*.jpg`）
      - 8 張 `.jpg`、1200×1200、150-230KB；之前嘅 7 個 `.svg` 已退役
      - 審核頁「代表相」同公開 fallback 共用同一張
    - 新增 `exhibition`（展銷位）areaType
      - AI prompt、listing-filter 白名單、llm-venue-completer、stock-photos 表、
        公開篩選下拉、featured-item 標籤、listing-card 標籤、審核 AREA_TYPES+AREA_LABELS、
        草稿 STOCK_FILE 全部加咗


---

## 6. 啟用步驟（Mercy 一次性做）

1. **跑 migration**：喺 Supabase SQL Editor 逐條 run
   - `supabase/migrations/202609010001_drop_intake_unique.sql`（拆多場地唔再撞唯一約束）
   - `supabase/migrations/202609010002_review_rls.sql`（開 RLS）
   - `supabase/migrations/202609020001_add_report_count.sql`（slice 4 回報計數＋RPC）
   - `supabase/migrations/202609040001_add_draft_photos.sql`（slice 6：每個樓盤自己嘅展示相列表 `photos jsonb`；additive，唔影響舊資料）
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
- 公開頁視覺（背景動畫、圖片）屬於品味決定，唔可以擅自換色／加無關裝飾；改前先同 Mercy 確認方向。

---

## 5. 對話／交接守則（防止 thread「爆死」）

- **長對話會因上下文爆 token 而永久死亡**（尤其貼過多圖／長文）。呢個係模型供應商限制，唔係項目問題。
- 預防：大檔用**檔案路徑**叫 agent 讀，唔好貼全文／反覆貼圖；一個階段完就開新 thread。
- 補救：開新對話 → 俾 repo 路徑 → 叫佢先讀 `docs/PROGRESS.md`、`docs/specs/`、`git log`。
- **每完成一塊就 git commit（只本地，唔 push）並更新本文件**，令進度唔依賴單一對話記憶。
- 對話偏長時，agent 要主動提 Mercy 開新 thread 交接。

---

## 7. 開新 thread 交接 checklist

1. 讀 `docs/PROGRESS.md`、`docs/PROJECT_STRUCTURE.md`、`git log --oneline -20`。
2. 確認本地 dev server `http://localhost:3000/` 行緊（`lsof -nP -iTCP:3000 -sTCP:LISTEN`）；
   唔係就喺 `apps/web` 跑 `npm run dev`，第一個用 3000 port，第二個會跳 3001。
3. `.env.local` 入面有 `REVIEW_SECRET`、`TELEGRAM_BOT_TOKEN`、`TELEGRAM_ALLOWED_CHAT_IDS`；
   **唔可以打印入面任何 token**。
4. stock 相目錄：`apps/web/public/stock/`；新類型圖放 `/stock/<key>.jpg`（`key` = `STOCK_FILE` 嘅 value）。
5. 測試：`npm run typecheck` + `npm test`，期望 94 個全綠。
6. 自動化跑腳本如要 escalated，**唔好加 prefix_rule**（審核器 bug，會卡住）。


## 12. Phase 4 設計打磨（2026-09-04，已取消中秋 seasonal 部署）

文件先行，spec 喺 `docs/specs/2026-09-04-design-phase-4-typography-and-mid-autumn.md`。

- **Typography** — 源柔ゴシック（next/font/local，3 個 .woff2）做主字體，
  Noto Sans TC（next/font/google）做繁中 fallback；typography scale 由 ad-hoc
  font-size 改成 `:root` 嘅 `--text-xs` ... `--text-display` CSS 變數。
- **Mid-Autumn Mood** — 兩隻 inline SVG 元素（飄浮兔仔燈籠 + 望月白兔），
  `MID_AUTUMN_2026` flag 控制 2026-09-04 至 2026-09-27 HK time 開窗；
  過咗 9/27 自動 unmount。位置 fixed 右上／右下，layer 喺 SiteBackground 之上、
  page-content 之下，pointer-events: none。prefers-reduced-motion 自動關動畫。
- **檔案結構**：
  - `apps/web/src/lib/seasonal.ts`（feature flag + 日期判定）
  - `apps/web/src/app/components/seasonal-decorations.tsx`（容器）
  - `apps/web/src/app/components/floating-rabbit-lantern.tsx`
  - `apps/web/src/app/components/moon-gazing-rabbit.tsx`
  - `apps/web/src/app/fonts/*.woff2`（字體）
  - `apps/web/tests/seasonal.test.ts`（日期視窗 unit test）
- **唔做**：新 route、新 npm 依賴、改 SiteBackground、listing DTO、review page 視覺。

> 2026-09-07 取消：中秋 mood 嘅 SVG / PNG / lib / CSS / test 全部移除。Typography（Noto Sans JP + Noto Sans TC fallback + scale vars + preload: false）保留，屬於永久字體決定。Spec doc `docs/specs/2026-09-04-design-phase-4-typography-and-mid-autumn.md`保留作為歷史記錄（唔再 active deploy）。

---

## 更新：2026-09-09 — Link REIT filter 完整 fix

最後更新：2026-09-09（凌晨）
狀態：**Link REIT filter 由「完全冇效」變成「server-side 正常運作」**。

### 根因（第一性原理）

`matchesFilters()` 喺 `apps/web/src/lib/listing-filter.ts` 雖然有收到 `filters.linkReit`（UI + parseFilters 都 OK），但**漏寫咗實際嘅 boolean check**：

```ts
// 之前：filter 喺 URL 收到 linkReit=1，但 matchesFilters 完全冇用呢個值
// 之後（加咗呢段）：
if (filters.linkReit && listing.isLinkReit !== true) {
  return false;
}
```

之前所有「search 領展 出現非領展場地」嘅症狀都係因為呢度。
Dev server 嘅 stale compiled output 係次要問題（已 .next cache 清過），唔係 root cause。

### 修正內容

1. **Code fix** — `apps/web/src/lib/listing-filter.ts`：
   - `matchesFilters()` 加 `filters.linkReit && listing.isLinkReit !== true` check
2. **Test 新增 3 條** — `apps/web/tests/listing-filter.test.ts`：
   - 只睇領展：isLinkReit=false → 排除
   - 只睇領展：isLinkReit=true → 保留
   - 唔剔 linkReit：所有場地都保留
   - 加埋 `parseFilters` 嘅 linkReit 解析測試
3. **Data fix** — Supabase REST PATCH：
   - 12 個 venue 名（共 15 條 entry）由 `is_link_reit=false` 改為 `true`：
     - 樂富B、樂富B
     - 太和、太和廣場
     - 蝴蝶、蝴蝶C、蝴蝶廣場
     - 安蔭商場
     - 新翠商場
     - 富東 A、富東 B
     - 顯徑 A
     - 鯉魚門 C1、鯉魚門 C2、鯉魚門廣場
   - 全屬 Link REIT HOS portfolio（公屋範圍內嘅領展商場）
4. **驗證結果**：
   - 122/122 tests pass（+4 新 linkReit test）
   - TypeScript clean
   - Dev server (`?linkReit=1`)：
     - 之前：154 cards（filter 冇效）
     - 而家：97 cards（全部係 Link REIT HOS）
   - 反向驗證：`大本型`、`美孚`、`利東街`、`紅磡廣場` 剔咗 linkReit 後**完全唔顯示** ✅

### DB counts（修補後）
- is_link_reit=true：**98 條**（之前 83）
- is_link_reit=false：**62 條**（之前 77）

### 預防措施
- linkReit filter 邏輯已有 4 條 unit test 覆蓋（filter 行為 + URL parsing）
- DB tagging 仍係人手 review；下次再發現唔啱可以 update 同一條 PATCH script


---

## 13. Reload 重置首頁篩選（2026-09-09）

文件：`docs/decisions/2026-09-09-filters-reset-on-reload.md`。

- 首頁篩選視為臨時查詢狀態；用戶在帶 query 嘅首頁按 Reload（F5 / Cmd+R）時，client 會用 Navigation Timing 偵測 `reload`，再 `window.location.replace("/")` 回到完整列表。
- 初次打開／分享連結（`navigate`）、上一頁／下一頁（`back_forward`）、無 query 首頁均不會重置。
- 免責條款同意狀態同回報防重複記錄仍保留喺 localStorage，今次唔清。
- 新增 pure helper `apps/web/src/lib/filter-reload.ts` 及 5 個 unit test；apps/web 測試總數 127 全綠。
