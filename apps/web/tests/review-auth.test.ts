import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createSessionToken,
  isCorrectPassword,
  isSessionValid,
} from "../src/lib/review-auth.js";

const SECRET = "test-review-secret-value";

describe("review-auth", () => {
  beforeEach(() => {
    process.env.REVIEW_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.REVIEW_SECRET;
  });

  it("accepts the correct password and rejects others", () => {
    expect(isCorrectPassword(SECRET)).toBe(true);
    expect(isCorrectPassword("wrong")).toBe(false);
    expect(isCorrectPassword("")).toBe(false);
  });

  it("returns false for everything when REVIEW_SECRET is unset", () => {
    delete process.env.REVIEW_SECRET;
    expect(isCorrectPassword("anything")).toBe(false);
    expect(isSessionValid("whatever")).toBe(false);
  });

  it("creates a token that validates before expiry", () => {
    const now = 1_000_000;
    const token = createSessionToken(now);
    expect(isSessionValid(token, now)).toBe(true);
    // 11 小時後（TTL 12 小時）仍有效。
    expect(isSessionValid(token, now + 11 * 3600 * 1000)).toBe(true);
  });

  it("rejects an expired token", () => {
    const now = 1_000_000;
    const token = createSessionToken(now);
    expect(isSessionValid(token, now + 13 * 3600 * 1000)).toBe(false);
  });

  it("rejects tampered and malformed tokens", () => {
    const token = createSessionToken(1_000_000);
    expect(isSessionValid(token + "x", 1_000_000)).toBe(false);
    expect(isSessionValid("nodot", 1_000_000)).toBe(false);
    expect(isSessionValid("", 1_000_000)).toBe(false);
    expect(isSessionValid(undefined, 1_000_000)).toBe(false);
  });
});
