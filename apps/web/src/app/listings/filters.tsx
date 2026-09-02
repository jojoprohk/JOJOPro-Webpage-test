import type { ListingFilters } from "../../lib/listing-types.js";

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#44403c",
  display: "block",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #d6d3d1",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};

export function Filters({
  filters,
  resultCount,
}: {
  filters: ListingFilters;
  resultCount: number;
}) {
  const hasActive =
    filters.q !== "" ||
    filters.date !== null ||
    filters.maxBudget !== null ||
    filters.food ||
    filters.aircon ||
    filters.deal;

  return (
    <form
      method="get"
      style={{
        background: "#fff",
        border: "1px solid #e7e5e4",
        borderRadius: 8,
        padding: 16,
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        alignItems: "end",
      }}
    >
      <div style={{ gridColumn: "1 / -1" }}>
        <label htmlFor="q" style={labelStyle}>
          搜尋（地區／場地／關鍵字）
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={filters.q}
          placeholder="例如：旺角、市集、pop-up"
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="date" style={labelStyle}>
          邊日有檔
        </label>
        <input
          id="date"
          name="date"
          type="date"
          defaultValue={filters.date ?? ""}
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="maxBudget" style={labelStyle}>
          最高預算（HKD）
        </label>
        <input
          id="maxBudget"
          name="maxBudget"
          type="number"
          min={1}
          step={50}
          defaultValue={filters.maxBudget ?? ""}
          placeholder="例如 800"
          style={inputStyle}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          fontSize: 14,
          flexWrap: "wrap",
        }}
      >
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            name="food"
            value="1"
            defaultChecked={filters.food}
          />
          可賣食品
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            name="aircon"
            value="1"
            defaultChecked={filters.aircon}
          />
          冷氣場
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            name="deal"
            value="1"
            defaultChecked={filters.deal}
          />
          急放／特價
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="submit"
          style={{
            background: "#1c1917",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "9px 18px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          篩選
        </button>
        {hasActive ? (
          <a
            href="/"
            style={{ fontSize: 13, color: "#78716c", textDecoration: "underline" }}
          >
            清除
          </a>
        ) : null}
      </div>

      <div style={{ gridColumn: "1 / -1", fontSize: 13, color: "#78716c" }}>
        {resultCount} 個場地
      </div>
    </form>
  );
}
