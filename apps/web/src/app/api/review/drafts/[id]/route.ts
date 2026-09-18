import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { REVIEW_COOKIE_NAME, isSessionValid } from "../../../../../lib/review-auth";
import {
  buildDraftUpdate,
  createReviewRepository,
  type ReviewAction,
} from "../../../../../lib/review-repository";
import { createSupabaseServiceClient } from "../../../../../lib/venue-repository";
import { coerceVenuePhotos } from "../../../../../lib/draft-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(REVIEW_COOKIE_NAME)?.value;
  if (!isSessionValid(token)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: {
    action?: unknown;
    fields?: unknown;
    reviewNote?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  }

  const action = body.action;
  if (
    action !== "approve" &&
    action !== "reject" &&
    action !== "save" &&
    action !== "toggle_featured"
  ) {
    return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
  }

  const rawFields =
    body.fields && typeof body.fields === "object" && !Array.isArray(body.fields)
      ? (body.fields as Record<string, unknown>)
      : undefined;
  // photos 係結構化陣列，要專門驗證；唔合格就棄用，唔接受任意物件。
  const fields: Record<string, unknown> | undefined = rawFields
    ? (() => {
        const out: Record<string, unknown> = { ...rawFields };
        if ("photos" in out) {
          const photos = coerceVenuePhotos(out.photos);
          if (photos === null) {
            delete out.photos;
          } else {
            out.photos = photos;
          }
        }
        return out;
      })()
    : undefined;
  const reviewNote =
    typeof body.reviewNote === "string" ? body.reviewNote : undefined;

  const row = buildDraftUpdate(
    action as ReviewAction,
    fields,
    reviewNote,
    new Date().toISOString(),
  );

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
    await repository.updateDraft(id, row);

    // toggle_featured 後即時 enforce 5 個 featured window，
    // 防止 admin 重覆 click / hand-edit 產生超過 5 個 featured。
    // RPC 係 idempotent，no-op when 已係 <= 5。
    if (action === "toggle_featured") {
      try {
        const demoted = await repository.enforceFeaturedWindow();
        if (demoted > 0) {
          console.log(
            `[review-draft] featured-window demoted ${demoted} row(s)`,
          );
        }
      } catch (windowErr) {
        // Non-fatal: toggle 本身已成功，視窗約束只係 housekeeping。
        console.warn(
          "[review-draft] enforceFeaturedWindow failed (non-fatal):",
          windowErr,
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[review-draft] update failed:", error);
    return NextResponse.json(
      { ok: false, error: "update_failed" },
      { status: 500 },
    );
  }
}
