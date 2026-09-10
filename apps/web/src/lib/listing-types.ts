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
  /** 真實場地相（用戶上傳）數量。 */
  realPhotoCount: number;
  /** Stock 代表相（按 area_type 自動配）數量。 */
  stockPhotoCount: number;
  /** 展示用嘅第一張相屬於邊一種——Stock 相必須標明「僅供參考」。 */
  firstPhotoKind: "real" | "stock" | "none";
  /** Admin 設定：是否加入本週精選卡（人手控制，唔再 auto-tier）。 */
  isFeatured: boolean;
  /** 最近一次 featured 嘅時間；NULL 表示從未 featured。 */
  featuredAt: string | null;
  /** 領展 (Link REIT) 場地標籤。前端可 filter「只睇領展場地」。 */
  isLinkReit: boolean;
}

export interface ListingFilters {
  q: string;
  date: string | null; // YYYY-MM-DD
  areaType: string | null; // 舖位類型（area_type），空字串/null = 不限
  district: string | null; // 地區：18 區標準名，或 macro key（hong_kong_island/kowloon/new_territories）
  linkReit: boolean; // true = 只顯示領展場地
  maxBudget: number | null;
  food: boolean;
  aircon: boolean;
  deal: boolean;
}
