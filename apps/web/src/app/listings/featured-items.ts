// Server-safe data shaping for the featured gallery + detail modal.
// Kept out of the "use client" component so the server can call it.
import type { PublicListing } from "../../lib/listing-types.js";
import { formatDateLabel, normalizeWhatsappLink } from "../../lib/listing-filter.js";

export interface FeaturedBadge {
  label: string;
  hot: boolean;
}

export interface FeaturedItem {
  id: string;
  title: string;
  category: string;
  place: string;
  price: string | null;
  photo: string;
  href: string | null;
  // Detail-modal fields (all pre-computed on the server).
  dates: string;
  size: string | null;
  summary: string;
  badges: FeaturedBadge[];
  whatsapp: string | null;
  contactText: string | null;
  sourceLabel: string;
  updated: string;
}

const AREA_TYPE_LABELS: Record<string, string> = {
  mall: "商場",
  market: "市集",
  street: "街舖",
  industrial: "工廈",
  pop_up_event: "Pop-up 活動",
  private_venue: "私人場地",
  exhibition: "展銷位",
  other: "其他",
  unknown: "未分類",
};

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "未標示";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "未標示";
  const hk = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return hk.toISOString().slice(0, 10);
}

function badgesFor(l: PublicListing): FeaturedBadge[] {
  const out: FeaturedBadge[] = [];
  if (l.isUrgent) out.push({ label: "急放", hot: true });
  if (l.isDiscounted) out.push({ label: "特價", hot: true });
  if (l.allowsFood === true) out.push({ label: "可賣食品", hot: false });
  if (l.hasAircon === true) out.push({ label: "冷氣", hot: false });
  if (l.isPrimeSpot) out.push({ label: "旺位", hot: false });
  if (l.isCartSpot) out.push({ label: "車位", hot: false });
  if (l.requiresProductApproval) out.push({ label: "產品需審批", hot: false });
  return out;
}

// 精選：有相、最新嘅頭 limit 個場地。
export function toFeaturedItems(listings: PublicListing[], limit = 5): FeaturedItem[] {
  return listings.slice(0, limit).map((l) => ({
    id: l.id,
    title: l.title,
    category: AREA_TYPE_LABELS[l.areaType] ?? "未分類",
    place: [l.district, l.venueName].filter(Boolean).join(" · ") || "地點待確認",
    price: l.priceText,
    photo: `/api/photos/listing/${l.id}/0`,
    href: l.sourceUrl,
    dates: formatDateLabel(l),
    size: l.boothSizeText,
    summary: l.summary,
    badges: badgesFor(l),
    whatsapp: normalizeWhatsappLink(l.contactWhatsappLink),
    contactText: l.contactText,
    sourceLabel: l.sourceLabel,
    updated: formatUpdatedAt(l.lastReviewedAt),
  }));
}
