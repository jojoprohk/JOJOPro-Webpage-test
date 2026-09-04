#!/usr/bin/env node
// 開發用 Cloudflare quick tunnel 自動守護：
//   1. 啟動 cloudflared quick tunnel 指去本機 Next server
//   2. 從 cloudflared 輸出攞到 tunnel 網址後，自動重設 Telegram webhook
//   3. tunnel 一旦斷開（進程退出），自動重開並再更新 webhook
//
// 用法：node apps/web/scripts/dev-tunnel.mjs
//   環境變數可覆蓋：PORT（本機 server port，預設 3000）
//
// 注意：quick tunnel 每次重開都會換網址，呢個腳本會自動同步 webhook，
// 所以唔使再人手 setWebhook。長遠穩定方案係用 Cloudflare 命名 tunnel。

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(__dirname, "..");
const ENV_PATH = path.join(WEB_DIR, ".env.local");
const LOCAL_PORT = process.env.PORT || "3000";
const LOCAL_URL = `http://localhost:${LOCAL_PORT}`;
const WEBHOOK_PATH = "/api/intake/telegram";

function loadEnv() {
  const env = {};
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`搵唔到 ${ENV_PATH}`);
  }
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
if (!env.TELEGRAM_BOT_TOKEN) throw new Error(".env.local 缺少 TELEGRAM_BOT_TOKEN");

function ts() {
  return new Date().toLocaleTimeString("zh-HK", { hour12: false });
}
function log(...args) {
  console.log(`[${ts()}]`, ...args);
}

async function setWebhook(tunnelUrl) {
  const webhookUrl = `${tunnelUrl}${WEBHOOK_PATH}`;
  const res = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: env.TELEGRAM_WEBHOOK_SECRET,
        allowed_updates: ["message"],
        drop_pending_updates: false,
      }),
    },
  );
  const json = await res.json();
  if (!json.ok) throw new Error(`setWebhook 失敗：${JSON.stringify(json)}`);
  log("✅ Telegram webhook 已更新 →", webhookUrl);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 關鍵：cloudflared 一印出網址時，權威 DNS 往往仲未發布筆記錄（查落去係 NXDOMAIN）。
// 若喺呢個時候搶閘 setWebhook，Telegram 會即時 resolve 並收到「主機唔存在」，
// 再按 SOA negative TTL（trycloudflare 為 1800 秒）快取呢個失敗，之後半個鐘都 set 唔到。
// 所以第一次 setWebhook 之前，必須先確認公共 DNS 真係解析到筆 A/AAAA 記錄。
// 用 HTTPS DNS API 而唔用系統 UDP DNS：同一條 HTTP 通道先喺 launchd 環境穩定。
const DNS_JSON_ENDPOINTS = [
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/resolve",
];

async function isHostResolvable(hostname) {
  for (const endpoint of DNS_JSON_ENDPOINTS) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set("name", hostname);
      url.searchParams.set("type", "A");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { accept: "application/dns-json" },
        });
        if (!res.ok) continue;
        const json = await res.json();
        const answers = Array.isArray(json.Answer) ? json.Answer : [];
        if (answers.some((a) => a.type === 1)) return true;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // 呢個 DNS endpoint 暫時唔得，試下一個
    }
  }
  return false;
}

async function waitForDns(hostname, { timeoutMs = 120000, intervalMs = 3000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    if (await isHostResolvable(hostname)) {
      log(`🟢 DNS 已生效（第 ${attempt} 次檢查）：${hostname}`);
      return true;
    }
    await sleep(intervalMs);
  }
  log(`⚠️  DNS 喺 ${timeoutMs / 1000} 秒內仍未查到記錄；唔會強行設 webhook，等定期檢查接手。`);
  return false;
}

function hostnameOf(url) {
  return new URL(url).hostname;
}

// 核對 Telegram 目前嘅 webhook 係咪已經指向現用 tunnel。
async function getWebhookUrl() {
  const res = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`,
  );
  const json = await res.json();
  if (!json.ok) throw new Error(`getWebhookInfo 失敗：${JSON.stringify(json)}`);
  return json.result?.url || "";
}

// 新 quick tunnel 嘅 DNS 傳播實測要约 60 秒，Telegram 會即時 resolve 主機，
// 太早 setWebhook 會因主機未生效而失敗。用指數退避拉長到覆蓋约 90 秒窗口。
const BACKOFF_MS = [3000, 5000, 8000, 12000, 15000, 15000, 15000, 15000];

// 單次「攞到網址後努力設好 webhook」：成功就停，失敗照退避時間表重試。
async function setWebhookWithRetry(tunnelUrl) {
  for (let i = 0; i <= BACKOFF_MS.length; i++) {
    try {
      await setWebhook(tunnelUrl);
      state.webhookSet = true;
      state.currentUrl = tunnelUrl;
      return;
    } catch (err) {
      log(`⚠️  webhook 第 ${i + 1} 次失敗：${err.message}`);
      if (i < BACKOFF_MS.length) await sleep(BACKOFF_MS[i]);
    }
  }
  log("❌ webhook 喺傳播窗口內仍未設好，稍後守護會再自動重試。");
}

const state = { webhookSet: false, currentUrl: null };

// 保險機制：每 45 秒檢查一次。若 webhook 未設好、或指唔到現用 tunnel
//（例如 DNS 遲過窗口先通、或 tunnel 靜默換咗網址），就自動補設。
setInterval(async () => {
  if (!state.currentUrl) return;
  try {
    // 定期檢查同樣要等 DNS 生效先好碰 setWebhook，避免毒化 Telegram 負面快取。
    if (!(await isHostResolvable(hostnameOf(state.currentUrl)))) return;
    const want = `${state.currentUrl}${WEBHOOK_PATH}`;
    const have = await getWebhookUrl();
    if (have === want && state.webhookSet) return;
    if (have !== want) log("🔁 webhook 未對齊現用 tunnel，自動補設…");
    await setWebhook(state.currentUrl);
    state.webhookSet = true;
  } catch (err) {
    log(`⚠️  定期檢查 webhook 失敗：${err.message}`);
  }
}, 45000).unref();

function startTunnel() {
  state.webhookSet = false;
  state.currentUrl = null;
  log("🔄 啟動 cloudflared tunnel，指去", LOCAL_URL);

  const child = spawn(
    "cloudflared",
    ["tunnel", "--url", LOCAL_URL, "--no-autoupdate", "--protocol", "http2"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  let settled = false;
  const urlRe = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

  const onLine = (chunk) => {
    const text = chunk.toString();
    process.stdout.write(`  cloudflared | ${text}`);
    const m = text.match(urlRe);
    if (m && !settled) {
      settled = true;
      const tunnelUrl = m[0];
      // 一攞到網址就記住，即使 webhook 暫時因 DNS 未傳播而 set 唔到，
      // 定期檢查都要靠佢嚟補設。
      state.currentUrl = tunnelUrl;
      log("🌐 tunnel 就緒：", tunnelUrl);
      // 等 DNS 真係生效先第一次 setWebhook，避免毒化 Telegram 嘅負面快取。
      void (async () => {
        if (await waitForDns(hostnameOf(tunnelUrl))) {
          await setWebhookWithRetry(tunnelUrl);
        }
      })();
    }
  };

  child.stdout.on("data", onLine);
  child.stderr.on("data", onLine);

  child.on("exit", (code) => {
    log(`⛔ cloudflared 退出（code ${code}），3 秒後重開…`);
    setTimeout(startTunnel, 3000);
  });

  child.on("error", (err) => {
    log("⛔ 啟動 cloudflared 出錯：", err.message);
  });

  return child;
}

log("jojopro dev tunnel 守護啟動");
log("本機 server：", LOCAL_URL);
startTunnel();

function shutdown() {
  log("收到離開訊號，停止守護。");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
