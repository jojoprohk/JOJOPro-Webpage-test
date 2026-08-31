import { describe, expect, it } from "vitest";
import { parseVenuePost } from "../src/parser.js";
import type {
  IntakeInput,
  MultiVenueResult,
  VenueDraft,
  VenueDraftEntry,
} from "../src/types.js";

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

function makeDraft(overrides: Partial<VenueDraft> = {}): VenueDraft {
  return {
    title: "葵涌邨大場 3號位",
    district: "葵涌",
    venueName: "葵涌邨大場",
    sessionDates: [],
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
    ...overrides,
  };
}

function makeEntry(overrides: Partial<VenueDraftEntry> = {}): VenueDraftEntry {
  return {
    draft: makeDraft(),
    confidenceScore: 86,
    lowConfidenceFields: [],
    unconfirmedFields: [],
    reviewNote: "日期、價錢、地區清楚。",
    isAgentListing: false,
    ...overrides,
  };
}

function multi(entries: VenueDraftEntry[], note = ""): MultiVenueResult {
  return { isVenuePost: true, entries, note };
}

describe("parseVenuePost", () => {
  it("returns a structured venue draft from LLM JSON", async () => {
    const result = await parseVenuePost(input, async () =>
      multi([makeEntry({ lowConfidenceFields: ["hasAircon"] })]),
    );

    expect(result.status).toBe("needs_review");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].draft.district).toBe("葵涌");
    expect(result.entries[0].draft.priceAmountHkd).toBe(1600);
    expect(result.entries[0].lowConfidenceFields).toContain("hasAircon");
  });

  it("rejects content that does not look like a venue post", async () => {
    const result = await parseVenuePost(
      { ...input, rawContent: "今日午餐食什麼？" },
      async () => {
        throw new Error("LLM should not be called for obvious non-venue input");
      },
    );

    expect(result.status).toBe("rejected");
    expect(result.entries).toHaveLength(0);
    expect(result.reviewNote).toContain("唔似場地貼文");
  });

  it("keeps missing essential fields in review state", async () => {
    const result = await parseVenuePost(
      { ...input, rawContent: "葵涌有場，4粒，有意 WhatsApp 9123 4567" },
      async () =>
        multi([
          makeEntry({
            draft: makeDraft({
              sessionDates: [],
              startDate: null,
              endDate: null,
              priceText: null,
              priceAmountHkd: null,
            }),
            confidenceScore: 52,
          }),
        ]),
    );

    expect(result.status).toBe("needs_review");
    expect(result.entries[0].draft.startDate).toBeNull();
    expect(result.entries[0].draft.priceText).toBeNull();
    expect(result.entries[0].lowConfidenceFields).toContain("priceText");
  });

  it("derives start/end from discrete sessionDates and drops bogus dates", async () => {
    const result = await parseVenuePost(
      { ...input, rawContent: "利東街週末市集 招募檔位 WhatsApp 9123 4567" },
      async () =>
        multi([
          makeEntry({
            draft: makeDraft({
              sessionDates: [
                "2026-09-07",
                "2026-09-06",
                "2026-09-06",
                "2026-10-05",
                "2026-09-13",
                "2026-02-30",
              ],
              startDate: "2026-09-05",
              endDate: "2026-10-25",
            }),
          }),
        ]),
    );

    expect(result.entries[0].draft.sessionDates).toEqual([
      "2026-09-06",
      "2026-09-07",
      "2026-09-13",
      "2026-10-05",
    ]);
    expect(result.entries[0].draft.startDate).toBe("2026-09-06");
    expect(result.entries[0].draft.endDate).toBe("2026-10-05");
  });

  it("flags OCR-derived dates as unconfirmed for photo posts", async () => {
    const result = await parseVenuePost(
      { ...input, rawContent: "[圖片]", photoFileIds: ["file-1"] },
      async () =>
        multi([
          makeEntry({
            draft: makeDraft({
              sessionDates: ["2026-09-06", "2026-09-07"],
              startDate: "2026-09-06",
              endDate: "2026-09-07",
            }),
            reviewNote: "海報日期待核對。",
          }),
        ]),
    );

    expect(result.entries[0].unconfirmedFields).toContain("startDate");
    expect(result.entries[0].lowConfidenceFields).toContain("startDate");
  });

  it("splits a multi-venue post: skips 代放 venues but keeps normal ones", async () => {
    const result = await parseVenuePost(
      {
        ...input,
        rawContent:
          "九月份\n10-12良景B（代放三粒）\n12-14寶林A（代放四粒）\n12-14南昌A（六粒可兩粒起）\n25-27長發C（六粒可兩粒起）\nhttps://wa.me/85252666262",
      },
      async () =>
        multi(
          [
            makeEntry({
              draft: makeDraft({
                title: "良景邨B區 3粒位",
                venueName: "良景邨",
                boothSizeText: "B區 代放三粒",
                sessionDates: ["2026-09-10", "2026-09-11", "2026-09-12"],
              }),
              reviewNote:
                "⚠️ 代放/代理資訊，非業主直接發布，需向場地核實。",
              isAgentListing: true,
            }),
            makeEntry({
              draft: makeDraft({
                title: "寶林邨A區 4粒位",
                venueName: "寶林邨",
                boothSizeText: "A區 代放四粒",
                sessionDates: ["2026-09-12", "2026-09-13", "2026-09-14"],
              }),
              reviewNote:
                "⚠️ 代放/代理資訊，非業主直接發布，需向場地核實。",
              isAgentListing: true,
            }),
            makeEntry({
              draft: makeDraft({
                title: "南昌邨A區 6粒位",
                venueName: "南昌邨",
                district: "深水埗",
                boothSizeText: "A區 六粒可兩粒起",
                sessionDates: ["2026-09-12", "2026-09-13", "2026-09-14"],
              }),
              isAgentListing: false,
            }),
            makeEntry({
              draft: makeDraft({
                title: "長發邨C區 6粒位",
                venueName: "長發邨",
                district: "青衣",
                boothSizeText: "C區 六粒可兩粒起",
                sessionDates: ["2026-09-25", "2026-09-26", "2026-09-27"],
              }),
              isAgentListing: false,
            }),
          ],
          "貼文列咗 4 個場地。",
        ),
    );

    expect(result.status).toBe("needs_review");
    // 良景、寶林（代放）被跳過；南昌、長發正常收錄。
    expect(result.entries).toHaveLength(2);
    expect(result.entries.map((e) => e.draft.venueName)).toEqual([
      "南昌邨",
      "長發邨",
    ]);
    expect(result.reviewNote).toContain("代放");
    expect(result.reviewNote).toContain("良景");
  });

  it("rejects when every venue is an agent (代放) listing", async () => {
    const result = await parseVenuePost(
      { ...input, rawContent: "良景B（代放三粒）" },
      async () =>
        multi([
          makeEntry({
            draft: makeDraft({ boothSizeText: "代放三粒" }),
            reviewNote: "⚠️ 代放/代理資訊，非業主直接發布。",
            isAgentListing: true,
          }),
        ]),
    );

    expect(result.status).toBe("rejected");
    expect(result.allAgentListings).toBe(true);
    expect(result.entries).toHaveLength(0);
  });

  it("detects agent venue from reviewNote even if model forgets the flag", async () => {
    const result = await parseVenuePost(
      { ...input, rawContent: "寶林A（代放四粒）WhatsApp 9123 4567" },
      async () =>
        multi([
          makeEntry({
            draft: makeDraft({ venueName: "寶林邨" }),
            reviewNote:
              "⚠️ 代放/代理資訊，非業主直接發布，需向場地核實。",
            isAgentListing: false, // 模型漏咗標 flag，但備註有「代放」
          }),
        ]),
    );

    expect(result.status).toBe("rejected");
    expect(result.allAgentListings).toBe(true);
  });

  it("treats a lone 「代」 marker (私人場代) as agent, but keeps plain 私人場", async () => {
    const agentVenue = makeEntry({
      draft: makeDraft({
        title: "天平新城 4-10號",
        venueName: "天平新城",
        boothSizeText: "私人場代",
      }),
      reviewNote: "純私人場，無代理字眼。",
      isAgentListing: false, // 模型漏標，靠後備偵測
    });
    const normalVenue = makeEntry({
      draft: makeDraft({
        title: "翠林C 8-14號",
        venueName: "翠林C",
        boothSizeText: "私人場",
        contactText: "WhatsApp 9123 4567",
      }),
      reviewNote: "純私人場，無代理字眼。",
      isAgentListing: false,
    });

    // 私人場代 → 跳過；私人場（冇代）→ 收錄
    const result = await parseVenuePost(
      {
        ...input,
        rawContent:
          "天平新城（私人場代）\n翠林C（私人場）\n有意 WhatsApp 9123 4567",
      },
      async () => multi([agentVenue, normalVenue]),
    );

    expect(result.status).toBe("needs_review");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].draft.venueName).toBe("翠林C");
    expect(result.reviewNote).toContain("代");
  });

  it("skips a venue marked 私人場代四粒 via booth text", async () => {
    const result = await parseVenuePost(
      {
        ...input,
        rawContent: "4-10石圍角（私人場代四粒）\n有意 WhatsApp 9123 4567",
      },
      async () =>
        multi([
          makeEntry({
            draft: makeDraft({
              venueName: "石圍角",
              boothSizeText: "私人場代四粒",
            }),
            reviewNote: "純私人場資料。",
            isAgentListing: false,
          }),
        ]),
    );

    expect(result.status).toBe("rejected");
    expect(result.allAgentListings).toBe(true);
  });

  it("uses the AI warning note to skip agent venues even across a large roster", async () => {
    // 模擬真實 9-11 月清單：良景/石圍角屬代理（AI 警告句），翠林純私人場照收。
    const agentWarning =
      "⚠️ 代放/代理資訊，非業主直接發布，需向場地核實。租金未列明，建議直接聯絡業主或出租負責人查詢。";
    const normalNote =
      "租金未列明，建議直接聯絡業主或出租負責人查詢。";

    const result = await parseVenuePost(
      {
        ...input,
        rawContent:
          "十月份\n18-20良景B（代放三粒）\n4-10石圍角（私人場代）\n8-14翠林C（私人場）",
      },
      async () =>
        multi([
          makeEntry({
            draft: makeDraft({
              title: "良景B",
              venueName: "良景B",
              boothSizeText: "代放三粒",
              startDate: "2026-10-18",
              endDate: "2026-10-20",
            }),
            reviewNote: agentWarning,
            isAgentListing: false, // 故意漏標，靠警告句偵測
          }),
          makeEntry({
            draft: makeDraft({
              title: "石圍角",
              venueName: "石圍角",
              boothSizeText: "私人場代",
              startDate: "2026-10-04",
              endDate: "2026-10-10",
            }),
            reviewNote: normalNote,
            isAgentListing: false,
          }),
          makeEntry({
            draft: makeDraft({
              title: "翠林C",
              venueName: "翠林C",
              boothSizeText: "私人場",
              startDate: "2026-10-08",
              endDate: "2026-10-14",
            }),
            reviewNote: normalNote,
            isAgentListing: false,
          }),
        ]),
    );

    expect(result.status).toBe("needs_review");
    // 良景、石圍角（代理）跳過；翠林C（純私人場）照收。
    expect(result.entries.map((e) => e.draft.venueName)).toEqual(["翠林C"]);
    expect(result.reviewNote).toContain("代");
  });
});
