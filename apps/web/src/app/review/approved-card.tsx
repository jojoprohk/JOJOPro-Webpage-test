"use client";

import { BadgeCheck, MapPin } from "lucide-react";
import { AREA_LABELS, draftPhotos } from "./review-lib";
import type { Draft } from "./review-lib";

// 已批准（已上線）草稿嘅唯讀摘要卡，用喺「已批准」分頁。
export function ApprovedCard({ draft }: { draft: Draft }) {
  const photoCount = draftPhotos(draft).length;
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
    <div className="approved-card">
      <div className="approved-head">
        <strong className="approved-title">{draft.title || "（無標題）"}</strong>
        <span className="approved-live">
          <BadgeCheck />
          已上線
        </span>
      </div>
      <div className="approved-meta">
        <MapPin />
        <span>
          {[draft.district, draft.venue_name].filter(Boolean).join(" · ") || "地點待確認"}
          <span className="area-type">{AREA_LABELS[draft.area_type] ?? "未分類"}</span>
        </span>
      </div>
      <div className="approved-sub">
        {dateLabel}
        {draft.price_text ? ` · ${draft.price_text}` : ""}
        {` · ${photoCount} 相`}
      </div>
      <div className="approved-sub">
        來源：{draft.intake?.source_label ?? ""}
        {draft.last_reviewed_at
          ? ` · 批准於 ${new Date(draft.last_reviewed_at).toLocaleString("zh-HK")}`
          : ""}
      </div>
    </div>
  );
}
