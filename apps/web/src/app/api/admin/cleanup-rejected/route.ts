import { NextResponse } from "next/server";
import { expectOk, supabaseRest } from "../../../../lib/supabase-rest.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-shot admin endpoint for purging rejected venue_drafts.
//
// Auth: header-only (x-diag-secret or Authorization: Bearer). Same env
// fallback chain as /api/diag/bot (DIAG_SECRET -> REVIEW_SECRET ->
// TELEGRAM_WEBHOOK_SECRET). Fail-closed when unset.
//
// Modes:
//   GET /api/admin/cleanup-rejected
//     -> DRY RUN. Returns the list of rejected drafts that WOULD be
//        deleted. Nothing is mutated.
//   GET /api/admin/cleanup-rejected?confirm=YES_DELETE
//     -> ACTUAL DELETE. Removes every venue_drafts row with
//        status = 'rejected'. Returns the list of deleted IDs.
//
// CASCADE NOTE: venue_drafts.intake_item_id references intake_items.id
// with ON DELETE CASCADE in the OTHER direction (intake -> drafts). So
// deleting a draft leaves its linked intake_item alive (just orphaned).
// Orphan cleanup is intentionally NOT done here -- operators can run a
// follow-up query after confirming the audit numbers.
export async function GET(request: Request) {
  const expected =
    process.env.DIAG_SECRET ??
    process.env.REVIEW_SECRET ??
    process.env.TELEGRAM_WEBHOOK_SECRET ??
    null;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "server_misconfigured" },
      { status: 500 },
    );
  }
  const headerSecret =
    request.headers.get("x-diag-secret") ??
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ??
    null;
  if (headerSecret !== expected) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const confirmed = url.searchParams.get("confirm") === "YES_DELETE";

  // Step 1: list the rejected drafts so we know what we're touching.
  // Keep the query narrow -- we don't want to materialize the full photos
  // jsonb or raw_content blobs over the wire just to count rows.
  const listRes = await supabaseRest(
    "/rest/v1/venue_drafts?status=eq.rejected&select=id,title,district,area_type,last_reviewed_at,intake_item_id",
  );
  await expectOk(listRes, "cleanup-rejected:list");
  const drafts = (await listRes.json()) as Array<{
    id: string;
    title: string | null;
    district: string | null;
    area_type: string | null;
    last_reviewed_at: string | null;
    intake_item_id: string | null;
  }>;

  if (!confirmed) {
    return NextResponse.json({
      ok: true,
      mode: "dry_run",
      rejectedCount: drafts.length,
      rejectedDrafts: drafts,
      hint: "Append ?confirm=YES_DELETE to actually DELETE these rows. There is no undo.",
    });
  }

  if (drafts.length === 0) {
    return NextResponse.json({
      ok: true,
      mode: "delete",
      deleted: 0,
      deletedIds: [],
    });
  }

  // Step 2: delete in one shot. PostgREST accepts `id=in.(uuid,uuid,...)`
  // with literal commas in the URL grammar -- DO NOT encodeURIComponent
  // (would turn commas into %2C and trigger PGRST125). UUIDs are ASCII
  // so they're safe in the URL path.
  const ids = drafts.map((d) => d.id);
  const idsCsv = ids.join(",");
  const delRes = await supabaseRest(
    `/rest/v1/venue_drafts?id=in.(${idsCsv})`,
    { method: "DELETE" },
  );
  await expectOk(delRes, "cleanup-rejected:delete");

  console.log(
    `[cleanup-rejected] deleted ${ids.length} rejected venue_drafts rows`,
  );

  return NextResponse.json({
    ok: true,
    mode: "delete",
    deleted: ids.length,
    deletedIds: ids,
    // Surface the orphaned intake_item_ids so the operator can decide
    // whether to clean those up in a follow-up pass.
    orphanedIntakeIds: Array.from(
      new Set(
        drafts
          .map((d) => d.intake_item_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ),
  });
}
