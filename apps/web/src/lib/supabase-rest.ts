// Shared raw-fetch helper for Supabase REST + Storage.
//
// Why this exists: supabase-js 2.45.x drives every request through Node's
// built-in fetch (undici). On the Vercel Node 18 runtime, undici throws
// "Cannot convert argument to a ByteString ... value of 8594" the moment
// any URL / Header / Body byte has a codepoint > U+00FF. This trips on
// any Unicode arrow / smart-quote / em-dash carried in a row value
// (e.g. legacy `summary` cells from earlier Grok responses that have
// `->` in them) or in env vars pasted with non-ASCII chars.
//
// All table / storage calls in this app now go through this helper
// instead of supabase-js. Two reasons:
//   1. raw fetch + URLSearchParams keeps the URL/Headers/Body latin1-clean.
//   2. We're explicit about how credentials are read, so a stray non-ASCII
//      byte in a Vercel env var doesn't 500 the whole route.

export interface SupabaseRestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  // Body is sent verbatim. For JSON, callers should JSON.stringify and
  // set Content-Type explicitly (or omit and we'll default to JSON).
  body?: BodyInit | null;
  headers?: Record<string, string>;
  cache?: RequestCache;
}

function readCreds(): { base: string; key: string } {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  // Defensive: scrub non-ASCII bytes from the secret. A truncated key is
  // recoverable; a 500 is not.
  const asciiKey = key.replace(/[^\x00-\x7f]/g, "?");
  // Normalize base to "<scheme>://<host>". Strip trailing slash, and also
  // any "/rest/v1" suffix in case the operator pasted a PostgREST-style URL
  // instead of the project URL.
  let cleaned = url.replace(/\/$/, "");
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, "");
  return { base: cleaned, key: asciiKey };
}

// Raw Supabase REST call. `path` should begin with "/" (e.g. "/rest/v1/venue_drafts?...").
export async function supabaseRest(
  path: string,
  opts: SupabaseRestOptions = {},
): Promise<Response> {
  const { base, key } = readCreds();
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...(opts.headers || {}),
  };
  if (opts.body !== undefined && typeof opts.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const fullUrl = `${base}${path}`;
  // Diagnostic: surface the URL we are about to fetch. Critical for
  // debugging PGRST125 (invalid path) and 401 (wrong key) without
  // needing to attach a debugger.
  console.log(`[supabase-rest] ${opts.method ?? "GET"} ${fullUrl}`);
  return fetch(fullUrl, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body,
    cache: opts.cache ?? "no-store",
  });
}

// Convenience: throw on non-2xx with a short body excerpt.
export async function expectOk(
  res: Response,
  context: string,
): Promise<void> {
  if (res.ok) return;
  const body = await res.text().catch(() => "");
  throw new Error(
    `${context} failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`,
  );
}
