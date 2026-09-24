// Edge runtime Sentry init.
//
// Jojopro currently does not run any route in the Edge runtime — all
// `route.ts` files declare `export const runtime = "nodejs"` and the
// only Edge surfaces would be `middleware` / `proxy` (we have none).
// This file is kept so that if Edge usage is added later, the SDK
// initializes cleanly via the runtime branch in `instrumentation.ts`.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
const isDev = process.env.NODE_ENV === "development";

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: isDev ? 1.0 : 0.1,
    sendDefaultPii: false,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {
        deny: ["forwarded", "-ip", "remote-", "via", "-user", "authorization"],
      },
      urlQueryParams: false,
    },
  });
}
