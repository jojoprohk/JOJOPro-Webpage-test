import { NextResponse } from "next/server";
import {
  assertTelegramWebhookSecret,
  getTelegramAllowedChatIds,
} from "../../../../lib/env";
import { createOpenAiVenueCompleter } from "../../../../lib/openai-venue-completer";
import { processTelegramIntake } from "../../../../lib/telegram-intake-service";
import type { TelegramUpdate } from "../../../../lib/telegram-parser";
import {
  createSupabaseServiceClient,
  createVenueRepository,
} from "../../../../lib/venue-repository";

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
    const repository = createVenueRepository(createSupabaseServiceClient());
    const completeJson = createOpenAiVenueCompleter();

    const result = await processTelegramIntake({
      update,
      completeJson,
      repository,
      allowedChatIds: getTelegramAllowedChatIds(),
    });

    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json(
      { ok: false, error: "intake_processing_failed" },
      { status: 500 },
    );
  }
}
