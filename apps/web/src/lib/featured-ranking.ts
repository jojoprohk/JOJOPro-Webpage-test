import type { PublicListing } from "./listing-types.js";
import { isExpired } from "./listing-filter.js";

// 每周精選嘅計分邏輯。
//
// 目標：揀出「資料最清楚 + 價錢最平 + 場地最有吸引力」嘅 listing，
// 將來可作廣告位（pay-to-feature）。純 computed，唔改 DB。
//
// 三個維度（各 0–100，最終加權 40/30/30）：
//   - clarity  (40%)：8 個關鍵欄位齊唔齊（價、聯絡、冷氣、場地名、地區、相、摘要、日期）
//   - price    (30%)：同一 area_type 入面嘅平貴 percentile
//   - appeal   (30%)：area_type 吸引力 + 旺位 + 多相 + 冷氣 + 唔使審批

const FEATURED_LIMIT = 6;

// 對潛在租戶嚟講最受歡迎嘅 area_type；高 = 高需求。
const AREA_TYPE_APPEAL: Record<string, number> = {
  pop_up_event: 1.0,
  market: 0.95,
  mall: 0.9,
  exhibition: 0.7,
  street: 0.6,
  private_venue: 0.5,
  industrial: 0.4,
  other: 0.3,
  unknown: 0.1,
};

const TOTAL_CLARITY_FIELDS = 8;

export function clarityScore(listing: PublicListing): number {
  let filled = 0;
  if (listing.priceAmountHkd !== null && listing.priceAmountHkd > 0) filled += 1;
  if (listing.contactWhatsappLink || listing.contactText) filled += 1;
  if (listing.hasAircon !== null) filled += 1;
  if (listing.venueName) filled += 1;
  if (listing.district) filled += 1;
  if (listing.photoCount > 0) filled += 1;
  if (listing.summary && listing.summary.trim() !== "") filled += 1;
  if (
    listing.startDate !== null ||
    listing.endDate !== null ||
    listing.sessionDates.length > 0
  ) {
    filled += 1;
  }
  return Math.round((filled / TOTAL_CLARITY_FIELDS) * 100);
}

export function priceScore(listing: PublicListing, peers: PublicListing[]): number {
  if (listing.priceAmountHkd === null) return 0;
  const sameTypePrices = peers
    .filter(
      (p) =>
        p.areaType === listing.areaType &&
        p.priceAmountHkd !== null &&
        p.priceAmountHkd > 0,
    )
    .map((p) => p.priceAmountHkd as number)
    .sort((a, b) => a - b);
  if (sameTypePrices.length === 0) return 0;
  const idx = sameTypePrices.indexOf(listing.priceAmountHkd);
  if (idx < 0) return 0;
  // 最平（idx=0）= 100；最貴（last）= 0
  if (sameTypePrices.length === 1) return 100;
  return Math.round((1 - idx / (sameTypePrices.length - 1)) * 100);
}

export function appealScore(listing: PublicListing): number {
  let s = 0;
  // area_type 吸引力（最多 40）
  s += (AREA_TYPE_APPEAL[listing.areaType] ?? 0.3) * 40;
  // 旺位（最多 15）
  if (listing.isPrimeSpot) s += 15;
  // 真實場地相（用戶 upload）— 場主主動提供嘅相係強訊號，分數大幅拉高。
  if (listing.realPhotoCount >= 3) s += 30;
  else if (listing.realPhotoCount >= 1) s += 20;
  // 多張相（最多 15）— 包括 stock fallback，主要反映豐富度
  if (listing.photoCount >= 3) s += 15;
  else if (listing.photoCount >= 2) s += 9;
  // 冷氣明確有（10）
  if (listing.hasAircon === true) s += 10;
  // 車位 niche（5）
  if (listing.isCartSpot) s += 5;
  // 唔使產品審批（5）— 即買即擺通常比較吸引
  if (!listing.requiresProductApproval) s += 5;
  // 純急放/特價通常零碎，輕微扣分
  if (listing.isUrgent || listing.isDiscounted) s -= 4;
  return Math.max(0, Math.min(100, Math.round(s)));
}

export type FeaturedTier = 1 | 2 | 3 | 4;

// 嚴格 tier 排序（用戶要求）：
// 重點區分「真實相」（realPhotoCount > 0，即用戶喺 Telegram 一齊 upload 上嚟）
// 同 Stock 相（自動配嘅代表相）：
//   tier 1 = 有真實相 + 有價（最高分）
//   tier 2 = 冇真實相 + 有價（只有 stock 相但有價都 OK）
//   tier 3 = 有真實相 + 冇價（visual 強但價錢唔清）
//   tier 4 = 冇真實相 + 冇價（最低分）
// pickFeatured 會先排 tier，tier 入面再用 scoreForFeatured 排，
// 確保任何 tier 1 都贏過任何 tier 2/3/4，無論分數幾差。
export function featuredTier(listing: PublicListing): FeaturedTier {
  const hasReal = listing.realPhotoCount > 0;
  const hasPrice = listing.priceAmountHkd !== null && listing.priceAmountHkd > 0;
  if (hasReal && hasPrice) return 1;
  if (!hasReal && hasPrice) return 2;
  if (hasReal) return 3;
  return 4;
}

export function scoreForFeatured(
  listing: PublicListing,
  peers: PublicListing[],
): number {
  return Math.round(
    0.4 * clarityScore(listing) +
      0.3 * priceScore(listing, peers) +
      0.3 * appealScore(listing),
  );
}

export function pickFeatured(
  listings: PublicListing[],
  today: string,
  limit: number = FEATURED_LIMIT,
): PublicListing[] {
  // 過期場地直接排除（用戶已講明過期唔顯示）。
  // 冇相都排除（featured gallery 冇圖冇意義）。
  const candidates = listings.filter(
    (l) => l.photoCount > 0 && !isExpired(l, today),
  );
  const scored = candidates.map((l) => ({
    listing: l,
    score: scoreForFeatured(l, candidates),
    tier: featuredTier(l),
  }));
  scored.sort((a, b) => {
    // 先按 tier（1 最高），tier 入面先按 score。
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (b.score !== a.score) return b.score - a.score;
    // 同分揀較新建立嘅。
    return a.listing.createdAt < b.listing.createdAt ? 1 : -1;
  });
  return scored.slice(0, limit).map((s) => s.listing);
}
