"use client";

import { useState } from "react";
import { AlertTriangle, MapPin, Trash2 } from "lucide-react";
import { AREA_LABELS, draftPhotos, type Draft } from "./review-lib";

export function RejectedCard({
  draft,
  onDeleted,
}: {
  draft: Draft;
  onDeleted: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const removePermanently = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/cleanup-drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ids: [draft.id],
          confirm: "YES_DELETE",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onDeleted(draft.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "刪除失敗");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="approved-card rejected-card">
      <div className="approved-head">
        <strong className="approved-title">{draft.title || "（無標題）"}</strong>
        <span className="rejected-badge">已下架</span>
      </div>
      <div className="approved-meta">
        <MapPin />
        <span>
          {[draft.district, draft.venue_name].filter(Boolean).join(" · ") || "地點待確認"}
          <span className="area-type">{AREA_LABELS[draft.area_type] ?? "未分類"}</span>
        </span>
      </div>
      <div className="approved-sub">
        {draft.price_text ? `${draft.price_text} · ` : ""}
        {draftPhotos(draft).length} 相
        {draft.last_reviewed_at
          ? ` · 下架於 ${new Date(draft.last_reviewed_at).toLocaleString("zh-HK")}`
          : ""}
      </div>

      {confirming ? (
        <div className="rejected-confirm">
          <AlertTriangle />
          <div>
            <strong>永久刪除？</strong>
            <p>刪除後無法復原；相關 intake 資料同 storage 相唔會自動清理。</p>
          </div>
          <div className="rejected-actions">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn--danger btn--sm"
              onClick={() => void removePermanently()}
              disabled={busy}
            >
              <Trash2 />
              {busy ? "刪除中…" : "確認永久刪除"}
            </button>
          </div>
        </div>
      ) : (
        <div className="rejected-actions">
          <button
            type="button"
            className="btn btn--danger btn--sm"
            onClick={() => setConfirming(true)}
          >
            <Trash2 />
            永久刪除
          </button>
        </div>
      )}
      {error ? <div className="approved-error">{error}</div> : null}
    </div>
  );
}
