import { MapPinned, Sparkles } from "lucide-react";
import { Filters } from "./listings/filters.js";
import { ListingCard } from "./listings/listing-card.js";
import { FeaturedGallery } from "./listings/featured-gallery.js";
import { toFeaturedItems } from "./listings/featured-items.js";
import { HeroIntro, Reveal, RevealGrid } from "./components/motion.js";
import { SiteFooter } from "./components/site-footer.js";
import { applyFilters, parseFilters, todayInHongKong } from "../lib/listing-filter.js";
import { pickFeatured } from "../lib/featured-ranking.js";
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
  let approved: PublicListing[] = [];
  let loadFailed = false;
  try {
    const repository = createListingRepository(createSupabaseServiceClient());
    approved = await repository.listApprovedListings();
    listings = applyFilters(approved, filters, todayInHongKong());
  } catch (error) {
    console.error("[listings] load failed:", error);
    loadFailed = true;
  }

  // 精選：固定置頂（唔受篩選影響），由人手 is_featured 控制；最多 5 張。
  const featured = toFeaturedItems(pickFeatured(approved, todayInHongKong()));

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <a href="/" className="brand" aria-label="JoJoPro 租租舖 首頁">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/jojopro-logo.png" alt="JoJoPro" className="brand-logo" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/jojopro-logo-cn.png" alt="租租舖" className="brand-logo-cn" />
          </a>
          <span className="header-meta">
            <MapPinned />
            短租舖位 · 市集 · 工廈 · Pop-up
          </span>
        </div>
      </header>

      <HeroIntro>
        <section className="hero">
          <p className="hero-eyebrow" data-motion>
            <Sparkles />
            香港短租場地情報
          </p>
          <h1 data-motion>
            搵 <span className="hl">pop-up、booth、展銷場</span>
            <br />
            唔使再逐個 group 刨
          </h1>
          <p className="tagline" data-motion>
            聚合公開貼文嘅場地情報，來源清楚、定期更新。
            檔期同條款請向場地負責人確認。
          </p>
        </section>
      </HeroIntro>

      <main className="wrap" style={{ paddingTop: 26 }}>
        {featured.length > 0 ? (
          <section className="featured" aria-label="精選場地">
            <div className="featured__head">
              <h2 className="featured__title">
                本週<span className="hl">精選</span>場地
              </h2>
              <span className="featured__eyebrow">Featured · 拉開睇詳情</span>
            </div>
            <FeaturedGallery items={featured} />
          </section>
        ) : null}

        <Reveal>
          <Filters filters={filters} resultCount={listings.length} />
        </Reveal>

        {loadFailed ? (
          <p className="notice notice--error">暫時載入唔到場地，請稍後再試。</p>
        ) : listings.length === 0 ? (
          <p className="notice">未有符合條件嘅場地。試下清除篩選，或者稍後再嚟睇。</p>
        ) : (
          <RevealGrid className="listing-grid" childSelector=":scope > article">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </RevealGrid>
        )}

        <SiteFooter />
      </main>
    </>
  );
}
