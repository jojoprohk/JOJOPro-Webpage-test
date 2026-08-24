import { describe, expect, it } from "vitest";
import type { IntakeInput, ParseResult } from "@jopojo/ai";
import { processTelegramIntake } from "../src/lib/telegram-intake-service.js";

const input: IntakeInput = {
  rawContent: "大埔廣場 4粒 $900/日 有意 WhatsApp 91234567",
  sourceType: "telegram",
  sourceLabel: "測試場地群",
  sourceUrl: "https://example.com/post/1",
  receivedAt: "2026-08-24T10:00:00.000Z",
};

const parseResult: ParseResult = {
  status: "needs_review",
  draft: {
    title: "大埔廣場4粒",
    district: "大埔",
    venueName: "大埔廣場",
    startDate: "2026-08-25",
    endDate: "2026-08-25",
    priceText: "$900/日",
    priceAmountHkd: 900,
    priceUnit: "day",
    boothSizeText: "4粒",
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
    summary: "大埔廣場4粒，$900/日。",
  },
  confidenceScore: 82,
  lowConfidenceFields: [],
  unconfirmedFields: [],
  reviewNote: "測試 parse result。",
};

describe("processTelegramIntake", () => {
  it("saves parsed venue drafts", async () => {
    const saved: Array<{ input: IntakeInput; result: ParseResult }> = [];

    const result = await processTelegramIntake({
      update: {
        update_id: 1,
        message: {
          message_id: 1,
          date: 1787555400,
          chat: { id: 1, type: "private" },
          text: input.rawContent,
        },
      },
      parseTelegramUpdate: () => ({
        status: "received",
        input,
        messageId: 1,
        chatId: 1,
      }),
      completeJson: async () => {
        const { status: _status, ...rest } = parseResult;
        return rest;
      },
      repository: {
        async saveIntakeAndDraft(receivedInput, receivedResult) {
          saved.push({ input: receivedInput, result: receivedResult });
          return {
            intakeItemId: "intake-1",
            venueDraftId: "draft-1",
          };
        },
      },
    });

    expect(result.status).toBe("saved");
    expect(saved).toHaveLength(1);
    expect(saved[0]?.result.draft.venueName).toBe("大埔廣場");
  });

  it("does not save ignored updates", async () => {
    const result = await processTelegramIntake({
      update: { update_id: 2 },
      parseTelegramUpdate: () => ({
        status: "ignored",
        reason: "冇文字內容。",
      }),
      completeJson: async () => {
        throw new Error("should not parse ignored updates");
      },
      repository: {
        async saveIntakeAndDraft() {
          throw new Error("should not save ignored updates");
        },
      },
    });

    expect(result.status).toBe("ignored");
  });
});
