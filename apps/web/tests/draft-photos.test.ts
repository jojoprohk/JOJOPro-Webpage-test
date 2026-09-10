import { describe, expect, it } from "vitest";
import { buildEntryPhotos, coerceVenuePhotos } from "../src/lib/draft-photos.js";

describe("buildEntryPhotos 排位", () => {
  it("real 相排最前, stock 相排最後", () => {
    const photos = buildEntryPhotos(
      "pop_up_event",
      ["file1", "file2", "file3"],
      [0, 2],
    );
    expect(photos).toHaveLength(3); // 2 real + 1 stock
    expect(photos[0]).toEqual({ kind: "telegram", fileId: "file1" });
    expect(photos[1]).toEqual({ kind: "telegram", fileId: "file3" });
    expect(photos[2]?.kind).toBe("stock");
  });

  it("real 相按 realVenuePhotoIndexes 嘅順序排", () => {
    const photos = buildEntryPhotos(
      "mall",
      ["a", "b", "c"],
      [2, 0],
    );
    expect(photos[0]).toEqual({ kind: "telegram", fileId: "c" });
    expect(photos[1]).toEqual({ kind: "telegram", fileId: "a" });
    expect(photos[2]?.kind).toBe("stock");
  });

  it("冇 real 相 → 淨係一張 stock", () => {
    const photos = buildEntryPhotos("street", ["x"], undefined);
    expect(photos).toHaveLength(1);
    expect(photos[0]?.kind).toBe("stock");
  });

  it("realVenuePhotoIndexes 空 array → 淨係一張 stock", () => {
    const photos = buildEntryPhotos("market", ["x"], []);
    expect(photos).toHaveLength(1);
    expect(photos[0]?.kind).toBe("stock");
  });

  it("out-of-range index 會被 filter 走", () => {
    const photos = buildEntryPhotos(
      "mall",
      ["a"],
      [0, 5, 10], // 5, 10 越界
    );
    expect(photos).toHaveLength(2); // 1 real + 1 stock
    expect(photos[0]).toEqual({ kind: "telegram", fileId: "a" });
    expect(photos[1]?.kind).toBe("stock");
  });

  it("manual 相會原樣保留", () => {
    const manualKey = "11111111-1111-1111-1111-111111111111";
    expect(
      coerceVenuePhotos([
        { kind: "telegram", fileId: "f1" },
        { kind: "manual", storageKey: manualKey },
      ]),
    ).toEqual([
      { kind: "telegram", fileId: "f1" },
      { kind: "manual", storageKey: manualKey },
    ]);
  });

  it("manual 嘅 storageKey 唔係 uuid → null", () => {
    expect(
      coerceVenuePhotos([{ kind: "manual", storageKey: "not-a-uuid" }]),
    ).toBeNull();
  });

  it("manual 缺少 storageKey → null", () => {
    expect(
      coerceVenuePhotos([{ kind: "manual" }]),
    ).toBeNull();
  });
});
