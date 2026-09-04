import { createHmac, timingSafeEqual } from "node:crypto";

export const REVIEW_COOKIE_NAME = "jojopro_review_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 小時

function getSecret(): string {
  const secret = process.env.REVIEW_SECRET;
  if (!secret) {
    throw new Error("Missing REVIEW_SECRET.");
  }
  return secret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

// 常數時間比對密碼，避免計時洩漏。
export function isCorrectPassword(password: string): boolean {
  const secret = process.env.REVIEW_SECRET;
  if (!secret || !password) return false;

  const a = Buffer.from(password);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function createSessionToken(now: number = Date.now()): string {
  const secret = getSecret();
  const payload = JSON.stringify({ exp: now + SESSION_TTL_MS });
  const payloadB64 = base64url(payload);
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

export function isSessionValid(
  token: string | undefined | null,
  now: number = Date.now(),
): boolean {
  if (!token) return false;
  const secret = process.env.REVIEW_SECRET;
  if (!secret) return false;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payloadB64 = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expected = sign(payloadB64, secret);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp > now;
  } catch {
    return false;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
};
