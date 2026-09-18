import { NextResponse, type NextRequest } from "next/server";
import { createListingRepository } from "../../../../../lib/listing-repository.js";
import { createSupabaseServiceClient } from "../../../../../lib/venue-repository.js";
import { getClientIp, rateLimit } from "../../../../../lib/rate-limit.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REPORT_LIMIT = { windowSec: 60, max: 5 };

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  }

  // Per-IP rate limit. Backed by Vercel KV (auto-injected when linked
  // via Dashboard → Storage). The helper is fail-open, so missing or
  // broken KV env does not 500 the endpoint -- it just logs a warning
  // and lets the request through until KV is provisioned.
  const ip = getClientIp(request);
  const rl = await rateLimit("report", ip, REPORT_LIMIT);
  if (!rl.allowed) {
    console.warn(
      `[listing-report] rate-limited ip=${ip} count=${rl.count} retry=${rl.retryAfterSec}s`,
    );
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: rl.retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      },
    );
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
