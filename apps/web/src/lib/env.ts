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
