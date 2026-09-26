import { describe, expect, it } from "vitest";
import {
  getCleanupBlockers,
  parseCleanupIds,
  type CleanupDraftRow,
} from "../src/lib/cleanup-drafts.js";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function row(id: string, status = "rejected"): CleanupDraftRow {
  return {
    id,
    title: "測試場地",
    district: null,
    area_type: "market",
    status,
    intake_item_id: null,
    last_reviewed_at: null,
  };
}

describe("parseCleanupIds", () => {
  it("accepts valid UUIDs and removes duplicates", () => {
    expect(parseCleanupIds([A, B, A.toUpperCase()])).toEqual([A, B]);
  });

  it("rejects empty, non-array and malformed input", () => {
    expect(parseCleanupIds([])).toBeNull();
    expect(parseCleanupIds("not-an-array")).toBeNull();
    expect(parseCleanupIds([A, "not-a-uuid"])).toBeNull();
  });
});

describe("getCleanupBlockers", () => {
  it("allows deletion only when every requested row is rejected", () => {
    expect(getCleanupBlockers([A, B], [row(A), row(B)])).toEqual([]);
  });

  it("blocks missing and non-rejected rows", () => {
    expect(getCleanupBlockers([A, B], [row(A, "approved")])).toEqual([
      { id: A, reason: "not_rejected", status: "approved" },
      { id: B, reason: "missing" },
    ]);
  });
});
