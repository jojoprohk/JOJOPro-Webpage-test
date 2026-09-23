// Server-side Sentry init for Next.js Node.js runtime.
//
// Loaded by `apps/web/src/instrumentation.ts` via dynamic import so
// the SDK never bundles into the Edge runtime.
//
// PII is opt-out: v10 deprecated sendDefaultPii, so we use
// `dataCollection` (cookies / httpHeaders / userInfo all denied or
// selectively scrubbed). The default for `httpHeaders` is `true`
// (collects full header values) so we explicitly deny sensitive
// header names. We also drop the request body for known PII routes
// in `beforeSend`.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;
const isDev = process.env.NODE_ENV === "development";

Sentry.init({
  dsn,
  tracesSampleRate: isDev ? 1.0 : 0.1,
  sendDefaultPii: false,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: {
      deny: [
        "forwarded",
        "-ip",
        "remote-",
        "via",
        "-user",
        "authorization",
        "x-api-key",
        "x-telegram-bot-api-secret-token",
      ],
    },
    urlQueryParams: false,
  },
  beforeSend(event) {
    const url = event.request?.url ?? "";
    if (
      url.includes("/api/intake/telegram") ||
      url.includes("/api/photos") ||
      url.includes("/api/diag/bot") ||
      url.includes("/api/diag/llm")
    ) {
      if (event.request) {
        event.request.data = null;
      }
    }
    return event;
  },
  ignoreErrors: [
    // Telegram retries on the same update_id when the webhook returns
    // non-200. We never 5xx, so this is informational only.
    "skip duplicate update_id",
  ],
});
