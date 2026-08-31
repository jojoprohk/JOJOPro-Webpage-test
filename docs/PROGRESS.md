# JoPoJo 開發進度（單一交接文件）

最後更新：2026-09-01
狀態：Stage 1 情報營運服務 — 後端收料 pipeline 已成型，審核／公開頁未做

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

測試目前：24 個全綠（packages/ai 15、apps/web 9）。

注意：本地 sandbox 若唔畀寫 `node_modules/.vite` 或 `*.tsbuildinfo`，
用 `vitest run --no-cache` 同 `tsc --noEmit --incremental false` 即可，唔影響結果。

環境設定見 `docs/operations/telegram-intake-setup.md`。真實 key 只放 `.env.local`（已 gitignore），**唔可以入 git**。

---

## 2. 已完成（對照 MVP spec 第 13 節實作順序）

1. **項目結構 + 資料庫 schema** — npm workspaces monorepo；`supabase/migrations/` 3 條：
   - `202608230001_create_intake_tables.sql`（intake_items + venue_drafts）
   - `202608270001_add_intake_photos.sql`（photo_file_ids）
   - `202608270002_add_session_dates.sql`（斷續檔期 session_dates）
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

---

## 3. 未做（下一步，按順序）

4. **最小審核 queue 頁** — Mercy 批准／修改／拒絕 `needs_review` 草稿；低信心欄位要標示。
   仲要加 Supabase RLS 同審核者身份（而家 schema 刻意未開 RLS）。
5. **公開 listing 頁** — 搜尋＋篩選（日期／預算／尺寸／食品／冷氣／急放）、listing 卡、
   WhatsApp 聯絡掣、「回報資料過期」。**唔做 marketing landing page，listing 頁就係產品。**
6. **IG／FB 帖文草稿生成** — 7 種草稿類型（見 spec 第 10 節），初期人手貼，唔好做全自動發布。

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
