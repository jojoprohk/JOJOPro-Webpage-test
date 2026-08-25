# JoPoJo Slice 2：Telegram 收料、AI 解析同資料庫寫入

日期：2026-08-24
狀態：計劃中

## 1. 目標

建立第一條可運行嘅自動收料 pipeline：

```text
Telegram webhook
  -> 提取貼文文字
  -> 寫入 intake_items
  -> 用 AI 解析成 venue_drafts
  -> 等待 Mercy 審核
```

完成後，Mercy 或已批准人士將場地貼文 forward 去 Telegram bot，系統可以自動產生結構化草稿。

## 2. 呢個 slice 唔做

- 唔做登入同審核頁。
- 唔做公開 listing 頁。
- 唔做 IG／Facebook 自動發布。
- 唔做 WhatsApp 自動監控或自動回覆。
- 唔做金流、合約、談判、即時通訊。
- 唔保存任何 API key、bot token、webhook secret 入 Git。

## 3. 檔案結構

```text
apps/
  web/
    package.json
    tsconfig.json
    next-env.d.ts
    next.config.js
    src/
      app/
        api/
          intake/
            telegram/
              route.ts
      lib/
        env.ts
        openai-venue-completer.ts
        supabase.ts
        telegram-intake-service.ts
        telegram-parser.ts
        venue-repository.ts
    tests/
      telegram-parser.test.ts
      telegram-intake-service.test.ts
      venue-repository.test.ts

packages/
  ai/
    src/
      index.ts
```

## 4. 實作要求

1. `apps/web` 使用 Next.js App Router，只建立 webhook route。
2. Telegram parser 只處理 message text 同 image caption。
3. Webhook 必須用 `X-Telegram-Bot-Api-Secret-Token` 驗證。
4. Supabase 使用 service role key，只可以喺 server 讀取。
5. OpenAI-compatible LLM completer 用 structured JSON output，初期可用 Groq，輸出型別必須對齊 `ParseResult`。
6. 非場地貼文都要寫入 `intake_items`，同時建立 `status = rejected` 嘅 `venue_drafts`，方便日後檢查。
7. 冇文字內容、冇 caption、system message 一律回傳 ignored，但唔寫入資料庫。
8. 所有錯誤訊息唔可以打印 token、API key、Supabase key 或完整 Telegram update。

## 5. 驗證

- `npm test`
- `npm run typecheck`
- `npm audit --omit=dev`

## 6. 之後先做

- Supabase migration 檢查同 RLS／審核者身份。
- 簡單審核 queue。
- Approved listing 公開頁。
- IG／Facebook 帖文草稿生成。
- Telegram bot setup script 同 webhook 設定教學。
