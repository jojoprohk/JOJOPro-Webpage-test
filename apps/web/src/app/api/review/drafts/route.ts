import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { REVIEW_COOKIE_NAME, isSessionValid } from "../../../../lib/review-auth";
import { createSupabaseServiceClient } from "../../../../lib/venue-repository";
import { createReviewRepository } from "../../../../lib/review-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUS = new Set(["needs_review", "approved", "rejected", "published"]);

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(REVIEW_COOKIE_NAME)?.value;
  if (!isSessionValid(token)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get("status") ?? "needs_review";
  if (!ALLOWED_STATUS.has(status)) {
    return NextResponse.json({ ok: false, error: "bad_status" }, { status: 400 });
  }

  // Re-enabled after the PGRST125 (literal-comma) + ByteString (non-ASCII env
  // var) fixes landed. We go through the raw-fetch path inside
  // review-repository.listDrafts so we never touch supabase-js Node 18 fetch.
  try {
    const repository = createReviewRepository(createSupabaseServiceClient());
    const drafts = await repository.listDrafts(status);
    return NextResponse.json({ ok: true, drafts });
  } catch (e) {
    console.error("[review-drafts] list failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "list_failed" },
      { status: 500 },
    );
  }
}
