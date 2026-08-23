import { buildVenueParseMessages } from "./prompt.js";
import type { IntakeInput, ParseResult, VenueDraft, VenueDraftField } from "./types.js";

export type JsonCompleter = (input: {
  messages: ReturnType<typeof buildVenueParseMessages>;
}) => Promise<Omit<ParseResult, "status">>;

const venueSignals = [
  "檔",
  "場",
  "市集",
  "展銷",
  "pop",
  "popup",
  "booth",
  "舖",
  "鋪",
  "粒",
  "攤位",
];

const rentalSignals = [
  "租金",
  "價錢",
  "特價",
  "$",
  "日",
  "報貨",
  "冷氣",
  "whatsapp",
  "wa.me",
  "有意",
  "聯絡",
  "急放",
  "代放",
  "電話",
];

const rejectedDraft: VenueDraft = {
  title: "非場地貼文",
  district: null,
  venueName: null,
  startDate: null,
  endDate: null,
  priceText: null,
  priceAmountHkd: null,
  priceUnit: "unknown",
  boothSizeText: null,
  contactText: null,
  contactWhatsappLink: null,
  areaType: "unknown",
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
  summary: "輸入內容唔似場地資訊，已拒絕進入場地審核。",
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

export function looksLikeVenuePost(rawContent: string) {
  const normalized = normalizeText(rawContent);
  const hasVenueSignal = venueSignals.some((signal) =>
    normalized.includes(normalizeText(signal)),
  );
  const hasRentalSignal = rentalSignals.some((signal) =>
    normalized.includes(normalizeText(signal)),
  );

  return hasVenueSignal && hasRentalSignal;
}

function getMissingEssentialFields(
  result: Omit<ParseResult, "status">,
): VenueDraftField[] {
  const essentialFields: VenueDraftField[] = [
    "title",
    "venueName",
    "startDate",
    "endDate",
    "priceText",
    "contactText",
  ];

  return essentialFields.filter((field) => {
    const value = result.draft[field];
    return value === null || value === "";
  });
}

export async function parseVenuePost(
  input: IntakeInput,
  completeJson: JsonCompleter,
): Promise<ParseResult> {
  if (!looksLikeVenuePost(input.rawContent)) {
    return {
      status: "rejected",
      draft: rejectedDraft,
      confidenceScore: 0,
      lowConfidenceFields: [],
      unconfirmedFields: [],
      reviewNote: "內容唔似場地貼文，已自動拒絕。",
    };
  }

  const result = await completeJson({
    messages: buildVenueParseMessages(input),
  });

  const missingFields = getMissingEssentialFields(result);
  const lowConfidenceFields = Array.from(
    new Set([...result.lowConfidenceFields, ...missingFields]),
  );
  const unconfirmedFields = Array.from(
    new Set([...result.unconfirmedFields, ...missingFields]),
  );

  return {
    ...result,
    lowConfidenceFields,
    unconfirmedFields,
    status: "needs_review",
  };
}
