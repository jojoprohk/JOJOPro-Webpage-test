import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local manually (this script runs outside Next.js)
const envPath = path.join(__dirname, "../.env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const { createLlmVenueCompleter } = await import("../src/lib/llm-venue-completer.ts");
const { createVenueRepository, createSupabaseServiceClient } = await import(
  "../src/lib/venue-repository.ts"
);
const { processTelegramIntake } = await import(
  "../src/lib/telegram-intake-service.ts"
);

const update = {
  update_id: 1001,
  message: {
    message_id: 55,
    date: 1756281600,
    chat: { id: 7219187491, type: "private", first_name: "Mercy" },
    from: { id: 7219187491, is_bot: false, first_name: "Mercy" },
    text: "代客急放\n8月25日\n葵涌廣場 大場\n3號位 特價 $900/日\n4粒，近街市，要報貨\n有意 WhatsApp 91234567",
  },
};

try {
  const repository = createVenueRepository(createSupabaseServiceClient());
  const completeJson = createLlmVenueCompleter();
  const result = await processTelegramIntake({
    update,
    completeJson,
    repository,
    allowedChatIds: [7219187491],
  });
  console.log("SUCCESS:", JSON.stringify(result, null, 2));
} catch (err) {
  console.error("FAILED:", err?.message);
  console.error(err?.stack);
  if (err?.error) console.error("DETAIL:", JSON.stringify(err.error, null, 2));
  process.exit(1);
}
