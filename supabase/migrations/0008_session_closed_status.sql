-- Serva: decouple "closed" (archived, removed from the live view) from "paid" (fully settled, still visible).
-- Previously `updateSessionStatus(..., "paid")` also stamped `closed_at`, so `loadLiveSessions`'s
-- `closed_at IS NULL` filter silently dropped a table the instant staff marked it paid. Staff now
-- explicitly close a table via a separate action, which is the only thing that sets `closed_at`.

alter table public.live_table_sessions drop constraint live_table_sessions_status_check;
alter table public.live_table_sessions
  add constraint live_table_sessions_status_check check (
    status in ('empty', 'seated', 'ordering', 'order_placed', 'preparing', 'served', 'ready_to_pay', 'paid', 'closed')
  );
