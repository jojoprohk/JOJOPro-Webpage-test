-- Per-IP rate-limit counters, backing apps/web/src/lib/rate-limit.ts.
--
-- Server-side upsert (PostgREST resolution=merge-duplicates) hits this
-- table keyed by `rl:<bucket>:<identity>|w<windowSec>`. The BEFORE
-- INSERT/UPDATE trigger parses the window from the key suffix and
-- resets the counter when the previous expires_at has elapsed.
--
-- Run this in Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  key text PRIMARY KEY,
  count int NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION rate_limit_bump()
RETURNS TRIGGER AS $$
DECLARE
  window_sec int;
BEGIN
  -- Parse window from key suffix: ...|w<seconds>. Default 60s.
  window_sec := COALESCE(
    substring(NEW.key FROM '\|w([0-9]+)$')::int,
    60
  );

  IF TG_OP = 'INSERT' THEN
    NEW.count := 1;
    NEW.expires_at := now() + (window_sec || ' seconds')::interval;
  ELSE
    IF OLD.expires_at < now() THEN
      NEW.count := 1;
      NEW.expires_at := now() + (window_sec || ' seconds')::interval;
    ELSE
      NEW.count := OLD.count + 1;
      NEW.expires_at := OLD.expires_at;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rate_limit_bump_trigger ON rate_limit_counters;
CREATE TRIGGER rate_limit_bump_trigger
BEFORE INSERT OR UPDATE ON rate_limit_counters
FOR EACH ROW EXECUTE FUNCTION rate_limit_bump();

-- service_role bypasses RLS by default; enable + leave policy-less so
-- anon / authenticated callers have no access.
ALTER TABLE rate_limit_counters ENABLE ROW LEVEL SECURITY;
