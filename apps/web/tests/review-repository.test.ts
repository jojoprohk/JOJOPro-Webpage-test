import { describe, expect, it } from "vitest";
import {
  buildDraftUpdate,
  createReviewRepository,
} from "../src/lib/review-repository.js";

const NOW = "2026-09-01T00:00:00.000Z";

describe("buildDraftUpdate", () => {
  it("approve sets status and last_reviewed_at", () => {
    const row = buildDraftUpdate("approve", undefined, undefined, NOW);
    expect(row.status).toBe("approved");
    expect(row.last_reviewed_at).toBe(NOW);
  });

  it("reject sets rejected status and note", () => {
    const row = buildDraftUpdate("reject", undefined, "資料唔齊", NOW);
    expect(row.status).toBe("rejected");
    expect(row.review_note).toBe("資料唔齊");
  });

  it("maps editable camelCase fields to snake_case columns", () => {
    const row = buildDraftUpdate(
      "approve",
      {
        title: "新標題",
        district: "旺角",
        hasAircon: true,
        isUrgent: false,
        startDate: null,
      },
      undefined,
      NOW,
    );
    expect(row.title).toBe("新標題");
    expect(row.district).toBe("旺角");
    expect(row.has_aircon).toBe(true);
    expect(row.is_urgent).toBe(false);
    expect(row.start_date).toBeNull();
  });

  it("drops fields not on the whitelist", () => {
    const row = buildDraftUpdate(
      "approve",
      {
        title: "ok",
        // 以下全部唔應該寫入。
        id: "hacked",
        status: "published",
        confidence_score: 100,
        arbitrary: "x",
      },
      undefined,
      NOW,
    );
    expect(row.title).toBe("ok");
    expect(row).not.toHaveProperty("id");
    expect(row).not.toHaveProperty("confidence_score");
    expect(row).not.toHaveProperty("arbitrary");
    // status 由 action 決定，唔可以被 fields 覆蓋。
    expect(row.status).toBe("approved");
  });

  it("ignores empty review note", () => {
    const row = buildDraftUpdate("approve", undefined, "   ", NOW);
    expect(row).not.toHaveProperty("review_note");
  });

  it("save 只儲存欄位，唔改 status 同 last_reviewed_at", () => {
    const row = buildDraftUpdate(
      "save",
      { title: "改咗未批准", district: "觀塘區" },
      undefined,
      NOW,
    );
    expect(row).not.toHaveProperty("status");
    expect(row).not.toHaveProperty("last_reviewed_at");
    expect(row.title).toBe("改咗未批准");
    expect(row.district).toBe("觀塘區");
  });

  it("photos 欄位（結構化陣列）可以寫入", () => {
    const photos = [
      { kind: "telegram", fileId: "f1" },
      { kind: "stock", src: "/stock/market.jpg" },
    ];
    const row = buildDraftUpdate("save", { photos }, undefined, NOW);
    expect(row.photos).toEqual(photos);
  });
});

// 輕量 fake Supabase query builder：記低 list 參數同 update。
function fakeSupabase() {
  const calls: Array<Record<string, unknown>> = [];
  const state: { eqTable?: string; updateRow?: unknown } = {};

  function chain(table: string) {
    return {
      select(_cols: string) {
        return {
          eq(col: string, value: unknown) {
            calls.push({ op: "select", table, col, value });
            return {
              order(_col: string, _opts: unknown) {
                return Promise.resolve({
                  data: [{ id: "d1", title: "測試場" }],
                  error: null,
                });
              },
            };
          },
        };
      },
      update(row: unknown) {
        state.eqTable = table;
        state.updateRow = row;
        return {
          eq(col: string, value: unknown) {
            calls.push({ op: "update", table, col, value });
            return Promise.resolve({ error: null });
          },
        };
      },
    };
  }

  return { client: { from: chain } as never, calls, state };
}

describe("review-repository client", () => {
  it("listDrafts filters by status", async () => {
    const { client, calls } = fakeSupabase();
    const repo = createReviewRepository(client);
    const rows = await repo.listDrafts("needs_review");
    expect(rows).toHaveLength(1);
    expect(calls[0]?.value).toBe("needs_review");
  });

  it("updateDraft writes the given row to the target id", async () => {
    const { client, calls, state } = fakeSupabase();
    const repo = createReviewRepository(client);
    await repo.updateDraft("abc", { status: "approved" });
    expect(calls[0]?.value).toBe("abc");
    expect(state.updateRow).toEqual({ status: "approved" });
  });
});
