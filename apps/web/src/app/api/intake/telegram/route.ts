import { NextResponse } from "next/server";
import {
  assertTelegramWebhookSecret,
  getTelegramAllowedChatIds,
} from "../../../../lib/env";
import { createLlmVenueCompleter } from "../../../../lib/llm-venue-completer";
import { processTelegramIntake } from "../../../../lib/telegram-intake-service";
import { parseTelegramVenueUpdate, type TelegramUpdate } from "../../../../lib/telegram-parser";
import { createTelegramPhotoFetcher } from "../../../../lib/telegram-photo";
import {
  createSupabaseServiceClient,
  createVenueRepository,
} from "../../../../lib/venue-repository";
import { sendTelegramReply } from "../../../../lib/telegram-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel serverless：容許 vision OCR 完整時間，避免 60 秒 timeout。
export const maxDuration = 60;

// In-memory dedupe: Telegram retries failed webhooks on a backoff (~1 min
// default). We short-circuit duplicate update_ids so the user does not see
// the same ack twice on the same warm instance. Combined with "never 5xx"
// below, the retry loop is broken even when retries land on a fresh
// instance — Telegram only retries on 5xx, so a 200 always stops the loop.
const RECENT_UPDATES = new Map<number, number>();
const DEDUPE_TTL_MS = 10 * 60 * 1000;

function isUpdateProcessed(updateId: number): boolean {
  const now = Date.now();
  for (const [id, ts] of RECENT_UPDATES) {
    if (now - ts > DEDUPE_TTL_MS) RECENT_UPDATES.delete(id);
  }
  if (RECENT_UPDATES.has(updateId)) return true;
  RECENT_UPDATES.set(updateId, now);
  return false;
}

export async function POST(request: Request) {
  const secretHeader = request.headers.get(
    "x-telegram-bot-api-secret-token",
  );

  if (!assertTelegramWebhookSecret(secretHeader)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  try {
    const update = (await request.json()) as TelegramUpdate;

    // Dedupe retries. Telegram re-delivers the same update_id on 5xx with
    // an exponential backoff (~1 min by default); we short-circuit here so
    // the user never sees the ack twice.
    if (typeof update.update_id === "number" && isUpdateProcessed(update.update_id)) {
      console.log(`[telegram-intake] skip duplicate update_id=${update.update_id}`);
      return NextResponse.json({ ok: true, deduplicated: true });
    }

    // 預先 parse 一次，等可以即刻回「📥 收到」；若本身係 ignored / forbidden，
    // 由 processTelegramIntake 入面再決定覆乜。
    const earlyParse = parseTelegramVenueUpdate(update);
    if (earlyParse.status !== "ignored") {
      const allowed = getTelegramAllowedChatIds();
      if (allowed.length === 0 || allowed.includes(earlyParse.chatId)) {
        // 即刻回 ack，唔阻 webhook 200。Fire-and-forget。
        void sendTelegramReply(
          earlyParse.chatId,
          "📥 收到，正在用 AI 解析緊場地資料（相片 + 文字，通常 10–20 秒）…",
        );
      }
    }

    const repository = createVenueRepository(createSupabaseServiceClient());
    const completeJson = createLlmVenueCompleter();
    const fetchPhotos = createTelegramPhotoFetcher(process.env.TELEGRAM_BOT_TOKEN);

    let result;
    try {
      result = await processTelegramIntake({
        update,
        completeJson,
        repository,
        allowedChatIds: getTelegramAllowedChatIds(),
        fetchPhotos,
      });
    } catch (intakeErr) {
      console.error("[telegram-intake] processing failed:", intakeErr);
      if (earlyParse.status !== "ignored") {
        void sendTelegramReply(
          earlyParse.chatId,
          "❌ AI 處理失敗，請稍後重試或聯絡管理員。",
        );
      }
      // Always return 200 — Telegram only retries on 5xx, so we MUST NOT 500
      // here or the same ack will fire again on the next retry tick.
      return NextResponse.json({ ok: true, status: "intake_failed" });
    }

    // 處理完再覆用戶摘要
    if (earlyParse.status !== "ignored") {
      const allowed = getTelegramAllowedChatIds();
      if (allowed.length === 0 || allowed.includes(earlyParse.chatId)) {
        const chatId = earlyParse.chatId;
        console.log(`[intake-route] result.status=${result.status} venueCount=${result.venueCount} reason=${result.reason ?? "(none)"}`);
        try {
          if (result.status === "saved" && (result.venueCount ?? 0) > 0) {
            console.log("[intake-route] sending ✅ reply");
            await sendTelegramReply(
              chatId,
              `✅ 已儲存 ${result.venueCount} 筆場地草稿（待審核），去 /review 就可以審。`,
            );
          } else if (result.status === "skipped") {
            console.log("[intake-route] sending 📭 reply");
            // 將 AI 嘅實際原因加入回覆，用戶可以即時理解點解判斷唔係場地。
            const reason = result.reason
              ? `\n\n原因：${result.reason}`
              : "";
            await sendTelegramReply(
              chatId,
              `📭 收到呢批資料，但睇唔落係場地招租資訊，已標記待你確認。${reason}`,
            );
          } else if (result.status === "forbidden") {
            console.log("[intake-route] sending 🚫 reply");
            await sendTelegramReply(chatId, "🚫 呢個 chat 未獲授權。");
          } else {
            console.log(`[intake-route] no matching reply branch for status=${result.status}`);
          }
        } catch (replyErr) {
          console.error("[intake-route] final reply delivery failed:", replyErr);
        }
      }
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    // Outer safety net: even if our own handler crashes before responding,
    // we MUST return 200 to Telegram so it does not retry the same update_id
    // forever. The real cause is already logged above.
    console.error("[telegram-intake] handler crashed:", error);
    return NextResponse.json({ ok: true, status: "handler_crashed" });
  }
}
