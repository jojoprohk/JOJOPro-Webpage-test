import {
  parseVenuePost,
  type IntakeInput,
  type JsonCompleter,
  type ParseResult,
  type VenueDraftEntry,
} from "@jopojo/ai";
import { parseTelegramVenueUpdate } from "../apps/web/src/lib/telegram-parser";
import type { TelegramUpdate } from "../apps/web/src/lib/telegram-parser";
import type { VenueRepository } from "../apps/web/src/lib/venue-repository";
import type { TelegramPhotoFetcher } from "../apps/web/src/lib/telegram-intake-service";

interface BatchEntry {
  input: IntakeInput;
}

interface ChatBatch {
  chatId: number;
  entries: BatchEntry[];
  timer: ReturnType<typeof setTimeout>;
}

export interface BatchDeps {
  completeJson: JsonCompleter;
  repository: VenueRepository;
  fetchPhotos: TelegramPhotoFetcher;
  sendMessage: (chatId: number, text: string) => Promise<void>;
  quietMs?: number;
}

// Groups messages that arrive within a quiet window. Mercy sends a venue as
// several photos/text in a burst; we merge the whole burst into ONE intake,
// then split it into one-or-more venue drafts.
export function createVenueBatcher({
  completeJson,
  repository,
  fetchPhotos,
  sendMessage,
  quietMs = 90_000,
}: BatchDeps) {
  const batches = new Map<number, ChatBatch>();

  function enqueue(update: TelegramUpdate): { isFirst: boolean } {
    const parsed = parseTelegramVenueUpdate(update);
    if (parsed.status === "ignored") return { isFirst: false };

    const chatId = parsed.chatId;
    const existing = batches.get(chatId);
    const isFirst = !existing;
    if (existing) clearTimeout(existing.timer);

    const batch: ChatBatch = existing ?? {
      chatId,
      entries: [],
      timer: null as never,
    };
    batch.entries.push({ input: parsed.input });

    batch.timer = setTimeout(() => {
      batches.delete(chatId);
      void flush(chatId, batch.entries);
    }, quietMs);

    batches.set(chatId, batch);
    return { isFirst };
  }

  function venueLine(entry: VenueDraftEntry, index: number): string {
    const d = entry.draft;
    const dateNote =
      entry.unconfirmedFields.includes("startDate") ||
      entry.unconfirmedFields.includes("endDate")
        ? "（日期待你核對）"
        : "";
    const dateLine =
      d.sessionDates.length > 0
        ? `開檔 ${d.sessionDates.length} 日（${d.sessionDates[0]} 至 ${
            d.sessionDates[d.sessionDates.length - 1]
          }）${dateNote}`
        : d.startDate
          ? `日期 ${d.startDate}${
              d.endDate && d.endDate !== d.startDate ? ` 至 ${d.endDate}` : ""
            }${dateNote}`
          : "日期未提供";
    return [
      `${index + 1}. ${d.title}`,
      d.district ? `   地區：${d.district}` : "",
      `   ${dateLine}`,
      d.boothSizeText ? `   檔位：${d.boothSizeText}` : "",
      d.priceText
        ? `   價錢：${d.priceText}`
        : "   價錢：未列明（建議直接聯絡業主/出租負責人）",
      d.contactText ? `   聯絡：${d.contactText}` : "   聯絡：未提供",
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function flush(chatId: number, entries: BatchEntry[]) {
    try {
      if (entries.length === 0) return;
      // Merge: concatenate text/caption, collect all photo file ids.
      const photoFileIds = entries.flatMap((e) => e.input.photoFileIds ?? []);
      const texts = entries
        .map((e) => e.input.rawContent)
        .filter((t) => t && t !== "[圖片]");

      const first = entries[0].input;
      const merged: IntakeInput = {
        rawContent: texts.join("\n---\n") || "[圖片]",
        sourceType: first.sourceType,
        sourceLabel: first.sourceLabel,
        sourceUrl: entries.map((e) => e.input.sourceUrl).find(Boolean),
        receivedAt: new Date().toISOString(),
        photoFileIds: photoFileIds.length > 0 ? photoFileIds : undefined,
      };

      let images: { base64: string; mimeType: string }[] | undefined;
      if (photoFileIds.length > 0) {
        images = await fetchPhotos(photoFileIds);
      }

      const parseResult: ParseResult = await parseVenuePost(
        { ...merged, images },
        completeJson,
      );

      // 非場地，或全部場地都屬代放：只記低原始訊息，唔產生草稿。
      if (parseResult.status === "rejected") {
        await repository.saveIntakeOnly(merged);
        if (parseResult.allAgentListings) {
          await sendMessage(
            chatId,
            [
              "🚫 呢批場地全部屬「代放」代理資訊，唔係業主直接發布。為咗資料準確同誠信，我已全部跳過、唔收錄做場地草稿。",
              "如果你想收錄，建議直接聯絡業主/場地出租負責人，攞到一手資料再傳過嚟。",
            ].join("\n"),
          );
        } else {
          await sendMessage(
            chatId,
            "📭 收到呢批資料，但睇唔落係場地資訊，已標記待你確認。",
          );
        }
        return;
      }

      const saved = await repository.saveIntakeAndDrafts(merged, parseResult);

      const lines: string[] = [
        `✅ 已整合呢批資料，存為 ${saved.venueDraftIds.length} 筆場地草稿（待審核）：`,
        "",
        ...parseResult.entries.map((entry, i) => venueLine(entry, i)),
      ];

      if (parseResult.reviewNote) {
        lines.push("", `ℹ️ ${parseResult.reviewNote}`);
      }

      await sendMessage(chatId, lines.join("\n"));
    } catch (error) {
      console.error("[venue-batch] flush failed:", error);
      await sendMessage(chatId, "⚠️ 整合呢批資料時出錯，我會再跟進。");
    }
  }

  return { enqueue };
}
