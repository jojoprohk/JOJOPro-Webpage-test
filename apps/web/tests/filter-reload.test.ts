import { describe, expect, it } from "vitest";
import { shouldResetFiltersOnReload } from "../src/lib/filter-reload.js";

describe("shouldResetFiltersOnReload", () => {
  it("resets when reloading a filtered URL", () => {
    expect(shouldResetFiltersOnReload("?district=%E4%B8%AD%E8%A5%BF%E5%8D%80", "reload")).toBe(true);
  });

  it("does not reset on normal navigation to a filtered URL", () => {
    expect(shouldResetFiltersOnReload("?district=%E4%B8%AD%E8%BF%94%E5%8D%80", "navigate")).toBe(false);
  });

  it("does not reset on back/forward navigation", () => {
    expect(shouldResetFiltersOnReload("?areaType=mall", "back_forward")).toBe(false);
  });

  it("does not reload-loop on the default homepage", () => {
    expect(shouldResetFiltersOnReload("", "reload")).toBe(false);
  });

  it("does not reset without navigation timing data", () => {
    expect(shouldResetFiltersOnReload("?areaType=mall", undefined)).toBe(false);
  });
});
