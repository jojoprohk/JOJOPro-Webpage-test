import { NextResponse, type NextRequest } from "next/server";
import { createListingRepository } from "../../../../../lib/listing-repository.js";
import { createSupabaseServiceClient } from "../../../../../lib/venue-repository.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  }

  let repository;
  try {
    repository = createListingRepository(createSupabaseServiceClient());
  } catch {
    return NextResponse.json(
      { ok: false, error: "server_not_configured" },
      { status: 503 },
    );
  }

  try {
    const updated = await repository.reportListing(id, new Date().toISOString());
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[listing-report] failed:", error);
    return NextResponse.json(
      { ok: false, error: "report_failed" },
      { status: 500 },
    );
  }
}
