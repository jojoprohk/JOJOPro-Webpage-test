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
  | "exhibition"
  | "unknown";

export type PriceUnit = "day" | "period" | "unknown";

// 公開展示用相。每個樓盤維持自己嘅有序相列表：
// - telegram：用戶經 Telegram 傳入嘅「真實場地／IG 截圖」（適合展示）。
// - stock：按場地類型自動配嘅通用代表相（本地、免版權）。
// 純文字截圖（OCR 用）唔會入呢個列表。
export type VenuePhoto =
  | { kind: "telegram"; fileId: string }
  | { kind: "manual"; storageKey: string }
  | { kind: "stock"; src: string };

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
  // 公開展示相（有序）。向後相容：舊草稿可能冇呢欄，讀取時 fallback 用 stock 相。
  photos?: VenuePhoto[];
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
  // 邊幾張附圖係「真實場地／IG 截圖」（適合公開展示），用附圖由 0 開始嘅
  // index 表達。純文字海報截圖唔列入。app 層據此由 photoFileIds 組 telegram 相；
  // 冇列入嘅場地一律用場地類型 stock 相。
  realVenuePhotoIndexes?: number[];
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
