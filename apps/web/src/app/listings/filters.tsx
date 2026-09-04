"use client";

// 篩選欄（客戶端）：揀好舖位類型／地區／日期後撳「篩選」，
// 若未同意免責條款，會先彈出確認方格；剔咗「已閱讀並同意」先真正篩選。
// 同意一次後記喺本機，之後直接篩選唔再彈。
import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X, ShieldCheck } from "lucide-react";
import type { ListingFilters } from "../../lib/listing-types.js";

// v2 = new inline confirm design (v1 was full-page gate, removed).
// version bump forces existing users (incl. those who agreed under v1) to see the new flow once.
const STORAGE_KEY = "jojopro_disclaimer_agreed_v2";

// 舖位類型（對應系統 area_type）。
const AREA_OPTIONS: { value: string; label: string }[] = [
  { value: "pop_up_event", label: "Pop-up Store" },
  { value: "mall", label: "商場舖位" },
  { value: "market", label: "市集 / Booth 攤位" },
  { value: "street", label: "街舖" },
  { value: "industrial", label: "工廈" },
  { value: "private_venue", label: "私人場地" },
  { value: "exhibition", label: "展銷位" },
  { value: "other", label: "其他" },
];

// 地區：三大區統稱 + 18 區（分組）。
const DISTRICT_GROUPS: { label: string; options: { value: string; label: string }[] }[] = [
  {
    label: "全部分區",
    options: [
      { value: "hong_kong_island", label: "港島（全區）" },
      { value: "kowloon", label: "九龍（全區）" },
      { value: "new_territories", label: "新界（全區）" },
    ],
  },
  {
    label: "港島",
    options: [
      { value: "中西區", label: "中西區" },
      { value: "灣仔區", label: "灣仔區" },
      { value: "東區", label: "東區" },
      { value: "南區", label: "南區" },
    ],
  },
  {
    label: "九龍",
    options: [
      { value: "油尖旺區", label: "油尖旺區" },
      { value: "深水埗區", label: "深水埗區" },
      { value: "九龍城區", label: "九龍城區" },
      { value: "黃大仙區", label: "黃大仙區" },
      { value: "觀塘區", label: "觀塘區" },
    ],
  },
  {
    label: "新界",
    options: [
      { value: "葵青區", label: "葵青區" },
      { value: "荃灣區", label: "荃灣區" },
      { value: "屯門區", label: "屯門區" },
      { value: "元朗區", label: "元朗區" },
      { value: "北區", label: "北區" },
      { value: "大埔區", label: "大埔區" },
      { value: "沙田區", label: "沙田區" },
      { value: "西貢區", label: "西貢區" },
      { value: "離島區", label: "離島區" },
    ],
  },
];

export function Filters({
  filters,
  resultCount,
}: {
  filters: ListingFilters;
  resultCount: number;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [agreed, setAgreed] = useState(true); // 伺服器首次 render 當已同意，避免 hydration 不匹配；mount 後再讀真實狀態。
  const [showConfirm, setShowConfirm] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      setAgreed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setAgreed(false);
    }
  }, []);

  const hasActive =
    filters.areaType !== null ||
    filters.district !== null ||
    filters.date !== null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (agreed) return; // 已同意：照正常 GET 提交篩選。
    event.preventDefault();
    setShowConfirm(true);
  }

  function handleAgreeAndFilter() {
    if (!checked) return;
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // 寫唔入都照繼續。
    }
    setAgreed(true);
    setShowConfirm(false);
    formRef.current?.submit();
  }

  return (
    <form ref={formRef} method="get" className="filters filters--select" onSubmit={handleSubmit}>
      <div className="filters__field">
        <label htmlFor="areaType" className="field-label">
          舖位類型
        </label>
        <select id="areaType" name="areaType" defaultValue={filters.areaType ?? ""} className="field">
          <option value="">全部類型</option>
          {AREA_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="filters__field">
        <label htmlFor="district" className="field-label">
          地區
        </label>
        <select id="district" name="district" defaultValue={filters.district ?? ""} className="field">
          <option value="">全部地區</option>
          {DISTRICT_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="filters__field">
        <label htmlFor="date" className="field-label">
          邊日有檔
        </label>
        <input id="date" name="date" type="date" defaultValue={filters.date ?? ""} className="field" />
      </div>

      <div className="filters__actions">
        <button type="submit" className="btn btn--primary">
          <SlidersHorizontal />
          篩選
        </button>
        {hasActive ? (
          <a href="/" className="clear-link" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <X style={{ width: 13, height: 13 }} />
            清除
          </a>
        ) : null}
      </div>

      {showConfirm ? (
        <div className="filters__confirm" role="group" aria-label="免責條款確認">
          <p className="filters__confirm-title">
            <ShieldCheck />
            篩選前請確認免責條款
          </p>
          <p className="filters__confirm-text">
            JoJoPro 只係公開資訊聚合平台，<strong>唔係業主、代理或交易方</strong>，
            唔保證資料真確；場地資訊請自行向負責人核實，慎防受騙。
          </p>
          <label className="filters__confirm-check">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>
              我已閱讀並同意
              <a href="/disclaimer" target="_blank" rel="noopener noreferrer">
                免責條款
              </a>
              ，明白資料須自行核實。
            </span>
          </label>
          <div className="filters__confirm-actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleAgreeAndFilter}
              disabled={!checked}
            >
              同意並開始篩選
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                setShowConfirm(false);
                setChecked(false);
              }}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

      <div className="result-count">
        <b>{resultCount}</b> 個場地
      </div>
    </form>
  );
}
