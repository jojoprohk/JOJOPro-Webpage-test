import type { SupabaseClient } from "@supabase/supabase-js";
import { expectOk, supabaseRest } from "./supabase-rest.js";

export type ReviewAction = "approve" | "reject" | "save" | "toggle_featured";

// 審核頁可以改嘅欄位（camelCase -> 資料庫 snake_case）。
// 呢個白名單係唯一容許寫入嘅欄位，防止 API 接受任意欄位。
const EDITABLE_FIELD_MAP: Record<string, string> = {
  title: "title",
  district: "district",
  venueName: "venue_name",
  sessionDates: "session_dates",
  startDate: "start_date",
  endDate: "end_date",
  priceText: "price_text",
  priceAmountHkd: "price_amount_hkd",
  priceUnit: "price_unit",
  boothSizeText: "booth_size_text",
  contactText: "contact_text",
  contactWhatsappLink: "contact_whatsapp_link",
  areaType: "area_type",
  photos: "photos",
  hasAircon: "has_aircon",
  isPrimeSpot: "is_prime_spot",
  isCartSpot: "is_cart_spot",
  allowsFood: "allows_food",
  allowsDryGoods: "allows_dry_goods",
  allowsBeauty: "allows_beauty",
  allowsService: "allows_service",
  requiresProductApproval: "requires_product_approval",
  isUrgent: "is_urgent",
  isDiscounted: "is_discounted",
  summary: "summary",
  isFeatured: "is_featured",
  featuredAt: "featured_at",
};

function isEditableValue(value: unknown, key: string): boolean {
  // photos 係結構化物件陣列，由 route 層用 coerceVenuePhotos 驗證後先傳入，
  // 呢度只容許陣列（元素型別喺 route 層把關）。
  if (key === "photos") {
    return Array.isArray(value);
  }
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    (Array.isArray(value) &&
      value.every((item) => typeof item === "string"))
  );
}

// 純函數：由審核 action + 改動欄位，組出資料庫 update row。
// 唔喺白名單嘅欄位直接丟棄，錯型別都丟棄。
export function buildDraftUpdate(
  action: ReviewAction,
  fields: Record<string, unknown> | undefined,
  reviewNote: string | undefined,
  nowIso: string,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  // save = 只儲存改動，唔改狀態（草稿維持 needs_review）；updated_at 由
  // DB trigger 自動更新。approve/reject 先改 status 同 last_reviewed_at。
  if (action === "approve" || action === "reject") {
    row.status = action === "approve" ? "approved" : "rejected";
    row.last_reviewed_at = nowIso;
  } else if (action === "toggle_featured") {
    // featured toggle 必須讀取當前 is_featured 先決定 on/off。
    // 客戶端傳 isFeatured (boolean) 入 fields；呢度根據佢寫入並 stamp featured_at。
    // 若客戶端冇傳 isFeatured 就默認為 true（toggle on）。
    const wantOn =
      fields && typeof fields.isFeatured === "boolean"
        ? (fields.isFeatured as boolean)
        : true;
    row.is_featured = wantOn;
    row.featured_at = wantOn ? nowIso : null;
  }

  if (fields) {
    for (const [camelKey, value] of Object.entries(fields)) {
      const snakeKey = EDITABLE_FIELD_MAP[camelKey];
      if (snakeKey && isEditableValue(value, camelKey)) {
        row[snakeKey] = value;
      }
    }
  }

  if (typeof reviewNote === "string" && reviewNote.trim() !== "") {
    row.review_note = reviewNote;
  }

  return row;
}

export interface ReviewDraftRow {
  id: string;
  intake_item_id: string;
  status: string;
  title: string;
  district: string | null;
  venue_name: string | null;
  session_dates: string[] | null;
  start_date: string | null;
  end_date: string | null;
  price_text: string | null;
  price_amount_hkd: number | null;
  price_unit: string;
  booth_size_text: string | null;
  contact_text: string | null;
  contact_whatsapp_link: string | null;
  area_type: string;
  photos: Array<{ kind: string; fileId?: string; src?: string }> | null;
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
  is_featured: boolean;
  featured_at: string | null;
  confidence_score: number;
  low_confidence_fields: string[] | null;
  unconfirmed_fields: string[] | null;
  review_note: string;
  intake: {
    source_label: string;
    source_url: string | null;
    raw_content: string;
    received_at: string;
    photo_file_ids: string[] | null;
  } | null;
}

export interface ReviewRepository {
  listDrafts(status: string): Promise<ReviewDraftRow[]>;
  updateDraft(id: string, row: Record<string, unknown>): Promise<void>;
}

export function createReviewRepository(
  supabase: SupabaseClient,
): ReviewRepository {
  return {
    async listDrafts(status) {
      // Diagnostic + raw fetch.
      // Without cookie -> 401 (works). With cookie -> 500 ByteString.
      // Theory: env var (SUPABASE_URL or SERVICE_ROLE_KEY) has non-ASCII char,
      // undici header validation throws ByteString when building the request.
      const supabaseUrl = process.env.SUPABASE_URL || "";
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

      // Route through supabaseRest — single source of truth for URL/key scrubbing
      // and URL logging. The previous inline fetch path triggered Node 18 undici
      // ByteString ("character at index 19 has a value of 8594") when Vercel's
      // function runtime could not be bumped to Node 20 via package.json#engines.
      console.log(`[review-drafts] node=${process.version} status=${status}`);

      const params = new URLSearchParams({
        select: "*",
        status: `eq.${status}`,
        order: "created_at.desc",
      });
      const res = await supabaseRest(
        `/rest/v1/venue_drafts?${params.toString()}`,
        { method: "GET" },
      );
      await expectOk(res, "listDrafts");

      const drafts = (await res.json()) as Omit<ReviewDraftRow, "intake">[];
      return drafts.map((d) => ({ ...d, intake: null } as ReviewDraftRow));
    },

    async updateDraft(id, row) {
      // Bypass supabase-js (Node 18 undici ByteString bug). Raw PATCH.
      const res = await supabaseRest(
        `/rest/v1/venue_drafts?id=eq.${encodeURIComponent(id)}`,
        { method: "PATCH", body: JSON.stringify(row) },
      );
      await expectOk(res, "updateDraft");
    },
  };
}
