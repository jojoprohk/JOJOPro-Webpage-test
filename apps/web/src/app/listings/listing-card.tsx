import type { PublicListing } from "../../lib/listing-types.js";
import { formatDateLabel, normalizeWhatsappLink } from "../../lib/listing-filter.js";
import { ReportButton } from "./report-button.js";

const AREA_TYPE_LABELS: Record<string, string> = {
  mall: "商場",
  market: "市集",
  street: "街舖",
  industrial: "工廈",
  pop_up_event: "Pop-up 活動",
  private_venue: "私人場地",
  other: "其他",
  unknown: "未分類",
};

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "default" | "hot";
}) {
  const hot = tone === "hot";
  return (
    <span
      style={{
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        background: hot ? "#fef3c7" : "#f0eeec",
        color: hot ? "#92400e" : "#44403c",
        border: hot ? "1px solid #fcd34d" : "1px solid #e7e5e4",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "未標示";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "未標示";
  // 香港時區顯示日期。
  const hk = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return hk.toISOString().slice(0, 10);
}

export function ListingCard({ listing }: { listing: PublicListing }) {
  const whatsapp = normalizeWhatsappLink(listing.contactWhatsappLink);

  const badges: { label: string; tone?: "hot" }[] = [];
  if (listing.isUrgent) badges.push({ label: "急放", tone: "hot" });
  if (listing.isDiscounted) badges.push({ label: "特價", tone: "hot" });
  if (listing.allowsFood === true) badges.push({ label: "可賣食品" });
  if (listing.hasAircon === true) badges.push({ label: "冷氣" });
  if (listing.isPrimeSpot) badges.push({ label: "旺位" });
  if (listing.isCartSpot) badges.push({ label: "車位" });
  if (listing.requiresProductApproval) badges.push({ label: "產品需審批" });

  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #e7e5e4",
        borderRadius: 8,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
          {listing.title}
        </h2>
        {listing.priceText ? (
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#b45309",
              whiteSpace: "nowrap",
            }}
          >
            {listing.priceText}
          </span>
        ) : null}
      </div>

      <div style={{ fontSize: 14, color: "#44403c" }}>
        <div>
          📍 {[listing.district, listing.venueName]
            .filter(Boolean)
            .join(" · ") || "地點待確認"}
          <span style={{ color: "#a8a29e", marginLeft: 8 }}>
            {AREA_TYPE_LABELS[listing.areaType] ?? "未分類"}
          </span>
        </div>
        <div style={{ marginTop: 4 }}>🗓 {formatDateLabel(listing)}</div>
        {listing.boothSizeText ? (
          <div style={{ marginTop: 4 }}>
            📐 {listing.boothSizeText}
            <span style={{ fontSize: 12, color: "#a8a29e" }}>
              （實際尺寸同位置每場不同，請向負責人確認）
            </span>
          </div>
        ) : null}
      </div>

      {badges.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {badges.map((b) => (
            <Badge key={b.label} tone={b.tone}>
              {b.label}
            </Badge>
          ))}
        </div>
      ) : null}

      {listing.summary ? (
        <p style={{ margin: 0, fontSize: 14, color: "#57534e" }}>
          {listing.summary}
        </p>
      ) : null}

      <div
        style={{
          borderTop: "1px solid #f0eeec",
          paddingTop: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 12, color: "#78716c" }}>
          來源：
          {listing.sourceUrl ? (
            <a
              href={listing.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#57534e" }}
            >
              {listing.sourceLabel}
            </a>
          ) : (
            listing.sourceLabel
          )}
          <span style={{ marginLeft: 8 }}>
            最後更新：{formatUpdatedAt(listing.lastReviewedAt)}
          </span>
        </div>
        <ReportButton listingId={listing.id} />
      </div>

      <div>
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              background: "#25d366",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              padding: "8px 16px",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            WhatsApp 聯絡
          </a>
        ) : listing.contactText ? (
          <span style={{ fontSize: 14, color: "#44403c" }}>
            聯絡：{listing.contactText}
          </span>
        ) : (
          <span style={{ fontSize: 14, color: "#a8a29e" }}>
            聯絡方法待確認
          </span>
        )}
      </div>
    </article>
  );
}
