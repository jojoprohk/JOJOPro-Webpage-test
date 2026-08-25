# Telegram 收料系統設定教學

最後更新：2026-08-25

## 1. 你會需要

- 一個 Telegram 帳號。
- 一個 Groq API key。
- 一個 Supabase project。
- 一個公開 HTTPS webhook URL。本機測試可以用 Cloudflare Tunnel、ngrok 或 Vercel preview URL。

唔好將任何真實 token、API key、service role key 貼入 Git 或對話記錄。

## 2. 建立 `.env.local`

喺 project root 建立：

```text
/Users/mercy/Documents/ChatGPT/New project/.env.local
```

用 TextEdit 開：

```bash
cd "/Users/mercy/Documents/ChatGPT/New project"
touch .env.local
open -a TextEdit .env.local
```

`.env.local` 已被 `.gitignore` 忽略，唔會入 Git。

## 3. 建立 Telegram bot

1. 喺 Telegram 搜尋 `@BotFather`。
2. 傳 `/newbot`。
3. 按提示輸入 bot 名稱同 username。
4. BotFather 會俾你一個 bot token，格式大約係 `123456:ABC...`。
5. 將佢放入本機 `.env.local`：

```env
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN_HERE
```

## 4. 設定 webhook secret

隨機產生一串 secret，例如：

```bash
openssl rand -hex 32
```

放入：

```env
TELEGRAM_WEBHOOK_SECRET=YOUR_RANDOM_SECRET_HERE
```

呢個 secret 會放喺 Telegram webhook header，用嚟確認 request 真係由 Telegram 發出。

## 5. 設定 Telegram chat ID

1. 先將一則訊息 send 去你嘅 bot。
2. 用下面指令睇最新 update，搵你自己個 `chat.id`：

```bash
curl "https://api.telegram.org/botYOUR_TELEGRAM_BOT_TOKEN_HERE/getUpdates"
```

3. 將 chat ID 放入：

```env
TELEGRAM_ALLOWED_CHAT_IDS=123456789
```

如果有多個 chat，用逗號分隔：

```env
TELEGRAM_ALLOWED_CHAT_IDS=123456789,987654321
```

如果留空，任何知道你 webhook 嘅人都可以送 request，所以正式使用一定要設定。

## 6. 設定 Groq

1. 去 [Groq Console](https://console.groq.com/) 註冊或登入。
2. 開 `API Keys`。
3. 建立新 API key 並複製。Groq key 通常只會完整顯示一次。
4. 放入 `.env.local`：

```env
LLM_API_KEY=YOUR_GROQ_API_KEY_HERE
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.3-70b-versatile
```

預設用 `llama-3.3-70b-versatile`，有免費額度、速度快，適合初期測試。

## 7. 設定 Supabase

### 7.1 建立 project

1. 去 [Supabase Dashboard](https://supabase.com/dashboard)。
2. 撳 `New project`。
3. Project 名稱可以用 `jopojo`。
4. 設定資料庫密碼並自己保存。呢個密碼唔需要放入 `.env.local`。
5. Region 揀 `Southeast Asia (Singapore)`。
6. 等 project 建立完成。

### 7.2 建立資料表

1. 喺 Supabase Dashboard 開你嘅 project。
2. 左邊選單揀 `SQL Editor`。
3. 撳 `New query`。
4. 打開本機檔案：

```text
supabase/migrations/202608230001_create_intake_tables.sql
```

5. 將入面全部 SQL 複製，貼入 Supabase SQL Editor。
6. 撳 `Run`。

成功後會有兩個表：

- `intake_items`
- `venue_drafts`

### 7.3 攞連線資料

1. 喺 Supabase Dashboard 撳左下角 `Project Settings`。
2. 開 `API`。
3. 搵 `Project URL`，放入 `.env.local`：

```env
SUPABASE_URL=YOUR_SUPABASE_URL_HERE
```

4. 搵 `Project API keys` 入面嘅 `service_role` key，放入 `.env.local`：

```env
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE
```

`service_role` key 有高權限，可以繞過 Row Level Security，只可以放喺 server，唔可以放入公開前端。

## 8. `.env.local` 最終樣本

你嘅檔案應該似下面，但值要換成你自己嘅：

```env
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN_HERE
TELEGRAM_WEBHOOK_SECRET=YOUR_RANDOM_SECRET_HERE
TELEGRAM_ALLOWED_CHAT_IDS=YOUR_TELEGRAM_CHAT_ID_HERE

LLM_API_KEY=YOUR_GROQ_API_KEY_HERE
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.3-70b-versatile

SUPABASE_URL=YOUR_SUPABASE_URL_HERE
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE

PUBLIC_SITE_URL=http://localhost:3000
```

## 9. 本機啟動

喺 project root 執行：

```bash
npm install
npm run dev --workspace=@jopojo/web
```

網站會喺 `http://localhost:3000` 啟動。

## 10. 用 Tunnel 接收 Telegram webhook

如果你用 Cloudflare Tunnel 或 ngrok，假設公開 HTTPS URL 係：

```text
https://your-tunnel.example
```

webhook path 係：

```text
https://your-tunnel.example/api/intake/telegram
```

設定 Telegram webhook：

```bash
curl -X POST "https://api.telegram.org/botYOUR_TELEGRAM_BOT_TOKEN_HERE/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-tunnel.example/api/intake/telegram",
    "secret_token": "YOUR_RANDOM_SECRET_HERE",
    "allowed_updates": ["message"]
  }'
```

成功後，Telegram 會回傳：

```json
{ "ok": true, "result": true, "description": "Webhook was set" }
```

## 11. 測試一則場地貼文

將類似下面嘅訊息 send 去你個 bot：

```text
代客急放
8月25日
葵涌廣場 大場
3號位 特價 $900/日
4粒，近街市，要報貨
有意 WhatsApp 91234567
```

成功後：

- `intake_items` 會有一條 raw intake。
- `venue_drafts` 會有一條 `needs_review` 或 `rejected` draft。
- API 會回傳 `{ "ok": true, ... }`。

## 12. 檢查 webhook

```bash
curl "https://api.telegram.org/botYOUR_TELEGRAM_BOT_TOKEN_HERE/getWebhookInfo"
```

如果見到 `last_error_message`，先檢查：

- webhook URL 是否 HTTPS。
- `TELEGRAM_WEBHOOK_SECRET` 同 `setWebhook` 入面嘅 `secret_token` 是否一樣。
- `TELEGRAM_ALLOWED_CHAT_IDS` 是否包含你嘅 chat ID。
- Supabase 同 LLM env 是否正確。

## 13. 下一步

Slice 2 完成後，下一步應該做最小審核頁：

1. 列出 `needs_review` 場地草稿。
2. 顯示低信心欄位。
3. 容許 Mercy 修改、批准或拒絕。
4. 批准後先可以發布去公開 listing。
