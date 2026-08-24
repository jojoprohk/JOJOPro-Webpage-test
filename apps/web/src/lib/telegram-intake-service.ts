import {
  parseVenuePost,
  type IntakeInput,
  type JsonCompleter,
  type ParseResult,
} from "@jopojo/ai";
import {
  parseTelegramVenueUpdate,
  type TelegramUpdate,
} from "./telegram-parser.js";
import type { VenueRepository } from "./venue-repository.js";

export interface TelegramIntakeResult {
  status: "saved" | "ignored" | "forbidden";
  intakeItemId?: string;
  venueDraftId?: string;
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
}

export async function processTelegramIntake({
  update,
  parseTelegramUpdate = parseTelegramVenueUpdate,
  parseVenue = parseVenuePost,
  completeJson,
  repository,
  allowedChatIds = [],
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

  const parseResult = await parseVenue(parsedUpdate.input, completeJson);
  const saved = await repository.saveIntakeAndDraft(
    parsedUpdate.input,
    parseResult,
  );

  return {
    status: "saved",
    intakeItemId: saved.intakeItemId,
    venueDraftId: saved.venueDraftId,
    parseStatus: parseResult.status,
  };
}
