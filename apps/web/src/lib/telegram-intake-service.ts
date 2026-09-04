import {
  parseVenuePost,
  type IntakeInput,
  type JsonCompleter,
  type ParseResult,
} from "@jojopro/ai";
import {
  parseTelegramVenueUpdate,
  type TelegramUpdate,
} from "./telegram-parser.js";
import type { VenueRepository } from "./venue-repository.js";

export interface TelegramPhoto {
  base64: string;
  mimeType: string;
}

export type TelegramPhotoFetcher =
  (fileIds: string[]) => Promise<TelegramPhoto[]>;

export interface TelegramIntakeResult {
  status: "saved" | "skipped" | "ignored" | "forbidden";
  intakeItemId?: string;
  venueDraftIds?: string[];
  venueCount?: number;
  parseStatus?: ParseResult["status"];
  reason?: string;
}

interface ProcessTelegramIntakeDeps {
  update: TelegramUpdate;
  parseTelegramUpdate?: typeof parseTelegramVenueUpdate;
  parseVenue?: typeof parseVenuePost;
  completeJson: JsonCompleter;
  repository: VenueRepository;
  allowedChatIds?: number[];
  fetchPhotos?: TelegramPhotoFetcher;
}

export async function processTelegramIntake({
  update,
  parseTelegramUpdate = parseTelegramVenueUpdate,
  parseVenue = parseVenuePost,
  completeJson,
  repository,
  allowedChatIds = [],
  fetchPhotos,
}: ProcessTelegramIntakeDeps): Promise<TelegramIntakeResult> {
  const parsedUpdate = parseTelegramUpdate(update);

  if (parsedUpdate.status === "ignored") {
    return {
      status: "ignored",
      reason: parsedUpdate.reason,
    };
  }

  if (
    allowedChatIds.length > 0 &&
    !allowedChatIds.includes(parsedUpdate.chatId)
  ) {
    return {
      status: "forbidden",
      reason: "Telegram chat 未獲授權。",
    };
  }

  // Download photos (if any) so the vision model can OCR venue details.
  const photoFileIds = parsedUpdate.input.photoFileIds ?? [];
  let images = parsedUpdate.input.images;
  if (photoFileIds.length > 0 && fetchPhotos && !images) {
    images = await fetchPhotos(photoFileIds);
  }

  const parseResult = await parseVenue(
    { ...parsedUpdate.input, images },
    completeJson,
  );

  // 非場地 / 全部屬代放：只記低原始訊息，唔產生草稿。
  if (parseResult.status === "rejected") {
    const saved = await repository.saveIntakeOnly(parsedUpdate.input);
    return {
      status: "skipped",
      intakeItemId: saved.intakeItemId,
      parseStatus: parseResult.status,
      reason: parseResult.reviewNote,
    };
  }

  const saved = await repository.saveIntakeAndDrafts(
    parsedUpdate.input,
    parseResult,
  );

  return {
    status: "saved",
    intakeItemId: saved.intakeItemId,
    venueDraftIds: saved.venueDraftIds,
    venueCount: saved.venueDraftIds.length,
    parseStatus: parseResult.status,
  };
}
