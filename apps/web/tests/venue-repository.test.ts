import { describe, expect, it } from "vitest";
import type { IntakeInput, ParseResult } from "@jopojo/ai";
import { mapVenueDraftToRow } from "../src/lib/venue-repository.js";

const input: IntakeInput = {
  rawContent: "屯門市廣場 2粒 $1000/日 WhatsApp 91234567",
  sourceType: "telegram",
  sourceLabel: "Telegram",
  receivedAt: "2026-08-24T10:00:00.000Z",
};

const result: ParseResult = {
  status: "needs_review",
  draft: {
    title: "屯門市廣場2粒",
    district: "屯門",
    venueName: "屯門市廣場",
    startDate: "2026-08-26",
    endDate: "2026-08-26",
    priceText: "$1000/日",
    priceAmountHkd: 1000,
    priceUnit: "day",
    boothSizeText: "2粒",
    contactText: "WhatsApp 91234567",
    contactWhatsappLink: "https://wa.me/85291234567",
    areaType: "mall",
    hasAircon: null,
    isPrimeSpot: false,
    isCartSpot: false,
    allowsFood: null,
    allowsDryGoods: null,
    allowsBeauty: null,
    allowsService: null,
    requiresProductApproval: false,
    isUrgent: false,
    isDiscounted: false,
    summary: "屯門市廣場2粒，$1000/日。",
  },
  confidenceScore: 88,
  lowConfidenceFields: ["hasAircon"],
  unconfirmedFields: ["hasAircon"],
  reviewNote: "測試 repository mapping。",
};

describe("mapVenueDraftToRow", () => {
  it("maps camel-cased parser fields to snake-cased database rows", () => {
    const row = mapVenueDraftToRow({
      intakeItemId: "intake-1",
      result,
    });

    expect(row.intake_item_id).toBe("intake-1");
    expect(row.status).toBe("needs_review");
    expect(row.venue_name).toBe("屯門市廣場");
    expect(row.price_amount_hkd).toBe(1000);
    expect(row.contact_whatsapp_link).toBe("https://wa.me/85291234567");
    expect(row.low_confidence_fields).toEqual(["hasAircon"]);
  });
});
