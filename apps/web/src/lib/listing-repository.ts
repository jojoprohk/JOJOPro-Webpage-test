import type { SupabaseClient } from "@supabase/supabase-js";
import { expectOk, supabaseRest } from "./supabase-rest.js";
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
  is_featured: boolean;
  featured_at: string | null;
  is_link_reit: boolean;
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
    isFeatured: row.is_featured,
    featuredAt: row.featured_at,
    isLinkReit: row.is_link_reit,
  };
}

export interface ListingRepository {
  listApprovedListings(): Promise<PublicListing[]>;
  // 回報過期：increment report_count。返 true 表示搵到並更新。
  reportListing(id: string, nowIso: string): Promise<boolean>;
  // 設定 featured 旗標。on=true 標記並 stamp featured_at；on=false 移除 featured 狀態（featured_at 保留作歷史）。
  setFeatured(id: string, on: boolean, nowIso: string): Promise<boolean>;
}

export function createListingRepository(
  supabase: SupabaseClient,
): ListingRepository {
  return {
    async listApprovedListings() {
      // 跳過 supabase-js：用 raw fetch + URLSearchParams，等 Node 18 fetch
      // 唔會因為某啲 column value（例如舊 row 入面嘅 →）而 throw ByteString
      // error。Same trick as review-repository.listDrafts (commit 8a89d38).
      const supabaseUrl = process.env.SUPABASE_URL || "";
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      }

      // Defensive: env vars should be ASCII; if anyone pasted non-ASCII into
      // a secret we still want the page to load (truncated key is better
      // than crashing the whole home page).
      const asciiKey = serviceRoleKey.replace(/[^\x00-\x7f]/g, "?");

      const cleanBase = supabaseUrl.replace(/\/$/, "");

      // Query 1: approved venue_drafts (most recent first). No embed.
      // NOTE: do NOT put the comma-separated select / in() clauses through
      // URLSearchParams. It percent-encodes commas to %2C which PostgREST's
      // path parser rejects with PGRST125. Build the query string by hand
      // and only escape unsafe chars in scalar values.
      const draftsSelect =
        "id,title,district,venue_name,area_type,start_date,end_date," +
        "session_dates,price_text,price_amount_hkd,price_unit,booth_size_text," +
        "contact_text,contact_whatsapp_link,has_aircon,photos,is_prime_spot," +
        "is_cart_spot,allows_food,allows_dry_goods,allows_beauty,allows_service," +
        "requires_product_approval,is_urgent,is_discounted,summary,report_count," +
        "last_reviewed_at,created_at,is_featured,featured_at,is_link_reit,intake_item_id";
      const draftsQuery =
        `select=${encodeURIComponent(draftsSelect)}` +
        `&status=eq.approved` +
        `&order=created_at.desc`;
      const draftsRes = await supabaseRest(
        `/rest/v1/venue_drafts?${draftsQuery}`,
      );
      if (!draftsRes.ok) {
        await expectOk(draftsRes, "listApprovedListings");
      }
      const drafts = (await draftsRes.json()) as Array<
        Omit<ApprovedListingRow, "intake"> & { intake_item_id: string | null }
      >;
      if (drafts.length === 0) return [];

      // Query 2: intake_items 對應返各 draft 嘅 source_label / source_url。
      // Single round trip 用 in.() filter；避免逐個 query N+1。
      const intakeIds = Array.from(
        new Set(
          drafts
            .map((d) => d.intake_item_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0),
        ),
      );
      const intakeById = new Map<
        string,
        { source_label: string; source_url: string | null }
      >();
      if (intakeIds.length > 0) {
        // Same URLSearchParams caveat as Query 1: build the query string
        // by hand so the in.(uuid1,uuid2,...) filter keeps literal commas.
        const intakeQuery =
          `select=${encodeURIComponent("id,source_label,source_url")}` +
          `&id=in.(${intakeIds.map((id) => encodeURIComponent(id)).join(",")})`;
        const intakeRes = await supabaseRest(
          `/rest/v1/intake_items?${intakeQuery}`,
        );
        if (intakeRes.ok) {
          const intakes = (await intakeRes.json()) as Array<{
            id: string;
            source_label: string;
            source_url: string | null;
          }>;
          for (const it of intakes) {
            intakeById.set(it.id, {
              source_label: it.source_label,
              source_url: it.source_url,
            });
          }
        }
      }

      return drafts.map((d) => {
        const intakeMeta = d.intake_item_id
          ? intakeById.get(d.intake_item_id) ?? null
          : null;
        const row: ApprovedListingRow = {
          ...d,
          intake: intakeMeta
            ? {
                source_label: intakeMeta.source_label,
                source_url: intakeMeta.source_url,
              }
            : null,
        };
        return mapRowToPublicListing(row);
      });
    },

    async reportListing(id, nowIso) {
      // 原子遞增（SQL function，見 migration 202609020001）。
      // 只對 approved 行生效；搵唔到會回傳 null。
      // Bypass supabase-js (Node 18 undici ByteString bug). POST /rest/v1/rpc/<fn>.
      const res = await supabaseRest(
        "/rest/v1/rpc/increment_report_count",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listing_id: id, reported_at: nowIso }),
        },
      );
      if (!res.ok) {
        await expectOk(res, "reportListing");
      }
      // Supabase RPC returns the JSON result directly (single value or null).
      const data = await res.json().catch(() => null);
      return data !== null && data !== undefined;
    },

    async setFeatured(id, on, nowIso) {
      // on=true  → 寫 featured_at = now；on=false → 清 featured_at（保留 is_featured=false 旗標）。
      const update = on
        ? { is_featured: true, featured_at: nowIso }
        : { is_featured: false, featured_at: null };
      // Bypass supabase-js. PATCH with Prefer: return=representation so we
      // can read back the updated id.
      const res = await supabaseRest(
        `/rest/v1/venue_drafts?id=eq.${encodeURIComponent(id)}&status=eq.approved&select=id`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(update),
        },
      );
      await expectOk(res, "setFeatured");
      const data = (await res.json()) as Array<{ id: string }>;
      return Array.isArray(data) && data.length > 0;
    },
  };
}
