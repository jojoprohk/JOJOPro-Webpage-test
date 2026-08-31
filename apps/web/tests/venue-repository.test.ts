import { describe, expect, it } from "vitest";
import type { IntakeInput, ParseResult } from "@jopojo/ai";
import { createVenueRepository } from "../src/lib/venue-repository.js";

const input: IntakeInput = {
  rawContent: "屯門市廣場 2粒 $1000/日 WhatsApp 91234567",
  sourceType: "telegram",
  sourceLabel: "Telegram",
  receivedAt: "2026-08-24T10:00:00.000Z",
};

function makeResult(): ParseResult {
  return {
    status: "needs_review",
    allAgentListings: false,
    reviewNote: "測試 repository mapping。",
    entries: [
      {
        draft: {
          title: "屯門市廣場2粒",
          district: "屯門",
          venueName: "屯門市廣場",
          sessionDates: [],
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
        isAgentListing: false,
      },
    ],
  };
}

// 輕量假 Supabase client：記低 insert 嘅 table 同行數。
function fakeSupabase() {
  const inserts: Array<{ table: string; rows: unknown[] }> = [];
  let idCounter = 0;

  const client = {
    from(table: string) {
      return {
        insert(rows: unknown) {
          const arr = Array.isArray(rows) ? rows : [rows];
          inserts.push({ table, rows: arr });
          return {
            select() {
              const data = arr.map(() => ({ id: `id-${++idCounter}` }));
              const p = Promise.resolve({ data, error: null });
              return {
                then: (
                  onFulfilled?: (v: { data: { id: string }[] }) => unknown,
                  onRejected?: (e: unknown) => unknown,
                ) => p.then(onFulfilled, onRejected),
                single: () =>
                  Promise.resolve({ data: data[0], error: null }),
              };
            },
          };
        },
      };
    },
  };

  return { client: client as never, inserts };
}

describe("createVenueRepository", () => {
  it("saves one intake plus one row per venue draft", async () => {
    const { client, inserts } = fakeSupabase();
    const repo = createVenueRepository(client);

    const result = makeResult();
    const saved = await repo.saveIntakeAndDrafts(input, result);

    expect(inserts.map((i) => i.table)).toEqual([
      "intake_items",
      "venue_drafts",
    ]);
    const draftRows = inserts.find((i) => i.table === "venue_drafts");
    expect(draftRows?.rows).toHaveLength(1);
    const row = draftRows?.rows[0] as Record<string, unknown>;
    expect(row.status).toBe("needs_review");
    expect(row.venue_name).toBe("屯門市廣場");
    expect(row.price_amount_hkd).toBe(1000);
    expect(row.contact_whatsapp_link).toBe("https://wa.me/85291234567");
    expect(saved.venueDraftIds).toHaveLength(1);
  });

  it("saves only the intake (no drafts) for skipped posts", async () => {
    const { client, inserts } = fakeSupabase();
    const repo = createVenueRepository(client);

    await repo.saveIntakeOnly(input);

    expect(inserts.map((i) => i.table)).toEqual(["intake_items"]);
  });
});
