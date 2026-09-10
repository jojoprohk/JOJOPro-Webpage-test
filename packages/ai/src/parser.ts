import { buildVenueParseMessages, buildVenuePhotoInstruction } from "./prompt.js";
import { parseRosterPost } from "./roster.js";
import { inferDistrict, normalizeDistrict } from "./districts.js";
import type {
  IntakeInput,
  MultiVenueResult,
  ParseResult,
  VenueDraft,
  VenueDraftEntry,
  VenueDraftField,
} from "./types.js";

export type JsonCompleter = (input: {
  messages: ReturnType<typeof buildVenueParseMessages>;
  images?: ImageInput[];
}) => Promise<MultiVenueResult>;

export interface ImageInput {
  base64: string;
  mimeType: string;
}

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
  "商場",
  "廣場",
  "中心",
  "大廈",
  "地舖",
  "地鋪",
  "商舖",
  "商鋪",
  "道",
  "街",
  "出口",
];

const rentalSignals = [
  "租金",
  "價錢",
  "特價",
  "$",
  "日",
  "日租",
  "月租",
  "放租",
  "出租",
  "租",
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

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

// 「代放」「代租」＝代理幫場主放租，唔係業主本人直接發布。
// 注意：一條訊息可能同時有代放同正常場地，所以最終要逐個場地判定，
// 呢個 helper 只作文字關卡/提示用，唔會用嚟整條跳過。
export function isAgentProxyPost(rawContent: string): boolean {
  const normalized = normalizeText(rawContent);
  return normalized.includes("代放") || normalized.includes("代租");
}

// 驗證 YYYY-MM-DD 係真實存在嘅日期，剔走模型亂作嘅日子。
function isValidDateString(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// 統一處理日期：校驗、排序、去重，並用 sessionDates 嘅最早/最遲
// 推導 start/end，避免模型用連續範圍誤填斷續檔期。
function normalizeDatesOnDraft(draft: VenueDraft) {
  const sessionDates = Array.from(
    new Set(
      (draft.sessionDates ?? []).filter(
        (d): d is string => typeof d === "string" && isValidDateString(d),
      ),
    ),
  ).sort();

  draft.sessionDates = sessionDates;

  if (sessionDates.length > 0) {
    const first = sessionDates[0];
    const last = sessionDates[sessionDates.length - 1];
    if (!first || !last) {
      return;
    }
    // 有多過一個明確日期時，強制以日期清單為準，杜絕錯誤大範圍。
    if (sessionDates.length > 1) {
      draft.startDate = first;
      draft.endDate = last;
    } else {
      draft.startDate =
        draft.startDate && isValidDateString(draft.startDate)
          ? draft.startDate
          : first;
      if (
        !draft.endDate ||
        !isValidDateString(draft.endDate) ||
        draft.endDate < first
      ) {
        draft.endDate =
          draft.endDate && isValidDateString(draft.endDate)
            ? draft.endDate
            : last;
      }
    }
  } else {
    if (draft.startDate && !isValidDateString(draft.startDate)) {
      draft.startDate = null;
    }
    if (draft.endDate && !isValidDateString(draft.endDate)) {
      draft.endDate = null;
    }
  }
}

// 統一地區：LLM/規則填咗嘢就先正規化做標準 18 區；對唔到或留空，
// 再用場名/標題/原文做確定性推理。最終都唔知 → null，並標記為低信心
// （審核頁會高亮地區下拉，等用戶一按揀返）。
function normalizeDistrictOnDraft(
  entry: VenueDraftEntry,
  rawContent?: string,
) {
  const draft = entry.draft;
  let district = normalizeDistrict(draft.district);
  if (!district) {
    district = inferDistrict(
      draft.venueName,
      draft.title,
      draft.boothSizeText,
      draft.summary,
      rawContent,
    );
  }
  draft.district = district;

  if (!district) {
    if (!entry.lowConfidenceFields.includes("district")) {
      entry.lowConfidenceFields.push("district");
    }
    if (!entry.unconfirmedFields.includes("district")) {
      entry.unconfirmedFields.push("district");
    }
  }
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

function getMissingEssentialFields(draft: VenueDraft): VenueDraftField[] {
  const essentialFields: VenueDraftField[] = [
    "title",
    "venueName",
    "priceText",
    "contactText",
  ];

  const missing = essentialFields.filter((field) => {
    const value = draft[field];
    return value === null || value === "";
  });

  // 時間資訊：有 sessionDates 或 startDate 其中一樣都算齊全。
  if (
    draft.sessionDates.length === 0 &&
    (draft.startDate === null || draft.startDate === "")
  ) {
    missing.push("startDate");
  }

  return missing;
}

// 將一個場地正規化：驗證日期、合併缺欄位、圖片日期標待核。
function normalizeEntry(
  entry: VenueDraftEntry,
  hasPhotos: boolean,
  rawContent?: string,
): VenueDraftEntry {
  normalizeDatesOnDraft(entry.draft);
  normalizeDistrictOnDraft(entry, rawContent);

  if (hasPhotos) {
    const hasAnyDate =
      entry.draft.sessionDates.length > 0 || entry.draft.startDate !== null;
    if (hasAnyDate) {
      for (const field of ["startDate", "endDate"] as VenueDraftField[]) {
        if (!entry.lowConfidenceFields.includes(field)) {
          entry.lowConfidenceFields.push(field);
        }
        if (!entry.unconfirmedFields.includes(field)) {
          entry.unconfirmedFields.push(field);
        }
      }
    }
  }

  const missingFields = getMissingEssentialFields(entry.draft);
  entry.lowConfidenceFields = Array.from(
    new Set([...entry.lowConfidenceFields, ...missingFields]),
  );
  entry.unconfirmedFields = Array.from(
    new Set([...entry.unconfirmedFields, ...missingFields]),
  );
  entry.isAgentListing = entry.isAgentListing === true;
  return entry;
}

// 「代」字標記（行內簡寫）：場地標籤裏面單一個「代」字即係代放。
// 分兩層：
//  - 結構欄位（title/booth/contact/summary）：比對「代放/代租/私人場代/場代/
//    代＋粒」等明確標記，黑名單排除「代表/代幣」等誤判。
//  - AI 警告句（reviewNote）：只要以「⚠️」開頭兼含「代放/代理資訊」，即屬代理。
const AGENT_MARK_RE =
  /代放|代租|私人場代|場代(?![表幣理])|代\s*(?:[0-9０-９一二三四五六七八九十]+\s*)?粒/;
// AI 警告句：必須以 ⚠️ 開頭，且明確講「代放」或「代理資訊」。
// 用「非空白字符開頭」錨定，避免測試/備註入面順手提到「代」字就誤判。
const AGENT_WARNING_RE = /^[\s\S]*?⚠️[^。\n]*(?:代放|代理資訊)/;

function hasAgentMark(text: string | null | undefined): boolean {
  return !!text && AGENT_MARK_RE.test(text.replace(/\s+/g, ""));
}

// 逐個場地判定係咪代放：模型標示，或標題/備註/聯絡/檔位描述含代理標記。
function entryIsAgent(entry: VenueDraftEntry): boolean {
  if (entry.isAgentListing === true) return true;
  // AI 警告句：開頭有 ⚠️ 且提到代放/代理資訊，直接判定。
  if (AGENT_WARNING_RE.test(entry.reviewNote ?? "")) return true;
  return (
    hasAgentMark(entry.draft.title) ||
    hasAgentMark(entry.draft.contactText) ||
    hasAgentMark(entry.draft.boothSizeText) ||
    hasAgentMark(entry.draft.summary)
  );
}

export async function parseVenuePost(
  input: IntakeInput,
  completeJson: JsonCompleter,
): Promise<ParseResult> {
  const hasPhotos = (input.photoFileIds?.length ?? 0) > 0;

  // Text posts get a cheap keyword gate to save LLM calls. Photo posts always
  // go to the vision model — keywords live inside the image, not the caption.
  if (!hasPhotos && !looksLikeVenuePost(input.rawContent)) {
    return {
      status: "rejected",
      entries: [],
      reviewNote: "內容唔似場地貼文，已自動拒絕。",
    };
  }

  // 「樂妹式」結構化清單（多行、月份標題、每行日期+場名）：用規則直接拆，
  // 比大模型列舉穩定（唔會漏行）、亦唔使 API 費用。唔係呢類格式先交俾大模型。
  if (!hasPhotos) {
    const year = new Date(input.receivedAt).getUTCFullYear();
    const roster = parseRosterPost(input, year);
    if (roster) {
      return finalizeRoster(roster);
    }
  }

  const messages = buildVenueParseMessages(input);
  if (hasPhotos) {
    messages.push({
      role: "user" as const,
      content: buildVenuePhotoInstruction(),
    });
  }

  const result = await completeJson({
    messages,
    images: input.images,
  });

  if (
    !result.isVenuePost ||
    !Array.isArray(result.entries) ||
    result.entries.length === 0
  ) {
    return {
      status: "rejected",
      entries: [],
      reviewNote: result.note ?? "內容唔似場地資訊，已自動拒絕。",
    };
  }

  const normalized = result.entries.map((entry) =>
    normalizeEntry(entry, hasPhotos, input.rawContent),
  );

  // 逐個場地分：代放跳過，正常收錄。
  const kept: VenueDraftEntry[] = [];
  const skipped: VenueDraftEntry[] = [];
  for (const entry of normalized) {
    if (entryIsAgent(entry)) {
      entry.isAgentListing = true;
      skipped.push(entry);
    } else {
      entry.isAgentListing = false;
      kept.push(entry);
    }
  }

  if (kept.length === 0) {
    return {
      status: "rejected",
      entries: [],
      allAgentListings: true,
      reviewNote:
        "⚠️ 全部場地均屬「代放/代理」資訊，非業主直接發布，為咗資料準確同誠信已全部跳過；建議直接聯絡業主或場地出租負責人攞一手資料。",
    };
  }

  const noteParts: string[] = [];
  if (skipped.length > 0) {
    const names = skipped
      .map((e) => e.draft.venueName ?? e.draft.title)
      .filter(Boolean)
      .join("、");
    noteParts.push(
      `其中 ${skipped.length} 個場地（${names}）屬「代放」代理資訊，已跳過唔收錄；建議直接向場地查證。`,
    );
  }
  if (result.note) noteParts.push(result.note);

  return {
    status: "needs_review",
    entries: kept,
    allAgentListings: false,
    reviewNote: noteParts.join(" "),
  };
}

// 規則解析出嚟嘅清單，同大模型結果一齊走相同嘅正規化/代放分流。
function finalizeRoster(roster: MultiVenueResult): ParseResult {
  const normalized = roster.entries.map((entry) =>
    normalizeEntry(entry, false, undefined),
  );
  const kept: VenueDraftEntry[] = [];
  const skipped: VenueDraftEntry[] = [];
  for (const entry of normalized) {
    if (entryIsAgent(entry)) {
      entry.isAgentListing = true;
      skipped.push(entry);
    } else {
      entry.isAgentListing = false;
      kept.push(entry);
    }
  }

  if (kept.length === 0) {
    return {
      status: "rejected",
      entries: [],
      allAgentListings: true,
      reviewNote:
        "⚠️ 全部場地均屬「代放/代理」資訊，非業主直接發布，已全部跳過；建議直接聯絡業主或場地出租負責人。",
    };
  }

  const parts: string[] = [];
  if (skipped.length > 0) {
    parts.push(`其中 ${skipped.length} 個場地屬「代放」代理資訊，已跳過唔收錄。`);
  }
  if (roster.note) parts.push(roster.note);

  return {
    status: "needs_review",
    entries: kept,
    allAgentListings: false,
    reviewNote: parts.join(" "),
  };
}
