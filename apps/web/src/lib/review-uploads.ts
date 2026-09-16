import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { expectOk, supabaseRest } from "./supabase-rest.js";

// 審核頁手動上傳（候補相片、場地相關圖）。
// - 限制大小：相片太細冇意義、太大會爆 Vercel 4.5MB request limit。
// - 只容許 JPEG/PNG/WEBP，避免可執行檔或 vector 重編碼引入風險。
// - 檔名只用作 content-disposition / metadata，唔可以做路徑一部分。
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB
const MIN_UPLOAD_BYTES = 256;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export type UploadValidation =
  | { ok: true; mime: string }
  | {
      ok: false;
      reason:
        | "too_small"
        | "too_large"
        | "bad_mime"
        | "bad_name";
    };

export function validateUpload(file: File): UploadValidation {
  if (!file || typeof file.size !== "number") {
    return { ok: false, reason: "bad_mime" };
  }
  if (file.size < MIN_UPLOAD_BYTES) {
    return { ok: false, reason: "too_small" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return { ok: false, reason: "bad_mime" };
  }
  // 檔名只可以係普通 basename；拒絕 path traversal 或奇怪字符。
  const name = file.name || "upload";
  if (
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("..") ||
    /[\x00-\x1f]/.test(name)
  ) {
    return { ok: false, reason: "bad_name" };
  }
  return { ok: true, mime };
}

export const MANUAL_PHOTO_BUCKET = "venue-photos";

export interface UploadOutcome {
  storageKey: string;
  mime: string;
  bytes: number;
}

export interface UploadFailure {
  status: number;
  reason: string;
}

// 上傳到 Supabase Storage private bucket。
// service role client 用嚟避開 anon policy；UI route 必須先檢查 review cookie。
export async function uploadManualPhoto(
  supabase: SupabaseClient,
  file: File,
): Promise<UploadOutcome | UploadFailure> {
  const v = validateUpload(file);
  if (!v.ok) {
    const status =
      v.reason === "too_large" ? 413 : v.reason === "too_small" ? 400 : 415;
    return { status, reason: v.reason };
  }

  const storageKey = randomUUID();
  const arrayBuffer = await file.arrayBuffer();
  // Bypass supabase-js storage client. Supabase Storage REST upload:
  // POST /storage/v1/object/{bucket}/{key} with the raw binary body.
  const res = await supabaseRest(
    `/storage/v1/object/${MANUAL_PHOTO_BUCKET}/${encodeURIComponent(storageKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": v.mime,
        "Cache-Control": "31536000, immutable",
        "x-upsert": "false",
      },
      body: new Uint8Array(arrayBuffer),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { status: 502, reason: `storage upload ${res.status}: ${body.slice(0, 200)}` };
  }
  return { storageKey, mime: v.mime, bytes: file.size };
}

// 將 storage / supabase 錯誤統一翻譯做 HTTP response。
export function classifyUploadError(err: unknown): { status: number; reason: string } {
  const message = err instanceof Error ? err.message : "upload_failed";
  if (/bucket/i.test(message) || /storage/i.test(message)) {
    return { status: 502, reason: message };
  }
  return { status: 500, reason: message };
}
