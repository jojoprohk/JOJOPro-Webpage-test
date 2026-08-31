import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { createLlmVenueCompleter } from "../apps/web/src/lib/llm-venue-completer";
import { getTelegramAllowedChatIds } from "../apps/web/src/lib/env";
import {
  createSupabaseServiceClient,
  createVenueRepository,
} from "../apps/web/src/lib/venue-repository";
import type { TelegramUpdate } from "../apps/web/src/lib/telegram-parser";
import { createTelegramPhotoFetcher } from "../apps/web/src/lib/telegram-photo";
import { createVenueBatcher } from "./venue-batch";
import { parseTelegramVenueUpdate } from "../apps/web/src/lib/telegram-parser";

// Load .env.local (Next.js convention) — never log secret values.
function loadEnv() {
  // The server is always launched from the repo root; fall back to locations
  // relative to this file (server/ or server/dist/) for robustness.
  const candidates = [
    path.join(process.cwd(), "apps/web/.env.local"),
    path.join(process.cwd(), ".env.local"),
  ];
  const envPath = candidates.find((candidate) => existsSync(candidate));
  if (!envPath) {
    console.error("[telegram-webhook] .env.local not found");
    process.exit(1);
  }
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    const key = m?.[1];
    const value = m?.[2];
    if (key && value !== undefined && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnv();

const PORT = Number(process.env.PORT || 3000);
const WEBHOOK_PATH = "/api/intake/telegram";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

function secretMatches(provided: string | null) {
  if (!provided || !WEBHOOK_SECRET) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(WEBHOOK_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function sendTelegramMessage(chatId: number, text: string) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (error) {
    console.error("[telegram] reply failed:", error);
  }
}

const repository = createVenueRepository(createSupabaseServiceClient());
const completeJson = createLlmVenueCompleter();
const allowedChatIds = getTelegramAllowedChatIds();
const fetchPhotos = createTelegramPhotoFetcher(BOT_TOKEN);

const batcher = createVenueBatcher({
  completeJson,
  repository,
  fetchPhotos,
  sendMessage: sendTelegramMessage,
  quietMs: Number(process.env.BATCH_QUIET_MS || 45_000),
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== "POST" || url.pathname !== WEBHOOK_PATH) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
    return;
  }

  if (!secretMatches(req.headers["x-telegram-bot-api-secret-token"] as string | null)) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  try {
    const update = JSON.parse(body) as TelegramUpdate;
    const chatId = update.message?.chat?.id;

    // Fast path: acknowledge instantly, then merge a burst of messages into
    // one venue draft after a quiet period (see venue-batch).
    const parsed = parseTelegramVenueUpdate(update);
    if (parsed.status === "ignored") {
      if (chatId) {
        await sendTelegramMessage(
          chatId,
          `⏭️ 已忽略：${parsed.reason ?? "唔係有效貼文"}`,
        );
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, status: "ignored" }));
      return;
    }

    if (
      allowedChatIds.length > 0 &&
      !allowedChatIds.includes(parsed.chatId)
    ) {
      await sendTelegramMessage(parsed.chatId, "🚫 呢個 chat 未獲授權。");
      res.writeHead(403, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "forbidden" }));
      return;
    }

    const { isFirst } = batcher.enqueue(update);
    if (isFirst) {
      await sendTelegramMessage(
        parsed.chatId,
        "📥 收到，收集中… 傳完晒所有圖/文字，我會自動合併成一筆場地（約 45 秒）。",
      );
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, status: "queued" }));
  } catch (error) {
    console.error("[telegram-intake] processing failed:", error);
    const chatId = (() => {
      try {
        return (JSON.parse(body) as TelegramUpdate)?.message?.chat?.id;
      } catch {
        return undefined;
      }
    })();
    if (chatId) {
      await sendTelegramMessage(chatId, "⚠️ 處理貼文時出錯，我會再跟進。");
    }
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "intake_processing_failed" }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[telegram-webhook] ready on http://0.0.0.0:${PORT}${WEBHOOK_PATH}`);
});
