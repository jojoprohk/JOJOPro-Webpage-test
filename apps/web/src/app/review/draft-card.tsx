"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Save,
  Trash2,
  ArrowLeft,
  ArrowRight,
  ImageOff,
} from "lucide-react";
import {
  AREA_LABELS,
  AREA_TYPES,
  HK_DISTRICTS,
  formToFields,
  lowConfidenceSet,
  toForm,
  type Draft,
  type DraftForm,
} from "./review-lib";
import type { VenuePhoto } from "@jojopro/ai";

export type CardStatus =
  | "pending"
  | "saving"
  | "approving"
  | "approved"
  | "rejecting"
  | "rejected"
  | "error";

// 暴露畀父層做批量操作：用卡入面最新表單值執行 action。
export type CardAct = (
  action: "approve" | "reject" | "save",
) => Promise<boolean>;

type IntakePhoto = { fileId: string; index: number };

const STOCK_FILE: Record<string, string> = {
  mall: "mall",
  market: "market",
  street: "street",
  industrial: "industrial",
  pop_up_event: "pop-up",
  private_venue: "private-venue",
  exhibition: "exhibition",
  other: "hong-kong-shop",
  unknown: "hong-kong-shop",
};

function stockSrcForAreaType(t: string): string {
  return `/stock/${STOCK_FILE[t] ?? "hong-kong-shop"}.jpg`;
}

function photoUrl(draftId: string, photo: VenuePhoto, index: number): string {
  if (photo.kind === "stock") return photo.src;
  return `/api/photos/draft/${draftId}/${index}`;
}

function PhotoEditor({
  draftId,
  photos,
  intakePhotos,
  onChange,
}: {
  draftId: string;
  photos: VenuePhoto[];
  intakePhotos: IntakePhoto[];
  onChange: (next: VenuePhoto[]) => void;
}) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= photos.length) return;
    const next = [...photos];
    const a = next[i];
    const b = next[j];
    if (a && b) {
      next[i] = b;
      next[j] = a;
    }
    onChange(next);
  };
  const remove = (i: number) =>
    onChange(photos.filter((_, idx) => idx !== i));
  const addTelegram = (fileId: string) => {
    if (photos.some((p) => p.kind === "telegram" && p.fileId === fileId)) return;
    onChange([...photos, { kind: "telegram", fileId }]);
  };
  const addStock = (src: string) => {
    onChange([...photos, { kind: "stock", src }]);
  };

  const usedFileIds = new Set(
    photos
      .filter(
        (p): p is Extract<VenuePhoto, { kind: "telegram" }> =>
          p.kind === "telegram",
      )
      .map((p) => p.fileId),
  );
  const availableIntake = intakePhotos.filter((p) => !usedFileIds.has(p.fileId));

  return (
    <div className="photo-editor">
      <div className="photo-editor__grid">
        {photos.length === 0 && (
          <div className="photo-editor__empty">
            <ImageOff size={16} /> 未選取展示相（公開頁會自動用代表相）
          </div>
        )}
        {photos.map((photo, i) => (
          <div className="photo-editor__item" key={`${photo.kind}-${i}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl(draftId, photo, i)}
              alt={`展示相 ${i + 1}`}
              loading="lazy"
            />
            <span className="photo-editor__tag">
              {photo.kind === "telegram" ? "真實相" : "代表相"}
            </span>
            <div className="photo-editor__ctrls">
              <button
                type="button"
                title="向左"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowLeft size={13} />
              </button>
              <button
                type="button"
                title="向右"
                disabled={i === photos.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowRight size={13} />
              </button>
              <button
                type="button"
                title="刪除"
                className="danger"
                onClick={() => remove(i)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="photo-editor__add">
        {availableIntake.length > 0 && (
          <label className="rv-label">
            加入 Telegram 原始相
            <select
              className="rv-field"
              value=""
              onChange={(e) => {
                const idx = Number(e.target.value);
                const p = intakePhotos[idx];
                if (p) addTelegram(p.fileId);
              }}
            >
              <option value="">— 揀一張原始相加入 —</option>
              {availableIntake.map((p) => (
                <option key={p.fileId} value={p.index}>
                  原始相 #{p.index + 1}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="rv-label">
          加入代表相（按場地類型）
          <select
            className="rv-field"
            value=""
            onChange={(e) => {
              const t = e.target.value;
              if (t) addStock(stockSrcForAreaType(t));
            }}
          >
            <option value="">— 揀代表相類型 —</option>
            {AREA_TYPES.map((t) => (
              <option key={t} value={t}>
                {AREA_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

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
  onResult: (id: string, action: "approve" | "reject" | "save") => void;
  registerAct: (id: string, act: CardAct) => void;
}) {
  const [form, setForm] = useState<DraftForm>(() => toForm(draft));
  const [busy, setBusy] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [status, setStatus] = useState<CardStatus>("pending");
  const low = lowConfidenceSet(draft);

  const intakePhotos: IntakePhoto[] = (
    draft.intake?.photo_file_ids ?? []
  ).map((fileId, index) => ({ fileId, index }));

  const actRef = useRef<CardAct>(async () => false);

  const lowClass = (camel: string) => (low.has(camel) ? " rv-field--low" : "");
  const set = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const act: CardAct = async (action) => {
    if (busy) return false;
    setBusy(true);
    setError("");
    setStatus(
      action === "approve"
        ? "approving"
        : action === "reject"
          ? "rejecting"
          : "saving",
    );
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
      if (action === "save") {
        setStatus("pending");
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2500);
      } else {
        setStatus(action === "approve" ? "approved" : "rejected");
      }
      onResult(draft.id, action);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失敗");
      setStatus("error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  actRef.current = act;

  useEffect(() => {
    registerAct(draft.id, async (action) => actRef.current(action));
  }, [draft.id, registerAct]);

  const done = status === "approved" || status === "rejected";
  const disabled = busy || done;

  const cardClass =
    "draft-card" +
    (status === "approved"
      ? " draft-card--approved"
      : status === "rejected"
        ? " draft-card--rejected"
        : selected
          ? " draft-card--selected"
          : "") +
    (done ? " is-done" : "");

  return (
    <div className={cardClass}>
      {status === "approved" && (
        <div className="status-banner status-banner--ok">
          <CheckCircle2 />
          已批准，已發布去公開頁
        </div>
      )}
      {status === "rejected" && (
        <div className="status-banner status-banner--reject">
          <XCircle />
          已拒絕
        </div>
      )}

      <div className="draft-head">
        <label className="draft-check">
          <input
            type="checkbox"
            checked={selected}
            disabled={disabled}
            onChange={(e) => onToggleSelect(draft.id, e.target.checked)}
          />
          {draft.title || "（無標題）"}
        </label>
        <span className="draft-meta">
          信心 <b>{draft.confidence_score}</b> · {draft.intake?.source_label ?? ""}
          {intakePhotos.length > 0 ? ` · ${intakePhotos.length} 原始相` : ""}
        </span>
      </div>

      <fieldset
        disabled={disabled}
        style={{ border: "none", padding: 0, margin: 0 }}
      >
        <label className="rv-label">展示相（公開頁用，可增刪／調位）</label>
        <PhotoEditor
          draftId={draft.id}
          photos={form.photos}
          intakePhotos={intakePhotos}
          onChange={(next) => set("photos", next)}
        />

        <div className="draft-grid">
          <div>
            <label className="rv-label">標題</label>
            <input
              className={"rv-field" + lowClass("title")}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
            <label className="rv-label">地區（香港 18 區）</label>
            <select
              className={"rv-field" + lowClass("district")}
              value={form.district}
              onChange={(e) => set("district", e.target.value)}
            >
              <option value="">— 未分區（待審核）—</option>
              {HK_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <label className="rv-label">場地名</label>
            <input
              className={"rv-field" + lowClass("venueName")}
              value={form.venueName}
              onChange={(e) => set("venueName", e.target.value)}
            />
            <label className="rv-label">開始日期</label>
            <input
              className={"rv-field" + lowClass("startDate")}
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
            <label className="rv-label">結束日期</label>
            <input
              className={"rv-field" + lowClass("endDate")}
              type="date"
              value={form.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
            <label className="rv-label">價錢（原文）</label>
            <input
              className={"rv-field" + lowClass("priceText")}
              value={form.priceText}
              onChange={(e) => set("priceText", e.target.value)}
            />
            <label className="rv-label">尺寸（原文）</label>
            <input
              className={"rv-field" + lowClass("boothSizeText")}
              value={form.boothSizeText}
              onChange={(e) => set("boothSizeText", e.target.value)}
            />
          </div>
          <div>
            <label className="rv-label">聯絡（原文）</label>
            <input
              className={"rv-field" + lowClass("contactText")}
              value={form.contactText}
              onChange={(e) => set("contactText", e.target.value)}
            />
            <label className="rv-label">場地類型</label>
            <select
              className="rv-field"
              value={form.areaType}
              onChange={(e) => set("areaType", e.target.value)}
            >
              {AREA_TYPES.map((t) => (
                <option key={t} value={t}>
                  {AREA_LABELS[t]}
                </option>
              ))}
            </select>
            <label className="rv-label">冷氣</label>
            <select
              className="rv-field"
              value={form.hasAircon}
              onChange={(e) => set("hasAircon", e.target.value)}
            >
              <option value="">未知</option>
              <option value="yes">有</option>
              <option value="no">冇</option>
            </select>
            <label className="rv-label">可賣食品</label>
            <select
              className={"rv-field" + lowClass("allowsFood")}
              value={form.allowsFood}
              onChange={(e) => set("allowsFood", e.target.value)}
            >
              <option value="">未知</option>
              <option value="yes">可以</option>
              <option value="no">唔可以</option>
            </select>
            <div className="rv-checks">
              <label>
                <input
                  type="checkbox"
                  checked={form.isUrgent}
                  onChange={(e) => set("isUrgent", e.target.checked)}
                />
                急放
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.isDiscounted}
                  onChange={(e) => set("isDiscounted", e.target.checked)}
                />
                特價
              </label>
              <label>
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
        <div className="rv-note">AI 備註：{draft.review_note}</div>
      )}

      <button
        type="button"
        onClick={() => setShowRaw((s) => !s)}
        className="rv-raw-toggle"
      >
        {showRaw ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            收起原始貼文 <ChevronUp style={{ width: 13, height: 13 }} />
          </span>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            睇原始貼文 <ChevronDown style={{ width: 13, height: 13 }} />
          </span>
        )}
      </button>
      {showRaw && draft.intake && (
        <pre className="rv-raw">{draft.intake.raw_content}</pre>
      )}

      <div className="rv-actions">
        <button
          type="button"
          disabled={disabled}
          onClick={() => void act("save")}
          className="btn btn--secondary"
        >
          <Save />
          {status === "saving" ? "儲存中…" : savedFlash ? "已儲存 ✓" : "儲存改動"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void act("approve")}
          className="btn btn--success"
        >
          <CheckCircle2 />
          {status === "approving" ? "批准中…" : "批准"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void act("reject")}
          className="btn btn--danger"
        >
          <XCircle />
          {status === "rejecting" ? "拒絕中…" : "拒絕"}
        </button>
        {error && <span className="rv-error">{error}</span>}
      </div>
    </div>
  );
}
