import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only diagnostic for the Telegram bot. Calls Telegram's getMe to
// confirm the token currently in env is valid AND to report the bot
// username / ID. Useful after BotFather /revoke to verify the deploy
// is using the new token (token prefix in logs/responses will differ).
//
// Auth: header-only (x-diag-secret or Authorization: Bearer). Same env
// fallback order as the LLM diag: DIAG_SECRET → REVIEW_SECRET →
// TELEGRAM_WEBHOOK_SECRET. Fail-closed when unset.
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

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN not set" },
      { status: 500 },
    );
  }

  // Call Telegram getMe. Never log or return the token itself — only a
  // 6-char prefix (first 6 of the numeric part) so the operator can
  // eyeball whether it's the new token vs the old one.
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getMe`,
      { cache: "no-store" },
    );
    const data = (await res.json().catch(() => null)) as
      | { ok: true; result: { id: number; username: string; first_name: string } }
      | { ok: false; error_code?: number; description?: string }
      | null;
    if (!res.ok || !data || data.ok !== true) {
      return NextResponse.json(
        {
          ok: false,
          httpStatus: res.status,
          error: (data && "description" in data ? data.description : null) ?? "unknown",
          tokenPrefix: `${token.split(":")[0]?.slice(0, 6) ?? "?"}***`,
          tokenLength: token.length,
        },
        { status: 200 },
      );
    }
    return NextResponse.json({
      ok: true,
      bot: {
        id: data.result.id,
        username: data.result.username,
        firstName: data.result.first_name,
      },
      tokenPrefix: `${token.split(":")[0]?.slice(0, 6) ?? "?"}***`,
      tokenLength: token.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        tokenPrefix: `${token.split(":")[0]?.slice(0, 6) ?? "?"}***`,
        tokenLength: token.length,
      },
      { status: 200 },
    );
  }
}
