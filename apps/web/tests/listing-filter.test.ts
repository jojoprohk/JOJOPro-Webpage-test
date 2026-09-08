import { describe, expect, it } from "vitest";
import {
  applyFilters,
  compareListings,
  extractContactUrl,
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
    realPhotoCount: 0,
    stockPhotoCount: 0,
    firstPhotoKind: "none",
    isFeatured: false,
    featuredAt: null,
    isLinkReit: false,
    ...overrides,
  };
}

const NO_FILTERS: ListingFilters = {
  q: "",
  date: null,
  areaType: null,
  district: null,
  maxBudget: null,
  food: false,
  aircon: false,
  deal: false,
  linkReit: false,
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

  it("地區用標準 18 區名時，口語搜尋都搵到（旺角→油尖旺區）", () => {
    const listing = makeListing({ district: "油尖旺區", title: "朗豪坊場", venueName: "朗豪坊" });
    expect(matchesFilters(listing, { ...NO_FILTERS, q: "旺角" }, TODAY)).toBe(true);
    expect(matchesFilters(listing, { ...NO_FILTERS, q: "油尖旺" }, TODAY)).toBe(true);
    expect(matchesFilters(listing, { ...NO_FILTERS, q: "油尖旺區" }, TODAY)).toBe(true);
  });

  it("大區統稱：九龍對到九龍五區、港島對到港島四區、新界對到新界九區", () => {
    const mk = makeListing({ district: "油尖旺區", title: "旺角場" });
    const ssp = makeListing({ district: "深水埗區", title: "深水埗場" });
    const tm = makeListing({ district: "屯門區", title: "屯門場" });
    const central = makeListing({ district: "中西區", title: "中環場" });
    // 打「九龍」或「九龍區」都要對到九龍五區。
    for (const q of ["九龍", "九龍區"]) {
      expect(matchesFilters(mk, { ...NO_FILTERS, q }, TODAY)).toBe(true);
      expect(matchesFilters(ssp, { ...NO_FILTERS, q }, TODAY)).toBe(true);
      expect(matchesFilters(tm, { ...NO_FILTERS, q }, TODAY)).toBe(false);
      expect(matchesFilters(central, { ...NO_FILTERS, q }, TODAY)).toBe(false);
    }
    // 打「新界」對到屯門（新界），唔對九龍／港島。
    expect(matchesFilters(tm, { ...NO_FILTERS, q: "新界" }, TODAY)).toBe(true);
    expect(matchesFilters(mk, { ...NO_FILTERS, q: "新界" }, TODAY)).toBe(false);
    // 打「港島」對到中環（中西區）。
    expect(matchesFilters(central, { ...NO_FILTERS, q: "港島" }, TODAY)).toBe(true);
    expect(matchesFilters(mk, { ...NO_FILTERS, q: "港島" }, TODAY)).toBe(false);
  });

  it("下拉篩選：舖位類型同地區（含大區）", () => {
    const mkMarket = makeListing({ district: "油尖旺區", areaType: "market" });
    const tmMall = makeListing({ district: "屯門區", areaType: "mall" });

    // 類型篩選：只留 market。
    expect(matchesFilters(mkMarket, { ...NO_FILTERS, areaType: "market" }, TODAY)).toBe(true);
    expect(matchesFilters(tmMall, { ...NO_FILTERS, areaType: "market" }, TODAY)).toBe(false);

    // 地區下拉選單一區。
    expect(matchesFilters(mkMarket, { ...NO_FILTERS, district: "油尖旺區" }, TODAY)).toBe(true);
    expect(matchesFilters(tmMall, { ...NO_FILTERS, district: "油尖旺區" }, TODAY)).toBe(false);

    // 地區下拉選「九龍（全區）」→ 油尖旺中、屯門唔中。
    expect(matchesFilters(mkMarket, { ...NO_FILTERS, district: "kowloon" }, TODAY)).toBe(true);
    expect(matchesFilters(tmMall, { ...NO_FILTERS, district: "kowloon" }, TODAY)).toBe(false);

    // 類型＋地區一齊用。
    expect(
      matchesFilters(mkMarket, { ...NO_FILTERS, areaType: "market", district: "kowloon" }, TODAY),
    ).toBe(true);
    expect(
      matchesFilters(tmMall, { ...NO_FILTERS, areaType: "market", district: "kowloon" }, TODAY),
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

  it("只睇領展場地：isLinkReit=false 嘅場地會被排除", () => {
    expect(
      matchesFilters(makeListing({ isLinkReit: false }), { ...NO_FILTERS, linkReit: true }, TODAY),
    ).toBe(false);
  });

  it("只睇領展場地：isLinkReit=true 嘅場地會被保留", () => {
    expect(
      matchesFilters(makeListing({ isLinkReit: true }), { ...NO_FILTERS, linkReit: true }, TODAY),
    ).toBe(true);
  });

  it("唔剔 linkReit：所有場地都會被保留", () => {
    expect(
      matchesFilters(makeListing({ isLinkReit: false }), { ...NO_FILTERS, linkReit: false }, TODAY),
    ).toBe(true);
    expect(
      matchesFilters(makeListing({ isLinkReit: true }), { ...NO_FILTERS, linkReit: false }, TODAY),
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
      linkReit: "1",
    });
    expect(f.q).toBe("旺角");
    expect(f.date).toBe("2026-09-10");
    expect(f.maxBudget).toBe(800);
    expect(f.food).toBe(true);
    expect(f.aircon).toBe(true);
    expect(f.deal).toBe(true);
    expect(f.linkReit).toBe(true);
  });

  it("缺省 linkReit 為 false", () => {
    expect(parseFilters({}).linkReit).toBe(false);
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


describe("extractContactUrl", () => {
  it("null / 空字 = null", () => {
    expect(extractContactUrl(null)).toBeNull();
    expect(extractContactUrl("")).toBeNull();
  });

  it("https URL", () => {
    expect(extractContactUrl("https://instagram.com/abc")).toBe(
      "https://instagram.com/abc",
    );
    expect(extractContactUrl("https://wa.me/85212345678")).toBe(
      "https://wa.me/85212345678",
    );
  });

  it("wa.me / t.me 自動補 https://", () => {
    expect(extractContactUrl("wa.me/85212345678")).toBe(
      "https://wa.me/85212345678",
    );
    expect(extractContactUrl("t.me/abc")).toBe("https://t.me/abc");
  });

  it("context 前綴（IG: @xxx）入面有 URL 抽得到", () => {
    expect(extractContactUrl("IG: @reu_funfest")).toBeNull();
    expect(extractContactUrl("IG: @reu_funfest https://instagram.com/reu_funfest")).toBe(
      "https://instagram.com/reu_funfest",
    );
  });

  it("純文字 username = null", () => {
    expect(extractContactUrl("IG: @abc")).toBeNull();
    expect(extractContactUrl("請致電 12345678")).toBeNull();
  });
});