import { describe, expect, it } from "vitest";
import {
  appealScore,
  clarityScore,
  featuredTier,
  pickFeatured,
  priceScore,
  scoreForFeatured,
} from "../src/lib/featured-ranking.js";
import type { PublicListing } from "../src/lib/listing-types.js";

const TODAY = "2026-09-06";

function makeListing(overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    id: "id",
    title: "場地",
    district: "中西區",
    venueName: "某某商場",
    areaType: "mall",
    startDate: "2026-09-10",
    endDate: "2026-09-12",
    sessionDates: [],
    priceText: "$800/日",
    priceAmountHkd: 800,
    priceUnit: "day",
    boothSizeText: "3粒",
    contactText: null,
    contactWhatsappLink: "https://wa.me/85212345678",
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
    photoCount: 2,
    createdAt: "2026-09-01T00:00:00.000Z",
    realPhotoCount: 1,
    stockPhotoCount: 1,
    firstPhotoKind: "real",
    isFeatured: false,
    featuredAt: null,
    isLinkReit: false,
    ...overrides,
  };
}

describe("clarityScore", () => {
  it("全部欄位齊 = 100", () => {
    expect(clarityScore(makeListing())).toBe(100);
  });

  it("完全冇資料 = 0", () => {
    expect(
      clarityScore(
        makeListing({
          priceAmountHkd: null,
          contactWhatsappLink: null,
          contactText: null,
          hasAircon: null,
          venueName: null,
          district: null,
          summary: "",
          startDate: null,
          endDate: null,
          sessionDates: [],
          photoCount: 0,
        }),
      ),
    ).toBe(0);
  });

  it("5 個欄位 null 晒 = 50%（剩 4/8）", () => {
    expect(
      clarityScore(
        makeListing({
          priceAmountHkd: null,
          contactWhatsappLink: null,
          contactText: null,
          hasAircon: null,
          venueName: null,
        }),
      ),
    ).toBe(50); // district/photo/summary/startDate 仍然齊 = 4/8
  });

  it("空字串 summary 當冇填", () => {
    expect(
      clarityScore(makeListing({ summary: "   " })),
    ).toBeLessThan(clarityScore(makeListing({ summary: "內容" })));
  });
});

describe("priceScore", () => {
  const cheap = makeListing({ id: "cheap", priceAmountHkd: 500, areaType: "mall" });
  const mid = makeListing({ id: "mid", priceAmountHkd: 1000, areaType: "mall" });
  const exp = makeListing({ id: "exp", priceAmountHkd: 2000, areaType: "mall" });
  const peers = [cheap, mid, exp];

  it("最平滿分", () => {
    expect(priceScore(cheap, peers)).toBe(100);
  });

  it("最貴 0 分", () => {
    expect(priceScore(exp, peers)).toBe(0);
  });

  it("中間約 50 分", () => {
    const s = priceScore(mid, peers);
    expect(s).toBeGreaterThanOrEqual(40);
    expect(s).toBeLessThanOrEqual(60);
  });

  it("冇價錢 = 0 分", () => {
    expect(priceScore(makeListing({ priceAmountHkd: null }), peers)).toBe(0);
  });

  it("peer 入面冇同 area_type = 0 分", () => {
    const lone = makeListing({ areaType: "industrial", priceAmountHkd: 500 });
    expect(priceScore(lone, peers)).toBe(0);
  });

  it("只有自己一個 peer = 100 分", () => {
    const alone = makeListing({ id: "solo", priceAmountHkd: 500, areaType: "mall" });
    expect(priceScore(alone, [alone])).toBe(100);
  });
});

describe("appealScore", () => {
  it("pop_up_event + 旺位 + 多相 + 冷氣 = 接近滿分", () => {
    const s = appealScore(
      makeListing({
        areaType: "pop_up_event",
        isPrimeSpot: true,
        photoCount: 4,
        hasAircon: true,
        isCartSpot: true,
        requiresProductApproval: false,
      }),
    );
    expect(s).toBeGreaterThanOrEqual(85);
  });

  it("unknown area_type 唔應該拎好多分（隔離 real photo boost）", () => {
    const s = appealScore(
      makeListing({ areaType: "unknown", realPhotoCount: 0, stockPhotoCount: 0, photoCount: 0 }),
    );
    expect(s).toBeLessThan(30);
  });

  it("產品要審批會被扣分", () => {
    const baseline = appealScore(makeListing());
    const withApproval = appealScore(
      makeListing({ requiresProductApproval: true }),
    );
    expect(withApproval).toBeLessThan(baseline);
  });

  it("急放 / 特價輕微扣分", () => {
    const baseline = appealScore(makeListing());
    const urgent = appealScore(makeListing({ isUrgent: true }));
    expect(urgent).toBeLessThan(baseline);
  });

  it("clamp 喺 0..100", () => {
    const s = appealScore(makeListing({ areaType: "unknown" }));
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("scoreForFeatured", () => {
  it("40/30/30 加權後出 0..100", () => {
    const l = makeListing();
    const peers = [l, makeListing({ priceAmountHkd: 1500 })];
    const s = scoreForFeatured(l, peers);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("pickFeatured", () => {
  it("過期場地唔揀", () => {
    const expired = makeListing({
      id: "expired",
      endDate: "2026-08-01",
      photoCount: 3,
    });
    const result = pickFeatured([expired], TODAY, 5);
    expect(result).toHaveLength(0);
  });

  it("冇相唔揀", () => {
    const noPhoto = makeListing({ id: "noPhoto", photoCount: 0 });
    expect(pickFeatured([noPhoto], TODAY, 5)).toHaveLength(0);
  });

  it("同 featured_at 用 score tie-break：高分排前面", () => {
    const good = makeListing({
      id: "good",
      areaType: "pop_up_event",
      priceAmountHkd: 500,
      photoCount: 4,
      isPrimeSpot: true,
      hasAircon: true,
      isFeatured: true,
      featuredAt: "2026-09-06T10:00:00Z",
    });
    const bad = makeListing({
      id: "bad",
      areaType: "unknown",
      priceAmountHkd: null,
      photoCount: 1,
      hasAircon: null,
      venueName: null,
      district: null,
      summary: "",
      startDate: null,
      endDate: null,
      sessionDates: [],
      contactText: null,
      contactWhatsappLink: null,
      isFeatured: true,
      featuredAt: "2026-09-06T10:00:00Z",
    });
    const result = pickFeatured([bad, good], TODAY, 5);
    expect(result[0]?.id).toBe("good");
  });

  it("limit 5 最多拎 5 個", () => {
    const all = Array.from({ length: 10 }, (_, i) =>
      makeListing({ id: `l${i}`, isFeatured: true, featuredAt: `2026-09-${String(i + 1).padStart(2, "0")}T10:00:00Z` }),
    );
    expect(pickFeatured(all, TODAY, 5)).toHaveLength(5);
  });

  it("limit 預設 = 5", () => {
    const all = Array.from({ length: 10 }, (_, i) =>
      makeListing({ id: `l${i}`, isFeatured: true, featuredAt: `2026-09-${String(i + 1).padStart(2, "0")}T10:00:00Z` }),
    );
    expect(pickFeatured(all, TODAY)).toHaveLength(5);
  });

  it("同分時新建立排前面（同 featured_at）", () => {
    const old = makeListing({
      id: "old",
      createdAt: "2026-08-01T00:00:00.000Z",
      isFeatured: true,
      featuredAt: "2026-09-06T10:00:00Z",
    });
    const newer = makeListing({
      id: "new",
      createdAt: "2026-09-05T00:00:00.000Z",
      isFeatured: true,
      featuredAt: "2026-09-06T10:00:00Z",
    });
    const result = pickFeatured([old, newer], TODAY, 5);
    expect(result[0]?.id).toBe("new");
  });
});

describe("realPhotoCount 對精選嘅影響", () => {
  it("同條件下有真實相 > 全部 stock（scoreForFeatured 加分）", () => {
    // scoreForFeatured 仍然畀 real photo 加分；人手 is_featured 排序唔影響 score 邏輯。
    const withReal = makeListing({
      id: "withReal",
      realPhotoCount: 2,
      stockPhotoCount: 0,
      photoCount: 2,
      firstPhotoKind: "real",
      isFeatured: true,
      featuredAt: "2026-09-06T10:00:00Z",
    });
    const allStock = makeListing({
      id: "allStock",
      realPhotoCount: 0,
      stockPhotoCount: 2,
      photoCount: 2,
      firstPhotoKind: "stock",
      isFeatured: true,
      featuredAt: "2026-09-06T10:00:00Z",
    });
    const peers = [withReal, allStock];
    expect(scoreForFeatured(withReal, peers)).toBeGreaterThan(
      scoreForFeatured(allStock, peers),
    );
    // 同 featured_at → score tie-break → allStock 排先（因為 createdAt 較新 by default）
    const result = pickFeatured(peers, "2026-09-06", 5);
    expect(result).toHaveLength(2);
  });

  it(">=3 真實相 比 1 真實相拎多啲", () => {
    const oneReal = makeListing({
      id: "one",
      realPhotoCount: 1,
      stockPhotoCount: 0,
      photoCount: 1,
      firstPhotoKind: "real",
    });
    const threeReal = makeListing({
      id: "three",
      realPhotoCount: 3,
      stockPhotoCount: 0,
      photoCount: 3,
      firstPhotoKind: "real",
    });
    expect(scoreForFeatured(threeReal, [oneReal, threeReal])).toBeGreaterThan(
      scoreForFeatured(oneReal, [oneReal, threeReal]),
    );
  });
});
describe("featuredTier（real photo vs stock）", () => {
  it("real + price = tier 1（最高）", () => {
    expect(
      featuredTier(
        makeListing({ realPhotoCount: 1, priceAmountHkd: 100 }),
      ),
    ).toBe(1);
  });
  it("冇 real（只有 stock）+ price = tier 2", () => {
    expect(
      featuredTier(
        makeListing({ realPhotoCount: 0, stockPhotoCount: 1, priceAmountHkd: 100 }),
      ),
    ).toBe(2);
  });
  it("real + 冇價 = tier 3", () => {
    expect(
      featuredTier(
        makeListing({ realPhotoCount: 2, priceAmountHkd: null }),
      ),
    ).toBe(3);
  });
  it("冇 real + 冇價 = tier 4（最低）", () => {
    expect(
      featuredTier(
        makeListing({ realPhotoCount: 0, priceAmountHkd: null }),
      ),
    ).toBe(4);
  });
});

describe("pickFeatured 精選控制（人手 is_featured 模式）", () => {
  // 設計：admin 喺 review page 設定 is_featured；featured_at DESC 排序（最新先）。
  // 第 6 個跌出 5-slot window。同 featured_at 用 scoreForFeatured tie-break。

  it("is_featured=false 嘅 listing 完全唔揀", () => {
    const off = makeListing({ id: "off", isFeatured: false, featuredAt: null });
    const on = makeListing({ id: "on", isFeatured: true, featuredAt: "2026-09-06T10:00:00Z" });
    const result = pickFeatured([off, on], TODAY, 5);
    expect(result.map((l) => l.id)).toEqual(["on"]);
  });

  it("冇 featured_at 嘅唔揀（就算 is_featured=true）", () => {
    const noTs = makeListing({ id: "noTs", isFeatured: true, featuredAt: null });
    expect(pickFeatured([noTs], TODAY, 5)).toHaveLength(0);
  });

  it("featured_at DESC：最新 featured 排前面", () => {
    const old = makeListing({ id: "old", isFeatured: true, featuredAt: "2026-09-01T10:00:00Z" });
    const mid = makeListing({ id: "mid", isFeatured: true, featuredAt: "2026-09-04T10:00:00Z" });
    const newer = makeListing({ id: "new", isFeatured: true, featuredAt: "2026-09-06T10:00:00Z" });
    const result = pickFeatured([old, mid, newer], TODAY, 5);
    expect(result.map((l) => l.id)).toEqual(["new", "mid", "old"]);
  });

  it("limit 5：第 6 個跌出 window", () => {
    const all = Array.from({ length: 6 }, (_, i) =>
      makeListing({
        id: `l${i}`,
        isFeatured: true,
        featuredAt: `2026-09-0${6 - i}T10:00:00Z`,
      }),
    );
    const result = pickFeatured(all, TODAY, 5);
    expect(result).toHaveLength(5);
    expect(result[0]?.id).toBe("l0");
    expect(result.find((l) => l.id === "l5")).toBeUndefined();
  });

  it("limit 預設 = 5", () => {
    const all = Array.from({ length: 10 }, (_, i) =>
      makeListing({
        id: `l${i}`,
        isFeatured: true,
        featuredAt: `2026-09-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
      }),
    );
    expect(pickFeatured(all, TODAY)).toHaveLength(5);
  });

  it("過期 featured 都唔揀", () => {
    const expired = makeListing({
      id: "exp",
      isFeatured: true,
      featuredAt: "2026-09-01T10:00:00Z",
      endDate: "2026-09-05",
    });
    const active = makeListing({
      id: "ok",
      isFeatured: true,
      featuredAt: "2026-09-06T10:00:00Z",
      endDate: "2026-09-30",
    });
    const result = pickFeatured([expired, active], TODAY, 5);
    expect(result.map((l) => l.id)).toEqual(["ok"]);
  });

  it("冇相嘅 featured 唔揀", () => {
    const noPhoto = makeListing({
      id: "np",
      isFeatured: true,
      featuredAt: "2026-09-06T10:00:00Z",
      photoCount: 0,
      realPhotoCount: 0,
      stockPhotoCount: 0,
    });
    const ok = makeListing({
      id: "ok",
      isFeatured: true,
      featuredAt: "2026-09-06T11:00:00Z",
    });
    const result = pickFeatured([noPhoto, ok], TODAY, 5);
    expect(result.map((l) => l.id)).toEqual(["ok"]);
  });

  it("同 featured_at 時用 scoreForFeatured tie-break（高分先）", () => {
    const low = makeListing({
      id: "low",
      isFeatured: true,
      featuredAt: "2026-09-06T10:00:00Z",
      district: null,
      venueName: null,
      summary: "",
      hasAircon: null,
    });
    const high = makeListing({
      id: "high",
      isFeatured: true,
      featuredAt: "2026-09-06T10:00:00Z",
      district: "中西區",
      venueName: "朗豪坊",
      summary: "完整資料",
      hasAircon: true,
      isPrimeSpot: true,
    });
    const result = pickFeatured([low, high], TODAY, 5);
    expect(result[0]?.id).toBe("high");
    expect(result[1]?.id).toBe("low");
  });

  it("is_featured=true 嘅 listing 唔受 tier / score 自動影響（人手控制）", () => {
    const lowScoreFeatured = makeListing({
      id: "lowFeat",
      isFeatured: true,
      featuredAt: "2026-09-06T10:00:00Z",
      district: null,
      venueName: null,
      summary: "",
      photoCount: 1,
      realPhotoCount: 0,
      stockPhotoCount: 1,
      firstPhotoKind: "stock",
    });
    const result = pickFeatured([lowScoreFeatured], TODAY, 5);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("lowFeat");
  });
});