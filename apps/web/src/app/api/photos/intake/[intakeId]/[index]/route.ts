import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { REVIEW_COOKIE_NAME, isSessionValid } from "../../../../../../lib/review-auth.js";
import { PhotoError, getIntakePhoto } from "../../../../../../lib/photo-service.js";
import { createSupabaseServiceClient } from "../../../../../../lib/venue-repository.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ intakeId: string; index: string }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(REVIEW_COOKIE_NAME)?.value;
  if (!isSessionValid(token)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { intakeId, index } = await ctx.params;
  if (!UUID_RE.test(intakeId)) {
    return new NextResponse("Not found", { status: 404 });
  }

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return new NextResponse("Server not configured", { status: 503 });
  }

  try {
    const photo = await getIntakePhoto(
      supabase,
      process.env.TELEGRAM_BOT_TOKEN,
      intakeId,
      index,
    );
    return new NextResponse(new Uint8Array(photo.buffer), {
      status: 200,
      headers: {
        "content-type": photo.mimeType,
        // 審核相唔快取（含未公開資料）。
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof PhotoError) {
      const status =
        error.code === "no_bot_token" || error.code === "upstream_failed"
          ? 502
          : 404;
      return new NextResponse(error.message, { status });
    }
    console.error("[photo-intake] failed:", error);
    return new NextResponse("Failed", { status: 500 });
  }
}
