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
  status: "saved" | "ignored";
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
}

export async function processTelegramIntake({
  update,
  parseTelegramUpdate = parseTelegramVenueUpdate,
  parseVenue = parseVenuePost,
  completeJson,
  repository,
}: ProcessTelegramIntakeDeps): Promise<TelegramIntakeResult> {
  const parsedUpdate = parseTelegramUpdate(update);

  if (parsedUpdate.status === "ignored") {
    return {
      status: "ignored",
      reason: parsedUpdate.reason,
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
