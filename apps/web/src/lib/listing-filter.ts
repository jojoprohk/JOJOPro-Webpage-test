import type { ListingFilters, PublicListing } from "./listing-types.js";

// 日期全部用 YYYY-MM-DD 字串比較（lexicographic 同時間序一致）。

// 攞香港時區（UTC+8）今日嘅 YYYY-MM-DD。server 可能用 UTC，
// 香港接近午夜時兩者會差一日，所以顯式用香港時區。
export function todayInHongKong(now: Date = new Date()): string {
  const hkTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return hkTime.toISOString().slice(0, 10);
}

// 完全過期：所有日子都喺今日之前。
//
// 5 個 case：
//   1. 斷續檔 session_dates：今日喺 list 入面 OR 入面有 future date → 已 active；
//      全部都 < today → expired。
//   2. 連續檔 start + end：今日喺 [start, end] 之內 → 已 active（横跨進行中嘅 listing）；
//      否則睇 end 過咗未。
//   3. 只有 end：end < today → expired；否則 active。
//   4. 只有 start（一日 event）：start < today → expired；否則 active。
//   5. 完全冇日期資料 → 唔當過期（唔好靜默隱藏）。
export function isExpired(listing: PublicListing, today: string): boolean {
  const sessions = listing.sessionDates ?? [];
  if (sessions.length > 0) {
    if (sessions.includes(today)) return false;
    const latest = sessions[sessions.length - 1] as string;
    return latest < today;
  }
  const start = listing.startDate;
  const end = listing.endDate;
  if (start !== null && end !== null) {
    if (start <= today && today <= end) return false;
    return end < today;
  }
  if (end !== null) {
    return end < today;
  }
  if (start !== null) {
    return start < today;
  }
  return false;
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
  // 地區搜尋：資料庫 district 用標準 18 區名（「油尖旺區」），但用戶多數
  // 打口語名（「旺角」）或大區統稱（「九龍」）。先擴展成地區關鍵字群組：
  // 命中群組其中一個區名即當符合。
  const districtGroup = DISTRICT_QUERY_GROUPS[needle];
  if (districtGroup) {
    const d = (listing.district ?? "").toLowerCase();
    if (districtGroup.some((name) => d === name.toLowerCase())) {
      return true;
    }
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

// 地區下拉：18 區標準名，或三大區統稱（港島／九龍／新界）。
const DISTRICT_MACRO_GROUPS: Record<string, string[]> = {
  hong_kong_island: ["中西區", "灣仔區", "東區", "南區"],
  kowloon: ["油尖旺區", "深水埗區", "九龍城區", "黃大仙區", "觀塘區"],
  new_territories: [
    "葵青區", "荃灣區", "屯門區", "元朗區", "北區", "大埔區",
    "沙田區", "西貢區", "離島區",
  ],
};

function matchesDistrict(listing: PublicListing, district: string): boolean {
  if (!listing.district) return false;
  const group = DISTRICT_MACRO_GROUPS[district];
  if (group) return group.includes(listing.district);
  return listing.district === district;
}

// 口語／別名 → 標準 18 區。搜尋地區時用嚟把關：用戶打「旺角」或「九龍」
// 都可以對到「油尖旺區」／九龍五區。key 一律小寫、去空白。
const DISTRICT_ALIAS: Record<string, string> = {
  中環: "中西區", 上環: "中西區", 金鐘: "中西區", 西環: "中西區", 堅尼地城: "中西區",
  灣仔: "灣仔區", 銅鑼灣: "灣仔區", 銅鑼湾: "灣仔區", 銅鑼: "灣仔區", 跑馬地: "灣仔區",
  北角: "東區", 鰂魚涌: "東區", 太古: "東區", 西灣河: "東區", 筲箕灣: "東區",
  柴灣: "東區", 杏花邨: "東區", 康怡: "東區", 太古城: "東區",
  香港仔: "南區", 鴨脷洲: "南區", 赤柱: "南區", 薄扶林: "南區", 數碼港: "南區",
  華富: "南區", 海怡: "南區", 田灣: "南區",
  旺角: "油尖旺區", 尖沙咀: "油尖旺區", 尖沙嘴: "油尖旺區", 佐敦: "油尖旺區",
  油麻地: "油尖旺區", 大角咀: "油尖旺區", 奧海城: "油尖旺區", 朗豪坊: "油尖旺區",
  深水埗: "深水埗區", 長沙灣: "深水埗區", 石硤尾: "深水埗區", 荔枝角: "深水埗區",
  美孚: "深水埗區", 南昌: "深水埗區",
  九龍城: "九龍城區", 紅磡: "九龍城區", 土瓜灣: "九龍城區", 何文田: "九龍城區",
  黃埔: "九龍城區", 啟德: "九龍城區", 启德: "九龍城區",
  黃大仙: "黃大仙區", 乐富: "黃大仙區", 樂富: "黃大仙區", 鑽石山: "黃大仙區",
  彩虹: "黃大仙區", 慈雲山: "黃大仙區", 新蒲崗: "黃大仙區",
  觀塘: "觀塘區", 观塘: "觀塘區", 牛頭角: "觀塘區", 九龍灣: "觀塘區",
  秀茂坪: "觀塘區", 藍田: "觀塘區", 油塘: "觀塘區", apm: "觀塘區", 德福: "觀塘區",
  淘大: "觀塘區",
  葵涌: "葵青區", 葵芳: "葵青區", 青衣: "葵青區", 葵青: "葵青區",
  荃灣: "荃灣區",
  屯門: "屯門區",
  元朗: "元朗區", 天水圍: "元朗區",
  上水: "北區", 粉嶺: "北區",
  大埔: "大埔區",
  沙田: "沙田區", 馬鞍山: "沙田區",
  將軍澳: "西貢區", 将军澳: "西貢區", 西貢: "西貢區", 西贡: "西貢區", 坑口: "西貢區", 寶琳: "西貢區",
  東涌: "離島區", 东涌: "離島區", 長洲: "離島區", 大嶼山: "離島區", 愉景灣: "離島區",
};

const HONG_KONG_ISLAND = ["中西區", "灣仔區", "東區", "南區"];
const KOWLOON = ["油尖旺區", "深水埗區", "九龍城區", "黃大仙區", "觀塘區"];
const NEW_TERRITORIES = [
  "葵青區", "荃灣區", "屯門區", "元朗區", "北區", "大埔區",
  "沙田區", "西貢區", "離島區",
];

const MACRO_GROUPS: Record<string, string[]> = {
  港島: HONG_KONG_ISLAND,
  香港島: HONG_KONG_ISLAND,
  香港: HONG_KONG_ISLAND,
  九龍: KOWLOON,
  九龍區: KOWLOON,
  新界: NEW_TERRITORIES,
  離島: ["離島區"],
};

// 預先組好「搜尋詞 → 會命中嘅標準區名群組」。標準區名自己都係群組（一個區）。
const DISTRICT_QUERY_GROUPS: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const [alias, canonical] of Object.entries(DISTRICT_ALIAS)) {
    map[alias.toLowerCase()] = [canonical];
  }
  for (const [key, group] of Object.entries(MACRO_GROUPS)) {
    map[key.toLowerCase()] = group;
  }
  // 標準區名（「油尖旺區」）自己對自己；容許唔打「區」字（「油尖旺」）。
  const allDistricts = new Set<string>([
    ...Object.values(DISTRICT_ALIAS),
    ...HONG_KONG_ISLAND,
    ...KOWLOON,
    ...NEW_TERRITORIES,
  ]);
  for (const d of allDistricts) {
    map[d.toLowerCase()] = [d];
    map[d.replace(/區$/, "").toLowerCase()] = [d];
  }
  return map;
})();

export function matchesFilters(
  listing: PublicListing,
  filters: ListingFilters,
  today: string,
): boolean {
  // 揀咗特定日期：只顯示當日有檔；過期與否唔影響（已過期但當日有檔屬邏輯矛盾，跳過）。
  if (filters.date && !isAvailableOn(listing, filters.date)) {
    return false;
  }

  // 過期場地直接隱藏，唔顯示。
  if (isExpired(listing, today)) {
    return false;
  }

  if (!matchesQuery(listing, filters.q)) {
    return false;
  }

  if (filters.areaType && listing.areaType !== filters.areaType) {
    return false;
  }

  if (filters.district && !matchesDistrict(listing, filters.district)) {
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

  // 領展場地 filter：剔咗就只顯示 isLinkReit=true 嘅場地。
  if (filters.linkReit && listing.isLinkReit !== true) {
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

  const areaTypeRaw = (first("areaType") ?? "").trim();
  const areaType =
    areaTypeRaw !== "" &&
    ["mall", "market", "street", "industrial", "pop_up_event", "private_venue", "other", "exhibition", "unknown"].includes(areaTypeRaw)
      ? areaTypeRaw
      : null;

  const districtRaw = (first("district") ?? "").trim();
  const district =
    districtRaw !== "" &&
    (DISTRICT_MACRO_GROUPS[districtRaw] !== undefined ||
      /^[\u4e00-\u9fff]{2,4}區$/.test(districtRaw))
      ? districtRaw
      : null;

  const budgetRaw = first("maxBudget") ?? "";
  const budgetNum = Number(budgetRaw);
  const maxBudget =
    budgetRaw.trim() !== "" && Number.isFinite(budgetNum) && budgetNum > 0
      ? Math.floor(budgetNum)
      : null;

  return {
    q,
    date,
    areaType,
    district,
    maxBudget,
    food: isTruthyFlag(first("food")),
    aircon: isTruthyFlag(first("aircon")),
    deal: isTruthyFlag(first("deal")),
    linkReit: isTruthyFlag(first("linkReit")),
  };
}

// 由 contactText 內抽取第一個 URL。
// 支援：https?://、wa.me/、t.me/、instagram.com/...、bit.ly/...。
// 用最簡單 regex：URL 連續字元直到空白／句號／行尾。
// 如果 contactText 本身係 URL 就 extract 返出嚟做 link 嘅 href；
// 但 link 嘅顯示文字仍然用原 contactText（包含「IG: @xxx」等 context）。
const CONTACT_URL_RE = /\b((?:https?:\/\/[\w.-]+|wa\.me\/[\w-]+|t\.me\/[\w-]+|[\w-]+\.(?:com|hk|org|io|me|co))(?:\/[\w\-./?=&%#]*)?)/i;

export function extractContactUrl(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(CONTACT_URL_RE);
  if (!m) return null;
  const url = m[1];
  if (url === undefined) return null;
  // 自動補 https:// 如果係 wa.me / t.me / domain-only
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
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
