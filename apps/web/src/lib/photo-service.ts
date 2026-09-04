import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveVenuePhotos, type AreaType, type VenuePhoto } from "@jojopro/ai";
import { readFile } from "node:fs/promises";
import path from "node:path";
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

interface DraftPhotosRow {
  id: string;
  status: string;
  area_type: string;
  photos: VenuePhoto[] | null;
}

function parseIndex(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

const STOCK_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

// stock 相由本地 public/stock 直接讀返（唔經 Telegram）。
async function readStockPhoto(src: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const safe = src.replace(/^\/+/, "");
  const filePath = path.join(process.cwd(), "public", safe);
  // 防 path traversal：確保最終路徑喺 public/stock 入面。
  if (!filePath.startsWith(path.join(process.cwd(), "public", "stock") + path.sep)) {
    throw new PhotoError("not_found", "invalid stock path");
  }
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch (e) {
    // 代表相檔案缺失（例如未生成）→ 當唔存在處理，唔好 500。
    throw new PhotoError(
      "not_found",
      e instanceof Error ? e.message : "stock photo missing",
    );
  }
  const ext = path.extname(filePath).toLowerCase();
  return { buffer, mimeType: STOCK_MIME[ext] ?? "image/jpeg" };
}

// 讀取草稿嘅展示相列表（向後相容：photos 空 → 按 area_type fallback stock）。
async function fetchDraftPhotos(
  supabase: SupabaseClient,
  draftId: string,
  opts: { requireApproved: boolean },
): Promise<{ photos: VenuePhoto[] }> {
  let query = supabase
    .from("venue_drafts")
    .select("id, status, area_type, photos")
    .eq("id", draftId);
  if (opts.requireApproved) {
    query = query.eq("status", "approved");
  }
  const { data, error } = await query.maybeSingle<DraftPhotosRow>();
  if (error) {
    throw new PhotoError("upstream_failed", error.message);
  }
  if (!data) {
    throw new PhotoError("not_found", "draft not found");
  }
  return {
    photos: resolveVenuePhotos(data.photos, (data.area_type as AreaType) ?? "unknown"),
  };
}

// 按展示相 index 取相：stock 讀本地檔，telegram 去 Telegram 下載。
async function serveDraftPhoto(
  supabase: SupabaseClient,
  botToken: string | undefined,
  draftId: string,
  indexRaw: string,
  opts: { requireApproved: boolean },
): Promise<{ buffer: Buffer; mimeType: string }> {
  const index = parseIndex(indexRaw);
  if (index === null) {
    throw new PhotoError("not_found", "bad index");
  }
  const { photos } = await fetchDraftPhotos(supabase, draftId, opts);
  const photo = photos[index];
  if (!photo) {
    throw new PhotoError("not_found", "photo index out of range");
  }
  if (photo.kind === "stock") {
    return readStockPhoto(photo.src);
  }
  // telegram 相
  if (!botToken) {
    throw new PhotoError("no_bot_token", "missing bot token");
  }
  try {
    return await downloadTelegramPhoto(botToken, photo.fileId);
  } catch (e) {
    throw new PhotoError(
      "upstream_failed",
      e instanceof Error ? e.message : "photo download failed",
    );
  }
}

// 公開 listing 相：只可以攞 approved 草稿嘅相。
// 核對 draft 存在＋狀態，再攞所屬 intake 嘅相。
export async function getListingPhoto(
  supabase: SupabaseClient,
  botToken: string | undefined,
  draftId: string,
  indexRaw: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  return serveDraftPhoto(supabase, botToken, draftId, indexRaw, {
    requireApproved: true,
  });
}

// 審核頁草稿相：唔要求 approved（草稿仍係 needs_review），其餘邏輯一樣。
export async function getDraftPhoto(
  supabase: SupabaseClient,
  botToken: string | undefined,
  draftId: string,
  indexRaw: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  return serveDraftPhoto(supabase, botToken, draftId, indexRaw, {
    requireApproved: false,
  });
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
