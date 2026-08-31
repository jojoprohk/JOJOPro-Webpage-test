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

function singleResult(): ParseResult {
  return {
    status: "needs_review",
    allAgentListings: false,
    reviewNote: "",
    entries: [
      {
        draft: {
          title: "大埔廣場4粒",
          district: "大埔",
          venueName: "大埔廣場",
          sessionDates: [],
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
        isAgentListing: false,
      },
    ],
  };
}

function receivedUpdate(chatId = 1) {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: 1787555400,
      chat: { id: chatId, type: "private" as const },
      text: input.rawContent,
    },
  };
}

describe("processTelegramIntake", () => {
  it("saves parsed venue drafts", async () => {
    const draftsSaved: number[] = [];

    const result = await processTelegramIntake({
      update: receivedUpdate(),
      parseTelegramUpdate: () => ({
        status: "received" as const,
        input,
        messageId: 1,
        chatId: 1,
      }),
      completeJson: async () => ({
        isVenuePost: true,
        entries: [
          {
            ...singleResult().entries[0]!,
          },
        ],
      }),
      repository: {
        async saveIntakeAndDrafts(_input, parseResult) {
          draftsSaved.push(parseResult.entries.length);
          return {
            intakeItemId: "intake-1",
            venueDraftIds: ["draft-1"],
          };
        },
        async saveIntakeOnly() {
          throw new Error("should not save intake-only for normal post");
        },
      },
    });

    expect(result.status).toBe("saved");
    expect(result.venueCount).toBe(1);
    expect(draftsSaved).toEqual([1]);
  });

  it("does not save ignored updates", async () => {
    const result = await processTelegramIntake({
      update: { update_id: 2 },
      parseTelegramUpdate: () => ({
        status: "ignored" as const,
        reason: "冇文字內容。",
      }),
      completeJson: async () => {
        throw new Error("should not parse ignored updates");
      },
      repository: {
        async saveIntakeAndDrafts() {
          throw new Error("should not save ignored updates");
        },
        async saveIntakeOnly() {
          throw new Error("should not save ignored updates");
        },
      },
    });

    expect(result.status).toBe("ignored");
  });

  it("does not parse or save updates from unauthorized chats", async () => {
    const result = await processTelegramIntake({
      update: receivedUpdate(999),
      parseTelegramUpdate: () => ({
        status: "received" as const,
        input,
        messageId: 3,
        chatId: 999,
      }),
      completeJson: async () => {
        throw new Error("should not parse unauthorized updates");
      },
      allowedChatIds: [123],
      repository: {
        async saveIntakeAndDrafts() {
          throw new Error("should not save unauthorized updates");
        },
        async saveIntakeOnly() {
          throw new Error("should not save unauthorized updates");
        },
      },
    });

    expect(result.status).toBe("forbidden");
    expect(result.reason).toContain("未獲授權");
  });

  it("saves intake-only (no drafts) when all venues are agent listings", async () => {
    let intakeOnlyCalled = false;

    const result = await processTelegramIntake({
      update: receivedUpdate(),
      parseTelegramUpdate: () => ({
        status: "received" as const,
        input,
        messageId: 1,
        chatId: 1,
      }),
      completeJson: async () => ({
        isVenuePost: true,
        entries: [
          {
            ...singleResult().entries[0]!,
            reviewNote: "⚠️ 代放/代理資訊，非業主直接發布。",
            isAgentListing: true,
          },
        ],
      }),
      repository: {
        async saveIntakeAndDrafts() {
          throw new Error("should not draft all-agent posts");
        },
        async saveIntakeOnly() {
          intakeOnlyCalled = true;
          return { intakeItemId: "intake-9" };
        },
      },
    });

    expect(result.status).toBe("skipped");
    expect(result.reason).toContain("代放");
    expect(intakeOnlyCalled).toBe(true);
  });
});
