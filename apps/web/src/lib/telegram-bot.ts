// 共用 Telegram bot 回覆工具：Next.js 路由同獨立 webhook server 都用呢個。
// 故意 fire-and-forget（唔 await 個 fetch），等 webhook 立即返 200，
// 同時 background 發訊息俾用戶。
// 失敗只記 log，唔影響主流程。
export async function sendTelegramReply(
  chatId: number,
  text: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[telegram-bot] TELEGRAM_BOT_TOKEN 未設定，略過回覆");
    return;
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[telegram-bot] sendMessage 失敗 (${res.status}):`,
        body.slice(0, 200),
      );
    }
  } catch (error) {
    console.error("[telegram-bot] sendMessage 錯誤:", error);
  }
}
