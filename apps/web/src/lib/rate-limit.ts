// Fail-open rate limiter backed by Vercel KV (Upstash REST under the hood).
//
// Deliberately uses raw fetch against the KV REST API instead of the
// @vercel/kv SDK so that a missing KV binding does not crash the module
// load of the route that imports this helper. If KV env vars are not yet
// injected OR KV throws, this helper logs a warning and returns
// allowed:true -- the protected route stays online instead of 500ing.
//
// KV env vars (auto-injected when a KV store is linked in the Vercel
// Dashboard → Storage):
//   KV_REST_API_URL
//   KV_REST_API_TOKEN

type RateLimitConfig = {
  windowSec: number;
  max: number;
};

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  retryAfterSec: number;
  degraded: boolean;
};

async function kvCommand(
  command: "incr" | "expire",
  key: string,
  seconds?: number,
): Promise<unknown> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("KV not configured");
  const path =
    command === "incr"
      ? `/incr/${encodeURIComponent(key)}`
      : `/expire/${encodeURIComponent(key)}/${seconds}`;
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `KV ${command} failed: ${res.status} ${text.slice(0, 120)}`,
    );
  }
  return (await res.json()) as { result: number };
}

export async function rateLimit(
  bucket: string,
  identity: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.warn(
      `[rate-limit:${bucket}] KV not configured, allowing request (fail-open)`,
    );
    return {
      allowed: true,
      count: 0,
      retryAfterSec: 0,
      degraded: true,
    };
  }

  const key = `rl:${bucket}:${identity}`;
  try {
    const data = await kvCommand("incr", key);
    const count = Number((data as { result: number }).result);
    if (count === 1) {
      // First hit in this window -- set the TTL so the counter resets
      // after the window elapses. EXPIRE on a key with no TTL is fine,
      // but we gate with count===1 for clarity.
      await kvCommand("expire", key, config.windowSec);
    }
    if (count > config.max) {
      return {
        allowed: false,
        count,
        retryAfterSec: config.windowSec,
        degraded: false,
      };
    }
    return {
      allowed: true,
      count,
      retryAfterSec: 0,
      degraded: false,
    };
  } catch (err) {
    console.warn(
      `[rate-limit:${bucket}] KV error, allowing request (fail-open):`,
      err,
    );
    return {
      allowed: true,
      count: 0,
      retryAfterSec: 0,
      degraded: true,
    };
  }
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
