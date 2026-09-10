# 決策：Reload 後重置首頁篩選

日期：2026-09-09

## 決定

首頁篩選屬於臨時查詢狀態。用戶在已套用篩選的頁面按瀏覽器 Reload（F5 / Cmd+R）時，自動返回 `/`，令舖位類型、領展、地區、日期全部返回預設值。

以下行為不視為 Reload，不強制重置：

- 初次打開 `/`；
- 初次打開或貼上帶 query 的篩選連結；
- 瀏覽器上一頁 / 下一頁；
- 撳「篩選」提交；
- 撳「清除」返回 `/`。

免責條款同意狀態及回報防重複記錄不屬於篩選選擇，保留在 localStorage，不在本次範圍清除。

## 原因

篩選係臨時操作，不是用戶長期偏好。Reload 時保留 query 容易令用戶以為網站冇更新，或忘記自己仍在某個篩選條件內。每次 Reload 返回完整列表更直接、可預期。

## 實作邊界

用 `performance.getEntriesByType("navigation")[0].type === "reload"` 分辨真正 Reload。只有 `window.location.search` 非空時才 `window.location.replace("/")`，避免首頁無 query 時無限 reload。

此邏輯放在 client filter component：server 仍維持 URL query 驅動，保留可分享篩選連結及無 JS 基本可用性。
