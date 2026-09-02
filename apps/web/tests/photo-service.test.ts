import { describe, expect, it, vi } from "vitest";
import { PhotoError, getIntakePhoto, getListingPhoto } from "../src/lib/photo-service.js";

// 可設定每個 table 回傳值嘅假 supabase client。
function createFakeSupabase(opts: {
  draft?: unknown;
  intake?: unknown;
}) {
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
  const supabase = {
    from: vi.fn((table: string) =>
      chain(table === "venue_drafts" ? opts.draft : opts.intake),
    ),
  };
  return { supabase };
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

  it("approved draft 先會去攞 intake 相", async () => {
    const { supabase } = createFakeSupabase({
      draft: { id: ID, status: "approved", intake_item_id: null },
    });
    // intake_item_id 為 null → not_found（證明有檢查 approved 先繼續）
    await expect(
      getListingPhoto(supabase as never, "token", ID, "0"),
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
});
