import { timingSafeEqual } from "node:crypto";

export function assertTelegramWebhookSecret(secret: string | null) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!secret || !expected) {
    return false;
  }

  const secretBuffer = Buffer.from(secret);
  const expectedBuffer = Buffer.from(expected);

  if (secretBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(secretBuffer, expectedBuffer);
}

// Returns null when TELEGRAM_ALLOWED_CHAT_IDS is unset. Callers MUST treat
// null as "server misconfigured" and fail closed — previously this function
// returned [] which the intake route read as "allow everyone" (fail-open).
export function getTelegramAllowedChatIds(): number[] | null {
  const raw = process.env.TELEGRAM_ALLOWED_CHAT_IDS;
  if (!raw) return null;

  return raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value));
}
