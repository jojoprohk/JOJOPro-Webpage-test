# jojopro Slice 4：公開 Listing 頁（搜尋＋篩選＋聯絡＋回報過期）

日期：2026-09-02
狀態：已完成（待 Mercy 跑 migration `202609020001_add_report_count.sql`，見 PROGRESS.md 第 6 節）
前置：Slice 1（AI parser）、Slice 2（Telegram 收料）、Slice 3（審核 queue）已完成

## 1. 目標

令 Mercy 喺審核頁批准（`status = 'approved'`）嘅場地草稿，即時喺公開網站首頁 `/`
變成可搜尋、可篩選、可聯絡嘅 listing。

**首頁就係產品**，唔做 marketing landing page。原則同 slice 3 一樣：最細、夠用、可測試。

公開頁要做到 spec 第 9 節：

- 地區／場地搜尋；
- 篩選：日期、最高預算、可賣食品、冷氣、急放／特價；
- listing 卡：日期、地區、場地、價錢、尺寸、限制、來源、最後更新時間；
- 用原始聯絡資料嘅 WhatsApp／聯絡掣；
- 「回報資料過期」功能。

## 2. 呢個 slice 唔做

- 唔做獨立「發布」步驟或發布後台：審核頁一批准（`approved`）就即係公開。
  `published` 狀態保留唔用，唔加多個掣。
- 唔做 booth 尺寸／粒數篩選：尺寸每場不同、規格唔統一，篩選會誤導。
  `booth_size_text` 只喺卡上顯示作參考，並提示「請向負責人確認實際尺寸同位置」。
- 唔顯示相（Telegram 圖片代理 route 留返 slice 7 圖片處理一併做）。
- 唔做分頁、排序花款、map 視圖、站內 chat、收藏／alert 登記。
- 唔做自動下架、report 後台頁；回報只係 increment 計數，等 Mercy 喺審核頁／Supabase 跟進。
- 唔開 anon RLS policy：公開讀取同 slice 3 一樣，全部經 server route／server component
  用 service role key（bypass RLS）。RLS 維持防呆。

## 3. 發布模型

- 公開頁資料來源：`venue_drafts` 入面 `status = 'approved'` 嘅行。
- 批准即公開，唔設二次發布。`rejected` / `needs_review` 唔會出現。

## 4. 過期處理（預設隱藏）

- 預設只顯示**未來／進行中**嘅場地；完全過期嘅自動隱藏（唔刪除，仲喺庫內）。
- 判定（全部以香港時區今日為準，純函數可注入 `today`）：
  - 連續檔（有 `end_date`）：`end_date < today` 算過期。
  - 斷續檔（有 `session_dates`）：所有日期都 `< today` 算過期。
  - 完全冇日期資料：唔當過期，照顯示（日期缺失係資料問題，唔好靜默隱藏）。
- 當瀏覽者揀咗特定日期 `date`：只顯示「當日有檔」嘅 listing
  （連續：`start <= date <= end`；斷續：`session_dates` 含 `date`），
  呢個情況下唔再另外套用「隱藏過期」（揀過去日期就自然冇結果）。

## 5. 篩選語意（純函數，全部可單元測試）

URL search params（GET form，可分享連結、無 JS 都用到）：

- `q`：搜尋文字，不分大小寫，比對 `title` / `district` / `venue_name` / `summary`。
- `date`（YYYY-MM-DD）：當日有檔（見第 4 節）。
- `maxBudget`（整數 HKD）：`price_amount_hkd <= maxBudget` 先顯示；
  `price_amount_hkd` 為 null（解析唔到價）而設咗預算時排除；`price_text` 原文照顯示。
- `food`（=1/on/true）：`allows_food === true`（null 未知唔計）。
- `aircon`（=1/on/true）：`has_aircon === true`。
- `deal`（=1/on/true）：`is_urgent === true OR is_discounted === true`（急放／特價）。

排序：急放／特價行先 → 最近開始日期（`start_date` 升序，null 排最後）→ 最新建立。

## 6. 公開資料白名單（防洩漏）

公開 DTO 只包含以下欄位，**絕不回傳** `raw_content`、`confidence_score`、
`low_confidence_fields`、`unconfirmed_fields`、`review_note`、`intake_item_id`：

`id, title, district, venue_name, area_type, start_date, end_date, session_dates,
price_text, price_amount_hkd, price_unit, booth_size_text, contact_text,
contact_whatsapp_link, has_aircon, is_prime_spot, is_cart_spot, allows_food,
allows_dry_goods, allows_beauty, allows_service, requires_product_approval,
is_urgent, is_discounted, summary, source_label, source_url,
last_reviewed_at, report_count`

## 7. 資料庫變更

新 migration `supabase/migrations/202609020001_add_report_count.sql`：

- `venue_drafts` 加 `report_count integer not null default 0`；
- 加 `last_reported_at timestamptz`（null = 未被回報過）。

用加法式 alter，可直接喺 Supabase SQL Editor run。

## 8. 檔案結構

```text
apps/web/src/
  app/
    layout.tsx                      # 最細 root layout（lang="zh-Hant"）
    page.tsx                        # 公開 listing 頁（server component，讀庫＋篩選）
    listings/
      filters.tsx                   # 搜尋＋篩選表單（原生 GET form）
      listing-card.tsx              # 單一 listing 卡（server component）
      report-button.tsx             # 「回報過期」掣（client component）
    api/listings/[id]/report/route.ts  # POST 回報過期（increment）
  lib/
    listing-types.ts                # PublicListing DTO、ListingFilters
    listing-filter.ts               # 純函數：解析 params、篩選、排序、日期判定
    listing-repository.ts           # listApprovedListings / reportListing
apps/web/tests/
  listing-filter.test.ts
  listing-repository.test.ts
supabase/migrations/
  202609020001_add_report_count.sql
```

## 9. 頁面行為

- `app/page.tsx` 係 async server component：`await searchParams` → 解析篩選 →
  用 service role client 拎 `approved` 行（join intake 取 `source_label`/`source_url`）
  → 純函數篩選＋排序 → render。
- 篩選表單用原生 `<form method="get">`，submit 改 URL，server 重新 render；
  顯示現有篩選同「清除」連結。
- Listing 卡內容：
  - 標題、地區、場地名、場地類型；
  - 日期：斷續顯示「最早 → 最遲（共 N 日）」，連續顯示範圍，單日顯示一日；
  - 價錢原文 `price_text`（解析價只作篩選，唔單獨展示數字以免誤導）；
  - 尺寸 `booth_size_text`＋細字「實際尺寸同位置每場不同，請向負責人確認」；
  - badges：可賣食品、冷氣、旺位、車位、需審批產品、急放、特價；
  - summary（如有）；
  - 來源：`source_label`，有 `source_url` 就做連結；最後更新 `last_reviewed_at`；
  - 聯絡掣：有 `contact_whatsapp_link` 就 `https://wa.me/...` 外链（`target="_blank"`
    `rel="noopener noreferrer"`）；否則顯示 `contact_text` 原文；
  - 「回報資料過期」掣。
- 空狀態：冇 approved listing 或篩選冇結果時，顯示簡單提示。

## 10. 回報過期 API

- `POST /api/listings/[id]/report`：
  - 驗 `id` 係 UUID；
  - 只對 `status = 'approved'` 嘅行 increment `report_count`、set `last_reported_at = now()`；
  - 用 service role client；成功回 `{ ok: true }`，唔喺 response 洩漏其他資料。
- 防濫用（MVP 最細）：client `localStorage` 記住已回報嘅 listing id，同一 browser
  同一 listing 只可以點一次（掣變「已回報，多謝」）。server 不設 auth／rate limit
  （已知風險，計數只供 Mercy 參考，唔自動觸發任何公開變更）。

## 11. WhatsApp 連結處理

- `contact_whatsapp_link` 可能係 `https://wa.me/852xxxx`、`wa.me/...` 或
  `https://api.whatsapp.com/send?phone=...`。純函數 `normalizeWhatsappLink()`：
  已經係 `http(s)://` 開頭就原用；`wa.me/...` 開頭就補 `https://`；
  淨係數字（≥8 位）就當電話號碼組 `https://wa.me/<數字>`；其餘視為無效。

## 12. 驗證

- `npm test`：新增
  - `listing-filter.test.ts`：過期判定（連續／斷續／無日期）、當日有檔、
    搜尋、預算（含 null 排除）、食品／冷氣／deal flags、排序、params 解析、
    WhatsApp link 正規化；
  - `listing-repository.test.ts`：用注入假 supabase client，驗 list 只取
    `approved` 同 join、report increment 有 set 計數同時間、report 唔 touch 白名單外欄位。
- `npm run typecheck` 全綠。
- migration 可直接喺 Supabase SQL Editor run（加法式、if not exists）。
- 手動 smoke：`next dev`，喺 `/review` 批准一筆假草稿 → `/` 見到張卡；
  試篩選、WhatsApp 掣、回報過期；確認 Supabase `report_count` 有上升。

## 13. 完成定義

- `/` 列出 approved listing，支援搜尋＋日期／預算／食品／冷氣／急放特價篩選；
- 過期 listing 預設隱藏；揀日期只顯示當日有檔；
- 每張卡顯示來源同最後更新時間，聯絡／WhatsApp 掣可用，可回報過期；
- 公開 response 唔含 raw_content／信心／審核內部欄位；
- 測試同 typecheck 全綠；
- PROGRESS.md 更新，本地 git commit（唔 push）。
