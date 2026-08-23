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
}

export interface VenueDraft {
  title: string;
  district: string | null;
  venueName: string | null;
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

export interface ParseResult {
  status: ReviewStatus;
  draft: VenueDraft;
  confidenceScore: number;
  lowConfidenceFields: VenueDraftField[];
  unconfirmedFields: VenueDraftField[];
  reviewNote: string;
}
