import { describe, expect, it } from "vitest";
import {
  applyFilters,
  compareListings,
  formatDateLabel,
  isAvailableOn,
  isExpired,
  matchesFilters,
  normalizeWhatsappLink,
  parseFilters,
  todayInHongKong,
} from "../src/lib/listing-filter.js";
import type { ListingFilters, PublicListing } from "../src/lib/listing-types.js";

function makeListing(overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    id: "id-1",
    title: "旺角商場 pop-up",
    district: "旺角",
    venueName: "某某商場",
    areaType: "mall",
    startDate: "2026-09-10",
    endDate: "2026-09-12",
    sessionDates: [],
    priceText: "$800/日",
    priceAmountHkd: 800,
    priceUnit: "day",
    boothSizeText: "3粒",
    contactText: "wa.me/85212345678",
    contactWhatsappLink: "85212345678",
    hasAircon: true,
    isPrimeSpot: false,
    isCartSpot: false,
    allowsFood: true,
    allowsDryGoods: true,
    allowsBeauty: null,
    allowsService: null,
    requiresProductApproval: false,
    isUrgent: false,
    isDiscounted: false,
    summary: "旺角人流旺商場",
    sourceLabel: "TG group",
    sourceUrl: null,
    lastReviewedAt: "2026-09-01T00:00:00.000Z",
    reportCount: 0,
    photoCount: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

const NO_FILTERS: ListingFilters = {
  q: "",
  date: null,
  maxBudget: null,
  food: false,
  aircon: false,
  deal: false,
};

const TODAY = "2026-09-02";

describe("isExpired", () => {
  it("連續檔 end_date 早過今日算過期", () => {
    expect(
      isExpired(makeListing({ startDate: "2026-08-01", endDate: "2026-08-31" }), TODAY),
    ).toBe(true);
  });

  it("連續檔橫跨今日唔算過期", () => {
    expect(
      isExpired(makeListing({ startDate: "2026-09-01", endDate: "2026-09-10" }), TODAY),
    ).toBe(false);
  });

  it("斷續檔所有日期早過今日算過期", () => {
    expect(
      isExpired(
        makeListing({
          startDate: "2026-08-01",
          endDate: "2026-08-30",
          sessionDates: ["2026-08-02", "2026-08-30"],
        }),
        TODAY,
      ),
    ).toBe(true);
  });

  it("斷續檔有未來日期唔算過期", () => {
    expect(
      isExpired(
        makeListing({ sessionDates: ["2026-08-30", "2026-09-05"] }),
        TODAY,
      ),
    ).toBe(false);
  });

  it("完全冇日期唔當過期", () => {
    expect(
      isExpired(makeListing({ startDate: null, endDate: null }), TODAY),
    ).toBe(false);
  });
});

describe("isAvailableOn", () => {
  it("連續檔日期喺範圍內", () => {
    expect(isAvailableOn(makeListing(), "2026-09-11")).toBe(true);
    expect(isAvailableOn(makeListing(), "2026-09-13")).toBe(false);
  });

  it("斷續檔要係 session_dates 其中一日", () => {
    const l = makeListing({ sessionDates: ["2026-09-05", "2026-09-12"] });
    expect(isAvailableOn(l, "2026-09-05")).toBe(true);
    expect(isAvailableOn(l, "2026-09-06")).toBe(false);
  });
});

describe("matchesFilters", () => {
  it("預設隱藏過期、顯示未來", () => {
    expect(
      matchesFilters(makeListing({ endDate: "2026-08-01" }), NO_FILTERS, TODAY),
    ).toBe(false);
    expect(matchesFilters(makeListing(), NO_FILTERS, TODAY)).toBe(true);
  });

  it("揀咗日期就只顯示當日有檔，唔再靠隱藏過期", () => {
    const f = { ...NO_FILTERS, date: "2026-09-11" };
    expect(matchesFilters(makeListing(), f, TODAY)).toBe(true);
    const f2 = { ...NO_FILTERS, date: "2026-09-20" };
    expect(matchesFilters(makeListing(), f2, TODAY)).toBe(false);
  });

  it("搜尋比對地區／場地／標題／摘要", () => {
    expect(
      matchesFilters(makeListing(), { ...NO_FILTERS, q: "旺角" }, TODAY),
    ).toBe(true);
    expect(
      matchesFilters(makeListing(), { ...NO_FILTERS, q: "銅鑼灣" }, TODAY),
    ).toBe(false);
  });

  it("最高預算：超過或解析唔到價都排除", () => {
    expect(
      matchesFilters(makeListing({ priceAmountHkd: 800 }), {
        ...NO_FILTERS,
        maxBudget: 1000,
      }, TODAY),
    ).toBe(true);
    expect(
      matchesFilters(makeListing({ priceAmountHkd: 1200 }), {
        ...NO_FILTERS,
        maxBudget: 1000,
      }, TODAY),
    ).toBe(false);
    expect(
      matchesFilters(makeListing({ priceAmountHkd: null }), {
        ...NO_FILTERS,
        maxBudget: 1000,
      }, TODAY),
    ).toBe(false);
  });

  it("食品／冷氣要 true 先計", () => {
    expect(
      matchesFilters(makeListing({ allowsFood: null }), { ...NO_FILTERS, food: true }, TODAY),
    ).toBe(false);
    expect(
      matchesFilters(makeListing({ hasAircon: false }), { ...NO_FILTERS, aircon: true }, TODAY),
    ).toBe(false);
    expect(
      matchesFilters(makeListing(), { ...NO_FILTERS, food: true, aircon: true }, TODAY),
    ).toBe(true);
  });

  it("deal：急放或特價", () => {
    expect(
      matchesFilters(makeListing(), { ...NO_FILTERS, deal: true }, TODAY),
    ).toBe(false);
    expect(
      matchesFilters(makeListing({ isUrgent: true }), { ...NO_FILTERS, deal: true }, TODAY),
    ).toBe(true);
    expect(
      matchesFilters(makeListing({ isDiscounted: true }), { ...NO_FILTERS, deal: true }, TODAY),
    ).toBe(true);
  });
});

describe("compareListings / applyFilters", () => {
  it("急放行先，再按最近開始日期，最後最新建立", () => {
    const urgent = makeListing({
      id: "urgent",
      isUrgent: true,
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const soon = makeListing({
      id: "soon",
      startDate: "2026-09-20",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const later = makeListing({
      id: "later",
      startDate: "2026-09-25",
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    const sorted = applyFilters([later, urgent, soon], NO_FILTERS, TODAY);
    expect(sorted.map((l) => l.id)).toEqual(["urgent", "soon", "later"]);
  });

  it("冇 start_date 排最後", () => {
    const withDate = makeListing({ id: "d", startDate: "2026-09-10" });
    const noDate = makeListing({ id: "n", startDate: null, endDate: null });
    expect(compareListings(noDate, withDate)).toBe(1);
  });
});

describe("parseFilters", () => {
  it("解析合法參數", () => {
    const f = parseFilters({
      q: "  旺角  ",
      date: "2026-09-10",
      maxBudget: "800",
      food: "1",
      aircon: "on",
      deal: "true",
    });
    expect(f.q).toBe("旺角");
    expect(f.date).toBe("2026-09-10");
    expect(f.maxBudget).toBe(800);
    expect(f.food).toBe(true);
    expect(f.aircon).toBe(true);
    expect(f.deal).toBe(true);
  });

  it("非法日期同預算變 null / 0", () => {
    const f = parseFilters({ date: "10-09-2026", maxBudget: "abc" });
    expect(f.date).toBeNull();
    expect(f.maxBudget).toBeNull();
  });

  it("負數或零預算視為冇設", () => {
    expect(parseFilters({ maxBudget: "-5" }).maxBudget).toBeNull();
    expect(parseFilters({ maxBudget: "0" }).maxBudget).toBeNull();
  });

  it("array 參數取第一個", () => {
    expect(parseFilters({ q: ["旺角", "第二"] }).q).toBe("旺角");
  });
});

describe("normalizeWhatsappLink", () => {
  it("已有 http(s) 連結原用", () => {
    expect(normalizeWhatsappLink("https://wa.me/85212345678")).toBe(
      "https://wa.me/85212345678",
    );
  });

  it("wa.me 開頭補 scheme", () => {
    expect(normalizeWhatsappLink("wa.me/85212345678")).toBe(
      "https://wa.me/85212345678",
    );
  });

  it("淨數字當電話號碼", () => {
    expect(normalizeWhatsappLink("852 1234 5678")).toBe(
      "https://wa.me/85212345678",
    );
  });

  it("無效或空白回 null", () => {
    expect(normalizeWhatsappLink("")).toBeNull();
    expect(normalizeWhatsappLink(null)).toBeNull();
    expect(normalizeWhatsappLink("whatsapp 我啦")).toBeNull();
  });
});

describe("formatDateLabel", () => {
  it("單日", () => {
    expect(formatDateLabel(makeListing({ sessionDates: ["2026-09-05"] }))).toBe(
      "2026-09-05",
    );
  });

  it("斷續多日顯示範圍同日數", () => {
    expect(
      formatDateLabel(makeListing({ sessionDates: ["2026-09-05", "2026-09-12"] })),
    ).toBe("2026-09-05 至 2026-09-12（共 2 日）");
  });

  it("連續範圍", () => {
    expect(
      formatDateLabel(makeListing({ startDate: "2026-09-10", endDate: "2026-09-12" })),
    ).toBe("2026-09-10 至 2026-09-12");
  });

  it("冇日期顯示待確認", () => {
    expect(
      formatDateLabel(makeListing({ startDate: null, endDate: null })),
    ).toBe("日期待確認");
  });
});

describe("todayInHongKong", () => {
  it("UTC 23:00 計香港次日", () => {
    // 2026-09-02 23:30 UTC = 2026-09-03 07:30 香港
    expect(todayInHongKong(new Date("2026-09-02T23:30:00.000Z"))).toBe(
      "2026-09-03",
    );
  });
});
