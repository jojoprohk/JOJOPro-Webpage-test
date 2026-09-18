import { NextResponse, type NextRequest } from "next/server";
import { PhotoError, getListingPhoto } from "../../../../../../lib/photo-service.js";
import { createSupabaseServiceClient } from "../../../../../../lib/venue-repository.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string; index: string }> },
) {
  const { id, index } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return new NextResponse("Not found", { status: 404 });
  }

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return new NextResponse("Server not configured", { status: 503 });
  }

  try {
    const photo = await getListingPhoto(
      supabase,
      process.env.TELEGRAM_BOT_TOKEN,
      id,
      index,
    );
    return new NextResponse(new Uint8Array(photo.buffer), {
      status: 200,
      headers: {
        "content-type": photo.mimeType,
        // Listing photos are served via a serverless route and can change
        // any time an admin updates the venue (e.g. new Telegram photo,
        // review upload, stock fallback swap). Never let a shared cache
        // (Vercel CDN, browser) pin stale bytes — every request must
        // re-fetch from Supabase / Telegram.
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
    console.error("[photo-listing] failed:", error);
    return new NextResponse("Failed", { status: 500 });
  }
}
