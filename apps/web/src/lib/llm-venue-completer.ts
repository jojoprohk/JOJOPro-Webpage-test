import OpenAI from "openai";
import type {
  AreaType,
  JsonCompleter,
  ParseResult,
  PriceUnit,
  VenueDraft,
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

function isVenueDraft(value: unknown): value is VenueDraft {
  if (!isObject(value)) return false;

  return (
    typeof value.title === "string" &&
    isOptionalString(value.district) &&
    isOptionalString(value.venueName) &&
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

function isParseResultPayload(
  value: unknown,
): value is Omit<ParseResult, "status"> {
  if (!isObject(value)) return false;

  return (
    isVenueDraft(value.draft) &&
    typeof value.confidenceScore === "number" &&
    value.confidenceScore >= 0 &&
    value.confidenceScore <= 100 &&
    isStringArray(value.lowConfidenceFields) &&
    isStringArray(value.unconfirmedFields) &&
    typeof value.reviewNote === "string"
  );
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

  return async ({ messages }) => {
    const completion = await client.chat.completions.create({
      model,
      messages,
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

    if (!isParseResultPayload(parsed)) {
      throw new Error("LLM response did not match the expected schema.");
    }

    return {
      draft: parsed.draft,
      confidenceScore: Math.round(parsed.confidenceScore),
      lowConfidenceFields: parsed.lowConfidenceFields as VenueDraftField[],
      unconfirmedFields: parsed.unconfirmedFields as VenueDraftField[],
      reviewNote: parsed.reviewNote,
    };
  };
}
