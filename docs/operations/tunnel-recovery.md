# Tunnel Recovery Playbook

`apps/web/scripts/dev-tunnel.mjs` 係 Cloudflare Quick Tunnel 嘅守護進程：
啟動 `cloudflared`、自動擷取新 URL、自動同步 Telegram webhook，
並喺 tunnel 進程退出時 respawn。

呢份 playbook 講解「如果 supervisor 自己 dead 咗」或者「tunnel 卡住」嘅人手修復步驟。

---

## 場景 1：Supervisor 進程死咗

**徵兆：**
- `curl https://<tunnel>/api/health` 冇回應
- `.logs/jopojo-tunnel.log` 冇新行超過 5 分鐘
- Telegram 完全冇反應（連 ack 都冇）

**Step 1：確認 Next.js server 仲喺度**
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/health
# 期望 200
```

**Step 2：睇 supervisor 狀態**
```bash
ps -ef | grep -E "dev-tunnel|cloudflared" | grep -v grep
```

如果冇 `dev-tunnel.mjs` 進程：launchd 已經死，需要人手重啟（見 Step 3）。
如果 `cloudflared` 死但 supervisor 仲喺度：等 3 秒會自動 respawn。

**Step 3：人手重啟 supervisor**
```bash
cd "/Users/mercy/Documents/ChatGPT/New project"
nohup node apps/web/scripts/dev-tunnel.mjs > .logs/jopojo-tunnel.log 2>&1 &
disown
```

**Step 4：verify**
```bash
sleep 10
tail -20 .logs/jopojo-tunnel.log
# 期望見到「🌐 tunnel 就緒：https://xxx.trycloudflare.com」+「✅ Telegram webhook 已更新」
curl -s https://<tunnel>/api/health
# 期望返 {"ok":true,...}
```

---

## 場景 2：Tunnel 卡住但 supervisor 仲喺度

**徵兆：**
- log 仲有新行（例如「⚠️ health probe 第 X/3 次失敗」）
- 但 webhook 接收唔到 update

**Step 1：等自動 respawn**
health probe 預設 60 秒 ping 一次，連續 3 次失敗就 kill tunnel 強制 respawn。
等約 3 分鐘睇 log：
```bash
tail -30 .logs/jopojo-tunnel.log
```
期望見到：
- `❌ health probe 連續 3 次失敗，kill tunnel 強制 respawn…`
- `🔄 啟動 cloudflared tunnel`
- `🌐 tunnel 就緒：https://新-url.trycloudflare.com`
- `✅ Telegram webhook 已更新`

**Step 2：如果超過 5 分鐘都冇 respawn**
```bash
ps -ef | grep cloudflared | grep -v grep
# 攞 PID，然後：
kill <PID>
```
3 秒後 supervisor 嘅 `child.on("exit")` 會觸發 respawn。

---

## 場景 3：QUIC Protocol 卡住（recurring 問題）

**徵兆：**
- log 不斷出現 QUIC retry
- 唔係 http2 connection

**修復：**
1. 確認 `apps/web/scripts/dev-tunnel.mjs` 嘅 spawn args 包含 `"--protocol", "http2"`
2. 已經有嘅話唔使改；新加嘅都會自動用 http2
3. 人手重啟 supervisor（場景 1 Step 3）

長遠穩定方案：用 Cloudflare Named Tunnel，但要先喺 dashboard 開 tunnel + 裝 cert。

---

## 健康檢查指令清單

**一次性 verify（30 秒）：**
```bash
# 1. Next.js 仲喺度？
curl -s -o /dev/null -w "next=%{http_code}\n" http://localhost:3000/api/health

# 2. Tunnel URL 仲通？
curl -s -o /dev/null -w "tunnel=%{http_code}\n" "https://<tunnel>/api/health"

# 3. Telegram webhook 對齊？
curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo" | jq '.result.url'

# 4. Supervisor log 正常？
tail -5 .logs/jopojo-tunnel.log
```

**全綠標準：** `next=200`、`tunnel=200`、webhook URL 對應 tunnel URL、log 有近期「✅ Telegram webhook 已更新」。

---

## 環境變數參考

`apps/web/.env.local` 必須有：
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_ALLOWED_CHAT_IDS`

冇呢啲 supervisor 會喺 startup 直接 throw。

---

## 配置位置

- Supervisor 源碼：`apps/web/scripts/dev-tunnel.mjs`
- Health probe：`apps/web/src/app/api/health/route.ts`
- Launchd plist（如有）：`~/Library/LaunchAgents/`
- Log：`.logs/jopojo-tunnel.log`
- Env：`.env.local`
