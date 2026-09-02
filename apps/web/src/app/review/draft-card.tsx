"use client";

import { useEffect, useState, type CSSProperties } from "react";
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

export type CardStatus = "pending" | "approving" | "approved" | "rejecting" | "rejected" | "error";

// 暴露畀父層做批量操作：用卡入面最新表單值執行 approve/reject。
export type CardAct = (action: "approve" | "reject") => Promise<boolean>;

export function DraftCard({
  draft,
  selected,
  onToggleSelect,
  onResult,
  registerAct,
}: {
  draft: Draft;
  selected: boolean;
  onToggleSelect: (id: string, checked: boolean) => void;
  onResult: (id: string, action: "approve" | "reject") => void;
  registerAct: (id: string, act: CardAct) => void;
}) {
  const [form, setForm] = useState<DraftForm>(() => toForm(draft));
  const [busy, setBusy] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<CardStatus>("pending");
  const low = lowConfidenceSet(draft);
  const photoIds = draft.intake?.photo_file_ids ?? [];
  const photoCount = photoIds.length;

  const hl = (camel: string): CSSProperties =>
    low.has(camel)
      ? { background: "#fff3cd", borderColor: "#e0a800" }
      : {};

  const set = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const act: CardAct = async (action) => {
    if (busy) return false;
    setBusy(true);
    setError("");
    setStatus(action === "approve" ? "approving" : "rejecting");
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
      setStatus(action === "approve" ? "approved" : "rejected");
      onResult(draft.id, action);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失敗");
      setStatus("error");
      setBusy(false);
      return false;
    }
  };

  useEffect(() => {
    registerAct(draft.id, act);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.id, form]);

  const done = status === "approved" || status === "rejected";
  const disabled = busy || done;

  return (
    <div
      style={{
        border:
          status === "approved"
            ? "1px solid #1a7f37"
            : status === "rejected"
              ? "1px solid #c0392b"
              : selected
                ? "1px solid #0b63ce"
                : "1px solid #ddd",
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        background: "#fff",
        opacity: done ? 0.85 : 1,
      }}
    >
      {status === "approved" && (
        <div
          style={{
            background: "#e6f4ea",
            color: "#1a7f37",
            padding: "8px 12px",
            borderRadius: 6,
            marginBottom: 12,
            fontWeight: 600,
          }}
        >
          ✓ 已批准，已發布去公開頁
        </div>
      )}
      {status === "rejected" && (
        <div
          style={{
            background: "#fdecea",
            color: "#c0392b",
            padding: "8px 12px",
            borderRadius: 6,
            marginBottom: 12,
            fontWeight: 600,
          }}
        >
          已拒絕
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          <input
            type="checkbox"
            checked={selected}
            disabled={disabled}
            onChange={(e) => onToggleSelect(draft.id, e.target.checked)}
          />
          {draft.title || "（無標題）"}
        </label>
        <span style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>
          信心 {draft.confidence_score} · {draft.intake?.source_label ?? ""}
          {photoCount > 0 ? ` · ${photoCount} 相` : ""}
        </span>
      </div>

      {photoCount > 0 && draft.intake_item_id && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 10,
            overflowX: "auto",
            paddingBottom: 4,
          }}
        >
          {photoIds.map((_, i) => (
            <a
              key={i}
              href={`/api/photos/intake/${draft.intake_item_id}/${i}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/photos/intake/${draft.intake_item_id}/${i}`}
                alt={`相 ${i + 1}`}
                loading="lazy"
                style={{
                  width: 96,
                  height: 96,
                  objectFit: "cover",
                  borderRadius: 6,
                  border: "1px solid #e7e5e4",
                  display: "block",
                }}
              />
            </a>
          ))}
        </div>
      )}

      <fieldset
        disabled={disabled}
        style={{ border: "none", padding: 0, margin: 0 }}
      >
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
              style={{ ...inputStyle, ...hl("startDate") }}
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
            <label style={labelStyle}>結束日期</label>
            <input
              style={{ ...inputStyle, ...hl("endDate") }}
              type="date"
              value={form.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
            <label style={labelStyle}>價錢（原文）</label>
            <input
              style={{ ...inputStyle, ...hl("priceText") }}
              value={form.priceText}
              onChange={(e) => set("priceText", e.target.value)}
            />
            <label style={labelStyle}>尺寸（原文）</label>
            <input
              style={{ ...inputStyle, ...hl("boothSizeText") }}
              value={form.boothSizeText}
              onChange={(e) => set("boothSizeText", e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>聯絡（原文）</label>
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
            <label style={labelStyle}>冷氣</label>
            <select
              style={inputStyle}
              value={form.hasAircon}
              onChange={(e) => set("hasAircon", e.target.value)}
            >
              <option value="">未知</option>
              <option value="yes">有</option>
              <option value="no">冇</option>
            </select>
            <label style={labelStyle}>可賣食品</label>
            <select
              style={{ ...inputStyle, ...hl("allowsFood") }}
              value={form.allowsFood}
              onChange={(e) => set("allowsFood", e.target.value)}
            >
              <option value="">未知</option>
              <option value="yes">可以</option>
              <option value="no">唔可以</option>
            </select>
            <div style={{ marginTop: 10, display: "flex", gap: 16, fontSize: 14 }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={form.isUrgent}
                  onChange={(e) => set("isUrgent", e.target.checked)}
                />
                急放
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={form.isDiscounted}
                  onChange={(e) => set("isDiscounted", e.target.checked)}
                />
                特價
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={form.isPrimeSpot}
                  onChange={(e) => set("isPrimeSpot", e.target.checked)}
                />
                旺位
              </label>
            </div>
          </div>
        </div>
      </fieldset>

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
          disabled={disabled}
          onClick={() => void act("approve")}
          style={{
            padding: "8px 18px",
            background: "#1a7f37",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: disabled ? "default" : "pointer",
            fontSize: 14,
          }}
        >
          {status === "approving" ? "批准中…" : "批准"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void act("reject")}
          style={{
            padding: "8px 18px",
            background: "#fff",
            color: "#c0392b",
            border: "1px solid #c0392b",
            borderRadius: 6,
            cursor: disabled ? "default" : "pointer",
            fontSize: 14,
          }}
        >
          {status === "rejecting" ? "拒絕中…" : "拒絕"}
        </button>
        {error && (
          <span style={{ color: "#c0392b", fontSize: 13, alignSelf: "center" }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
