create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create table if not exists intake_items (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('telegram', 'instagram', 'whatsapp_forward', 'manual')),
  source_label text not null,
  source_url text,
  raw_content text not null,
  received_at timestamptz not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create trigger intake_items_set_updated_at
before update on intake_items
for each row
execute function set_updated_at();

create table if not exists venue_drafts (
  id uuid primary key default gen_random_uuid(),
  intake_item_id uuid not null unique references intake_items(id) on delete cascade,
  status text not null check (status in ('needs_review', 'approved', 'rejected', 'published')),

  title text not null,
  district text,
  venue_name text,
  start_date date,
  end_date date,
  price_text text,
  price_amount_hkd integer,
  price_unit text not null check (price_unit in ('day', 'period', 'unknown')),
  booth_size_text text,
  contact_text text,
  contact_whatsapp_link text,

  area_type text not null check (
    area_type in (
      'mall',
      'market',
      'street',
      'industrial',
      'pop_up_event',
      'private_venue',
      'other',
      'unknown'
    )
  ),

  has_aircon boolean,
  is_prime_spot boolean not null default false,
  is_cart_spot boolean not null default false,
  allows_food boolean,
  allows_dry_goods boolean,
  allows_beauty boolean,
  allows_service boolean,
  requires_product_approval boolean not null default false,
  is_urgent boolean not null default false,
  is_discounted boolean not null default false,

  summary text not null default '',
  confidence_score integer not null check (confidence_score between 0 and 100),
  low_confidence_fields text[] not null default '{}',
  unconfirmed_fields text[] not null default '{}',
  review_note text not null default '',
  last_reviewed_at timestamptz,

  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create trigger venue_drafts_set_updated_at
before update on venue_drafts
for each row
execute function set_updated_at();

create index if not exists idx_venue_drafts_status on venue_drafts(status);
create index if not exists idx_venue_drafts_dates on venue_drafts(start_date, end_date);
create index if not exists idx_venue_drafts_district on venue_drafts(district);
create index if not exists idx_intake_items_received_at on intake_items(received_at desc);

comment on table venue_drafts is 'Parsed venue drafts. RLS will be enabled when authenticated review access is introduced.';
