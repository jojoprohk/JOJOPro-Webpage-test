// Next.js 16 instrumentation entry point.
//
// Two exports:
//   - register()              — runs once per server instance, before
//                              requests are served. Loads the matching
//                              Sentry config based on NEXT_RUNTIME.
//   - onRequestError(err, req, ctx)
//                            — Next.js 16 stable hook (since v15.0.0)
//                              that captures server-side errors with
//                              rich context (routerKind, routeType,
//                              renderSource, etc). Bridged to Sentry
//                              via `Sentry.captureRequestError`.
//
// Place this file at apps/web/src/ (Next.js convention — not inside
// app/ or pages/).

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = async (
  err: unknown,
  request: {
    path: string;
    method: string;
    headers: { [key: string]: string | string[] };
  },
  context: {
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "proxy";
    renderSource?:
      | "react-server-components"
      | "react-server-components-payload"
      | "server-rendering";
    revalidateReason?: "on-demand" | "stale" | undefined;
    renderType?: "dynamic" | "dynamic-resume";
  },
) => {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, context);
};
