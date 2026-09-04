# jojopro Slice 4.1：審核批量操作＋批准狀態＋圖片顯示

日期：2026-09-02
狀態：已完成（圖片代理要 dev server 用 webpack 跑；`npm run dev` 已改做 `next dev --webpack`）
前置：Slice 3（審核頁）、Slice 4（公開 listing 頁）已完成

## 1. 目標

回應 Mercy 三項需求：

1. 審核頁可批量勾選，一次批准／拒絕多筆草稿。
2. 批准／拒絕後有明確狀態顯示（而家撳完即消失，唔知成功未）。
3. 收料有圖片時，審核頁同公開 listing 都顯示到相。

## 2. 圖片安全設計（重點）

- Bot token 同 Telegram raw file_id 唔可以落瀏覽器。
- 用兩個 server 代理 route，server 端用 bot token 向 Telegram 攞相再 stream：
  - 公開：`GET /api/photos/listing/[id]/[index]`，server 先查該 draft 係
    `status = 'approved'` 先俾相，否則 404；index 對應 photo_file_ids 位置（0 起），越界 404。
  - 審核：`GET /api/photos/intake/[intakeId]/[index]`，要 review cookie
    （重用 `isSessionValid`），唔通過 401。
- 重用 `telegram-photo.ts` 嘅 getFile 邏輯，抽出可重用函式
  `downloadTelegramPhoto(botToken, fileId)` 回傳 buffer＋mimeType。
- 公開 DTO 只加 `photoCount: number`（安全）；圖片 URL 由前端用 draft id＋index 砌，
  唔回傳 intake_item_id 或 file_id。
- 相暫時直接代理 Telegram（唔入 Supabase Storage），最平。

## 3. 批量操作

- 每張待審卡加 checkbox；頂部「全選」。
- 底部操作列：「已選 N 張」＋「批量批准」「批量拒絕」。
- 批量逐張 PATCH 現有 `/api/review/drafts/[id]`（唔開新端點），用卡入面現有表單值
  （默認 = AI 解析結果，唔改都可直接批量批准）。
- 每張卡獨立回報成功／失敗；失敗唔影響其他。

## 4. 批准／拒絕狀態

- 審核頁加分頁：「待審核」（needs_review）／「已批准」（approved）。
- 撳批准後卡頂顯示綠色橫額「✓ 已批准，已發布去公開頁」，卡身禁用；約 1.2 秒後移除。
- 撳拒絕顯示紅色「已拒絕」，同樣短暫顯示後移除。
- 「已批准」分頁列出所有 approved 草稿（唯讀摘要），令 Mercy 清楚咩已上線。

## 5. 公開 listing 顯示相

- listing DTO 加 `photoCount`；repository join intake 攞 `photo_file_ids`，
  mapper 計 `photoCount = length`，但 DTO 只留 count（唔留 id 陣列）。
- 公開卡：`photoCount > 0` 第一張做封面 `<img src="/api/photos/listing/{id}/0">`，
  其餘相用縮圖列（點開新分頁大圖）。冇相唔留空位。

## 6. 檔案

```text
apps/web/src/
  lib/telegram-photo.ts          # 重構：抽出 downloadTelegramPhoto
  lib/photo-service.ts           # 代理共用邏輯（取 draft/intake、stream 相）
  lib/listing-types.ts           # 加 photoCount
  lib/listing-repository.ts      # intake join photo_file_ids -> photoCount
  app/
    api/photos/listing/[id]/[index]/route.ts
    api/photos/intake/[intakeId]/[index]/route.ts
    review/page.tsx              # 分頁＋批量＋狀態
    review/draft-card.tsx        # checkbox、狀態橫額、縮圖
    review/approved-card.tsx     # 已批准唯讀卡
    listings/listing-card.tsx    # 公開卡封面相
apps/web/tests/
  photo-service.test.ts
```

## 7. 唔做

- 唔入 Supabase Storage、唔做相庫／CDN。
- 唔做釘圖、揀相、拖曳排序、裁剪。
- 唔改資料庫 schema（唔使 migration）。

## 8. 驗證

- `npm test`：新增 photo-service 測試（approved gate、index 越界、審核未登入 401、
  photoCount 計算）；`npm run typecheck` 全綠。
- 手動：review 頁見相、批量批准、狀態橫額、已批准分頁；公開卡見封面相。
