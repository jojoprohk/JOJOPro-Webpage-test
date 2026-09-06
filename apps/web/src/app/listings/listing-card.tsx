import {
  MapPin,
  CalendarDays,
  Ruler,
  Flame,
  Tag,
  UtensilsCrossed,
  Snowflake,
  Star,
  Car,
  ClipboardCheck,
  ImageOff,
} from "lucide-react";
import type { PublicListing } from "../../lib/listing-types.js";
import { extractContactUrl, formatDateLabel, normalizeWhatsappLink } from "../../lib/listing-filter.js";
import { ReportButton } from "./report-button.js";

const AREA_TYPE_LABELS: Record<string, string> = {
  mall: "商場",
  market: "市集",
  street: "街舖",
  industrial: "工廈",
  pop_up_event: "Pop-up 活動",
  private_venue: "私人場地",
  exhibition: "展銷位",
  other: "其他",
  unknown: "未分類",
};

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "未標示";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "未標示";
  const hk = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return hk.toISOString().slice(0, 10);
}

export function ListingCard({ listing }: { listing: PublicListing }) {
  const whatsapp = normalizeWhatsappLink(listing.contactWhatsappLink);
  const photoBase = `/api/photos/listing/${listing.id}`;

  const badges: { label: string; hot?: boolean; icon: React.ReactNode }[] = [];
  if (listing.isUrgent) badges.push({ label: "急放", hot: true, icon: <Flame /> });
  if (listing.isDiscounted) badges.push({ label: "特價", hot: true, icon: <Tag /> });
  if (listing.allowsFood === true) badges.push({ label: "可賣食品", icon: <UtensilsCrossed /> });
  if (listing.hasAircon === true) badges.push({ label: "冷氣", icon: <Snowflake /> });
  if (listing.isPrimeSpot) badges.push({ label: "旺位", icon: <Star /> });
  if (listing.isCartSpot) badges.push({ label: "車位", icon: <Car /> });
  if (listing.requiresProductApproval) badges.push({ label: "產品需審批", icon: <ClipboardCheck /> });

  const placeName =
    [listing.district, listing.venueName].filter(Boolean).join(" · ") || "地點待確認";

  return (
    <article className="card listing-card">
      {listing.photoCount > 0 ? (
        <a className={`photo${listing.firstPhotoKind === "stock" ? " photo--reference" : ""}`} href={`${photoBase}/0`} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${photoBase}/0`} alt={listing.title} loading="lazy" />
          {listing.firstPhotoKind === "stock" ? (
            <span className="reference-badge" title="圖片僅供參考，並非真實場地">
              僅供參考
            </span>
          ) : null}
          {listing.priceText ? <span className="price-tag">{listing.priceText}</span> : null}
        </a>
      ) : (
        <div className="photo--placeholder">
          <ImageOff />
        </div>
      )}

      {listing.photoCount > 1 ? (
        <div className="thumbs">
          {Array.from({ length: listing.photoCount }, (_, i) => (
            <a key={i} href={`${photoBase}/${i}`} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${photoBase}/${i}`} alt={`${listing.title} 相 ${i + 1}`} loading="lazy" />
            </a>
          ))}
        </div>
      ) : null}

      <div className="listing-body">
        <h2 className="listing-title">{listing.title}</h2>

        <div className="meta-list">
          <div className="meta-row">
            <MapPin />
            <span>
              {placeName}
              <span className="area-type">
                {AREA_TYPE_LABELS[listing.areaType] ?? "未分類"}
              </span>
            </span>
          </div>
          <div className="meta-row">
            <CalendarDays />
            <span>{formatDateLabel(listing)}</span>
          </div>
          {listing.boothSizeText ? (
            <div className="meta-row">
              <Ruler />
              <span>
                {listing.boothSizeText}
                <span className="meta-note">（實際尺寸同位置每場不同，請向負責人確認）</span>
              </span>
            </div>
          ) : null}
        </div>

        {badges.length > 0 ? (
          <div className="badges">
            {badges.map((b) => (
              <span key={b.label} className={`badge${b.hot ? " badge--hot" : ""}`}>
                {b.icon}
                {b.label}
              </span>
            ))}
          </div>
        ) : null}

        {listing.summary ? <p className="listing-summary">{listing.summary}</p> : null}

        <div className="listing-foot">
          <div className="source">
            來源：
            {listing.sourceUrl ? (
              <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer">
                {listing.sourceLabel}
              </a>
            ) : (
              listing.sourceLabel
            )}
            <span style={{ marginLeft: 8 }}>
              更新：{formatUpdatedAt(listing.lastReviewedAt)}
            </span>
          </div>
          <ReportButton listingId={listing.id} />
        </div>

        {whatsapp ? (
          <a
            className="btn btn--whatsapp"
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp 聯絡
          </a>
        ) : (() => {
          const contactUrl = extractContactUrl(listing.contactText);
          if (contactUrl && listing.contactText) {
            return (
              <a
                className="contact-link"
                href={contactUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                聯絡：{listing.contactText}
              </a>
            );
          }
          if (listing.contactText) {
            return (
              <span className="contact-text">聯絡：{listing.contactText}</span>
            );
          }
          return <span className="contact-none">聯絡方法待確認</span>;
        })()}
      </div>
    </article>
  );
}
