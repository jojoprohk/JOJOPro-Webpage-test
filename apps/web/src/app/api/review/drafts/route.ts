import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { REVIEW_COOKIE_NAME, isSessionValid } from "../../../../lib/review-auth";
import {
  createReviewRepository,
} from "../../../../lib/review-repository";
import { createSupabaseServiceClient } from "../../../../lib/venue-repository";

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

  let repository;
  try {
    repository = createReviewRepository(createSupabaseServiceClient());
  } catch {
    return NextResponse.json(
      { ok: false, error: "server_not_configured" },
      { status: 503 },
    );
  }
  try {
    const drafts = await repository.listDrafts(status);
    return NextResponse.json({ ok: true, drafts });
  } catch (error) {
    console.error("[review-drafts] list failed:", error);
    return NextResponse.json(
      { ok: false, error: "list_failed" },
      { status: 500 },
    );
  }
}
