export const CLEANUP_CONFIRMATION = "YES_DELETE";
export const MAX_CLEANUP_IDS = 100;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CleanupDraftRow {
  id: string;
  title: string | null;
  district: string | null;
  area_type: string | null;
  status: string;
  intake_item_id: string | null;
  last_reviewed_at: string | null;
}

export type CleanupBlocker =
  | { id: string; reason: "missing" }
  | { id: string; reason: "not_rejected"; status: string };

export function parseCleanupIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_CLEANUP_IDS) {
    return null;
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || !UUID_RE.test(item)) return null;
    const id = item.toLowerCase();
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids.length > 0 ? ids : null;
}

export function getCleanupBlockers(
  requestedIds: string[],
  rows: CleanupDraftRow[],
): CleanupBlocker[] {
  const rowsById = new Map(rows.map((row) => [row.id.toLowerCase(), row]));
  const blockers: CleanupBlocker[] = [];

  for (const id of requestedIds) {
    const row = rowsById.get(id);
    if (!row) {
      blockers.push({ id, reason: "missing" });
      continue;
    }
    if (row.status !== "rejected") {
      blockers.push({ id, reason: "not_rejected", status: row.status });
    }
  }

  return blockers;
}
