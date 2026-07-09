-- Serva: Menu item image uploads
-- Public storage bucket for dish photos uploaded from the Menu Builder.
-- Objects are stored under `${restaurant_id}/...` so RLS can scope writes
-- to members of that restaurant, matching the pattern used by menu_items.

insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

create policy "menu images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'menu-images');

create policy "members can upload menu images"
  on storage.objects for insert
  with check (
    bucket_id = 'menu-images'
    and exists (
      select 1 from public.memberships m
      where m.restaurant_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()
    )
  );

create policy "members can update menu images"
  on storage.objects for update
  using (
    bucket_id = 'menu-images'
    and exists (
      select 1 from public.memberships m
      where m.restaurant_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()
    )
  );

create policy "members can delete menu images"
  on storage.objects for delete
  using (
    bucket_id = 'menu-images'
    and exists (
      select 1 from public.memberships m
      where m.restaurant_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()
    )
  );
