import type { TelegramPhoto } from "./telegram-intake-service.js";

interface TelegramFileInfo {
  file_path?: string;
}

export interface DownloadedPhoto {
  buffer: Buffer;
  mimeType: string;
}

// 下載單一 Telegram 相，回傳 buffer＋MIME type。
// 供 vision OCR 同圖片代理 route 共用；永不記錄 token 或圖片內容。
export async function downloadTelegramPhoto(
  botToken: string,
  fileId: string,
): Promise<DownloadedPhoto> {
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
  if (!fileRes.ok) {
    throw new Error("Telegram file download failed.");
  }
  const arrayBuffer = await fileRes.arrayBuffer();

  const mimeType = filePath.toLowerCase().endsWith(".png")
    ? "image/png"
    : "image/jpeg";

  return { buffer: Buffer.from(arrayBuffer), mimeType };
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
      const { buffer, mimeType } = await downloadTelegramPhoto(botToken, fileId);
      photos.push({ base64: buffer.toString("base64"), mimeType });
    }

    return photos;
  };
}
