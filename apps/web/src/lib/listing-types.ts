// 公開 listing 頁用嘅資料型別。
// 注意：呢個 DTO 只包含可以公開嘅欄位，唔可以加入
// raw_content / confidence_score / low_confidence_fields /
// unconfirmed_fields / review_note / intake_item_id 等內部欄位。

export interface PublicListing {
  id: string;
  title: string;
  district: string | null;
  venueName: string | null;
  areaType: string;
  startDate: string | null;
  endDate: string | null;
  sessionDates: string[];
  priceText: string | null;
  priceAmountHkd: number | null;
  priceUnit: string;
  boothSizeText: string | null;
  contactText: string | null;
  contactWhatsappLink: string | null;
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
  sourceLabel: string;
  sourceUrl: string | null;
  lastReviewedAt: string | null;
  reportCount: number;
  photoCount: number;
  createdAt: string;
}

export interface ListingFilters {
  q: string;
  date: string | null; // YYYY-MM-DD
  maxBudget: number | null;
  food: boolean;
  aircon: boolean;
  deal: boolean;
}
