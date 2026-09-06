// 簡單 health endpoint，供 dev-tunnel 嘅守護去 ping。
// 只返 200 + JSON，唔撈 Supabase / Telegram 等外部服務（避免監控同真服務依賴耦合）。
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, ts: new Date().toISOString() });
}
