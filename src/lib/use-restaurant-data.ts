"use client";

import { useEffect, useState } from "react";
import { usePortalData } from "@/lib/portal-cache";
import { DEFAULT_MENU_APPEARANCE, type MenuAppearanceSettings, type MenuCategory } from "@/lib/menu-types";
import type { MenuItem, Order } from "@/lib/types";

/** Reads the shared portal cache (see lib/portal-cache.tsx) — no independent fetch, no refetch on every mount. */
export function useRestaurantData(restaurantSlug: string) {
  void restaurantSlug;
  const { data, loading, hasData, refresh } = usePortalData();
  return { data: data.restaurant, loading, hasData, refresh };
}

export function useUploadBatches(restaurantSlug: string) {
  void restaurantSlug;
  const { data, loading, refresh } = usePortalData();
  return { batches: data.uploadBatches, loading, refresh };
}

/** Public, unauthenticated menu read for the QR customer flow — fetches via the server API route rather than direct Supabase access. */
export function useQRMenu(restaurantSlug: string) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [appearance, setAppearance] = useState<MenuAppearanceSettings>(DEFAULT_MENU_APPEARANCE);
  const [totalItemCount, setTotalItemCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/qr/${restaurantSlug}/menu`)
      .then((res) =>
        res.ok ? res.json() : { menu: [], orders: [], categories: [], appearance: DEFAULT_MENU_APPEARANCE, totalItemCount: 0 }
      )
      .then(
        (result: {
          menu: MenuItem[];
          orders: Order[];
          categories: MenuCategory[];
          appearance: MenuAppearanceSettings;
          totalItemCount: number;
        }) => {
          if (cancelled) return;
          setMenu(result.menu ?? []);
          setOrders(result.orders ?? []);
          setCategories(result.categories ?? []);
          setAppearance(result.appearance ?? DEFAULT_MENU_APPEARANCE);
          setTotalItemCount(result.totalItemCount ?? 0);
          setLoading(false);
        }
      )
      .catch(() => {
        if (cancelled) return;
        setMenu([]);
        setOrders([]);
        setCategories([]);
        setAppearance(DEFAULT_MENU_APPEARANCE);
        setTotalItemCount(0);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantSlug]);

  const hasData = menu.length > 0;

  return { menu, orders, categories, appearance, totalItemCount, loading, hasData };
}
