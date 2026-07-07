"use client";

import { useCallback, useEffect, useState } from "react";
import { loadRestaurantData, loadUploadBatches } from "@/lib/data-store";
import type { MenuItem, Order, RestaurantData, UploadBatch } from "@/lib/types";

export function useRestaurantData(restaurantSlug: string) {
  const [data, setData] = useState<RestaurantData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await loadRestaurantData(restaurantSlug);
    setData(result);
    setLoading(false);
  }, [restaurantSlug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const hasData = Boolean(data && (data.orders.length > 0 || data.menu.length > 0 || data.reviews.length > 0));

  return { data, loading, hasData, refresh };
}

export function useUploadBatches(restaurantSlug: string) {
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await loadUploadBatches(restaurantSlug);
    setBatches(result);
    setLoading(false);
  }, [restaurantSlug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { batches, loading, refresh };
}

/** Public, unauthenticated menu read for the QR customer flow — fetches via the server API route rather than direct Supabase access. */
export function useQRMenu(restaurantSlug: string) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/qr/${restaurantSlug}/menu`)
      .then((res) => (res.ok ? res.json() : { menu: [], orders: [] }))
      .then((result: { menu: MenuItem[]; orders: Order[] }) => {
        if (cancelled) return;
        setMenu(result.menu ?? []);
        setOrders(result.orders ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setMenu([]);
        setOrders([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantSlug]);

  const hasData = menu.length > 0;

  return { menu, orders, loading, hasData };
}
