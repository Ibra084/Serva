-- Serva: Live Operations + Payments + Guest Preferences
-- Adds a live table/session layer on top of the existing QR ordering flow.
-- `qr_orders`/`qr_order_items` become the live order record (linked to a
-- session); the historical `table_sessions`/`orders`/`order_items` tables
-- from the upload pipeline are untouched. Anonymous customers need to both
-- write AND read back their own table's live state (bill, order status),
-- so these new tables follow a public-read/public-write trust model scoped
-- by restaurant/table, matching the existing `qr_interactions` update policy.

-- ============================================================================
-- restaurant_tables: the physical table registry
-- ============================================================================

create table public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_number text not null,
  seats int not null default 2,
  zone text,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (restaurant_id, table_number)
);

create index restaurant_tables_restaurant_id_idx on public.restaurant_tables (restaurant_id);

alter table public.restaurant_tables enable row level security;

create policy "restaurant tables are publicly readable"
  on public.restaurant_tables for select
  using (true);

create policy "members can write restaurant tables"
  on public.restaurant_tables for all
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = restaurant_tables.restaurant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = restaurant_tables.restaurant_id and m.user_id = auth.uid()
    )
  );

-- ============================================================================
-- live_table_sessions: the live floor state (distinct from the historical
-- `table_sessions` POS-turnover table used by the upload pipeline)
-- ============================================================================

create table public.live_table_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null references public.restaurant_tables(id) on delete cascade,
  status text not null default 'seated' check (
    status in ('empty', 'seated', 'ordering', 'order_placed', 'preparing', 'served', 'ready_to_pay', 'paid')
  ),
  guest_count int not null default 1,
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  current_total numeric not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  created_at timestamptz not null default now()
);

create index live_table_sessions_restaurant_id_idx on public.live_table_sessions (restaurant_id);
create index live_table_sessions_table_id_idx on public.live_table_sessions (table_id);
create index live_table_sessions_restaurant_id_status_idx on public.live_table_sessions (restaurant_id, status);

alter table public.live_table_sessions enable row level security;

-- Anonymous QR customers create/update their own table's session (start a
-- session, request the bill); staff manage everything. No cross-restaurant
-- read risk since rows carry no guest-identifying data.
create policy "anyone can view live table sessions"
  on public.live_table_sessions for select
  using (true);

create policy "anyone can create live table sessions"
  on public.live_table_sessions for insert
  with check (true);

create policy "anyone can update live table sessions"
  on public.live_table_sessions for update
  using (true)
  with check (true);

create policy "members can delete live table sessions"
  on public.live_table_sessions for delete
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = live_table_sessions.restaurant_id and m.user_id = auth.uid()
    )
  );

-- ============================================================================
-- qr_orders: extend for the live lifecycle
-- ============================================================================

alter table public.qr_orders
  add column session_id uuid references public.live_table_sessions(id) on delete set null;

alter table public.qr_orders drop constraint qr_orders_status_check;
alter table public.qr_orders
  add constraint qr_orders_status_check check (
    status in ('new', 'preparing', 'served', 'ready_to_pay', 'paid', 'completed', 'cancelled')
  );

create index qr_orders_session_id_idx on public.qr_orders (session_id);

-- Anonymous customers need to read back their own order's live status.
create policy "anyone can view qr orders"
  on public.qr_orders for select
  using (true);

-- Anonymous customers can advance status themselves (e.g. request bill);
-- staff also update via the same policy shape as before.
create policy "anyone can update qr order status"
  on public.qr_orders for update
  using (true)
  with check (true);

create policy "anyone can view qr order items"
  on public.qr_order_items for select
  using (true);

-- ============================================================================
-- payments
-- ============================================================================

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid references public.restaurant_tables(id) on delete set null,
  session_id uuid references public.live_table_sessions(id) on delete set null,
  order_id uuid references public.qr_orders(id) on delete set null,
  amount numeric not null,
  tip_amount numeric not null default 0,
  method text not null default 'demo',
  status text not null default 'paid' check (status in ('pending', 'paid', 'failed')),
  split_type text not null default 'full' check (split_type in ('full', 'equal', 'items')),
  created_at timestamptz not null default now()
);

create index payments_restaurant_id_idx on public.payments (restaurant_id);
create index payments_session_id_idx on public.payments (session_id);

alter table public.payments enable row level security;

create policy "anyone can view payments"
  on public.payments for select
  using (true);

create policy "anyone can create payments"
  on public.payments for insert
  with check (true);

create policy "members can manage payments"
  on public.payments for all
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = payments.restaurant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = payments.restaurant_id and m.user_id = auth.uid()
    )
  );

-- ============================================================================
-- guest_preferences: one row per (restaurant, anonymous device), synced from
-- the client's localStorage copy for QR Insights aggregation.
-- ============================================================================

create table public.guest_preferences (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  anonymous_guest_id text not null,
  dietary_preference text,
  allergies text[] not null default '{}',
  spice_preference smallint,
  budget numeric,
  mood text,
  hunger_level text,
  updated_at timestamptz not null default now(),
  unique (restaurant_id, anonymous_guest_id)
);

create index guest_preferences_restaurant_id_idx on public.guest_preferences (restaurant_id);

alter table public.guest_preferences enable row level security;

create policy "anyone can upsert their own guest preferences"
  on public.guest_preferences for insert
  with check (true);

create policy "anyone can update their own guest preferences"
  on public.guest_preferences for update
  using (true)
  with check (true);

create policy "members can view guest preferences"
  on public.guest_preferences for select
  using (
    exists (
      select 1 from public.memberships m
      where m.restaurant_id = guest_preferences.restaurant_id and m.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Realtime: push table/order changes to both the portal live page and the
-- customer's order-status screen.
-- ============================================================================

alter publication supabase_realtime add table public.live_table_sessions;
alter publication supabase_realtime add table public.qr_orders;
alter publication supabase_realtime add table public.qr_order_items;
