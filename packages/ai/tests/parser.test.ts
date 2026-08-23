import { describe, expect, it } from "vitest";
import { parseVenuePost } from "../src/parser.js";
import type { IntakeInput, ParseResult } from "../src/types.js";

const input: IntakeInput = {
  rawContent: `
代客急放
8月23-24日
葵涌邨 大場
3號位 特價 $1600/日
4粒，近街市，要報貨
有意 WhatsApp 9123 4567
  `.trim(),
  sourceType: "whatsapp_forward",
  sourceLabel: "測試來源",
  sourceUrl: "https://example.com/post/1",
  receivedAt: "2026-08-23T10:00:00.000Z",
};

const mockVenueResult: Omit<ParseResult, "status"> = {
  draft: {
    title: "葵涌邨大場 3號位",
    district: "葵涌",
    venueName: "葵涌邨大場",
    startDate: "2026-08-23",
    endDate: "2026-08-24",
    priceText: "$1600/日",
    priceAmountHkd: 1600,
    priceUnit: "day",
    boothSizeText: "4粒",
    contactText: "WhatsApp 9123 4567",
    contactWhatsappLink: "https://wa.me/85291234567",
    areaType: "market",
    hasAircon: null,
    isPrimeSpot: false,
    isCartSpot: false,
    allowsFood: null,
    allowsDryGoods: true,
    allowsBeauty: null,
    allowsService: null,
    requiresProductApproval: true,
    isUrgent: true,
    isDiscounted: true,
    summary: "葵涌邨大場近街市，8月23至24日4粒位，特價$1600/日。",
  },
  confidenceScore: 86,
  lowConfidenceFields: ["hasAircon", "allowsFood"],
  unconfirmedFields: ["hasAircon", "allowsFood"],
  reviewNote: "日期、價錢、地區清楚；冷氣同可售產品未見列明。",
};

describe("parseVenuePost", () => {
  it("returns a structured venue draft from LLM JSON", async () => {
    const result = await parseVenuePost(input, async () => mockVenueResult);

    expect(result.status).toBe("needs_review");
    expect(result.draft.district).toBe("葵涌");
    expect(result.draft.priceAmountHkd).toBe(1600);
    expect(result.draft.isUrgent).toBe(true);
    expect(result.lowConfidenceFields).toContain("hasAircon");
  });

  it("rejects content that does not look like a venue post", async () => {
    const result = await parseVenuePost(
      {
        ...input,
        rawContent: "今日午餐食什麼？",
      },
      async () => {
        throw new Error("LLM should not be called for obvious non-venue input");
      },
    );

    expect(result.status).toBe("rejected");
    expect(result.reviewNote).toContain("唔似場地貼文");
  });

  it("keeps missing essential fields in review state", async () => {
    const result = await parseVenuePost(
      {
        ...input,
        rawContent: "葵涌有場，4粒，有意 WhatsApp 9123 4567",
      },
      async () => ({
        ...mockVenueResult,
        draft: {
          ...mockVenueResult.draft,
          startDate: null,
          endDate: null,
          priceText: null,
        },
        confidenceScore: 52,
        lowConfidenceFields: ["startDate", "endDate", "priceText"],
        unconfirmedFields: ["startDate", "endDate", "priceText"],
        reviewNote: "缺少日期同價錢，需要補充。",
      }),
    );

    expect(result.status).toBe("needs_review");
    expect(result.draft.startDate).toBeNull();
    expect(result.draft.priceText).toBeNull();
    expect(result.lowConfidenceFields).toContain("priceText");
  });
});
