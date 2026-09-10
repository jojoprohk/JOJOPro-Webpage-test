"use client";

import {
  HK_DISTRICTS,
  resolveVenuePhotos,
  type AreaType,
  type VenuePhoto,
} from "@jojopro/ai";

export { HK_DISTRICTS };

export type Draft = {
  id: string;
  intake_item_id: string | null;
  title: string;
  district: string | null;
  venue_name: string | null;
  photos: VenuePhoto[] | null;
  session_dates: string[] | null;
  start_date: string | null;
  end_date: string | null;
  price_text: string | null;
  booth_size_text: string | null;
  contact_text: string | null;
  contact_whatsapp_link: string | null;
  area_type: string;
  has_aircon: boolean | null;
  is_prime_spot: boolean;
  is_cart_spot: boolean;
  allows_food: boolean | null;
  is_urgent: boolean;
  is_discounted: boolean;
  summary: string;
  is_featured: boolean;
  featured_at: string | null;
  confidence_score: number;
  low_confidence_fields: string[] | null;
  unconfirmed_fields: string[] | null;
  review_note: string;
  last_reviewed_at: string | null;
  intake: {
    source_label: string;
    source_url: string | null;
    raw_content: string;
    received_at: string;
    photo_file_ids: string[] | null;
  } | null;
};

// 審核表單用嘅 camelCase 欄位（對應可編輯欄位）。
export type DraftForm = {
  title: string;
  district: string;
  venueName: string;
  photos: VenuePhoto[];
  startDate: string;
  endDate: string;
  priceText: string;
  boothSizeText: string;
  contactText: string;
  areaType: string;
  hasAircon: string;
  allowsFood: string;
  isUrgent: boolean;
  isDiscounted: boolean;
  isPrimeSpot: boolean;
};

// 草稿實際展示嘅相：DB photos 為空（舊數據）就按場地類型 fallback 一張 stock。
export function draftPhotos(d: Draft): VenuePhoto[] {
  return resolveVenuePhotos(d.photos, (d.area_type as AreaType) ?? "unknown");
}

export const AREA_TYPES = [
  "mall",
  "market",
  "street",
  "industrial",
  "pop_up_event",
  "private_venue",
  "exhibition",

  "other",
  "unknown",
];

export const AREA_LABELS: Record<string, string> = {
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

export function toForm(d: Draft): DraftForm {
  return {
    title: d.title ?? "",
    district: d.district ?? "",
    venueName: d.venue_name ?? "",
    photos: draftPhotos(d),
    startDate: d.start_date ?? "",
    endDate: d.end_date ?? "",
    priceText: d.price_text ?? "",
    boothSizeText: d.booth_size_text ?? "",
    contactText: d.contact_text ?? "",
    areaType: d.area_type ?? "unknown",
    hasAircon: d.has_aircon === null ? "" : d.has_aircon ? "yes" : "no",
    allowsFood: d.allows_food === null ? "" : d.allows_food ? "yes" : "no",
    isUrgent: d.is_urgent,
    isDiscounted: d.is_discounted,
    isPrimeSpot: d.is_prime_spot,
  };
}

export function formToFields(f: DraftForm) {
  return {
    title: f.title,
    district: f.district || null,
    venueName: f.venueName || null,
    photos: f.photos,
    startDate: f.startDate || null,
    endDate: f.endDate || null,
    priceText: f.priceText || null,
    boothSizeText: f.boothSizeText || null,
    contactText: f.contactText || null,
    areaType: f.areaType,
    hasAircon: f.hasAircon === "" ? null : f.hasAircon === "yes",
    allowsFood: f.allowsFood === "" ? null : f.allowsFood === "yes",
    isUrgent: f.isUrgent,
    isDiscounted: f.isDiscounted,
    isPrimeSpot: f.isPrimeSpot,
  };
}

// AI 標記為低信心／待確認嘅欄位（camelCase），用嚟喺表單高亮。
export function lowConfidenceSet(d: Draft): Set<string> {
  return new Set([
    ...(d.low_confidence_fields ?? []),
    ...(d.unconfirmed_fields ?? []),
  ]);
}
