import {
  stockPhotoForAreaType,
  type AreaType,
  type VenuePhoto,
} from "@jojopro/ai";

// 由解析結果組出每個草稿嘅展示相：
// AI 標記為「真實場地/IG 相」嘅附圖（用 index 對返 photoFileIds）排最前，
// 其餘位置由場地類型 stock 相補上。純文字截圖唔入列表。
export function buildEntryPhotos(
  areaType: AreaType,
  photoFileIds: string[],
  realVenuePhotoIndexes: number[] | undefined,
): VenuePhoto[] {
  const telegramPhotos: VenuePhoto[] = (realVenuePhotoIndexes ?? [])
    .map((i) => photoFileIds[i])
    .filter((fileId): fileId is string => !!fileId)
    .map((fileId) => ({ kind: "telegram" as const, fileId }));

  if (telegramPhotos.length > 0) {
    return telegramPhotos;
  }
  return [stockPhotoForAreaType(areaType)];
}

// 驗證由審核 API 傳入嘅 photos 欄位，只接受結構正確嘅 VenuePhoto[]。
export function coerceVenuePhotos(value: unknown): VenuePhoto[] | null {
  if (!Array.isArray(value)) return null;
  const out: VenuePhoto[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const kind = (item as { kind?: unknown }).kind;
    if (kind === "telegram") {
      const fileId = (item as { fileId?: unknown }).fileId;
      if (typeof fileId !== "string" || fileId.length === 0 || fileId.length > 200) {
        return null;
      }
      out.push({ kind: "telegram", fileId });
    } else if (kind === "stock") {
      const src = (item as { src?: unknown }).src;
      if (typeof src !== "string" || !/^\/stock\/[a-z0-9-]+\.(jpg|jpeg|png|webp|svg)$/.test(src)) {
        return null;
      }
      out.push({ kind: "stock", src });
    } else {
      return null;
    }
  }
  return out;
}
