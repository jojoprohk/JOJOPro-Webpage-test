import { describe, expect, it, vi } from "vitest";
import { PhotoError, getIntakePhoto, getListingPhoto } from "../src/lib/photo-service.js";

// 可設定每個 table 回傳值嘅假 supabase client。
function createFakeSupabase(opts: {
  draft?: unknown;
  intake?: unknown;
}) {
  const downloads: Array<{ bucket: string; key: string }> = [];
  function chain(row: unknown) {
    return {
      select: vi.fn(function (this: unknown) {
        return this;
      }),
      eq: vi.fn(function (this: unknown) {
        return this;
      }),
      maybeSingle: vi.fn(() => Promise.resolve({ data: row, error: null })),
    };
  }
  const storage = {
    from: vi.fn((bucket: string) => ({
      download: vi.fn(async (key: string) => {
        downloads.push({ bucket, key });
        return {
          data: new Blob([new Uint8Array([1, 2, 3, 4])], {
            type: "image/jpeg",
          }),
          error: null,
        };
      }),
    })),
  };
  const supabase = {
    from: vi.fn((table: string) =>
      chain(table === "venue_drafts" ? opts.draft : opts.intake),
    ),
    storage,
  };
  return { supabase, downloads };
}

describe("getIntakePhoto", () => {
  it("index 唔係數字 → not_found", async () => {
    const { supabase } = createFakeSupabase({});
    await expect(
      getIntakePhoto(supabase as never, "token", "11111111-1111-1111-1111-111111111111", "abc"),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("index 越界 → not_found", async () => {
    const { supabase } = createFakeSupabase({
      intake: { photo_file_ids: ["a"] },
    });
    await expect(
      getIntakePhoto(supabase as never, "token", "11111111-1111-1111-1111-111111111111", "1"),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("冇 bot token → no_bot_token", async () => {
    const { supabase } = createFakeSupabase({
      intake: { photo_file_ids: ["a"] },
    });
    await expect(
      getIntakePhoto(supabase as never, undefined, "11111111-1111-1111-1111-111111111111", "0"),
    ).rejects.toMatchObject({ code: "no_bot_token" });
  });
});

describe("getListingPhoto", () => {
  const ID = "22222222-2222-2222-2222-222222222222";

  it("draft 唔存在／唔係 approved → not_found", async () => {
    const { supabase } = createFakeSupabase({ draft: null });
    await expect(
      getListingPhoto(supabase as never, "token", ID, "0"),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("approved draft 嘅 telegram 相，冇 bot token → no_bot_token（證實通過咗 approved 檢查）", async () => {
    const { supabase } = createFakeSupabase({
      draft: {
        id: ID,
        status: "approved",
        area_type: "market",
        photos: [{ kind: "telegram", fileId: "f1" }],
      },
    });
    await expect(
      getListingPhoto(supabase as never, undefined, ID, "0"),
    ).rejects.toMatchObject({ code: "no_bot_token" });
  });

  it("展示相 index 越界 → not_found", async () => {
    const { supabase } = createFakeSupabase({
      draft: {
        id: ID,
        status: "approved",
        area_type: "market",
        photos: [{ kind: "telegram", fileId: "f1" }],
      },
    });
    await expect(
      getListingPhoto(supabase as never, "token", ID, "5"),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("draft id 唔係 uuid → not_found", async () => {
    const { supabase } = createFakeSupabase({});
    await expect(
      getListingPhoto(supabase as never, "token", "not-a-uuid", "0"),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("PhotoError 帶有 code 同 message", () => {
    const e = new PhotoError("not_found", "x");
    expect(e.code).toBe("not_found");
    expect(e.message).toBe("x");
    expect(e.name).toBe("PhotoError");
  });
  it("approved draft 嘅 manual 相 → 由 Supabase Storage 攞", async () => {
    const manualKey = "33333333-3333-3333-3333-333333333333";
    const { supabase, downloads } = createFakeSupabase({
      draft: {
        id: ID,
        status: "approved",
        area_type: "market",
        photos: [{ kind: "manual", storageKey: manualKey }],
      },
    });
    const result = await getListingPhoto(
      supabase as never,
      "token",
      ID,
      "0",
    );
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.buffer.length).toBe(4);
    expect(downloads).toEqual([{ bucket: "venue-photos", key: manualKey }]);
  });

  it("PhotoError 帶有 code 同 message", () => {
    const e = new PhotoError("not_found", "x");
    expect(e.code).toBe("not_found");
    expect(e.message).toBe("x");
    expect(e.name).toBe("PhotoError");
  });
});
