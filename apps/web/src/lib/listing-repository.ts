import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveVenuePhotos, type AreaType, type VenuePhoto } from "@jojopro/ai";
import type { PublicListing } from "./listing-types.js";

// 資料庫 row（snake_case）→ 公開 DTO（camelCase）。
// 只揀可以公開嘅欄位；raw_content／信心／審核內部欄位一律唔喺呢度出現。
interface ApprovedListingRow {
  id: string;
  title: string;
  district: string | null;
  venue_name: string | null;
  area_type: string;
  photos: VenuePhoto[] | null;
  start_date: string | null;
  end_date: string | null;
  session_dates: string[] | null;
  price_text: string | null;
  price_amount_hkd: number | null;
  price_unit: string;
  booth_size_text: string | null;
  contact_text: string | null;
  contact_whatsapp_link: string | null;
  has_aircon: boolean | null;
  is_prime_spot: boolean;
  is_cart_spot: boolean;
  allows_food: boolean | null;
  allows_dry_goods: boolean | null;
  allows_beauty: boolean | null;
  allows_service: boolean | null;
  requires_product_approval: boolean;
  is_urgent: boolean;
  is_discounted: boolean;
  summary: string;
  report_count: number | null;
  last_reviewed_at: string | null;
  created_at: string;
  intake: {
    source_label: string;
    source_url: string | null;
  } | null;
}

export function mapRowToPublicListing(row: ApprovedListingRow): PublicListing {
  return {
    id: row.id,
    title: row.title,
    district: row.district,
    venueName: row.venue_name,
    areaType: row.area_type,
    startDate: row.start_date,
    endDate: row.end_date,
    sessionDates: row.session_dates ?? [],
    priceText: row.price_text,
    priceAmountHkd: row.price_amount_hkd,
    priceUnit: row.price_unit,
    boothSizeText: row.booth_size_text,
    contactText: row.contact_text,
    contactWhatsappLink: row.contact_whatsapp_link,
    hasAircon: row.has_aircon,
    isPrimeSpot: row.is_prime_spot,
    isCartSpot: row.is_cart_spot,
    allowsFood: row.allows_food,
    allowsDryGoods: row.allows_dry_goods,
    allowsBeauty: row.allows_beauty,
    allowsService: row.allows_service,
    requiresProductApproval: row.requires_product_approval,
    isUrgent: row.is_urgent,
    isDiscounted: row.is_discounted,
    summary: row.summary,
    sourceLabel: row.intake?.source_label ?? "未知來源",
    sourceUrl: row.intake?.source_url ?? null,
    lastReviewedAt: row.last_reviewed_at,
    reportCount: row.report_count ?? 0,
    createdAt: row.created_at,
    // ...photo metadata 從 resolveVenuePhotos 計
    ...(() => {
      const photos = resolveVenuePhotos(
        row.photos,
        (row.area_type as AreaType) ?? "unknown",
      );
      const realPhotoCount = photos.filter((p) => p.kind === "telegram").length;
      const stockPhotoCount = photos.filter((p) => p.kind === "stock").length;
      const first = photos[0];
      const firstPhotoKind: "real" | "stock" | "none" =
        first === undefined
          ? "none"
          : first.kind === "telegram"
            ? "real"
            : "stock";
      return {
        photoCount: photos.length,
        realPhotoCount,
        stockPhotoCount,
        firstPhotoKind,
      };
    })(),
  };
}

export interface ListingRepository {
  listApprovedListings(): Promise<PublicListing[]>;
  // 回報過期：increment report_count。返 true 表示搵到並更新。
  reportListing(id: string, nowIso: string): Promise<boolean>;
}

export function createListingRepository(
  supabase: SupabaseClient,
): ListingRepository {
  return {
    async listApprovedListings() {
      const { data, error } = await supabase
        .from("venue_drafts")
        .select(
          "id, title, district, venue_name, area_type, start_date, end_date, session_dates, " +
          "price_text, price_amount_hkd, price_unit, booth_size_text, contact_text, " +
            "contact_whatsapp_link, has_aircon, photos, is_prime_spot, is_cart_spot, allows_food, " +
            "allows_dry_goods, allows_beauty, allows_service, requires_product_approval, " +
            "is_urgent, is_discounted, summary, report_count, last_reviewed_at, created_at, " +
            "intake:intake_items(source_label, source_url)",
        )
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }
      return ((data ?? []) as unknown as ApprovedListingRow[]).map(
        mapRowToPublicListing,
      );
    },

    async reportListing(id, nowIso) {
      // 原子遞增（SQL function，見 migration 202609020001）。
      // 只對 approved 行生效；搵唔到會回傳 null。
      const { data, error } = await supabase.rpc("increment_report_count", {
        listing_id: id,
        reported_at: nowIso,
      });

      if (error) {
        throw new Error(error.message);
      }
      return data !== null && data !== undefined;
    },
  };
}
