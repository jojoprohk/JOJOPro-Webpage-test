import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only diagnostic. Returns the resolved LLM config + the list of
// models xAI (or whatever baseURL is configured) currently exposes. We
// never echo the API key — only its length and a 4-char prefix.
//
// Auth: pass `x-diag-secret: <REVIEW_SECRET>` (or `Authorization: Bearer
// <secret>`). The env order is DIAG_SECRET → REVIEW_SECRET →
// TELEGRAM_WEBHOOK_SECRET. When no secret is configured the endpoint is
// closed (500 server_misconfigured).
export async function GET(request: Request) {
  // Auth via header only — never put REVIEW_SECRET in a URL query string:
  // it would appear in Vercel access logs, browser history, and the Referer
  // header on any cross-origin request. Order: explicit x-diag-secret header,
  // then Authorization: Bearer, then env.
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

  const apiKey = process.env.LLM_API_KEY;
  const baseURL =
    process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1";
  const envModel = process.env.LLM_MODEL ?? null;

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "no LLM_API_KEY in env",
        baseURL,
        envModel,
      },
      { status: 500 },
    );
  }

  const client = new OpenAI({ apiKey, baseURL });
  try {
    const list = await client.models.list();
    const all = list.data.map((m) => m.id).sort();
    const grok = all.filter((id) => /grok/i.test(id));
    const vision = all.filter((id) => /vision/i.test(id));
    return NextResponse.json({
      ok: true,
      baseURL,
      envModel,
      apiKeyLength: apiKey.length,
      apiKeyPrefix: `${apiKey.slice(0, 4)}***`,
      allCount: all.length,
      grokModels: grok,
      visionModels: vision,
      chainTried: [
        "grok-2-vision-latest",
        "grok-3-vision",
        "grok-4-vision",
        "grok-vision",
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        baseURL,
        envModel,
        apiKeyLength: apiKey.length,
        apiKeyPrefix: `${apiKey.slice(0, 4)}***`,
      },
      { status: 500 },
    );
  }
}
