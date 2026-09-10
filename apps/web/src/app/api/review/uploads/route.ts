import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  REVIEW_COOKIE_NAME,
  isSessionValid,
} from "../../../../lib/review-auth.js";
import { createSupabaseServiceClient } from "../../../../lib/venue-repository.js";
import {
  classifyUploadError,
  uploadManualPhoto,
} from "../../../../lib/review-uploads.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 容許近 4MB 圖片（Vercel Hobby 預設 4.5MB）。
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(REVIEW_COOKIE_NAME)?.value;
  if (!isSessionValid(token)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_form" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "missing_file" },
      { status: 400 },
    );
  }

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return NextResponse.json(
      { ok: false, error: "server_not_configured" },
      { status: 503 },
    );
  }

  try {
    const result = await uploadManualPhoto(supabase, file);
    if ("status" in result) {
      return NextResponse.json(
        { ok: false, error: result.reason },
        { status: result.status },
      );
    }
    return NextResponse.json({
      ok: true,
      storageKey: result.storageKey,
      mime: result.mime,
      bytes: result.bytes,
    });
  } catch (error) {
    const fail = classifyUploadError(error);
    return NextResponse.json(
      { ok: false, error: fail.reason },
      { status: fail.status },
    );
  }
}
