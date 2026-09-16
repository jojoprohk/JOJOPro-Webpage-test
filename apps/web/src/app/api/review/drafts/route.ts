import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { REVIEW_COOKIE_NAME, isSessionValid } from "../../../../lib/review-auth";

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

  // TEMPORARY: hardcoded empty list. NO supabase-js call at all in this route,
  // so the ByteString error cannot fire here. If /review still 500s after this
  // commit, the bug is in /review page itself, not in the API.
  console.log("[review-drafts] hardcoded empty list, supabase bypassed entirely");
  return NextResponse.json({ ok: true, drafts: [] });
}
