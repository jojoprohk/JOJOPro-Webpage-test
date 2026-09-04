import type { SupabaseClient } from "@supabase/supabase-js";

export type ReviewAction = "approve" | "reject" | "save";

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
      const { data, error } = await supabase
        .from("venue_drafts")
        .select(
          "*, intake:intake_items(source_label, source_url, raw_content, received_at, photo_file_ids)",
        )
        .eq("status", status)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []) as ReviewDraftRow[];
    },

    async updateDraft(id, row) {
      const { error } = await supabase
        .from("venue_drafts")
        .update(row)
        .eq("id", id);
      if (error) {
        throw new Error(error.message);
      }
    },
  };
}
