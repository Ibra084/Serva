-- Serva: Menu Builder + Menu Appearance
-- Extends menu_items with owner-controlled display/editorial fields, and adds
-- menu_categories (ordering) and menu_appearance (per-restaurant customer-menu
-- look & feel). Additive/nullable-or-defaulted only — the existing upload
-- pipeline (data-store.ts upsertMenuItems) never touches these columns, so
-- rows it writes simply keep the defaults below.

alter table public.menu_items
  add column description text,
  add column image_url text,
  add column allergens text[] not null default '{}',
  add column dietary_tags text[] not null default '{}',
  add column spice_level smallint not null default 0 check (spice_level between 0 and 3),
  add column is_signature boolean not null default false,
  add column is_recommended boolean not null default false,
  add column is_available boolean not null default true,
  add column is_hidden boolean not null default false,
  add column availability_start text,
  add column availability_end text,
  add column prep_time_minutes int,
  add column display_order int not null default 0;

-- ============================================================================
-- menu_categories: owner-controlled category ordering
-- ============================================================================

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create index menu_categories_restaurant_id_idx on public.menu_categories (restaurant_id);

alter table public.menu_categories enable row level security;

-- Public read, same rationale as menu_items: the unauthenticated QR customer
-- menu needs category order.
create policy "menu categories are publicly readable"
  on public.menu_categories for select
  using (true);

create policy "members can write menu categories"
  on public.menu_categories for all
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = menu_categories.restaurant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = menu_categories.restaurant_id and m.user_id = auth.uid()
    )
  );

-- ============================================================================
-- menu_appearance: one row per restaurant, controls the customer-facing look
-- ============================================================================

create table public.menu_appearance (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  layout text not null default 'modern' check (layout in ('modern', 'compact', 'booklet')),
  brand_color text,
  logo_url text,
  cover_image_url text,
  intro_text text,
  show_photos boolean not null default true,
  show_allergens boolean not null default true,
  show_popularity boolean not null default true,
  show_ai_box boolean not null default true,
  show_prices boolean not null default true,
  show_calories boolean not null default false,
  category_display text not null default 'tabs' check (category_display in ('tabs', 'sections', 'booklet')),
  updated_at timestamptz not null default now()
);

alter table public.menu_appearance enable row level security;

create policy "menu appearance is publicly readable"
  on public.menu_appearance for select
  using (true);

create policy "members can write menu appearance"
  on public.menu_appearance for all
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = menu_appearance.restaurant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = menu_appearance.restaurant_id and m.user_id = auth.uid()
    )
  );
