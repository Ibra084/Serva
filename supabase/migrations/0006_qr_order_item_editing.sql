-- Serva: allow the customer's short post-submit edit window to update an order's line items.
-- `qr_order_items` previously only had public insert/select policies; editing/resubmitting an
-- order (add/remove/change quantity) needs public update+delete too, scoped the same way as the
-- rest of the anonymous QR-flow trust model (public write, no cross-restaurant read risk).

create policy "anyone can update qr order items"
  on public.qr_order_items for update
  using (true)
  with check (true);

create policy "anyone can delete qr order items"
  on public.qr_order_items for delete
  using (true);
