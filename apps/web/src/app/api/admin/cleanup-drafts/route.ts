import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { REVIEW_COOKIE_NAME, isSessionValid } from "../../../../lib/review-auth.js";
import {
  CLEANUP_CONFIRMATION,
  MAX_CLEANUP_IDS,
  getCleanupBlockers,
  parseCleanupIds,
  type CleanupDraftRow,
} from "../../../../lib/cleanup-drafts.js";
import { expectOk, supabaseRest } from "../../../../lib/supabase-rest.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAuthorized(request: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(REVIEW_COOKIE_NAME)?.value;
  if (isSessionValid(token)) return true;

  const expected =
    process.env.DIAG_SECRET ??
    process.env.REVIEW_SECRET ??
    process.env.TELEGRAM_WEBHOOK_SECRET ??
    null;
  if (!expected) return false;

  const headerSecret =
    request.headers.get("x-diag-secret") ??
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ??
    null;
  return headerSecret === expected;
}

// Admin-only, ID-scoped hard delete for review drafts.
//
// The browser flow (review session cookie) first moves an approved draft to
// `rejected`, then shows it in the "已下架" tab. This endpoint only deletes
// rows that are already rejected, so a stale or malicious request cannot
// remove live listings directly.
export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { ids?: unknown; confirm?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  }

  const ids = parseCleanupIds(body.ids);
  if (!ids) {
    return NextResponse.json(
      { ok: false, error: "bad_ids", maxIds: MAX_CLEANUP_IDS },
      { status: 400 },
    );
  }

  const listPath =
    `/rest/v1/venue_drafts?id=in.(${ids.join(",")})` +
    "&select=id,title,district,area_type,status,intake_item_id,last_reviewed_at";
  const listRes = await supabaseRest(listPath);
  await expectOk(listRes, "cleanup-drafts:list");
  const rows = (await listRes.json()) as CleanupDraftRow[];
  const blockers = getCleanupBlockers(ids, rows);

  if (body.confirm !== CLEANUP_CONFIRMATION) {
    return NextResponse.json({
      ok: true,
      mode: "dry_run",
      requestedIds: ids,
      rows,
      blockers,
      deletable: blockers.length === 0,
      hint:
        `Send confirm=\"${CLEANUP_CONFIRMATION}\" to permanently delete ` +
        "the requested rejected drafts. There is no undo.",
    });
  }

  if (blockers.length > 0) {
    return NextResponse.json(
      { ok: false, error: "not_deletable", blockers, rows },
      { status: 409 },
    );
  }

  const deleteRes = await supabaseRest(
    `/rest/v1/venue_drafts?id=in.(${ids.join(",")})&status=eq.rejected`,
    { method: "DELETE" },
  );
  await expectOk(deleteRes, "cleanup-drafts:delete");

  const orphanedIntakeIds = Array.from(
    new Set(
      rows
        .map((row) => row.intake_item_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  console.log(`[cleanup-drafts] deleted ${ids.length} rejected venue_drafts rows`);

  return NextResponse.json({
    ok: true,
    mode: "delete",
    deleted: ids.length,
    deletedIds: ids,
    orphanedIntakeIds,
  });
}
