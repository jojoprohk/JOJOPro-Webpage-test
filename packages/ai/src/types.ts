export type SourceType =
  | "telegram"
  | "instagram"
  | "whatsapp_forward"
  | "manual";

export type AreaType =
  | "mall"
  | "market"
  | "street"
  | "industrial"
  | "pop_up_event"
  | "private_venue"
  | "other"
  | "unknown";

export type PriceUnit = "day" | "period" | "unknown";

export type ReviewStatus =
  | "needs_review"
  | "approved"
  | "rejected"
  | "published";

export interface IntakeInput {
  rawContent: string;
  sourceType: SourceType;
  sourceLabel: string;
  sourceUrl?: string;
  receivedAt: string;
  // Telegram photo file_ids (largest resolution last). Empty for text posts.
  photoFileIds?: string[];
  // Downloaded image bytes (base64) for vision parsing. Not persisted to DB.
  images?: { base64: string; mimeType: string }[];
}

export interface VenueDraft {
  title: string;
  district: string | null;
  venueName: string | null;
  // 個別開檔/有檔日期（YYYY-MM-DD）。斷續檔期（例如逢週末市集）要逐日列齊；
  // 連續租用則留空 []，靠 startDate/endDate 表達。
  sessionDates: string[];
  startDate: string | null;
  endDate: string | null;
  priceText: string | null;
  priceAmountHkd: number | null;
  priceUnit: PriceUnit;
  boothSizeText: string | null;
  contactText: string | null;
  contactWhatsappLink: string | null;
  areaType: AreaType;
  hasAircon: boolean | null;
  isPrimeSpot: boolean;
  isCartSpot: boolean;
  allowsFood: boolean | null;
  allowsDryGoods: boolean | null;
  allowsBeauty: boolean | null;
  allowsService: boolean | null;
  requiresProductApproval: boolean;
  isUrgent: boolean;
  isDiscounted: boolean;
  summary: string;
}

export type VenueDraftField = keyof VenueDraft;

// LLM 就「單一個場地」抽取嘅結果。
export interface VenueDraftEntry {
  draft: VenueDraft;
  confidenceScore: number;
  lowConfidenceFields: VenueDraftField[];
  unconfirmedFields: VenueDraftField[];
  reviewNote: string;
  // 「代放/代租」＝代理幫場主放租，唔係業主本人。逐個場地標示：
  // true 代表呢個場地屬代理資料，誠信起見唔收錄做草稿。
  isAgentListing?: boolean;
}

// LLM 原始輸出（未經 parser 正規化）：一條貼文可以含多個場地。
export interface MultiVenueResult {
  // false = 整段內容根本唔係場地資訊。
  isVenuePost: boolean;
  entries: VenueDraftEntry[];
  // 整體備註（例如「貼文列咗多個場地」）。
  note?: string;
}

export interface ParseResult {
  status: ReviewStatus;
  // 逐個場地嘅正規化結果。非場地貼文或全部屬代放時為空陣列。
  entries: VenueDraftEntry[];
  // 整體狀態備註（畀審核/bot 睇）。
  reviewNote: string;
  // true = 整條訊息都係代放/代理（冇正常場地收錄）。
  allAgentListings?: boolean;
}
