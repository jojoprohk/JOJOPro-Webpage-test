import type { TelegramPhoto } from "./telegram-intake-service.js";

interface TelegramFileInfo {
  file_path?: string;
}

// Downloads Telegram photos via the Bot API and returns them as base64 for
// vision OCR. Never logs tokens or full image data.
export function createTelegramPhotoFetcher(botToken: string | undefined) {
  return async (fileIds: string[]): Promise<TelegramPhoto[]> => {
    if (!botToken) {
      throw new Error("Missing TELEGRAM_BOT_TOKEN for photo download.");
    }

    const photos: TelegramPhoto[] = [];

    for (const fileId of fileIds) {
      const infoRes = await fetch(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
      );
      const info = (await infoRes.json()) as {
        ok: boolean;
        result?: TelegramFileInfo;
      };

      const filePath = info.result?.file_path;
      if (!info.ok || !filePath) {
        throw new Error("Telegram getFile failed.");
      }

      const fileRes = await fetch(
        `https://api.telegram.org/file/bot${botToken}/${filePath}`,
      );
      const arrayBuffer = await fileRes.arrayBuffer();

      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mimeType =
        filePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

      photos.push({ base64, mimeType });
    }

    return photos;
  };
}
