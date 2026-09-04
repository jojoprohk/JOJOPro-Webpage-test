import { NextResponse } from "next/server";
import {
  assertTelegramWebhookSecret,
  getTelegramAllowedChatIds,
} from "../../../../lib/env";
import { createLlmVenueCompleter } from "../../../../lib/llm-venue-completer";
import { processTelegramIntake } from "../../../../lib/telegram-intake-service";
import { parseTelegramVenueUpdate, type TelegramUpdate } from "../../../../lib/telegram-parser";
import {
  createSupabaseServiceClient,
  createVenueRepository,
} from "../../../../lib/venue-repository";
import { sendTelegramReply } from "../../../../lib/telegram-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const result = await processTelegramIntake({
      update,
      completeJson,
      repository,
      allowedChatIds: getTelegramAllowedChatIds(),
    });

    // 處理完再覆用戶摘要
    if (earlyParse.status !== "ignored") {
      const allowed = getTelegramAllowedChatIds();
      if (allowed.length === 0 || allowed.includes(earlyParse.chatId)) {
        const chatId = earlyParse.chatId;
        console.log(`[intake-route] result.status=${result.status} venueCount=${result.venueCount} reason=${result.reason ?? "(none)"}`);
        if (result.status === "saved" && (result.venueCount ?? 0) > 0) {
          console.log("[intake-route] sending ✅ reply");
          void sendTelegramReply(
            chatId,
            `✅ 已儲存 ${result.venueCount} 筆場地草稿（待審核），去 /review 就可以審。`,
          );
        } else if (result.status === "skipped") {
          console.log("[intake-route] sending 📭 reply");
          void sendTelegramReply(
            chatId,
            "📭 收到呢批資料，但睇唔落係場地資訊，已標記待你確認。",
          );
        } else if (result.status === "forbidden") {
          console.log("[intake-route] sending 🚫 reply");
          void sendTelegramReply(chatId, "🚫 呢個 chat 未獲授權。");
        } else {
          console.log(`[intake-route] no matching reply branch for status=${result.status}`);
        }
      }
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[telegram-intake] processing failed:", error);
    return NextResponse.json(
      { ok: false, error: "intake_processing_failed" },
      { status: 500 },
    );
  }
}
