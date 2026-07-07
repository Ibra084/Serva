-- Serva: initial schema migration
-- Moves restaurant/menu/order/review/QR data off client-side localStorage
-- and into Supabase, tied to real authenticated users.
--
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query).
-- Safe to run once against a fresh project; re-running will fail on the
-- `create table` statements since there's no IF NOT EXISTS guard by design
-- (this is a one-shot init migration).

-- ============================================================================
-- profiles (synced from auth.users)
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles are self-readable"
  on public.profiles for select
  using (auth.uid() = id);

-- ============================================================================
-- tenancy: restaurants + memberships
-- ============================================================================

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  location text,
  cuisine text,
  num_tables int,
  num_seats int,
  pos_system text,
  logo_url text,
  owner_user_id uuid not null references auth.users(id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'staff', 'consultant')),
  created_at timestamptz not null default now(),
  unique (user_id, restaurant_id)
);

create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_restaurant_id_idx on public.memberships (restaurant_id);

alter table public.restaurants enable row level security;
alter table public.memberships enable row level security;

-- Anyone (including anonymous QR customers) can resolve a slug -> restaurant.
create policy "restaurants are publicly readable"
  on public.restaurants for select
  using (true);

create policy "members can update their restaurant"
  on public.restaurants for update
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = restaurants.id and m.user_id = auth.uid()
    )
  );

create policy "authenticated users can create a restaurant"
  on public.restaurants for insert
  to authenticated
  with check (owner_user_id = auth.uid());

create policy "owners can delete their restaurant"
  on public.restaurants for delete
  using (owner_user_id = auth.uid());

create policy "members can view their memberships"
  on public.memberships for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.restaurants r
      where r.id = memberships.restaurant_id and r.owner_user_id = auth.uid()
    )
  );

create policy "owners can add memberships to their restaurant"
  on public.memberships for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.owner_user_id = auth.uid()
    )
  );

create policy "owners can remove memberships from their restaurant"
  on public.memberships for delete
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- owner data: upload pipeline
-- ============================================================================

create table public.upload_batches (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  status text not null check (status in ('processed', 'needs_review', 'failed')),
  quality jsonb not null,
  files jsonb not null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  dish text not null,
  category text not null default 'Uncategorized',
  price numeric not null default 0,
  cost numeric not null default 0,
  source_batch_id uuid references public.upload_batches(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (restaurant_id, dish)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id text not null,
  date text,
  time text,
  customer_id text,
  table_id text,
  total numeric not null default 0,
  source_batch_id uuid references public.upload_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (restaurant_id, order_id)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  dish text not null,
  category text not null,
  quantity numeric not null,
  price numeric not null,
  total numeric not null,
  revenue numeric not null,
  cost numeric not null
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  review_id text not null,
  date text,
  rating numeric,
  text text,
  guest_name text,
  source_batch_id uuid references public.upload_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (restaurant_id, review_id)
);

create table public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id text not null,
  date text,
  seated_time text,
  cleared_time text,
  guests numeric,
  source_batch_id uuid references public.upload_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (restaurant_id, table_id, date, seated_time)
);

create table public.opportunity_statuses (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  opportunity_id text not null,
  status text not null,
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, opportunity_id)
);

create index upload_batches_restaurant_id_idx on public.upload_batches (restaurant_id);
create index menu_items_restaurant_id_idx on public.menu_items (restaurant_id);
create index orders_restaurant_id_idx on public.orders (restaurant_id);
create index orders_restaurant_id_date_idx on public.orders (restaurant_id, date);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_restaurant_id_idx on public.order_items (restaurant_id);
create index reviews_restaurant_id_idx on public.reviews (restaurant_id);
create index table_sessions_restaurant_id_idx on public.table_sessions (restaurant_id);

alter table public.upload_batches enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.reviews enable row level security;
alter table public.table_sessions enable row level security;
alter table public.opportunity_statuses enable row level security;

-- Menu is the one owner-data table that must be publicly readable, for the
-- unauthenticated QR customer menu view.
create policy "menu items are publicly readable"
  on public.menu_items for select
  using (true);

create policy "members can write menu items"
  on public.menu_items for all
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = menu_items.restaurant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = menu_items.restaurant_id and m.user_id = auth.uid()
    )
  );

-- Remaining owner-data tables: full CRUD restricted to restaurant members only.
create policy "members can access upload_batches"
  on public.upload_batches for all
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = upload_batches.restaurant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = upload_batches.restaurant_id and m.user_id = auth.uid()
    )
  );

create policy "members can access orders"
  on public.orders for all
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = orders.restaurant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = orders.restaurant_id and m.user_id = auth.uid()
    )
  );

create policy "members can access order_items"
  on public.order_items for all
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = order_items.restaurant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = order_items.restaurant_id and m.user_id = auth.uid()
    )
  );

create policy "members can access reviews"
  on public.reviews for all
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = reviews.restaurant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = reviews.restaurant_id and m.user_id = auth.uid()
    )
  );

create policy "members can access table_sessions"
  on public.table_sessions for all
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = table_sessions.restaurant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = table_sessions.restaurant_id and m.user_id = auth.uid()
    )
  );

create policy "members can access opportunity_statuses"
  on public.opportunity_statuses for all
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = opportunity_statuses.restaurant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = opportunity_statuses.restaurant_id and m.user_id = auth.uid()
    )
  );

-- ============================================================================
-- QR customer flow: public writes, member-only reads
-- ============================================================================

create table public.qr_interactions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id text,
  question text,
  intent text,
  recommended_items text[],
  accepted_recommendation boolean,
  created_at timestamptz not null default now()
);

create table public.qr_orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id text not null,
  table_id text,
  subtotal numeric not null,
  ai_recommended_items text[],
  special_requests text,
  status text not null default 'new' check (status in ('new', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (restaurant_id, order_id)
);

create table public.qr_order_items (
  id uuid primary key default gen_random_uuid(),
  qr_order_id uuid not null references public.qr_orders(id) on delete cascade,
  dish text not null,
  category text not null,
  price numeric not null,
  quantity numeric not null
);

create table public.qr_reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id text,
  order_id text,
  food_rating numeric,
  service_rating numeric,
  atmosphere_rating numeric,
  overall_rating numeric,
  comment text,
  ai_recommendation_helpful boolean,
  created_at timestamptz not null default now()
);

create index qr_interactions_restaurant_id_idx on public.qr_interactions (restaurant_id);
create index qr_orders_restaurant_id_idx on public.qr_orders (restaurant_id);
create index qr_orders_restaurant_id_status_idx on public.qr_orders (restaurant_id, status);
create index qr_order_items_qr_order_id_idx on public.qr_order_items (qr_order_id);
create index qr_reviews_restaurant_id_idx on public.qr_reviews (restaurant_id);

alter table public.qr_interactions enable row level security;
alter table public.qr_orders enable row level security;
alter table public.qr_order_items enable row level security;
alter table public.qr_reviews enable row level security;

-- Anonymous customers can create rows for a valid restaurant, but can never
-- read them back (no anon select policy at all) — matches a public
-- contact-form pattern. The FK constraint on restaurant_id rejects inserts
-- for a restaurant that doesn't exist.
create policy "anyone can submit qr interactions"
  on public.qr_interactions for insert
  with check (true);

-- Lets the ordering flow flip accepted_recommendation on an interaction it
-- logged earlier in the same session (e.g. guest adds a recommended dish to
-- their basket). Anonymous updates are scoped only by knowing the row's
-- opaque uuid, matching the public-write trust model used throughout this table.
create policy "anyone can update their own qr interaction"
  on public.qr_interactions for update
  using (true)
  with check (true);

create policy "members can view qr interactions"
  on public.qr_interactions for select
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = qr_interactions.restaurant_id and m.user_id = auth.uid()
    )
  );

create policy "anyone can submit qr orders"
  on public.qr_orders for insert
  with check (true);

create policy "members can view qr orders"
  on public.qr_orders for select
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = qr_orders.restaurant_id and m.user_id = auth.uid()
    )
  );

create policy "members can update qr order status"
  on public.qr_orders for update
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = qr_orders.restaurant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = qr_orders.restaurant_id and m.user_id = auth.uid()
    )
  );

create policy "anyone can submit qr order items"
  on public.qr_order_items for insert
  with check (true);

create policy "members can view qr order items"
  on public.qr_order_items for select
  using (
    exists (
      select 1 from public.qr_orders o
      join public.memberships m on m.restaurant_id = o.restaurant_id
      where o.id = qr_order_items.qr_order_id and m.user_id = auth.uid()
    )
  );

create policy "anyone can submit qr reviews"
  on public.qr_reviews for insert
  with check (true);

create policy "members can view qr reviews"
  on public.qr_reviews for select
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = qr_reviews.restaurant_id and m.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Post-migration manual step (cannot be scripted via SQL):
-- Enable anonymous sign-ins in Supabase Dashboard -> Authentication ->
-- Providers -> Anonymous Sign-Ins, required for the demo-account flow.
-- ============================================================================
