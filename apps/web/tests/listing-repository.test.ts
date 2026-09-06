import { describe, expect, it, vi } from "vitest";
import {
  createListingRepository,
  mapRowToPublicListing,
} from "../src/lib/listing-repository.js";

// 最小假 supabase client：記低 chain 呼叫，回傳預設 data/error。
function createFakeSupabase(options: {
  selectData?: unknown;
  rpcData?: unknown;
  selectError?: { message: string } | null;
  rpcError?: { message: string } | null;
}) {
  const calls: Record<string, unknown> = {};

  const selectChain = {
    select: vi.fn(function (this: unknown, query: string) {
      calls.selectQuery = query;
      return this;
    }),
    eq: vi.fn(function (this: unknown, col: string, val: unknown) {
      (this as Record<string, unknown>)[`eq_${col}`] = val;
      return this;
    }),
    order: vi.fn(function (this: unknown) {
      return Promise.resolve({
        data: options.selectData ?? null,
        error: options.selectError ?? null,
      });
    }),
  };

  const supabase = {
    from: vi.fn(() => selectChain),
    rpc: vi.fn((fn: string, args: unknown) => {
      calls.rpcFn = fn;
      calls.rpcArgs = args;
      return Promise.resolve({
        data: options.rpcData ?? null,
        error: options.rpcError ?? null,
      });
    }),
  };

  return { supabase, calls, selectChain };
}

describe("mapRowToPublicListing", () => {
  it("只映射公開欄位，snake_case 轉 camelCase", () => {
    const dto = mapRowToPublicListing({
      id: "x",
      title: "T",
      district: "旺角",
      venue_name: "場",
      area_type: "mall",
      start_date: "2026-09-10",
      end_date: "2026-09-12",
      session_dates: null,
      price_text: "$800/日",
      price_amount_hkd: 800,
      price_unit: "day",
      booth_size_text: "3粒",
      contact_text: "wa.me/x",
      contact_whatsapp_link: "wa.me/x",
      has_aircon: true,
      is_prime_spot: false,
      is_cart_spot: false,
      allows_food: true,
      allows_dry_goods: null,
      allows_beauty: null,
      allows_service: null,
      requires_product_approval: false,
      is_urgent: false,
      is_discounted: false,
      summary: "",
      photos: [
        { kind: "telegram", fileId: "a" },
        { kind: "telegram", fileId: "b" },
      ],
      report_count: 3,
      last_reviewed_at: "2026-09-01T00:00:00.000Z",
      created_at: "2026-09-01T00:00:00.000Z",
      intake: { source_label: "TG group", source_url: null },
    });
    expect(dto).toMatchObject({
      id: "x",
      title: "T",
      district: "旺角",
      venueName: "場",
      areaType: "mall",
      priceAmountHkd: 800,
      allowsFood: true,
      reportCount: 3,
      sourceLabel: "TG group",
    });
    // 2 real 相 + 1 stock fallback (area_type "mall" 自動加) = 3
    expect(dto.photoCount).toBe(3);
    expect(dto.realPhotoCount).toBe(2);
    expect(dto.stockPhotoCount).toBe(1);
    // 內部欄位唔可以喺公開 DTO 出現。
    expect(dto).not.toHaveProperty("raw_content");
    expect(dto).not.toHaveProperty("confidence_score");
    expect(dto).not.toHaveProperty("low_confidence_fields");
    expect(dto).not.toHaveProperty("review_note");
    expect(dto).not.toHaveProperty("intake_item_id");
  });

  it("缺 intake 時來源 fallback", () => {
    const dto = mapRowToPublicListing({
      id: "x",
      title: "T",
      district: null,
      venue_name: null,
      area_type: "unknown",
      start_date: null,
      end_date: null,
      session_dates: null,
      price_text: null,
      price_amount_hkd: null,
      price_unit: "unknown",
      booth_size_text: null,
      contact_text: null,
      contact_whatsapp_link: null,
      has_aircon: null,
      is_prime_spot: false,
      is_cart_spot: false,
      allows_food: null,
      allows_dry_goods: null,
      allows_beauty: null,
      allows_service: null,
      requires_product_approval: false,
      is_urgent: false,
      is_discounted: false,
      summary: "",
      photos: null,
      report_count: null,
      last_reviewed_at: null,
      created_at: "2026-09-01T00:00:00.000Z",
      intake: null,
    });
    expect(dto.sourceLabel).toBe("未知來源");
    expect(dto.sourceUrl).toBeNull();
    expect(dto.reportCount).toBe(0);
    expect(dto.sessionDates).toEqual([]);
    // 冇 photos 時 fallback 一張場地類型代表相，所以公開頁至少 1 張。
    expect(dto.photoCount).toBe(1);
  });
});

describe("listApprovedListings", () => {
  it("只查 status=approved 並 join intake 取來源", async () => {
    const { supabase, calls, selectChain } = createFakeSupabase({
      selectData: [],
    });
    const repo = createListingRepository(supabase as never);
    const result = await repo.listApprovedListings();

    expect(supabase.from).toHaveBeenCalledWith("venue_drafts");
    expect(calls.selectQuery).toContain(
      "intake:intake_items(source_label, source_url)",
    );
    expect(calls.selectQuery).toContain("photos");
    expect(selectChain.eq).toHaveBeenCalledWith("status", "approved");
    expect(result).toEqual([]);
  });

  it("db 出錯時 throw", async () => {
    const { supabase } = createFakeSupabase({
      selectData: null,
      selectError: { message: "boom" },
    });
    const repo = createListingRepository(supabase as never);
    await expect(repo.listApprovedListings()).rejects.toThrow("boom");
  });
});

describe("reportListing", () => {
  it("call increment_report_count rpc，帶 id 同時間", async () => {
    const { supabase, calls } = createFakeSupabase({
      rpcData: "uuid-123",
    });
    const repo = createListingRepository(supabase as never);
    const ok = await repo.reportListing("uuid-123", "2026-09-02T00:00:00.000Z");

    expect(calls.rpcFn).toBe("increment_report_count");
    expect(calls.rpcArgs).toEqual({
      listing_id: "uuid-123",
      reported_at: "2026-09-02T00:00:00.000Z",
    });
    expect(ok).toBe(true);
  });

  it("rpc 回 null（唔存在／非 approved）→ false", async () => {
    const { supabase } = createFakeSupabase({ rpcData: null });
    const repo = createListingRepository(supabase as never);
    expect(await repo.reportListing("missing", "2026-09-02T00:00:00.000Z")).toBe(
      false,
    );
  });

  it("rpc 出錯時 throw", async () => {
    const { supabase } = createFakeSupabase({
      rpcError: { message: "rpc down" },
    });
    const repo = createListingRepository(supabase as never);
    await expect(
      repo.reportListing("x", "2026-09-02T00:00:00.000Z"),
    ).rejects.toThrow("rpc down");
  });
});


describe("mapRowToPublicListing photo breakdown", () => {
  it("全部 stock 相 → firstPhotoKind = 'stock'", () => {
    const dto = mapRowToPublicListing({
      id: "x",
      title: "t",
      district: null,
      venue_name: null,
      area_type: "mall",
      photos: null, // 冇真實相 → fallback stock
      start_date: null,
      end_date: null,
      session_dates: null,
      price_text: null,
      price_amount_hkd: null,
      price_unit: "unknown",
      booth_size_text: null,
      contact_text: null,
      contact_whatsapp_link: null,
      has_aircon: null,
      is_prime_spot: false,
      is_cart_spot: false,
      allows_food: null,
      allows_dry_goods: null,
      allows_beauty: null,
      allows_service: null,
      requires_product_approval: false,
      is_urgent: false,
      is_discounted: false,
      summary: "",
      report_count: 0,
      last_reviewed_at: null,
      created_at: "2026-09-01T00:00:00.000Z",
      intake: null,
    });
    expect(dto.firstPhotoKind).toBe("stock");
    expect(dto.stockPhotoCount).toBeGreaterThan(0);
    expect(dto.realPhotoCount).toBe(0);
  });

  it("有 telegram 相 → firstPhotoKind = 'real'", () => {
    const dto = mapRowToPublicListing({
      id: "x",
      title: "t",
      district: null,
      venue_name: null,
      area_type: "mall",
      photos: [{ kind: "telegram", fileId: "abc" }, { kind: "stock", src: "/stock/mall.svg" }],
      start_date: null,
      end_date: null,
      session_dates: null,
      price_text: null,
      price_amount_hkd: null,
      price_unit: "unknown",
      booth_size_text: null,
      contact_text: null,
      contact_whatsapp_link: null,
      has_aircon: null,
      is_prime_spot: false,
      is_cart_spot: false,
      allows_food: null,
      allows_dry_goods: null,
      allows_beauty: null,
      allows_service: null,
      requires_product_approval: false,
      is_urgent: false,
      is_discounted: false,
      summary: "",
      report_count: 0,
      last_reviewed_at: null,
      created_at: "2026-09-01T00:00:00.000Z",
      intake: null,
    });
    expect(dto.firstPhotoKind).toBe("real");
    expect(dto.realPhotoCount).toBe(1);
    expect(dto.stockPhotoCount).toBe(1);
    expect(dto.photoCount).toBe(2);
  });
});