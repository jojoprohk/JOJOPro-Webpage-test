import { describe, expect, it } from "vitest";
import { parseTelegramVenueUpdate } from "../src/lib/telegram-parser.js";

describe("parseTelegramVenueUpdate", () => {
  it("extracts text from a direct Telegram message", () => {
    const result = parseTelegramVenueUpdate({
      update_id: 1,
      message: {
        message_id: 100,
        date: 1787555400,
        chat: {
          id: 600,
          type: "private",
          first_name: "Mercy",
        },
        from: {
          id: 600,
          is_bot: false,
          first_name: "Mercy",
        },
        text: "將軍澳廣場 4粒 $800/日 有意 WhatsApp 91234567",
      },
    });

    expect(result.status).toBe("received");
    if (result.status !== "received") {
      throw new Error("expected received result");
    }

    expect(result.input.sourceType).toBe("telegram");
    expect(result.input.sourceLabel).toBe("Mercy");
    expect(result.input.rawContent).toContain("將軍澳廣場");
    expect(result.messageId).toBe(100);
    expect(result.chatId).toBe(600);
  });

  it("uses forwarded source name and caption links when available", () => {
    const result = parseTelegramVenueUpdate({
      update_id: 2,
      message: {
        message_id: 101,
        date: 1787555460,
        chat: {
          id: 601,
          type: "private",
          first_name: "Mercy",
        },
        forward_origin: {
          type: "channel",
          date: 1787555000,
          chat: {
            id: 700,
            type: "channel",
            title: "場勝將軍",
            username: "popupshogun",
          },
        },
        photo: [
          {
            file_id: "file-id",
            file_unique_id: "unique-id",
            width: 800,
            height: 600,
          },
        ],
        caption:
          "沙田新場 3粒 $750/日\nhttps://www.instagram.com/p/DcI1dMZk1fC/",
      },
    });

    expect(result.status).toBe("received");
    if (result.status !== "received") {
      throw new Error("expected received result");
    }

    expect(result.input.sourceType).toBe("telegram");
    expect(result.input.sourceLabel).toBe("場勝將軍");
    expect(result.input.sourceUrl).toBe(
      "https://www.instagram.com/p/DcI1dMZk1fC/",
    );
    expect(result.input.rawContent).toContain("沙田新場");
  });

  it("accepts a caption-less photo (vision OCR decides) and ignores empty messages", () => {
    const result = parseTelegramVenueUpdate({
      update_id: 3,
      message: {
        message_id: 102,
        date: 1787555520,
        chat: {
          id: 602,
          type: "private",
        },
        photo: [
          {
            file_id: "file-id",
            file_unique_id: "unique-id",
            width: 100,
            height: 100,
          },
        ],
      },
    });

    expect(result.status).toBe("received");
    if (result.status === "received") {
      expect(result.input.rawContent).toBe("[圖片]");
      expect(result.input.photoFileIds).toEqual(["file-id"]);
    }

    const empty = parseTelegramVenueUpdate({
      update_id: 4,
      message: {
        message_id: 103,
        date: 1787555530,
        chat: { id: 603, type: "private" },
      },
    });
    expect(empty.status).toBe("ignored");
  });
});
