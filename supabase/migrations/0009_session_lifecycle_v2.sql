-- Serva: clean session lifecycle rewrite.
-- Previously `live_table_sessions.status` conflated two unrelated things: kitchen/service progress
-- (seated -> ordering -> preparing -> served) and billing progress (ready_to_pay -> paid). Kitchen
-- progress now belongs entirely to each order's own status; the session's status is purely the
-- billing/table lifecycle: active -> bill_requested -> partially_paid -> paid -> closed.
--
-- Each CHECK constraint is dropped *before* its data fixup UPDATE — the new status values (e.g.
-- 'active') aren't allowed by the old constraint, so fixing the data first (as an earlier version
-- of this migration did) fails immediately with a check-constraint violation.

-- ============================================================================
-- live_table_sessions.status
-- ============================================================================

alter table public.live_table_sessions drop constraint live_table_sessions_status_check;

update public.live_table_sessions
  set status = 'active'
  where status in ('empty', 'seated', 'ordering', 'order_placed', 'preparing', 'served');

update public.live_table_sessions
  set status = 'bill_requested'
  where status = 'ready_to_pay';

alter table public.live_table_sessions
  add constraint live_table_sessions_status_check check (
    status in ('active', 'bill_requested', 'partially_paid', 'paid', 'closed')
  );
alter table public.live_table_sessions alter column status set default 'active';

-- ============================================================================
-- live_table_sessions.payment_status
-- ============================================================================

alter table public.live_table_sessions drop constraint live_table_sessions_payment_status_check;

update public.live_table_sessions set payment_status = 'partially_paid' where payment_status = 'partial';

alter table public.live_table_sessions
  add constraint live_table_sessions_payment_status_check check (
    payment_status in ('unpaid', 'partially_paid', 'paid')
  );

-- ============================================================================
-- qr_orders.status: now purely kitchen progress, billing lives on the session.
-- ============================================================================

alter table public.qr_orders drop constraint qr_orders_status_check;

update public.qr_orders set status = 'served' where status in ('ready_to_pay', 'paid', 'completed');

alter table public.qr_orders
  add constraint qr_orders_status_check check (status in ('new', 'preparing', 'served', 'cancelled'));

-- ============================================================================
-- Track real mutation timestamps — the assembled TableSession's `updatedAt` was
-- previously a client-only, localStorage-mirrored concept; now the session lives
-- entirely in Supabase, so it needs its own column.
-- ============================================================================

alter table public.live_table_sessions add column if not exists updated_at timestamptz not null default now();
alter table public.qr_orders add column if not exists updated_at timestamptz not null default now();
