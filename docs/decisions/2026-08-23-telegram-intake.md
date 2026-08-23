# 決策：先用 Telegram 做收料入口

日期：2026-08-23

## 決定

第一階段用 Telegram bot 做自動收料入口，唔用 WhatsApp Business App 抓取，亦唔用非官方 WhatsApp 自動化工具。

## 原因

Mercy 現有 WhatsApp Business App 號碼適合做人手聯絡，但 WhatsApp Business App 本身冇提供穩定官方 API 畀外部系統自動讀取訊息。用非官方工具 hook 入去有封號風險，對早期項目唔值得。

Telegram bot 免費、穩定、容易接 AI 同資料庫。MVP 主要靠 Mercy 同可信貢獻者 forward 貼文，所以 Telegram 足夠做驗證。

## 30 日後再檢討

如果達到以下條件，再考慮用獨立號碼接 WhatsApp Cloud API 或正式服務商：

- 每星期有 20 條以上有效場地貼文；
- 場地搞手或代理人主動要求用 WhatsApp send 資料；
- 收料流程明顯節省 Mercy 時間。

到時都要保留現有 WhatsApp Business App 號碼做人手聯絡，bot 要用另一個獨立號碼。
