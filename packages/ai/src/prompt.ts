import type { IntakeInput } from "./types.js";

export function buildVenueParseMessages(input: IntakeInput) {
  return [
    {
      role: "system" as const,
      content: [
        "你係香港短租舖位、booth、pop-up、展銷場地資料整理員。",
        "只可以根據使用者提供嘅貼文內容輸出 JSON。",
        "如果資料唔清楚，用 null，唔好亂猜。",
        "日期用 YYYY-MM-DD。如只有日子沒有年份，用收到訊息年份。",
        "價錢優先抽取每日價；如果貼文係整個時段價錢，priceUnit 用 period。",
        "電話要轉做香港 wa.me link，例如 9123 4567 變 https://wa.me/85291234567。",
        "輸出必須符合調用端要求嘅 JSON schema。",
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        `sourceType: ${input.sourceType}`,
        `sourceLabel: ${input.sourceLabel}`,
        `sourceUrl: ${input.sourceUrl ?? "none"}`,
        `receivedAt: ${input.receivedAt}`,
        "",
        "rawContent:",
        input.rawContent,
      ].join("\n"),
    },
  ];
}
