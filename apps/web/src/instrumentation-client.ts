// Browser-side Sentry init.
//
// Runs once per browser session, before the React app becomes
// interactive. We keep this minimal: capture frontend errors and
// navigation transitions, but skip session replay / profiling to
// stay within the Developer (free) plan limits.
//
// PII is opt-out for the same reason as `sentry.server.config.ts`.

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

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
