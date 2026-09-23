// Fail-open rate limiter backed by Supabase.
//
// Uses a single roundtrip upsert (PostgREST Prefer: resolution=merge-duplicates)
// into a `rate_limit_counters` table whose BEFORE INSERT/UPDATE trigger
// handles the count + window reset logic. No external service to provision.
//
// Behavior:
//   * Supabase not configured -> log warning, allow request (fail-open).
//   * `rate_limit_counters` table missing (migration not run yet) -> log
//     warning, allow request. The endpoint stays available between
//     deploy and migration.
//   * Supabase returns any other error -> log warning, allow request.
//   * Counter exceeds `config.max` -> deny + return retryAfterSec derived
//     from the row's expires_at.

import { supabaseRest } from "./supabase-rest.js";
import { captureIntakeFailure } from "./error-log.js";

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

export async function rateLimit(
  bucket: string,
  identity: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      `[rate-limit:${bucket}] Supabase not configured, allowing request (fail-open)`,
    );
    return {
      allowed: true,
      count: 0,
      retryAfterSec: 0,
      degraded: true,
    };
  }

  // Embed window in the key suffix so the Postgres trigger can read it
  // without needing RPC params. Format: rl:<bucket>:<identity>|w<seconds>
  const key = `rl:${bucket}:${identity}|w${config.windowSec}`;

  let res: Response;
  try {
    res = await supabaseRest("/rest/v1/rate_limit_counters", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // UPSERT on conflict (key is PK); trigger fills count + expires_at.
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        key,
        // Dummy initial values; BEFORE INSERT/UPDATE trigger overwrites
        // them based on the existing row + parsed window.
        count: 0,
        expires_at: new Date(0).toISOString(),
      }),
    });
  } catch (err) {
    console.warn(
      `[rate-limit:${bucket}] fetch threw, allowing request (fail-open):`,
      err,
    );
    captureIntakeFailure("rate-limit", err, { bucket });
    return {
      allowed: true,
      count: 0,
      retryAfterSec: 0,
      degraded: true,
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Distinguish "table missing" (migration not yet run) from any other
    // failure so the log makes the next step obvious.
    if (
      res.status === 404 &&
      text.toLowerCase().includes("rate_limit_counters")
    ) {
      console.warn(
        `[rate-limit:${bucket}] rate_limit_counters table missing, allowing request (run supabase/migrations/202609180002_rate_limit_counters.sql)`,
      );
      return {
        allowed: true,
        count: 0,
        retryAfterSec: 0,
        degraded: true,
      };
    }
    console.warn(
      `[rate-limit:${bucket}] upsert failed, allowing request (fail-open): ${res.status} ${text.slice(0, 200)}`,
    );
    captureIntakeFailure("rate-limit", new Error(`upsert ${res.status}`), {
      bucket,
      status: res.status,
      body: text.slice(0, 200),
    });
    return {
      allowed: true,
      count: 0,
      retryAfterSec: 0,
      degraded: true,
    };
  }

  const rows = (await res.json()) as Array<{
    count: number;
    expires_at: string;
  }>;
  const row = rows[0];
  if (!row) {
    console.warn(
      `[rate-limit:${bucket}] upsert returned no rows, allowing request (fail-open)`,
    );
    return {
      allowed: true,
      count: 0,
      retryAfterSec: 0,
      degraded: true,
    };
  }

  const count = Number(row.count);
  if (count > config.max) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((new Date(row.expires_at).getTime() - Date.now()) / 1000),
    );
    return {
      allowed: false,
      count,
      retryAfterSec,
      degraded: false,
    };
  }
  return {
    allowed: true,
    count,
    retryAfterSec: 0,
    degraded: false,
  };
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
