"use client";

import { useState, type CSSProperties } from "react";
import {
  AREA_LABELS,
  AREA_TYPES,
  formToFields,
  lowConfidenceSet,
  toForm,
  type Draft,
  type DraftForm,
} from "./review-lib";

const labelStyle: CSSProperties = {
  fontSize: 12,
  color: "#555",
  display: "block",
  marginTop: 8,
};
const inputStyle: CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #ccc",
  borderRadius: 6,
  fontSize: 14,
  boxSizing: "border-box",
};

export function DraftCard({
  draft,
  onDone,
}: {
  draft: Draft;
  onDone: (id: string) => void;
}) {
  const [form, setForm] = useState<DraftForm>(() => toForm(draft));
  const [busy, setBusy] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [error, setError] = useState("");
  const low = lowConfidenceSet(draft);
  const photoCount = draft.intake?.photo_file_ids?.length ?? 0;

  const hl = (camel: string): CSSProperties =>
    low.has(camel)
      ? { background: "#fff3cd", borderColor: "#e0a800" }
      : {};

  const set = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/review/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, fields: formToFields(form) }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onDone(draft.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失敗");
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <strong style={{ fontSize: 16 }}>
          {draft.title || "（無標題）"}
        </strong>
        <span style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>
          信心 {draft.confidence_score} · {draft.intake?.source_label ?? ""}
          {photoCount > 0 ? ` · ${photoCount} 相` : ""}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>標題</label>
          <input
            style={{ ...inputStyle, ...hl("title") }}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
          <label style={labelStyle}>地區</label>
          <input
            style={{ ...inputStyle, ...hl("district") }}
            value={form.district}
            onChange={(e) => set("district", e.target.value)}
          />
          <label style={labelStyle}>場地名</label>
          <input
            style={{ ...inputStyle, ...hl("venueName") }}
            value={form.venueName}
            onChange={(e) => set("venueName", e.target.value)}
          />
          <label style={labelStyle}>開始日期</label>
          <input
            type="date"
            style={{ ...inputStyle, ...hl("startDate") }}
            value={form.startDate}
            onChange={(e) => set("startDate", e.target.value)}
          />
          <label style={labelStyle}>結束日期</label>
          <input
            type="date"
            style={{ ...inputStyle, ...hl("endDate") }}
            value={form.endDate}
            onChange={(e) => set("endDate", e.target.value)}
          />
          {draft.session_dates && draft.session_dates.length > 0 && (
            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
              斷續檔期 {draft.session_dates.length} 日：
              {draft.session_dates.slice(0, 8).join(", ")}
              {draft.session_dates.length > 8 ? " …" : ""}
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>價錢（原文）</label>
          <input
            style={{ ...inputStyle, ...hl("priceText") }}
            value={form.priceText}
            onChange={(e) => set("priceText", e.target.value)}
          />
          <label style={labelStyle}>檔位尺寸</label>
          <input
            style={{ ...inputStyle, ...hl("boothSizeText") }}
            value={form.boothSizeText}
            onChange={(e) => set("boothSizeText", e.target.value)}
          />
          <label style={labelStyle}>聯絡</label>
          <input
            style={{ ...inputStyle, ...hl("contactText") }}
            value={form.contactText}
            onChange={(e) => set("contactText", e.target.value)}
          />
          <label style={labelStyle}>場地類型</label>
          <select
            style={inputStyle}
            value={form.areaType}
            onChange={(e) => set("areaType", e.target.value)}
          >
            {AREA_TYPES.map((t) => (
              <option key={t} value={t}>
                {AREA_LABELS[t]}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <label style={{ fontSize: 13 }}>
              冷氣{" "}
              <select
                value={form.hasAircon}
                onChange={(e) => set("hasAircon", e.target.value)}
              >
                <option value="">未知</option>
                <option value="yes">有</option>
                <option value="no">無</option>
              </select>
            </label>
            <label style={{ fontSize: 13 }}>
              可賣食品{" "}
              <select
                value={form.allowsFood}
                onChange={(e) => set("allowsFood", e.target.value)}
              >
                <option value="">未知</option>
                <option value="yes">可以</option>
                <option value="no">唔可以</option>
              </select>
            </label>
          </div>
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 8,
              fontSize: 13,
            }}
          >
            <label>
              <input
                type="checkbox"
                checked={form.isUrgent}
                onChange={(e) => set("isUrgent", e.target.checked)}
              />{" "}
              急放
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.isDiscounted}
                onChange={(e) => set("isDiscounted", e.target.checked)}
              />{" "}
              特價
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.isPrimeSpot}
                onChange={(e) => set("isPrimeSpot", e.target.checked)}
              />{" "}
              旺位
            </label>
          </div>
        </div>
      </div>

      {draft.review_note && (
        <div style={{ fontSize: 13, color: "#8a6d00", marginTop: 8 }}>
          AI 備註：{draft.review_note}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowRaw((s) => !s)}
        style={{
          marginTop: 10,
          fontSize: 12,
          border: "none",
          background: "none",
          color: "#0b63ce",
          cursor: "pointer",
        }}
      >
        {showRaw ? "收起" : "睇原始貼文"}
      </button>
      {showRaw && draft.intake && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#f6f6f6",
            padding: 10,
            borderRadius: 6,
            fontSize: 12,
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          {draft.intake.raw_content}
        </pre>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => act("approve")}
          style={{
            padding: "8px 18px",
            background: "#1a7f37",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: busy ? "default" : "pointer",
            fontSize: 14,
          }}
        >
          批准
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => act("reject")}
          style={{
            padding: "8px 18px",
            background: "#fff",
            color: "#c0392b",
            border: "1px solid #c0392b",
            borderRadius: 6,
            cursor: busy ? "default" : "pointer",
            fontSize: 14,
          }}
        >
          拒絕
        </button>
        {error && (
          <span
            style={{
              color: "#c0392b",
              fontSize: 13,
              alignSelf: "center",
            }}
          >
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
