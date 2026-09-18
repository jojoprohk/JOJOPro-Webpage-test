import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only diagnostic for the Telegram bot. Returns in one curl:
//   - env presence + non-sensitive prefix of TELEGRAM_BOT_TOKEN,
//     TELEGRAM_WHOOK_SECRET, and TELEGRAM_ALLOWED_CHAT_IDS
//   - bot identity via Telegram's getMe (validates the token)
//   - webhook status via Telegram's getWebhookInfo (URL registered,
//     pending_update_count, last_error_date, last_error_message)
//
// Token rotation sanity check: tokenPrefix now shows the first 6 chars
// of the secret portion (after the colon). On BotFather /revoke the
// secret portion changes; the bot ID portion does not. Compare the
// returned prefix against the new token BotFather printed to confirm
// the deploy is using the rotated token.
//
// Auth: header-only (x-diag-secret or Authorization: Bearer). Same env
// fallback order as the LLM diag: DIAG_SECRET → REVIEW_SECRET →
// TELEGRAM_WEBHOOK_SECRET. Fail-closed when unset.
export async function GET(request: Request) {
  // Optional ?register=1 will additionally call Telegram setWebhook
  // to (re)attach our endpoint. Auth still required (header secret
  // is checked below before this branch executes).
  const url = new URL(request.url);
  const wantsRegister = url.searchParams.get("register") === "1";
  // The webhook URL is the production Vercel domain (stable). For
  // preview deploys the URL would change — we deliberately hardcode
  // to prod because production is the only state we ever want the
  // webhook attached to.
  const WEBHOOK_URL =
    "https://jojo-pro-webpage-test-web.vercel.app/api/intake/telegram";
  const ALLOWED_UPDATES = ["message"];

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

  // Surface presence / prefix of every env var the intake path reads.
  // No raw values — just enough to verify "is it set?" and "does the
  // secret prefix line up with what the operator has in keychain?".
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const allowedRaw = process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? "";

  // tokenPrefix now shows the secret portion (after the colon). The bot ID
  // portion never changes on /revoke — only the 35-char secret changes,
  // and that's what we need to compare against BotFather's output to
  // confirm a token rotation went through.
  const tokenSecretPart = token.includes(":") ? token.split(":")[1] ?? "" : token;
  const tokenPrefix = tokenSecretPart.length >= 6
    ? `${tokenSecretPart.slice(0, 6)}***`
    : `${tokenSecretPart}***`;
  const webhookSecretPrefix = webhookSecret.length >= 6
    ? `${webhookSecret.slice(0, 6)}***`
    : "(empty or too short)";

  const baseEnv = {
    telegramBotTokenPrefix: tokenPrefix,
    telegramBotTokenLength: token.length,
    telegramWebhookSecretPresent: webhookSecret.length > 0,
    telegramWebhookSecretLength: webhookSecret.length,
    telegramWebhookSecretPrefix: webhookSecretPrefix,
    telegramAllowedChatIdsPresent: allowedRaw.length > 0,
    telegramAllowedChatIdsCount: allowedRaw.length > 0
      ? allowedRaw.split(",").map((s) => s.trim()).filter((s) => s.length > 0).length
      : 0,
  };

  // Two parallel diagnostic calls: getMe (auth check) and getWebhookInfo
  // (delivery check). If getMe passes but getWebhookInfo shows no URL or
  // a long pending_update_count, the bot isn't broken — Telegram just
  // isn't reaching our endpoint.
  const [meRes, whRes] = await Promise.all([
    fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: "no-store" })
      .then(async (r) => ({ r, body: await r.json().catch(() => null) }))
      .catch((e) => ({ r: null, body: null, error: e instanceof Error ? e.message : String(e) })),
    fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, { cache: "no-store" })
      .then(async (r) => ({ r, body: await r.json().catch(() => null) }))
      .catch((e) => ({ r: null, body: null, error: e instanceof Error ? e.message : String(e) })),
  ]);

  // Extract webhook fields. The Telegram schema is:
  //   { url, has_custom_certificate, pending_update_count,
  //     ip_address, max_connections, allowed_updates,
  //     last_error_date, last_error_message }
  type WebhookResult = {
    url?: string;
    pending_update_count?: number;
    ip_address?: string;
    allowed_updates?: string[];
    last_error_date?: number;
    last_error_message?: string;
    max_connections?: number;
  };
  const whBody = whRes.body as
    | { ok: true; result: WebhookResult }
    | { ok: false; description?: string }
    | null;
  const webhook = (whBody && "result" in whBody) ? whBody.result : null;

  const webhookSummary = webhook
    ? {
        url: webhook.url,
        registered: !!webhook.url,
        pendingUpdateCount: webhook.pending_update_count ?? 0,
        lastErrorDate: webhook.last_error_date
          ? new Date(webhook.last_error_date * 1000).toISOString()
          : null,
        lastErrorMessage: webhook.last_error_message ?? null,
        ipAddress: webhook.ip_address ?? null,
        allowedUpdates: webhook.allowed_updates ?? [],
      }
    : {
        url: null,
        registered: false,
        pendingUpdateCount: null,
        lastErrorDate: null,
        lastErrorMessage: null,
        ipAddress: null,
        allowedUpdates: [],
        fetchError: "getWebhookInfo failed",
      };

  const meOk = meRes.r && meRes.r.ok && meRes.body && (meRes.body as { ok?: boolean }).ok === true;
  const meBody = meRes.body as
    | { ok: true; result: { id: number; username: string; first_name: string } }
    | { ok: false; description?: string }
    | null;

  const responseBody: Record<string, unknown> = {
    ok: !!meOk,
    env: baseEnv,
    bot: meOk && meBody && "result" in meBody
      ? {
          id: meBody.result.id,
          username: meBody.result.username,
          firstName: meBody.result.first_name,
        }
      : null,
    botAuthError: !meOk
      ? (meBody && "description" in meBody ? meBody.description : null) ??
        (meRes as { error?: string }).error ??
        "unknown"
      : null,
    webhook: webhookSummary,
  };

  if (wantsRegister) {
    // Need the webhook secret to set it on the registration. Vercel's
    // env was already validated above (auth secret fallback chain), so
    // TELEGRAM_WEBHOOK_SECRET is either the same value or a separate
    // one — read it directly.
    const whSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
    try {
      // Telegram's setWebhook uses secret_token (the literal name) as
      // a query param. allowed_updates is a JSON array string.
      const setUrl = new URL(`https://api.telegram.org/bot${token}/setWebhook`);
      setUrl.searchParams.set("url", WEBHOOK_URL);
      setUrl.searchParams.set("secret_token", whSecret);
      setUrl.searchParams.set(
        "allowed_updates",
        JSON.stringify(ALLOWED_UPDATES),
      );
      setUrl.searchParams.set("drop_pending_updates", "false");
      const regRes = await fetch(setUrl.toString(), { cache: "no-store" });
      const regBody = (await regRes.json().catch(() => null)) as
        | { ok: true; result: true; description?: string }
        | { ok: false; description?: string; error_code?: number }
        | null;
      responseBody.registerWebhook = {
        called: true,
        targetUrl: WEBHOOK_URL,
        httpStatus: regRes.status,
        ok: regBody?.ok === true,
        description: regBody && "description" in regBody ? regBody.description : null,
      };
    } catch (err) {
      responseBody.registerWebhook = {
        called: true,
        targetUrl: WEBHOOK_URL,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  } else {
    responseBody.registerWebhook = {
      called: false,
      hint: "POST the same URL with ?register=1 (or GET) to re-attach the webhook",
    };
  }

  return NextResponse.json(responseBody);
}
