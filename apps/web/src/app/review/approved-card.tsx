"use client";

import { useRef, useState, useCallback } from "react";
import {
  BadgeCheck,
  MapPin,
  Sparkles,
  Pencil,
  Save,
  X,
  ImagePlus,
  Star,
} from "lucide-react";
import {
  AREA_LABELS,
  AREA_TYPES,
  HK_DISTRICTS,
  draftPhotos,
  formToFields,
  toForm,
  type Draft,
  type DraftForm,
} from "./review-lib";
import type { VenuePhoto } from "@jojopro/ai";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type FeaturedStatus = "idle" | "toggling" | "error";

// 已批准（已上線）草稿嘅管理卡：
// 1. 預設係唯讀摘要
// 2. 「編輯」入嚟可以改所有公開欄位（PATCH action=save）
// 3. 「加入本週精選 / 從精選移除」toggle 立即生效（PATCH action=toggle_featured）
//    - 重新 toggle on 會 stamp featured_at = now，由 featured-ranking 拎返入精選卡。
export function ApprovedCard({
  draft,
  onChanged,
}: {
  draft: Draft;
  onChanged?: (next: Draft) => void;
}) {
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

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<DraftForm>(() => toForm(draft));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [featuredStatus, setFeaturedStatus] = useState<FeaturedStatus>("idle");
  const [featuredError, setFeaturedError] = useState("");
  const [isFeatured, setIsFeatured] = useState<boolean>(draft.is_featured);
  const [featuredAt, setFeaturedAt] = useState<string | null>(draft.featured_at);

  const setField = useCallback(
    <K extends keyof DraftForm>(key: K, value: DraftForm[K]) => {
      setForm((f) => ({ ...f, [key]: value }));
    },
    [],
  );

  const setPhotos = useCallback((next: VenuePhoto[]) => {
    setForm((f) => ({ ...f, photos: next }));
  }, []);

  const enterEdit = () => {
    setForm(toForm(draft));
    setSaveStatus("idle");
    setSaveError("");
    setEditing(true);
  };
  const cancelEdit = () => {
    setForm(toForm(draft));
    setSaveStatus("idle");
    setSaveError("");
    setEditing(false);
  };

  const save = async () => {
    setSaveStatus("saving");
    setSaveError("");
    try {
      const res = await fetch(`/api/review/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save", fields: formToFields(form) }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setSaveStatus("saved");
      // 通知父層更新本地 cache，咁下次 reload 唔使重新 fetch。
      onChanged?.({
        ...draft,
        title: form.title,
        district: form.district || null,
        venue_name: form.venueName || null,
        photos: form.photos,
        start_date: form.startDate || null,
        end_date: form.endDate || null,
        price_text: form.priceText || null,
        booth_size_text: form.boothSizeText || null,
        contact_text: form.contactText || null,
        area_type: form.areaType,
        has_aircon: form.hasAircon === "" ? null : form.hasAircon === "yes",
        allows_food: form.allowsFood === "" ? null : form.allowsFood === "yes",
        is_urgent: form.isUrgent,
        is_discounted: form.isDiscounted,
        is_prime_spot: form.isPrimeSpot,
      });
      setTimeout(() => setSaveStatus("idle"), 1500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "儲存失敗");
      setSaveStatus("error");
    }
  };

  const toggleFeatured = async () => {
    const wantOn = !isFeatured;
    setFeaturedStatus("toggling");
    setFeaturedError("");
    try {
      const res = await fetch(`/api/review/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "toggle_featured",
          fields: { isFeatured: wantOn },
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      // 由 server stamp featured_at；本地樂觀更新用 now（跟 server 一致處理）。
      const nowIso = new Date().toISOString();
      setIsFeatured(wantOn);
      setFeaturedAt(wantOn ? nowIso : null);
      setFeaturedStatus("idle");
      onChanged?.({
        ...draft,
        is_featured: wantOn,
        featured_at: wantOn ? nowIso : null,
      });
    } catch (e) {
      setFeaturedError(e instanceof Error ? e.message : "切換失敗");
      setFeaturedStatus("error");
    }
  };

  // ── 摘要 view ──
  if (!editing) {
    return (
      <div className={`approved-card${isFeatured ? " approved-card--featured" : ""}`}>
        <div className="approved-head">
          <strong className="approved-title">{draft.title || "（無標題）"}</strong>
          <span className="approved-live">
            <BadgeCheck />
            已上線
          </span>
          {isFeatured ? (
            <span className="approved-featured-badge" title={featuredAt ? `自 ${new Date(featuredAt).toLocaleString("zh-HK")}` : ""}>
              <Star />
              本週精選
            </span>
          ) : null}
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
        <div className="approved-actions">
          <button
            type="button"
            className={`btn-toggle-featured${isFeatured ? " is-on" : ""}`}
            onClick={() => void toggleFeatured()}
            disabled={featuredStatus === "toggling"}
          >
            {isFeatured ? <Star /> : <Sparkles />}
            {featuredStatus === "toggling"
              ? "切換中…"
              : isFeatured
                ? "從精選移除"
                : "加入本週精選"}
          </button>
          <button
            type="button"
            className="btn-edit"
            onClick={enterEdit}
          >
            <Pencil />
            編輯資料
          </button>
        </div>
        {featuredStatus === "error" ? (
          <div className="approved-error">{featuredError}</div>
        ) : null}
      </div>
    );
  }

  // ── 編輯 view ──
  return (
    <div className={`approved-card approved-card--editing${isFeatured ? " approved-card--featured" : ""}`}>
      <div className="approved-head">
        <strong className="approved-title">編輯中 · {draft.title || "（無標題）"}</strong>
        <span className="approved-live"><BadgeCheck />已上線</span>
      </div>
      <fieldset className="approved-form">
        <label className="field">
          <span>標題</span>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
          />
        </label>
        <label className="field">
          <span>地區</span>
          <select
            value={form.district}
            onChange={(e) => setField("district", e.target.value)}
          >
            <option value="">（未填）</option>
            {HK_DISTRICTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>場地名</span>
          <input
            type="text"
            value={form.venueName}
            onChange={(e) => setField("venueName", e.target.value)}
          />
        </label>
        <label className="field">
          <span>場地類型</span>
          <select
            value={form.areaType}
            onChange={(e) => setField("areaType", e.target.value)}
          >
            {AREA_TYPES.map((t) => (
              <option key={t} value={t}>{AREA_LABELS[t] ?? t}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>開始日期</span>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setField("startDate", e.target.value)}
          />
        </label>
        <label className="field">
          <span>結束日期</span>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => setField("endDate", e.target.value)}
          />
        </label>
        <label className="field field--full">
          <span>價錢文字</span>
          <input
            type="text"
            value={form.priceText}
            onChange={(e) => setField("priceText", e.target.value)}
            placeholder="例：$800/日，兩日起租"
          />
        </label>
        <label className="field field--full">
          <span>檔位規格</span>
          <input
            type="text"
            value={form.boothSizeText}
            onChange={(e) => setField("boothSizeText", e.target.value)}
            placeholder="例：6ft x 4ft 桌位"
          />
        </label>
        <label className="field field--full">
          <span>聯絡方法</span>
          <input
            type="text"
            value={form.contactText}
            onChange={(e) => setField("contactText", e.target.value)}
            placeholder="電話 / WhatsApp / IG / email"
          />
        </label>
        <label className="field">
          <span>冷氣</span>
          <select
            value={form.hasAircon}
            onChange={(e) => setField("hasAircon", e.target.value)}
          >
            <option value="">（未填）</option>
            <option value="yes">有</option>
            <option value="no">冇</option>
          </select>
        </label>
        <label className="field">
          <span>可賣食品</span>
          <select
            value={form.allowsFood}
            onChange={(e) => setField("allowsFood", e.target.value)}
          >
            <option value="">（未填）</option>
            <option value="yes">可以</option>
            <option value="no">唔可以</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={form.isUrgent}
            onChange={(e) => setField("isUrgent", e.target.checked)}
          />
          <span>急放</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={form.isDiscounted}
            onChange={(e) => setField("isDiscounted", e.target.checked)}
          />
          <span>特價</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={form.isPrimeSpot}
            onChange={(e) => setField("isPrimeSpot", e.target.checked)}
          />
          <span>旺位</span>
        </label>
      </fieldset>
      <div className="approved-actions">
        <button
          type="button"
          className="btn-edit"
          onClick={cancelEdit}
          disabled={saveStatus === "saving"}
        >
          <X />
          取消
        </button>
        <button
          type="button"
          className="btn-toggle-featured is-on"
          onClick={() => void save()}
          disabled={saveStatus === "saving"}
        >
          <Save />
          {saveStatus === "saving" ? "儲存中…" : saveStatus === "saved" ? "已儲存" : "儲存"}
        </button>
      </div>
      {saveStatus === "error" ? (
        <div className="approved-error">{saveError}</div>
      ) : null}
      <PhotoStrip photos={form.photos} onChange={setPhotos} draftId={draft.id} />
    </div>
  );
}

// 簡化版相片編輯器（只 reorder + remove；無 add，避免加 stock 影響已上線 page）
function PhotoStrip({
  photos,
  onChange,
  draftId,
}: {
  photos: VenuePhoto[];
  onChange: (next: VenuePhoto[]) => void;
  draftId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [uploadError, setUploadError] = useState("");

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
  const remove = (i: number) => onChange(photos.filter((_, idx) => idx !== i));

  const upload = useCallback(async (file: File) => {
    setUploadStatus("uploading");
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/review/uploads", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        storageKey?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.storageKey) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      // 候補相插喺 stock 之前，咁 stock 相永遠做 category indicator。
      const insertAt = (() => {
        for (let i = photos.length - 1; i >= 0; i--) {
          const p = photos[i];
          if (p && p.kind === "stock") return i;
        }
        return photos.length;
      })();
      const next = [
        ...photos.slice(0, insertAt),
        { kind: "manual" as const, storageKey: data.storageKey },
        ...photos.slice(insertAt),
      ];
      onChange(next);
      setUploadStatus("idle");
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "上傳失敗");
      setUploadStatus("error");
    }
  }, [photos, onChange]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    e.target.value = "";
  };

  const photoUrl = (photo: VenuePhoto, index: number): string => {
    if (photo.kind === "stock") return photo.src;
    return `/api/photos/draft/${draftId}/${index}`;
  };

  if (photos.length === 0) return null;

  return (
    <div className="approved-photo-strip">
      <span className="strip-label">展示相（首張自動做卡封面）</span>
      <div className="strip-grid">
        {photos.map((photo, i) => (
          <div className="strip-item" key={`${photo.kind}-${i}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(photo, i)} alt={`相 ${i + 1}`} />
            <div className="strip-controls">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === photos.length - 1}>↓</button>
              <button type="button" onClick={() => remove(i)} className="strip-remove">×</button>
            </div>
            {photo.kind === "stock" ? <span className="strip-tag">參考</span> : null}
          </div>
        ))}
      </div>
      <div className="strip-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="visually-hidden"
          onChange={onPickFile}
        />
        <button
          type="button"
          className="btn-edit"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadStatus === "uploading"}
        >
          <ImagePlus />
          {uploadStatus === "uploading" ? "上傳中…" : "新增候補相"}
        </button>
      </div>
      {uploadStatus === "error" ? (
        <div className="approved-error">候補相上傳失敗：{uploadError}</div>
      ) : null}
    </div>
  );
}
