"use client";

import { useEffect } from "react";
import { usePortalData } from "@/lib/portal-cache";
import { subscribeToSessionsChanged } from "@/lib/session-store";

/** Reads the shared portal cache (see lib/portal-cache.tsx) — no independent fetch, no refetch on every mount. Also reloads whenever a session/order/payment changes anywhere (this tab, another tab, or realtime), so QR insights and dashboard QR widgets stay in sync with the live view. */
export function useQRData(restaurantSlug: string) {
  void restaurantSlug;
  const { data, loading, refresh } = usePortalData();
  const { interactions, orders, reviews } = data.qr;
  const hasData = interactions.length > 0 || orders.length > 0 || reviews.length > 0;

  useEffect(() => subscribeToSessionsChanged(refresh), [refresh]);

  return { interactions, orders, reviews, loading, hasData, refresh };
}
