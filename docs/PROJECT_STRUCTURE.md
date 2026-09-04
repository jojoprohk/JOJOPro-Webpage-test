# JoPoJo 項目結構規範

最後更新：2026-09-04

## 1. 項目目的

呢個項目第一階段係做一個 AI 輔助嘅香港短租舖位、booth、pop-up、展銷場地情報營運系統。

第一版唔係完整 marketplace，而係一個可控嘅收料、整理、審核、發布流程：

1. 透過 Telegram bot 接收場地貼文。
2. 用 AI 抽取結構化欄位。
3. 由 Mercy 審核同修改。
4. 審批後發布去網站。
5. 自動產生 Instagram 同 Facebook 帖文草稿。

## 2. 硬性約束

- 以一人公司營運為前提。
- 未驗證需求前，現金成本要保持最低。
- 唔代收租金、按金或任何交易款項。
- 唔代任何一方簽合約。
- 唔用非官方 WhatsApp 自動化工具，避免封號。
- 唔可以將原始對話匯出、電話號碼、API keys、tokens 或個人資料放入 Git。
- 每個公開 listing 必須顯示資料來源同最後更新時間。

## 3. 資料夾規則

```text
docs/
  specs/          已確認嘅產品同技術規格
  plans/          可執行實作計劃
  operations/     人手同自動化營運流程
  decisions/      重要決策紀錄
  vision/         長遠目標、擴展路線、階段門檻

apps/
  web/            公開網站同審核後台

packages/
  ai/             AI 解析同內容生成共用邏輯

supabase/
  migrations/     資料庫 schema 變更
```

## 4. 資料處理規則

- 原始訊息只可以放入資料庫或本機 ignored 儲存空間，唔可以入 Git。
- 公開 listing 只可以包含場地負責人或資料來源已經主動公開發布嘅租務資訊。
- 如果原始貼文已有電話或 WhatsApp link，可以顯示；但平台唔保證對方身份，除非日後有另行授權嘅認證流程。
- AI 產生欄位必須保留信心標記，直到 Mercy 審批。
- 已審批 listing 必須有 `source_url`、`source_type`、`source_label` 同 `last_reviewed_at`。

## 5. 命名規則

- 程式碼、指令、資料庫欄位用英文。
- 用戶介面同文件預設用繁體中文／廣東話。
- 檔名用 kebab-case。
- 日期格式用 `YYYY-MM-DD`。

## 6. 清理規則

- 暫存下載檔案放入 `/tmp` 或其他 ignored 位置。
- 每份規格必須寫清楚「唔做啲咩」。
- 自動化流程穩定後，要清理過期草稿。
- 改任何流程規則前，先更新相關文件，再改實作。

## 7. 長遠方向

JoPoJo 最終唔只係一個舖位 listing 網站。長遠目標係成為以香港為基地、連接小本創業者、場地營運方、商場發展商同批發／供應鏈資源嘅實體零售空間流動平台。

但所有大型功能、企業合作同跨境擴展，都要先通過早期驗證門檻，先可以投入資源。詳見 `docs/vision/long-term-vision.md`。

## 8. 視覺與 stock 相片系統（2026-09-04）

- 公開頁 ambient WebGL 背景：`apps/web/src/app/components/site-background.tsx`，純函數 GLSL fbm，零依賴；color palette 同 drift 參數直接喺 shader 入面。
- 全站圓角尺度：CSS variables 喺 `apps/web/src/app/globals.css` 嘅 `:root`：`--radius-sm` / `--radius` / `--radius-lg` / `--radius-pill`。改呢度就等於改全站。
- Stock 相片目錄：`apps/web/public/stock/`，副檔名統一 `.jpg`，檔名對應 `packages/ai/src/stock-photos.ts` 嘅 key（`mall` / `market` / `street` / `industrial` / `pop-up` / `private-venue` / `exhibition` / `hong-kong-shop`）。換圖時保持檔名同尺寸（1200×1200）就得，唔使改 code。
- 舖位類型（areaType）統一喺 `packages/ai/src/types.ts`，改呢度要先睇 `docs/PROGRESS.md` §11。
