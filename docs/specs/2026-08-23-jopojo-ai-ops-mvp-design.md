# JoPoJo AI Operations MVP Design

Date: 2026-08-23
Status: Draft for Mercy's review

## 1. Problem

Hong Kong short-term booth supply is active but fragmented. Venue operators, promoters, and agents post updates in WhatsApp groups and Instagram, but the information is hard to search, expires quickly, repeats constantly, and is not structured by date, price, location, booth size, or product restrictions.

Mercy wants an AI-assisted workflow that reduces manual整理 time while keeping human review before publication.

## 2. MVP Goal

Turn forwarded venue posts into approved website listings and social-media drafts in under 30 seconds of Mercy's review time per item.

The first version must prove that:

- venue posts can be parsed reliably enough for review;
- approved listings can be published to a simple site;
- AI can create useful Instagram/Facebook draft content;
- the workflow saves Mercy real time.

## 3. In Scope

- Telegram bot intake from Mercy and approved contributors.
- Storage of raw text, image references, source link, and submission time.
- AI extraction of venue listing fields.
- A review queue for Mercy to approve, edit, or reject items.
- A public website listing page and simple filters.
- Auto-generated social drafts, initially copied manually by Mercy.
- Basic source tracking: Telegram, Instagram post URL, WhatsApp forward, manual input.

## 4. Out of Scope

- Payments, deposits, escrow, rent collection, or transaction commissions.
- E-signature or contract hosting.
- In-platform chat between tenants and venue operators.
- Full venue-operator self-service dashboard.
- Fully automatic posting to Instagram.
- Scraping or monitoring the whole WhatsApp group.
- Verified badges, guarantees, or dispute arbitration.
- Complex recommendation algorithms.

## 5. Recommended Stack

| Layer | Choice | Reason |
|---|---|---|
| Intake | Telegram Bot | Free, stable, easy to automate, supports text/photo/link |
| Web app | Next.js + TypeScript | One stack for public site, review console, and bot webhook |
| Database | Supabase PostgreSQL | Free tier, structured data, auth later if needed |
| AI | OpenAI structured output | Good balance of cost and parsing quality |
| Hosting | Vercel | Simple Next.js deployment and webhook support |
| Social publishing | Manual copy first, Meta API later | Safer until data quality is proven |

Avoid Make.com, n8n, SleekFlow, or other paid tools in the first 30 days unless a concrete limitation requires them.

## 6. Core Data Flow

```text
Mercy/contributor forwards post to Telegram bot
  -> raw intake saved
  -> AI extracts fields and confidence
  -> review item created with status "needs_review"
  -> Mercy edits/approves/rejects
  -> approved listing published to website
  -> social draft generated and stored
  -> Mercy manually posts to Instagram/Facebook
```

## 7. Listing Fields

### Required for Approval

- `source_type`: `telegram`, `instagram`, `whatsapp_forward`, `manual`
- `source_label`: e.g. group name, Instagram handle, submitter label
- `source_url`: nullable; Instagram or public URL when available
- `title`
- `district`
- `venue_name`
- `start_date`
- `end_date`
- `price_text`: original wording, e.g. `$800/日`, `$1200/2日`
- `price_amount_hkd`: nullable numeric base price
- `price_unit`: `day`, `period`, `unknown`
- `booth_size_text`: e.g. `3粒`, `120x60cm 枱`, `4粒`
- `contact_text`: original contact wording
- `contact_whatsapp_link`: nullable
- `raw_content`
- `last_reviewed_at`

### Important Filters

- `area_type`: `mall`, `market`, `street`, `industrial`, `pop_up_event`, `private_venue`, `other`
- `has_aircon`
- `is_prime_spot`
- `is_cart_spot`
- `allows_food`
- `allows_dry_goods`
- `allows_beauty`
- `allows_service`
- `requires_product_approval`
- `is_urgent`
- `is_discounted`

### Trust Fields

- `publication_date`
- `last_seen_at`
- `data_quality_score`: 0-100
- `review_note`
- `report_count`

Do not call the operator "verified" in MVP. Use "last reviewed" and source labels only.

## 8. Review Rules

An item must be rejected or left pending if any of these are unclear:

- venue name or district
- dates
- price
- contact method
- product restrictions that materially affect suitability

Low-confidence fields should be visually marked in the review UI. AI must not silently guess.

## 9. Public Website MVP

First screen needs:

- search by district/venue;
- filters: dates, max price, booth size tags, food allowed, aircon, urgent/discounted;
- listing cards with date, district, venue, price, size, restrictions, source, and last-reviewed time;
- WhatsApp/contact button using the original source contact;
- "report outdated info" action.

Do not build a landing page with marketing copy. The listings page is the product.

## 10. Social Draft Types

AI should generate drafts from approved listings:

- `urgent_release`: 今日急放 / 執雞位
- `weekly_budget`: 本週平場
- `under_800`: $800 以下週末檔
- `food_friendly`: 可賣食品場地
- `aircon_picks`: 冷氣場精選
- `district_picks`: 地區精選
- `new_source`: 新場地 / 新供應來源

Each draft includes:

- title;
- 3-5 bullet points;
- source label and last-updated date;
- CTA to the website;
- disclaimer that users should confirm availability and terms directly with the venue contact.

## 11. 30-Day Success Metrics

- 30-50 approved listings.
- At least 100 unique website listing views.
- At least 20 contact/WhatsApp clicks.
- At least 20 alert/signup expressions of interest.
- Mercy spends 15-30 minutes per day on review and outreach, not manual content formatting.
- AI parsing produces approved listings with minimal edits for at least 70% of text posts.

## 12. Kill / Pause Signals

Pause after 30 days if:

- fewer than 30 usable posts can be collected;
- fewer than 50 people view the website repeatedly;
- contact clicks are below 10;
- Mercy still spends more time fixing AI output than the old manual process.

## 13. Implementation Order

1. Create project structure and data schema.
2. Build Telegram bot intake into Supabase.
3. Build AI parser with structured output and confidence.
4. Build minimal review page.
5. Publish approved listings to a public page.
6. Generate social drafts.
7. Add image handling and Instagram URL handling.
