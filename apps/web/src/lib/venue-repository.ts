import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { IntakeInput, ParseResult, VenueDraftEntry } from "@jopojo/ai";

interface SaveIntakeAndDraftsResult {
  intakeItemId: string;
  venueDraftIds: string[];
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
) {
  const d = entry.draft;
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
      .insert({
        source_type: input.sourceType,
        source_label: input.sourceLabel,
        source_url: input.sourceUrl,
        raw_content: input.rawContent,
        received_at: input.receivedAt,
        photo_file_ids: input.photoFileIds ?? [],
      })
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
      const rows = result.entries.map((entry) =>
        mapVenueDraftToRow(intakeData.id, entry),
      );

      const { data: draftData, error: draftError } = await supabase
        .from("venue_drafts")
        .insert(rows)
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
