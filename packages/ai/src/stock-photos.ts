import type { AreaType, VenuePhoto } from "./types.js";

// 場地類型 → 通用代表相（本地 public/stock，免版權、唔熱鏈）。
// 冇真實場地相時，公開 listing 同審核頁都用呢張做封面。
export const AREA_TYPE_STOCK_PHOTO: Record<AreaType, string> = {
  mall: "/stock/mall.jpg",
  market: "/stock/market.jpg",
  street: "/stock/street.jpg",
  industrial: "/stock/industrial.jpg",
  pop_up_event: "/stock/pop-up.jpg",
  private_venue: "/stock/private-venue.jpg",
  other: "/stock/hong-kong-shop.jpg",
  unknown: "/stock/hong-kong-shop.jpg",
  exhibition: "/stock/exhibition.jpg",
};

export function stockPhotoForAreaType(areaType: AreaType): VenuePhoto {
  return { kind: "stock", src: AREA_TYPE_STOCK_PHOTO[areaType] ?? AREA_TYPE_STOCK_PHOTO.unknown };
}

// 計算一個樓盤最終展示嘅相列表。
// 預期 draft.photos 已經係 buildEntryPhotos 組好嘅 [real, real, ..., stock]
// 結構；如果 caller 傳入嘅 photos 唔包 stock（舊數據），會自動補返一張喺最後。
export function resolveVenuePhotos(
  photos: VenuePhoto[] | null | undefined,
  areaType: AreaType,
): VenuePhoto[] {
  const list = Array.isArray(photos) ? photos.filter(Boolean) : [];
  if (list.length === 0) {
    return [stockPhotoForAreaType(areaType)];
  }
  // 已經有 stock 喺尾就唔重複加；冇嘅就補返（向後相容舊 DB row）。
  const lastIsStock = list[list.length - 1]?.kind === "stock";
  if (lastIsStock) return list;
  return [...list, stockPhotoForAreaType(areaType)];
}
