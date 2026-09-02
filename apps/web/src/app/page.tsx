import { Filters } from "./listings/filters.js";
import { ListingCard } from "./listings/listing-card.js";
import { applyFilters, parseFilters, todayInHongKong } from "../lib/listing-filter.js";
import { createListingRepository } from "../lib/listing-repository.js";
import { createSupabaseServiceClient } from "../lib/venue-repository.js";
import type { PublicListing } from "../lib/listing-types.js";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);

  let listings: PublicListing[] = [];
  let loadFailed = false;
  try {
    const repository = createListingRepository(createSupabaseServiceClient());
    const approved = await repository.listApprovedListings();
    listings = applyFilters(approved, filters, todayInHongKong());
  } catch (error) {
    console.error("[listings] load failed:", error);
    loadFailed = true;
  }

  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "24px 16px 48px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <header>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
          JoPoJo 香港短租場地
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "#57534e" }}>
          pop-up、booth、展銷場地情報。資料來自公開貼文，檔期同條款請向場地負責人確認。
        </p>
      </header>

      <Filters filters={filters} resultCount={listings.length} />

      {loadFailed ? (
        <p style={{ color: "#b91c1c" }}>
          暫時載入唔到場地，請稍後再試。
        </p>
      ) : listings.length === 0 ? (
        <p style={{ color: "#57534e" }}>
          未有符合條件嘅場地。試下清除篩選，或者稍後再嚟睇。
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          }}
        >
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      <footer style={{ fontSize: 12, color: "#a8a29e", marginTop: 8 }}>
        JoPoJo 只聚合公開資訊，唔參與租務交易，亦唔保證資料真偽。
      </footer>
    </main>
  );
}
