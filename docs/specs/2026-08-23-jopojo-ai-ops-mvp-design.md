# JoPoJo AI 營運系統 MVP 設計

日期：2026-08-23
狀態：草稿，待 Mercy 審閱

## 1. 要解決嘅問題

香港短租 booth 同展銷場地供應係活躍嘅，但資訊非常分散。場地搞手、代理人、場主會喺 WhatsApp group 同 Instagram 發布最新場地，但呢啲資訊好難搜尋、好快過期、重複內容多，亦冇統一結構去睇日期、價錢、地點、幾多粒、設施同產品限制。

Mercy 想建立一個 AI 輔助工作流程，減少人手整理時間，同時保留人工審核，避免錯誤資料直接發布。

## 2. MVP 目標

將一條 forward 入嚟嘅場地貼文，喺 Mercy 用大約 30 秒審核後，變成：

- 一條已審批網站 listing；
- 一個 Instagram / Facebook 帖文草稿。

第一版要驗證：

- AI 可唔可以穩定解析場地貼文；
- 已審批 listing 可唔可以快速發布去簡單網站；
- AI 產生嘅社交內容有冇實際用；
- 呢個流程係咪真係慳到 Mercy 時間。

## 3. 第一版範圍

- Telegram bot 接收 Mercy 同已批准貢獻者轉發嘅內容。
- 儲存原始文字、圖片引用、來源連結同提交時間。
- AI 抽取場地 listing 欄位同信心分數。
- 提供審核 queue，畀 Mercy 批准、修改或拒絕。
- 公開網站 listing 頁同基本篩選。
- 自動產生社交帖文草稿，初期由 Mercy 人手複製發布。
- 基本來源分類：Telegram、Instagram、WhatsApp forward、人手輸入。

## 4. 第一版唔做

- 唔做付款、按金、escrow、租金代收或成交佣金。
- 唔做電子合約或合約代管。
- 唔做站內即時通訊。
- 唔做場主自助 dashboard。
- 唔做全自動 Instagram 發布。
- 唔監控或爬取整個 WhatsApp group。
- 唔做 Verified Badge、資料真偽保證或爭議仲裁。
- 唔做複雜推薦算法。

## 5. 建議技術棧

| 層面 | 選擇 | 原因 |
|---|---|---|
| 收料入口 | Telegram Bot | 免費、穩定、易接自動化，支援文字、圖片、連結 |
| 網頁應用 | Next.js + TypeScript | 同時做公開網站、審核後台同 bot webhook |
| 資料庫 | Supabase PostgreSQL | 免費額度可用，結構化資料，日後可加 auth |
| AI | OpenAI-compatible structured output，初期用 Groq | 平衡成本、免費額度、解析能力同可轉換供應商 |
| 部署 | Vercel | Next.js 部署簡單，webhook 處理方便 |
| 社交發布 | 初期人手發布，後期接 Meta API | 等資料質素穩定先自動，減少出錯風險 |

30 日內除非遇到明確限制，否則唔好買 Make.com、n8n、SleekFlow 呢類月費工具。

## 6. 核心流程

```text
Mercy／貢獻者將貼文 forward 去 Telegram bot
  -> 儲存原始收料
  -> AI 抽取欄位同信心分數
  -> 建立狀態為 needs_review 嘅審核項目
  -> Mercy 修改、批准或拒絕
  -> 已批准 listing 發布去公開網站
  -> 產生社交帖文草稿
  -> Mercy 人手貼去 Instagram / Facebook
```

## 7. Listing 欄位

### 7.1 批准前必須有

- `source_type`：`telegram`、`instagram`、`whatsapp_forward`、`manual`
- `source_label`：例如 group 名、IG handle、提交者標籤
- `source_url`：可留空；有公開連結時填入
- `title`
- `district`
- `venue_name`
- `start_date`
- `end_date`
- `price_text`：原始寫法，例如 `$800/日`、`$1200/2日`
- `price_amount_hkd`：可留空，基礎價錢數字
- `price_unit`：`day`、`period`、`unknown`
- `booth_size_text`：例如 `3粒`、`120x60cm 枱`、`4粒`
- `contact_text`：原始聯絡方法
- `contact_whatsapp_link`：可留空
- `raw_content`
- `last_reviewed_at`

### 7.2 重要篩選欄位

- `area_type`：`mall`、`market`、`street`、`industrial`、`pop_up_event`、`private_venue`、`other`
- `has_aircon`
- `is_prime_spot`
- `is_cart_spot`
- `allows_food`
- `allows_dry_goods`
- `allows_beauty`
- `allows_service`
- `requires_product_approval`
- `is_urgent`
- `is_discounted`

### 7.3 信任同品質欄位

- `publication_date`
- `last_seen_at`
- `data_quality_score`：0-100
- `review_note`
- `report_count`

MVP 唔可以叫場地做「已認證」。只可以用「最後更新時間」同「資料來源」。

## 8. 審核規則

如果以下任何一項唔清楚，就要拒絕或保留待審：

- 場地名或地區；
- 日期；
- 價錢；
- 聯絡方法；
- 會實際影響檔主決定嘅產品限制。

低信心欄位要喺審核介面清楚標示。AI 唔可以靜默猜測。

## 9. 公開網站 MVP

首頁必須有：

- 地區／場地搜尋；
- 篩選：日期、最高預算、booth 尺寸標籤、可賣食品、冷氣、急放／特價；
- listing 卡：日期、地區、場地、價錢、尺寸、限制、來源、最後更新時間；
- 用原始聯絡資料嘅 WhatsApp／聯絡掣；
- 「回報資料過期」功能。

唔好做大型 marketing landing page。Listing 頁就係產品本身。

## 10. 社交草稿類型

AI 由已批准 listing 產生：

- `urgent_release`：今日急放／執雞位
- `weekly_budget`：本週平場
- `under_800`：$800 以下週末檔
- `food_friendly`：可賣食品場地
- `aircon_picks`：冷氣場精選
- `district_picks`：地區精選
- `new_source`：新場地／新供應來源

每個草稿包括：

- 標題；
- 3-5 個重點；
- 資料來源同最後更新時間；
- 去網站嘅 CTA；
- 提醒用戶自行向場地確認檔期同條款。

## 11. 30 日成功指標

- 30-50 個已批准 listing。
- 網站 listing 有至少 100 次不重複瀏覽。
- 至少 20 次聯絡／WhatsApp 點擊。
- 至少 20 個 alert／關注登記。
- Mercy 每日用 15-30 分鐘做審核同聯絡，而唔係人手排版。
- 文字貼文入面，至少 70% 可以經少量修改就批准。

## 12. 暫停或轉向指標

30 日後如果出現以下情況，要暫停並重新評估：

- 收集唔到 30 條可用貼文；
- 少過 50 人重複瀏覽網站；
- 聯絡點擊少過 10 次；
- Mercy 花喺修正 AI 輸出嘅時間，比舊式人手做法仲要多。

## 13. 實作順序

1. 建立項目結構同資料庫 schema。
2. 整 Telegram bot intake，將資料寫入 Supabase。
3. 整 AI parser，輸出結構化欄位同信心分數。
4. 整最小審核頁。
5. 將已批准 listing 發布去公開頁。
6. 產生社交草稿。
7. 再加圖片處理同 Instagram 連結處理。
