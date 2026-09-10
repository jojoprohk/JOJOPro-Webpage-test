import { describe, expect, it, vi } from "vitest";
import { classifyUploadError, MAX_UPLOAD_BYTES, validateUpload } from "../src/lib/review-uploads.js";

describe("validateUpload 接受嘅檔案", () => {
  const okFile = (overrides: Partial<File> = {}) =>
    ({
      name: "pop-up-store.jpg",
      type: "image/jpeg",
      size: 1024,
      ...overrides,
    }) as File;

  it("jpg/200k → ok", () => {
    const r = validateUpload(okFile({ type: "image/jpeg", size: 200_000 }));
    expect(r.ok).toBe(true);
  });
  it("png → ok", () => {
    const r = validateUpload(okFile({ type: "image/png" }));
    expect(r.ok).toBe(true);
  });
  it("webp → ok", () => {
    const r = validateUpload(okFile({ type: "image/webp" }));
    expect(r.ok).toBe(true);
  });
});

describe("validateUpload 拒絕", () => {
  const file = (overrides: Partial<File>) =>
    ({
      name: "x",
      size: 1024,
      type: "image/jpeg",
      ...overrides,
    }) as File;

  it("size = 0 → too_small", () => {
    const r = validateUpload(file({ size: 0 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_small");
  });
  it("size > MAX → too_large", () => {
    const r = validateUpload(file({ size: MAX_UPLOAD_BYTES + 1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_large");
  });
  it("type = application/pdf → bad_mime", () => {
    const r = validateUpload(file({ type: "application/pdf" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_mime");
  });
  it("type = empty → bad_mime", () => {
    const r = validateUpload(file({ type: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_mime");
  });
  it("name 含 ../ → bad_name", () => {
    const r = validateUpload(file({ name: "../etc.jpg" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_name");
  });
});

describe("classifyUploadError", () => {
  it("Supabase Storage 錯誤會對應 http_status 502", () => {
    const r = classifyUploadError(new Error("bucket not found"));
    expect(r.status).toBe(502);
  });
  it("其他錯誤 → 500", () => {
    const r = classifyUploadError("whatever");
    expect(r.status).toBe(500);
  });
});
