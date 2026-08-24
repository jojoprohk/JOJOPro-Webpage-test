import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { IntakeInput, ParseResult } from "@jopojo/ai";

interface SaveIntakeAndDraftResult {
  intakeItemId: string;
  venueDraftId: string;
}

export interface VenueRepository {
  saveIntakeAndDraft(
    input: IntakeInput,
    result: ParseResult,
  ): Promise<SaveIntakeAndDraftResult>;
}

interface MapVenueDraftToRowInput {
  intakeItemId: string;
  result: ParseResult;
}

export function mapVenueDraftToRow({
  intakeItemId,
  result,
}: MapVenueDraftToRowInput) {
  return {
    intake_item_id: intakeItemId,
    status: result.status,
    title: result.draft.title,
    district: result.draft.district,
    venue_name: result.draft.venueName,
    start_date: result.draft.startDate,
    end_date: result.draft.endDate,
    price_text: result.draft.priceText,
    price_amount_hkd: result.draft.priceAmountHkd,
    price_unit: result.draft.priceUnit,
    booth_size_text: result.draft.boothSizeText,
    contact_text: result.draft.contactText,
    contact_whatsapp_link: result.draft.contactWhatsappLink,
    area_type: result.draft.areaType,
    has_aircon: result.draft.hasAircon,
    is_prime_spot: result.draft.isPrimeSpot,
    is_cart_spot: result.draft.isCartSpot,
    allows_food: result.draft.allowsFood,
    allows_dry_goods: result.draft.allowsDryGoods,
    allows_beauty: result.draft.allowsBeauty,
    allows_service: result.draft.allowsService,
    requires_product_approval: result.draft.requiresProductApproval,
    is_urgent: result.draft.isUrgent,
    is_discounted: result.draft.isDiscounted,
    summary: result.draft.summary,
    confidence_score: result.confidenceScore,
    low_confidence_fields: result.lowConfidenceFields,
    unconfirmed_fields: result.unconfirmedFields,
    review_note: result.reviewNote,
  };
}

export function createVenueRepository(
  supabase: SupabaseClient,
): VenueRepository {
  return {
    async saveIntakeAndDraft(input, result) {
      const { data: intakeData, error: intakeError } = await supabase
        .from("intake_items")
        .insert({
          source_type: input.sourceType,
          source_label: input.sourceLabel,
          source_url: input.sourceUrl,
          raw_content: input.rawContent,
          received_at: input.receivedAt,
        })
        .select("id")
        .single<{ id: string }>();

      if (intakeError || !intakeData) {
        throw new Error(intakeError?.message ?? "Failed to save intake item.");
      }

      const { data: draftData, error: draftError } = await supabase
        .from("venue_drafts")
        .insert(
          mapVenueDraftToRow({
            intakeItemId: intakeData.id,
            result,
          }),
        )
        .select("id")
        .single<{ id: string }>();

      if (draftError || !draftData) {
        throw new Error(draftError?.message ?? "Failed to save venue draft.");
      }

      return {
        intakeItemId: intakeData.id,
        venueDraftId: draftData.id,
      };
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
