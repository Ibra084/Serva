-- Fixes "infinite recursion detected in policy for relation memberships" (Postgres 42P17).
-- The original SELECT policy on memberships queried memberships from inside its own
-- USING clause. Replaced with a check against restaurants.owner_user_id instead.
--
-- Run this in the Supabase SQL Editor if you already applied 0001_init.sql.

drop policy "members can view their memberships" on public.memberships;

create policy "members can view their memberships"
  on public.memberships for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.restaurants r
      where r.id = memberships.restaurant_id and r.owner_user_id = auth.uid()
    )
  );
