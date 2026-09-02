import type { SupabaseClient } from "@supabase/supabase-js";
import { downloadTelegramPhoto } from "./telegram-photo.js";

export class PhotoError extends Error {
  constructor(
    public code: "not_found" | "no_bot_token" | "upstream_failed",
    message: string,
  ) {
    super(message);
    this.name = "PhotoError";
  }
}

interface PhotoFileIdsRow {
  photo_file_ids: string[] | null;
}

function parseIndex(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// 公開 listing 相：只可以攞 approved 草稿嘅相。
// 核對 draft 存在＋狀態，再攞所屬 intake 嘅相。
export async function getListingPhoto(
  supabase: SupabaseClient,
  botToken: string | undefined,
  draftId: string,
  indexRaw: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const index = parseIndex(indexRaw);
  if (index === null) {
    throw new PhotoError("not_found", "bad index");
  }

  const { data: draft, error: draftError } = await supabase
    .from("venue_drafts")
    .select("id, status, intake_item_id")
    .eq("id", draftId)
    .eq("status", "approved")
    .maybeSingle<{ id: string; status: string; intake_item_id: string | null }>();

  if (draftError) {
    throw new PhotoError("upstream_failed", draftError.message);
  }
  if (!draft || !draft.intake_item_id) {
    throw new PhotoError("not_found", "listing not found or not approved");
  }

  return getIntakePhoto(supabase, botToken, draft.intake_item_id, indexRaw);
}

// 審核相：直接由 intake 攞（route 層已驗 review cookie）。
export async function getIntakePhoto(
  supabase: SupabaseClient,
  botToken: string | undefined,
  intakeId: string,
  indexRaw: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const index = parseIndex(indexRaw);
  if (index === null) {
    throw new PhotoError("not_found", "bad index");
  }

  const { data, error } = await supabase
    .from("intake_items")
    .select("photo_file_ids")
    .eq("id", intakeId)
    .maybeSingle<PhotoFileIdsRow>();

  if (error) {
    throw new PhotoError("upstream_failed", error.message);
  }
  const fileIds = data?.photo_file_ids ?? [];
  const fileId = fileIds[index];
  if (!fileId) {
    throw new PhotoError("not_found", "photo index out of range");
  }

  if (!botToken) {
    throw new PhotoError("no_bot_token", "missing bot token");
  }

  try {
    return await downloadTelegramPhoto(botToken, fileId);
  } catch (e) {
    throw new PhotoError(
      "upstream_failed",
      e instanceof Error ? e.message : "photo download failed",
    );
  }
}
