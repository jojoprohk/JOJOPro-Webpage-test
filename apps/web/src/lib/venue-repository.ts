import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { IntakeInput, ParseResult, VenueDraftEntry } from "@jojopro/ai";
import { buildEntryPhotos } from "./draft-photos.js";

interface SaveIntakeAndDraftsResult {
  intakeItemId: string;
  venueDraftIds: string[];
}

// 清走孤立代理字符（lone surrogate）。上游若用冇 `u` flag 嘅正則處理
// emoji，可能把代理對鋸斷成半字符；呢啲字串會令 PostgREST/Postgres
// 解析成個 JSON payload 時報 `invalid input syntax for type json`。
function stripLoneSurrogates(value: string): string {
  return value.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

// 遞迴清理即將寫入資料庫嘅 payload：字串清孤立代理，陣列/物件照走。
function sanitizeForInsert<T>(value: T): T {
  if (typeof value === "string") {
    return stripLoneSurrogates(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForInsert(item)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = sanitizeForInsert(item);
    }
    return out as unknown as T;
  }
  return value;
}

export interface VenueRepository {
  // 一條原始訊息可以對應多筆場地草稿（拆場地）。
  saveIntakeAndDrafts(
    input: IntakeInput,
    result: ParseResult,
  ): Promise<SaveIntakeAndDraftsResult>;
  // 只記低原始貼文（例如全部屬代放/非場地被跳過時），唔產生草稿。
  saveIntakeOnly(input: IntakeInput): Promise<{ intakeItemId: string }>;
}

function mapVenueDraftToRow(
  intakeItemId: string,
  entry: VenueDraftEntry,
  photoFileIds: string[],
) {
  const d = entry.draft;
  const photos =
    d.photos ??
    buildEntryPhotos(d.areaType, photoFileIds, entry.realVenuePhotoIndexes);
  return {
    intake_item_id: intakeItemId,
    status: "needs_review" as const,
    title: d.title,
    district: d.district,
    venue_name: d.venueName,
    session_dates: d.sessionDates,
    start_date: d.startDate,
    end_date: d.endDate,
    price_text: d.priceText,
    price_amount_hkd: d.priceAmountHkd,
    price_unit: d.priceUnit,
    booth_size_text: d.boothSizeText,
    contact_text: d.contactText,
    contact_whatsapp_link: d.contactWhatsappLink,
    area_type: d.areaType,
    photos,
    has_aircon: d.hasAircon,
    is_prime_spot: d.isPrimeSpot,
    is_cart_spot: d.isCartSpot,
    allows_food: d.allowsFood,
    allows_dry_goods: d.allowsDryGoods,
    allows_beauty: d.allowsBeauty,
    allows_service: d.allowsService,
    requires_product_approval: d.requiresProductApproval,
    is_urgent: d.isUrgent,
    is_discounted: d.isDiscounted,
    summary: d.summary,
    confidence_score: entry.confidenceScore,
    low_confidence_fields: entry.lowConfidenceFields,
    unconfirmed_fields: entry.unconfirmedFields,
    review_note: entry.reviewNote,
  };
}

export function createVenueRepository(
  supabase: SupabaseClient,
): VenueRepository {
  async function insertIntake(input: IntakeInput) {
    const { data: intakeData, error: intakeError } = await supabase
      .from("intake_items")
      .insert(sanitizeForInsert({
        source_type: input.sourceType,
        source_label: input.sourceLabel,
        source_url: input.sourceUrl,
        raw_content: input.rawContent,
        received_at: input.receivedAt,
        photo_file_ids: input.photoFileIds ?? [],
      }))
      .select("id")
      .single<{ id: string }>();

    if (intakeError || !intakeData) {
      throw new Error(intakeError?.message ?? "Failed to save intake item.");
    }

    return intakeData;
  }

  return {
    async saveIntakeAndDrafts(input, result) {
      const intakeData = await insertIntake(input);
      const photoFileIds = input.photoFileIds ?? [];
      const rows = result.entries.map((entry) =>
        mapVenueDraftToRow(intakeData.id, entry, photoFileIds),
      );

      const { data: draftData, error: draftError } = await supabase
        .from("venue_drafts")
        .insert(sanitizeForInsert(rows))
        .select("id");

      if (draftError || !draftData) {
        throw new Error(draftError?.message ?? "Failed to save venue drafts.");
      }

      return {
        intakeItemId: intakeData.id,
        venueDraftIds: draftData.map((row) => row.id),
      };
    },
    async saveIntakeOnly(input) {
      const intakeData = await insertIntake(input);
      return { intakeItemId: intakeData.id };
    },
  };
}

export function createSupabaseServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
