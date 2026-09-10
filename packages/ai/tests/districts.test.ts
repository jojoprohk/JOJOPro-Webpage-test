import { describe, expect, it } from "vitest";
import {
  HK_DISTRICTS,
  inferDistrict,
  isHkDistrict,
  normalizeDistrict,
} from "../src/districts.js";

describe("HK 18 區", () => {
  it("清單啱好 18 區", () => {
    expect(HK_DISTRICTS).toHaveLength(18);
  });

  it("標準區名通過校驗", () => {
    expect(isHkDistrict("屯門區")).toBe(true);
    expect(isHkDistrict("柴灣區")).toBe(false); // 冇呢個區
    expect(isHkDistrict(null)).toBe(false);
  });
});

describe("inferDistrict", () => {
  it("由商場/地標關鍵字定區", () => {
    expect(inferDistrict("良景邨大場")).toBe("屯門區");
    expect(inferDistrict("天水圍嘉湖")).toBe("元朗區");
    expect(inferDistrict("上水名都")).toBe("北區");
    expect(inferDistrict("馬鞍山新港城")).toBe("沙田區");
    expect(inferDistrict("東港城")).toBe("西貢區");
    expect(inferDistrict("愉景新城")).toBe("荃灣區");
    expect(inferDistrict("東涌東薈城")).toBe("離島區");
    expect(inferDistrict("朗豪坊")).toBe("油尖旺區");
    expect(inferDistrict("APM 商場")).toBe("觀塘區");
    expect(inferDistrict("時代廣場")).toBe("灣仔區");
    expect(inferDistrict("數碼港")).toBe("南區");
  });

  it("修正已知錯區／口語名", () => {
    // 柴灣屬東區，九龍灣屬觀塘區。
    expect(inferDistrict("柴灣")).toBe("東區");
    expect(inferDistrict("九龍灣")).toBe("觀塘區");
    // 銅鑼灣屬灣仔區（唔係東區）。
    expect(inferDistrict("銅鑼灣廣場")).toBe("灣仔區");
    // 口語名（唔帶「區」）都對到。
    expect(inferDistrict("旺角某商場")).toBe("油尖旺區");
  });

  it("由多段文字合併推理（場名冇，標題有）", () => {
    expect(inferDistrict("3粒位", "屯門時代廣場")).toBe("屯門區");
  });

  it("推理唔到就回 null", () => {
    expect(inferDistrict("某商場", "冇地區資料")).toBeNull();
    expect(inferDistrict("", null, undefined)).toBeNull();
  });
});

describe("normalizeDistrict", () => {
  it("已經係標準名直接回傳", () => {
    expect(normalizeDistrict("沙田區")).toBe("沙田區");
  });

  it("口語名／地標名轉標準名", () => {
    expect(normalizeDistrict("葵涌")).toBe("葵青區");
    expect(normalizeDistrict("深水埗")).toBe("深水埗區");
  });

  it("空值或對唔到回 null", () => {
    expect(normalizeDistrict("")).toBeNull();
    expect(normalizeDistrict(null)).toBeNull();
    expect(normalizeDistrict("火星區")).toBeNull();
  });
});
