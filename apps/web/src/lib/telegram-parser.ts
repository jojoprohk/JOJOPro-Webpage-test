import type { IntakeInput } from "@jopojo/ai";

type TelegramChatType = "private" | "group" | "supergroup" | "channel";

interface TelegramChat {
  id: number;
  type: TelegramChatType;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
}

interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
}

interface TelegramForwardOrigin {
  type: "user" | "channel" | "hidden_user" | "message_imported";
  date?: number;
  message_id?: number;
  sender_user?: TelegramUser;
  sender_user_name?: string;
  chat?: TelegramChat;
}

export interface TelegramMessage {
  message_id: number;
  date: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  forward_origin?: TelegramForwardOrigin;
  forward_sender_name?: string;
  forward_from?: TelegramUser;
  forward_from_chat?: TelegramChat;
  forward_from_message_id?: number;
  entities?: TelegramMessageEntity[];
  caption_entities?: TelegramMessageEntity[];
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

export type TelegramParsedUpdate =
  | {
      status: "received";
      input: IntakeInput;
      messageId: number;
      chatId: number;
    }
  | {
      status: "ignored";
      reason: string;
    };

function getDisplayName(user?: TelegramUser | null) {
  if (!user) return null;

  return [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function getSourceLabel(message: TelegramMessage) {
  const forwardChat =
    message.forward_origin?.chat ?? message.forward_from_chat ?? null;

  if (forwardChat?.title) return forwardChat.title;
  if (forwardChat?.username) return `@${forwardChat.username}`;

  const forwardUser =
    message.forward_origin?.sender_user ?? message.forward_from ?? null;
  const forwardUserName = getDisplayName(forwardUser);
  if (forwardUserName) return forwardUserName;

  if (message.forward_origin?.sender_user_name) {
    return message.forward_origin.sender_user_name;
  }

  if (message.forward_sender_name) return message.forward_sender_name;

  const senderName = getDisplayName(message.from);
  if (senderName) return senderName;
  if (message.from?.username) return `@${message.from.username}`;

  return message.chat.title || message.chat.username || "Telegram";
}

function extractEntityUrl(
  content: string,
  entities: TelegramMessageEntity[] = [],
) {
  const textLink = entities.find(
    (entity) => entity.type === "text_link" && entity.url,
  );
  if (textLink?.url) return textLink.url;

  const plainUrl = entities.find((entity) => entity.type === "url");
  if (plainUrl) {
    return content.slice(plainUrl.offset, plainUrl.offset + plainUrl.length);
  }

  return null;
}

function extractForwardUrl(message: TelegramMessage) {
  const chat = message.forward_origin?.chat ?? message.forward_from_chat;
  const messageId =
    message.forward_origin?.message_id ?? message.forward_from_message_id;

  if (chat?.username && messageId) {
    return `https://t.me/${chat.username}/${messageId}`;
  }

  return null;
}

function extractSourceUrl(message: TelegramMessage, content: string) {
  const entityUrl = extractEntityUrl(
    content,
    message.caption_entities ?? message.entities,
  );
  if (entityUrl) return entityUrl;

  const plainUrlMatch = content.match(/https?:\/\/[^\s]+/);
  if (plainUrlMatch) return plainUrlMatch[0].replace(/[),.]+$/, "");

  return extractForwardUrl(message);
}

export function parseTelegramVenueUpdate(
  update: TelegramUpdate,
): TelegramParsedUpdate {
  const message = update.message;

  if (!message) {
    return { status: "ignored", reason: "冇 Telegram message。" };
  }

  const textContent = (message.text ?? message.caption ?? "").trim();
  const photos = message.photo ?? [];
  const hasPhoto = photos.length > 0;

  // Pick the largest available photo size (Telegram sends ascending sizes).
  const largestPhoto = hasPhoto ? photos[photos.length - 1] : undefined;
  const photoFileIds = largestPhoto ? [largestPhoto.file_id] : [];

  // A photo with no caption is still processable via vision OCR.
  // A message with neither text nor photo has nothing to parse.
  if (!textContent && !hasPhoto) {
    return { status: "ignored", reason: "訊息冇文字、caption 或圖片。" };
  }

  const rawContent = textContent || "[圖片]";

  return {
    status: "received",
    messageId: message.message_id,
    chatId: message.chat.id,
    input: {
      rawContent,
      sourceType: "telegram",
      sourceLabel: getSourceLabel(message),
      sourceUrl: extractSourceUrl(message, rawContent) ?? undefined,
      receivedAt: new Date(message.date * 1000).toISOString(),
      photoFileIds,
    },
  };
}
