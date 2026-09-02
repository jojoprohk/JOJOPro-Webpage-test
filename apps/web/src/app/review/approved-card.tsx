"use client";

import { AREA_LABELS } from "./review-lib";
import type { Draft } from "./review-lib";

// 已批准（已上線）草稿嘅唯讀摘要卡，用喺「已批准」分頁。
export function ApprovedCard({ draft }: { draft: Draft }) {
  const photoIds = draft.intake?.photo_file_ids ?? [];
  const sessions = draft.session_dates ?? [];
  const dateLabel =
    sessions.length === 1
      ? sessions[0]
      : sessions.length > 1
        ? `${sessions[0]} 至 ${sessions[sessions.length - 1]}（共 ${sessions.length} 日）`
        : draft.start_date && draft.end_date && draft.start_date !== draft.end_date
          ? `${draft.start_date} 至 ${draft.end_date}`
          : draft.start_date ?? "日期待確認";
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 14,
        marginBottom: 12,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "baseline",
        }}
      >
        <strong style={{ fontSize: 15 }}>{draft.title || "（無標題）"}</strong>
        <span style={{ fontSize: 12, color: "#1a7f37", whiteSpace: "nowrap" }}>
          ✓ 已上線
        </span>
      </div>
      <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>
        📍 {[draft.district, draft.venue_name].filter(Boolean).join(" · ") || "地點待確認"}
        <span style={{ color: "#999", marginLeft: 6 }}>
          {AREA_LABELS[draft.area_type] ?? "未分類"}
        </span>
      </div>
      <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
        🗓 {dateLabel}
        {draft.price_text ? ` · ${draft.price_text}` : ""}
        {photoIds.length > 0 ? ` · ${photoIds.length} 相` : ""}
      </div>
      <div style={{ fontSize: 12, color: "#999", marginTop: 6 }}>
        來源：{draft.intake?.source_label ?? ""}
        {draft.last_reviewed_at
          ? ` · 批准於 ${new Date(draft.last_reviewed_at).toLocaleString("zh-HK")}`
          : ""}
      </div>
    </div>
  );
}
