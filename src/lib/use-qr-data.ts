"use client";

import { usePortalData } from "@/lib/portal-cache";

/** Reads the shared portal cache (see lib/portal-cache.tsx) — no independent fetch, no refetch on every mount. */
export function useQRData(restaurantSlug: string) {
  void restaurantSlug;
  const { data, loading, refresh } = usePortalData();
  const { interactions, orders, reviews } = data.qr;
  const hasData = interactions.length > 0 || orders.length > 0 || reviews.length > 0;

  return { interactions, orders, reviews, loading, hasData, refresh };
}
