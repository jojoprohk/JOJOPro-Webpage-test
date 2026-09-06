import {
  stockPhotoForAreaType,
  type AreaType,
  type VenuePhoto,
} from "@jojopro/ai";

// 由解析結果組出每個草稿嘅展示相：
// 1. AI 標記為「真實場地/IG 相」嘅附圖（用 index 對返 photoFileIds）排最前。
// 2. 然後永遠加一張 stock 相做 category indicator（例如 Pop-up Store 顯示 pop-up 圖）。
//    Stock 相會喺卡上自動標「僅供參考」。
// 純文字截圖唔入列表；冇真實相就淨係 stock 相。
export function buildEntryPhotos(
  areaType: AreaType,
  photoFileIds: string[],
  realVenuePhotoIndexes: number[] | undefined,
): VenuePhoto[] {
  const telegramPhotos: VenuePhoto[] = (realVenuePhotoIndexes ?? [])
    .map((i) => photoFileIds[i])
    .filter((fileId): fileId is string => !!fileId)
    .map((fileId) => ({ kind: "telegram" as const, fileId }));

  // Stock 相永遠排最後做 category indicator。
  const stock = stockPhotoForAreaType(areaType);
  if (telegramPhotos.length > 0) {
    return [...telegramPhotos, stock];
  }
  return [stock];
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
