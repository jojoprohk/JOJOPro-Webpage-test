import { describe, expect, it } from "vitest";
import { parseVenuePost, parseRosterPost } from "../src/index.js";
import type { IntakeInput } from "../src/types.js";

const roster = `*9-11月份領展及私人商場展銷攤位*

😁😁😁*九月份* 😁😁😁
10-12良景B（*代放三粒*）
12-14南昌A（*六粒🉑兩粒起*）
8-15天平新城（*私人場*）🔥
4-10石圍角（*私人場代*）🔥
28-3/11月石圍角（*私人場*）🔥

🎀 *十月份* 🎀
7-9鳳德（代放四粒）
18-20啟田C
1-7翠林C（*私人場*）🔥
11-17天平新城（*私人場代四粒*）🔥

🛍️ *十一月份* 🛍️
31/10-2尚德A
31-2/11何文田D
3-5良景B
10-12隆亨A
20-26石圍角新城（*私人場*）🔥
28-3/11健威坊（*私人場*）🔥
27-4/12集成中心（*私人場*）🔥

https://wa.me/85252666262?text=樂妹`;

const input: IntakeInput = {
  rawContent: roster,
  sourceType: "telegram",
  sourceLabel: "debug",
  receivedAt: "2026-08-30T00:00:00.000Z",
};

describe("parseRosterPost", () => {
  it("splits every dated row into its own venue", () => {
    const result = parseRosterPost(input, 2026);
    expect(result).not.toBeNull();
    // 9月5 + 10月5 + 11月6 = 16 行
    expect(result!.entries).toHaveLength(16);
  });

  it("flags 代放/私人場代 as agent but keeps plain 私人場", () => {
    const result = parseRosterPost(input, 2026)!;
    const agents = result.entries.filter((e) => e.isAgentListing);
    // 良景B代放、鳳德代放、石圍角私人場代、天平私人場代四粒 = 4
    expect(agents.map((e) => e.draft.venueName)).toEqual(
      expect.arrayContaining(["良景 B", "鳳德", "石圍角", "天平新城"]),
    );
    expect(agents.length).toBe(4);
    // 純私人場／正常場唔係代理
    const taiPingPrivate = result.entries.find(
      (e) => e.draft.boothSizeText === "私人場" && e.draft.venueName === "天平新城",
    );
    expect(taiPingPrivate?.isAgentListing).toBe(false);
  });

  it("handles cross-month dates and shared wa.me contact", () => {
    const result = parseRosterPost(input, 2026)!;
    const sheungTak = result.entries.find((e) =>
      e.draft.venueName.startsWith("尚德"),
    );
    expect(sheungTak?.draft.startDate).toBe("2026-10-31");
    expect(sheungTak?.draft.endDate).toBe("2026-11-02");

    const hoManTin = result.entries.find((e) =>
      e.draft.venueName.startsWith("何文田"),
    );
    expect(hoManTin?.draft.startDate).toBe("2026-10-31");
    expect(hoManTin?.draft.endDate).toBe("2026-11-02");

    // 十一月欄 28-3/11 健威坊 → 10/28~11/3（/11 明示結束日 3 號屬 11 月；
    // 3 號細過 28 號，開始日必然係上一個月 10 月）。
    const kinWai = result.entries.find((e) =>
      e.draft.venueName.startsWith("健威坊"),
    );
    expect(kinWai?.draft.startDate).toBe("2026-10-28");
    expect(kinWai?.draft.endDate).toBe("2026-11-03");

    // 十一月欄 27-4/12 集成中心 → 11/27~12/4（/12 明示 4 號屬 12 月）。
    const chipSing = result.entries.find((e) =>
      e.draft.venueName.startsWith("集成中心"),
    );
    expect(chipSing?.draft.startDate).toBe("2026-11-27");
    expect(chipSing?.draft.endDate).toBe("2026-12-04");

    // 九月欄 28-3/11月石圍角（純私人場）→ 同樣 10/28~11/3。
    // 私人場代嗰筆係代理，呢筆係純私人場，要分開搵。
    const shekWai = result.entries.filter((e) =>
      e.draft.venueName.startsWith("石圍角"),
    );
    const octCross = shekWai.find(
      (e) => e.draft.startDate === "2026-10-28" && e.draft.endDate === "2026-11-03",
    );
    expect(octCross).toBeTruthy();

    // 共用聯絡
    expect(result.entries[0]?.draft.contactWhatsappLink).toBe(
      "https://wa.me/85252666262",
    );
  });

  it("routes through parseVenuePost and keeps only non-agent venues", async () => {
    const result = await parseVenuePost(input, async () => {
      throw new Error("roster should not call the LLM");
    });
    expect(result.status).toBe("needs_review");
    // 16 行 - 4 代理 = 12 收錄
    expect(result.entries).toHaveLength(12);
    expect(result.reviewNote).toContain("代");
  });

  it("唔會產生孤立代理字符（emoji 代理對要成對處理）", () => {
    // 😂 同被清走嘅 🔥/😁 共用高位代理；若清 emoji 嘅正則冇開 u flag，
    // 會鋸斷代理對，遺下孤立半字符，令下游 JSON 寫入 Postgres 失敗。
    const emojiRoster = [
      "😁*九月份*😁",
      "16-20天平新城😂（私人場）",
      "21-23翠林C😂（私人場）",
      "28-3/11北角健威坊😂",
      "🎀*十月份*🎀",
      "4-6安蔭商場😂",
      "4-10石圍角😂",
      "8-14翠林C😂",
      "9-15北角健威坊😂",
      "11-17石圍角😂",
      "18-24天平新城😂",
    ].join("\n");
    const result = parseRosterPost(
      { ...input, rawContent: emojiRoster },
      2026,
    );
    expect(result).not.toBeNull();

    const hasLoneSurrogate = (s: string) =>
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(
        s,
      );

    for (const entry of result!.entries) {
      const d = entry.draft;
      const strings = [
        d.title,
        d.venueName,
        d.boothSizeText ?? "",
        d.summary,
        ...(d.sessionDates ?? []),
        ...entry.lowConfidenceFields,
        ...entry.unconfirmedFields,
        entry.reviewNote,
      ];
      for (const s of strings) {
        expect(hasLoneSurrogate(s)).toBe(false);
      }
    }

    // 成個輸出必須可以安全 JSON 序列化（PostgREST 傳輸嘅前提）。
    expect(() => JSON.stringify(result!.entries)).not.toThrow();
  });
});
