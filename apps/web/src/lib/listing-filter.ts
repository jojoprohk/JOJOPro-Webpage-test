import type { ListingFilters, PublicListing } from "./listing-types.js";

// 日期全部用 YYYY-MM-DD 字串比較（lexicographic 同時間序一致）。

// 攞香港時區（UTC+8）今日嘅 YYYY-MM-DD。server 可能用 UTC，
// 香港接近午夜時兩者會差一日，所以顯式用香港時區。
export function todayInHongKong(now: Date = new Date()): string {
  const hkTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return hkTime.toISOString().slice(0, 10);
}

// 完全過期：最遲開檔日都早過今日。
// 連續檔用 end_date（冇 end_date 用 start_date）；斷續檔用 session_dates 最遲一日。
// 完全冇日期資料唔當過期（唔好靜默隱藏）。
export function isExpired(listing: PublicListing, today: string): boolean {
  const sessions = listing.sessionDates ?? [];
  if (sessions.length > 0) {
    const latest = sessions[sessions.length - 1] as string;
    return latest < today;
  }
  const last = listing.endDate ?? listing.startDate;
  if (last === null) {
    return false;
  }
  return last < today;
}

// 某一日係咪有檔：
// - 斷續檔：session_dates 含該日；
// - 連續檔：start <= date <= end（冇 end 就當只 start 一日）。
export function isAvailableOn(listing: PublicListing, date: string): boolean {
  const sessions = listing.sessionDates ?? [];
  if (sessions.length > 0) {
    return sessions.includes(date);
  }
  const { startDate, endDate } = listing;
  if (startDate === null) {
    return false;
  }
  const end = endDate ?? startDate;
  return date >= startDate && date <= end;
}

function matchesQuery(listing: PublicListing, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (needle === "") {
    return true;
  }
  const haystack = [
    listing.title,
    listing.district,
    listing.venueName,
    listing.summary,
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n")
    .toLowerCase();
  return haystack.includes(needle);
}

export function matchesFilters(
  listing: PublicListing,
  filters: ListingFilters,
  today: string,
): boolean {
  // 揀咗特定日期：只顯示當日有檔（唔再另外套用隱藏過期）。
  if (filters.date) {
    if (!isAvailableOn(listing, filters.date)) {
      return false;
    }
  } else if (isExpired(listing, today)) {
    // 預設隱藏完全過期嘅場地。
    return false;
  }

  if (!matchesQuery(listing, filters.q)) {
    return false;
  }

  if (
    filters.maxBudget !== null &&
    (listing.priceAmountHkd === null ||
      listing.priceAmountHkd > filters.maxBudget)
  ) {
    return false;
  }

  if (filters.food && listing.allowsFood !== true) {
    return false;
  }
  if (filters.aircon && listing.hasAircon !== true) {
    return false;
  }
  if (
    filters.deal &&
    listing.isUrgent !== true &&
    listing.isDiscounted !== true
  ) {
    return false;
  }

  return true;
}

// 急放／特價行先 → 最近開始日期（null 排最後）→ 最新建立。
export function compareListings(a: PublicListing, b: PublicListing): number {
  const aDeal = a.isUrgent || a.isDiscounted ? 1 : 0;
  const bDeal = b.isUrgent || b.isDiscounted ? 1 : 0;
  if (aDeal !== bDeal) {
    return bDeal - aDeal;
  }

  const aStart = a.startDate;
  const bStart = b.startDate;
  if (aStart !== null && bStart !== null && aStart !== bStart) {
    return aStart < bStart ? -1 : 1;
  }
  if (aStart === null && bStart !== null) {
    return 1;
  }
  if (aStart !== null && bStart === null) {
    return -1;
  }

  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}

export function applyFilters(
  listings: PublicListing[],
  filters: ListingFilters,
  today: string,
): PublicListing[] {
  return listings
    .filter((listing) => matchesFilters(listing, filters, today))
    .sort(compareListings);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isTruthyFlag(value: string | undefined): boolean {
  return value === "1" || value === "on" || value === "true";
}

// 由 URL search params 解析篩選。輸入寬鬆，輸出規整。
export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): ListingFilters {
  const first = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const q = (first("q") ?? "").trim();
  const dateRaw = first("date") ?? "";
  const date = DATE_RE.test(dateRaw) ? dateRaw : null;

  const budgetRaw = first("maxBudget") ?? "";
  const budgetNum = Number(budgetRaw);
  const maxBudget =
    budgetRaw.trim() !== "" && Number.isFinite(budgetNum) && budgetNum > 0
      ? Math.floor(budgetNum)
      : null;

  return {
    q,
    date,
    maxBudget,
    food: isTruthyFlag(first("food")),
    aircon: isTruthyFlag(first("aircon")),
    deal: isTruthyFlag(first("deal")),
  };
}

// 將資料庫入面可能嘅 WhatsApp 聯絡寫法，正規化做可點擊連結。
// 已經係 http(s) 連結就原用；wa.me/... 補 scheme；淨數字當電話號碼。
export function normalizeWhatsappLink(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  const value = raw.trim();
  if (value === "") {
    return null;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  if (/^wa\.me\//i.test(value)) {
    return `https://${value}`;
  }
  const digits = value.replace(/[\s-]/g, "");
  if (/^\d{8,15}$/.test(digits)) {
    return `https://wa.me/${digits}`;
  }
  return null;
}

// 卡上日期顯示文字。
export function formatDateLabel(listing: PublicListing): string {
  const sessions = listing.sessionDates ?? [];
  if (sessions.length === 1) {
    return sessions[0] as string;
  }
  if (sessions.length > 1) {
    const first = sessions[0] as string;
    const last = sessions[sessions.length - 1] as string;
    return `${first} 至 ${last}（共 ${sessions.length} 日）`;
  }
  const { startDate, endDate } = listing;
  if (startDate && endDate && startDate !== endDate) {
    return `${startDate} 至 ${endDate}`;
  }
  if (startDate) {
    return startDate;
  }
  return "日期待確認";
}
