// Sentry capture helper for hot-path silent failures.
//
// Telegram intake + several route handlers intentionally return 200 even
// when downstream work fails (to stop Telegram from retrying the same
// update_id forever). This means a `console.error(...)` is the only
// signal that something went wrong — and console logs alone are not
// surfaced in any dashboard.
//
// `captureIntakeFailure()` wraps Sentry.captureException with a stable
// `scope` tag so the Sentry dashboard can group errors by route /
// subsystem instead of by stack frame.
//
// Safe to call before Sentry.init() runs — Sentry buffers events until
// init completes.

import * as Sentry from "@sentry/nextjs";

export type ErrorScope =
  | "telegram-intake"
  | "rate-limit"
  | "llm-completer"
  | "listing-repository"
  | "cleanup-rejected"
  | "telegram-photo"
  | "telegram-bot";

export function captureIntakeFailure(
  scope: ErrorScope,
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  Sentry.captureException(err, {
    tags: { scope },
    extra: scrubExtras(extra),
    level: "error",
  });
}

function scrubExtras(
  extras: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!extras) return {};
  // Defensive: strip known sensitive fields even if caller forgets.
  const denyKeys = new Set([
    "TELEGRAM_BOT_TOKEN",
    "SENTRY_AUTH_TOKEN",
    "SUPABASE_SERVICE_ROLE_KEY",
    "authorization",
    "x-api-key",
    "password",
    "token",
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extras)) {
    if (denyKeys.has(key)) {
      out[key] = "<REDACTED>";
    } else {
      out[key] = value;
    }
  }
  return out;
}
