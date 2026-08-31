import OpenAI from "openai";
import type {
  AreaType,
  ImageInput,
  JsonCompleter,
  MultiVenueResult,
  PriceUnit,
  VenueDraft,
  VenueDraftEntry,
  VenueDraftField,
} from "@jopojo/ai";

const areaTypes: AreaType[] = [
  "mall",
  "market",
  "street",
  "industrial",
  "pop_up_event",
  "private_venue",
  "other",
  "unknown",
];

const priceUnits: PriceUnit[] = ["day", "period", "unknown"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOptionalString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isOptionalNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isOptionalBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === "boolean";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

// LLM 可能回傳唔屬於 VenueDraft 欄位名嘅字串，過濾成合法欄位 key。
const draftFieldNames = [
  "title",
  "district",
  "venueName",
  "sessionDates",
  "startDate",
  "endDate",
  "priceText",
  "priceAmountHkd",
  "priceUnit",
  "boothSizeText",
  "contactText",
  "contactWhatsappLink",
  "areaType",
  "hasAircon",
  "isPrimeSpot",
  "isCartSpot",
  "allowsFood",
  "allowsDryGoods",
  "allowsBeauty",
  "allowsService",
  "requiresProductApproval",
  "isUrgent",
  "isDiscounted",
  "summary",
] as const satisfies readonly VenueDraftField[];

const draftFieldSet = new Set<string>(draftFieldNames);

function coerceFieldList(value: unknown): VenueDraftField[] {
  if (!isStringArray(value)) return [];
  return value.filter((field): field is VenueDraftField =>
    draftFieldSet.has(field),
  );
}

function isVenueDraft(value: unknown): value is VenueDraft {
  if (!isObject(value)) return false;

  return (
    typeof value.title === "string" &&
    isOptionalString(value.district) &&
    isOptionalString(value.venueName) &&
    isStringArray(value.sessionDates) &&
    isOptionalString(value.startDate) &&
    isOptionalString(value.endDate) &&
    isOptionalString(value.priceText) &&
    isOptionalNumber(value.priceAmountHkd) &&
    typeof value.priceUnit === "string" &&
    priceUnits.includes(value.priceUnit as PriceUnit) &&
    isOptionalString(value.boothSizeText) &&
    isOptionalString(value.contactText) &&
    isOptionalString(value.contactWhatsappLink) &&
    typeof value.areaType === "string" &&
    areaTypes.includes(value.areaType as AreaType) &&
    isOptionalBoolean(value.hasAircon) &&
    isBoolean(value.isPrimeSpot) &&
    isBoolean(value.isCartSpot) &&
    isOptionalBoolean(value.allowsFood) &&
    isOptionalBoolean(value.allowsDryGoods) &&
    isOptionalBoolean(value.allowsBeauty) &&
    isOptionalBoolean(value.allowsService) &&
    isBoolean(value.requiresProductApproval) &&
    isBoolean(value.isUrgent) &&
    isBoolean(value.isDiscounted) &&
    typeof value.summary === "string"
  );
}

function isVenueDraftEntry(value: unknown): value is VenueDraftEntry {
  if (!isObject(value)) return false;

  return (
    isVenueDraft(normalizeDraft(value.draft)) &&
    typeof value.confidenceScore === "number" &&
    value.confidenceScore >= 0 &&
    value.confidenceScore <= 100 &&
    isStringArray(value.lowConfidenceFields) &&
    isStringArray(value.unconfirmedFields) &&
    typeof value.reviewNote === "string" &&
    (value.isAgentListing === undefined ||
      typeof value.isAgentListing === "boolean")
  );
}

function isMultiVenuePayload(value: unknown): value is MultiVenueResult {
  if (!isObject(value)) return false;
  if (typeof value.isVenuePost !== "boolean") return false;
  if (!Array.isArray(value.entries)) return false;
  return value.entries.every((entry) => isVenueDraftEntry(entry));
}

// 向後相容：舊版模型可能仲係回傳單一草稿頂層 { draft, ... }。
function coerceLegacyPayload(value: unknown): MultiVenueResult | null {
  if (
    isObject(value) &&
    !Array.isArray((value as { entries?: unknown }).entries) &&
    isVenueDraft(normalizeDraft((value as { draft?: unknown }).draft))
  ) {
    const v = value as {
      draft: unknown;
      confidenceScore?: unknown;
      lowConfidenceFields?: unknown;
      unconfirmedFields?: unknown;
      reviewNote?: unknown;
    };
    return {
      isVenuePost: true,
      entries: [
        {
          draft: normalizeDraft(v.draft) as VenueDraft,
          confidenceScore:
            typeof v.confidenceScore === "number" ? v.confidenceScore : 60,
          lowConfidenceFields: coerceFieldList(v.lowConfidenceFields),
          unconfirmedFields: coerceFieldList(v.unconfirmedFields),
          reviewNote:
            typeof v.reviewNote === "string" ? v.reviewNote : "",
        },
      ],
    };
  }
  return null;
}

// LLMs often omit fields they consider "default" (false / null / unknown).
// Fill safe defaults so a sparse-but-valid response is still accepted.
function normalizeDraft(value: unknown): VenueDraft | null {
  if (!isObject(value) || typeof value.title !== "string") return null;

  return {
    title: value.title,
    district: isOptionalString(value.district) ? value.district : null,
    venueName: isOptionalString(value.venueName) ? value.venueName : null,
    sessionDates: isStringArray(value.sessionDates) ? value.sessionDates : [],
    startDate: isOptionalString(value.startDate) ? value.startDate : null,
    endDate: isOptionalString(value.endDate) ? value.endDate : null,
    priceText: isOptionalString(value.priceText) ? value.priceText : null,
    priceAmountHkd: isOptionalNumber(value.priceAmountHkd)
      ? value.priceAmountHkd
      : null,
    priceUnit: (() => {
      const raw = String(value.priceUnit ?? "").toLowerCase();
      if (raw === "daily" || raw === "per_day" || raw === "day") return "day";
      if (raw === "period" || raw === "whole_period") return "period";
      return priceUnits.includes(raw as PriceUnit)
        ? (raw as PriceUnit)
        : "unknown";
    })(),
    boothSizeText: isOptionalString(value.boothSizeText)
      ? value.boothSizeText
      : null,
    contactText: isOptionalString(value.contactText)
      ? value.contactText
      : null,
    contactWhatsappLink: isOptionalString(value.contactWhatsappLink)
      ? value.contactWhatsappLink
      : null,
    areaType: areaTypes.includes(value.areaType as AreaType)
      ? (value.areaType as AreaType)
      : "unknown",
    hasAircon: isOptionalBoolean(value.hasAircon) ? value.hasAircon : null,
    isPrimeSpot: isBoolean(value.isPrimeSpot) ? value.isPrimeSpot : false,
    isCartSpot: isBoolean(value.isCartSpot) ? value.isCartSpot : false,
    allowsFood: isOptionalBoolean(value.allowsFood) ? value.allowsFood : null,
    allowsDryGoods: isOptionalBoolean(value.allowsDryGoods)
      ? value.allowsDryGoods
      : null,
    allowsBeauty: isOptionalBoolean(value.allowsBeauty)
      ? value.allowsBeauty
      : null,
    allowsService: isOptionalBoolean(value.allowsService)
      ? value.allowsService
      : null,
    requiresProductApproval: isBoolean(value.requiresProductApproval)
      ? value.requiresProductApproval
      : false,
    isUrgent: isBoolean(value.isUrgent) ? value.isUrgent : false,
    isDiscounted: isBoolean(value.isDiscounted)
      ? value.isDiscounted
      : false,
    summary: typeof value.summary === "string" ? value.summary : "",
  };
}

export function createLlmVenueCompleter(): JsonCompleter {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("Missing LLM_API_KEY.");
  }

  const baseURL =
    process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
  const model = process.env.LLM_MODEL || "llama-3.3-70b-versatile";

  const client = new OpenAI({
    apiKey,
    baseURL,
  });

  return async ({ messages, images = [] }) => {
    // Build vision-ready payload: the final user message gets image parts
    // attached so the model can OCR venue details from Telegram photos.
    const resolvedMessages: OpenAI.Chat.ChatCompletionMessageParam[] =
      images.length === 0
        ? (messages as OpenAI.Chat.ChatCompletionMessageParam[])
        : (() => {
            const textParts = messages.map((m) => {
              if (m.role === "user" && typeof m.content === "string") {
                return m;
              }
              return m as OpenAI.Chat.ChatCompletionMessageParam;
            });

            const lastUserIndex = [...textParts]
              .map((m, i) => (m.role === "user" ? i : -1))
              .filter((i) => i >= 0)
              .pop();

            const imageContent = [
              ...images.map(
                (img): OpenAI.Chat.ChatCompletionContentPart => ({
                  type: "image_url",
                  image_url: {
                    url: `data:${img.mimeType};base64,${img.base64}`,
                  },
                }),
              ),
            ];

            if (lastUserIndex === undefined) {
              return [
                {
                  role: "user",
                  content: [
                    ...imageContent,
                    { type: "text", text: "請根據以上圖片抽取場地資料。" },
                  ],
                } as OpenAI.Chat.ChatCompletionMessageParam,
                ...textParts,
              ];
            }

            return textParts.map((m, i) => {
              if (i !== lastUserIndex) return m;
              return {
                role: "user",
                content: [
                  ...imageContent,
                  { type: "text", text: (m as { content?: string }).content ?? "" },
                ],
              } as OpenAI.Chat.ChatCompletionMessageParam;
            });
          })();

    const completion = await client.chat.completions.create({
      model,
      messages: resolvedMessages,
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message.content;
    if (!content) {
      throw new Error("LLM response did not include content.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("LLM response was not valid JSON.");
    }

    if (process.env.DEBUG_LLM === "1") {
      console.error("[debug] raw LLM content:", content);
    }

    const payload =
      isMultiVenuePayload(parsed)
        ? parsed
        : coerceLegacyPayload(parsed);

    if (!payload) {
      throw new Error("LLM response did not match the expected schema.");
    }

    return {
      isVenuePost: payload.isVenuePost,
      note: typeof payload.note === "string" ? payload.note : undefined,
      entries: payload.entries.map((entry) => ({
        draft: normalizeDraft(entry.draft) as VenueDraft,
        confidenceScore: Math.round(entry.confidenceScore),
        lowConfidenceFields: coerceFieldList(entry.lowConfidenceFields),
        unconfirmedFields: coerceFieldList(entry.unconfirmedFields),
        reviewNote: entry.reviewNote,
        isAgentListing: entry.isAgentListing === true,
      })),
    };
  };
}
