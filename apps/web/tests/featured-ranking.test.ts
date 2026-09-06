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

  it("高分排前面", () => {
    const good = makeListing({
      id: "good",
      areaType: "pop_up_event",
      priceAmountHkd: 500,
      photoCount: 4,
      isPrimeSpot: true,
      hasAircon: true,
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
    });
    const result = pickFeatured([bad, good], TODAY, 5);
    expect(result[0]?.id).toBe("good");
  });

  it("limit 5 最多拎 5 個", () => {
    const all = Array.from({ length: 10 }, (_, i) =>
      makeListing({ id: `l${i}` }),
    );
    expect(pickFeatured(all, TODAY, 5)).toHaveLength(5);
  });

  it("limit 預設 = 6", () => {
    const all = Array.from({ length: 10 }, (_, i) =>
      makeListing({ id: `l${i}` }),
    );
    expect(pickFeatured(all, TODAY)).toHaveLength(6);
  });

  it("同分時新建立排前面", () => {
    const old = makeListing({
      id: "old",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const newer = makeListing({
      id: "new",
      createdAt: "2026-09-05T00:00:00.000Z",
    });
    const result = pickFeatured([old, newer], TODAY, 5);
    expect(result[0]?.id).toBe("new");
  });
});

describe("realPhotoCount 對精選嘅影響", () => {
  it("同條件下有真實相 > 全部 stock", () => {
    const withReal = makeListing({
      id: "withReal",
      realPhotoCount: 2,
      stockPhotoCount: 0,
      photoCount: 2,
      firstPhotoKind: "real",
    });
    const allStock = makeListing({
      id: "allStock",
      realPhotoCount: 0,
      stockPhotoCount: 2,
      photoCount: 2,
      firstPhotoKind: "stock",
    });
    const peers = [withReal, allStock];
    expect(scoreForFeatured(withReal, peers)).toBeGreaterThan(
      scoreForFeatured(allStock, peers),
    );
    expect(pickFeatured(peers, "2026-09-06", 5)[0]?.id).toBe("withReal");
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

describe("pickFeatured 嚴格 tier 排序（real photo 優先）", () => {
  it("tier 1（real+price）永遠贏 tier 2（stock+price），無論 score 幾差", () => {
    // tier 1: 有 real 1 張 + 有價，但其他資料極差
    const tier1_bad = makeListing({
      id: "t1bad",
      realPhotoCount: 1,
      stockPhotoCount: 0,
      photoCount: 1,
      priceAmountHkd: 100,
      district: null,
      venueName: null,
      summary: "",
      startDate: null,
      endDate: null,
      sessionDates: [],
      contactText: null,
      contactWhatsappLink: null,
      hasAircon: null,
    });
    // tier 2: 只有 stock + 有價，但其他資料完美
    const tier2_good = makeListing({
      id: "t2good",
      realPhotoCount: 0,
      stockPhotoCount: 2,
      photoCount: 2,
      priceAmountHkd: 100,
      district: "中西區",
      venueName: "朗豪坊",
      summary: "完整資料",
      hasAircon: true,
      isPrimeSpot: true,
    });
    const result = pickFeatured([tier2_good, tier1_bad], TODAY, 5);
    expect(result[0]?.id).toBe("t1bad");
    expect(result[1]?.id).toBe("t2good");
  });

  it("tier 2（stock+price）永遠贏 tier 3（real+no price）", () => {
    const tier2 = makeListing({
      id: "t2",
      realPhotoCount: 0,
      stockPhotoCount: 1,
      photoCount: 1,
      priceAmountHkd: 100,
      district: null,
      venueName: null,
      summary: "",
      hasAircon: null,
    });
    const tier3 = makeListing({
      id: "t3",
      realPhotoCount: 3,
      stockPhotoCount: 0,
      photoCount: 3,
      priceAmountHkd: null,
      district: "中西區",
      venueName: "朗豪坊",
      summary: "完整資料",
      hasAircon: true,
      isPrimeSpot: true,
    });
    const result = pickFeatured([tier3, tier2], TODAY, 5);
    expect(result[0]?.id).toBe("t2");
    expect(result[1]?.id).toBe("t3");
  });

  it("tier 4（冇 real+冇價）會被 pickFeatured 過濾走（photoCount=0）", () => {
    const tier4 = makeListing({
      id: "t4",
      realPhotoCount: 0,
      stockPhotoCount: 0,
      photoCount: 0,
      priceAmountHkd: null,
    });
    const tier1 = makeListing({
      id: "t1",
      realPhotoCount: 1,
      stockPhotoCount: 0,
      photoCount: 1,
      priceAmountHkd: 100,
    });
    const result = pickFeatured([tier4, tier1], TODAY, 5);
    expect(result.map((l) => l.id)).toEqual(["t1"]);
  });

  it("同 tier 入面 score 高排前面", () => {
    const t1_low = makeListing({
      id: "t1low",
      realPhotoCount: 1,
      priceAmountHkd: 100,
      district: null,
      venueName: null,
      summary: "",
      hasAircon: null,
    });
    const t1_high = makeListing({
      id: "t1high",
      realPhotoCount: 1,
      priceAmountHkd: 100,
      district: "中西區",
      venueName: "朗豪坊",
      summary: "完整資料",
      hasAircon: true,
      isPrimeSpot: true,
    });
    const result = pickFeatured([t1_low, t1_high], TODAY, 5);
    expect(result[0]?.id).toBe("t1high");
    expect(result[1]?.id).toBe("t1low");
  });
});