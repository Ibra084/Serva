-- Serva: multi-device table sessions + bill splitting.
-- One `live_table_sessions` row is already the shared, table-wide session; this adds the
-- per-device participants joining that session, and lets payments attribute to a participant
-- and a split mode. Same anonymous public-read/public-write trust model as the rest of the
-- live-operations tables (rows carry no guest-identifying data beyond a self-chosen display name).

create table public.table_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_table_sessions(id) on delete cascade,
  device_id text not null,
  display_name text not null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true,
  amount_paid numeric not null default 0,
  assigned_items jsonb,
  unique (session_id, device_id)
);

create index table_participants_session_id_idx on public.table_participants (session_id);

alter table public.table_participants enable row level security;

create policy "anyone can view table participants"
  on public.table_participants for select
  using (true);

create policy "anyone can create table participants"
  on public.table_participants for insert
  with check (true);

create policy "anyone can update table participants"
  on public.table_participants for update
  using (true)
  with check (true);

create policy "members can delete table participants"
  on public.table_participants for delete
  using (
    exists (
      select 1 from public.live_table_sessions s
      join public.memberships m on m.restaurant_id = s.restaurant_id
      where s.id = table_participants.session_id and m.user_id = auth.uid()
    )
  );

alter publication supabase_realtime add table public.table_participants;

-- ============================================================================
-- payments: attribute to a participant, allow "custom" split mode
-- ============================================================================

alter table public.payments
  add column participant_id uuid references public.table_participants(id) on delete set null;

alter table public.payments drop constraint payments_split_type_check;
alter table public.payments
  add constraint payments_split_type_check check (split_type in ('full', 'equal', 'custom', 'items'));
