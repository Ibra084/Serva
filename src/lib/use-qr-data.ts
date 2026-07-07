"use client";

import { useCallback, useEffect, useState } from "react";
import { loadQRInteractions, loadQROrders, loadQRReviews } from "@/lib/qr-store";
import type { QRInteraction, QROrder, QRReview } from "@/lib/types";

export function useQRData(restaurantSlug: string) {
  const [interactions, setInteractions] = useState<QRInteraction[]>([]);
  const [orders, setOrders] = useState<QROrder[]>([]);
  const [reviews, setReviews] = useState<QRReview[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [nextInteractions, nextOrders, nextReviews] = await Promise.all([
      loadQRInteractions(restaurantSlug),
      loadQROrders(restaurantSlug),
      loadQRReviews(restaurantSlug),
    ]);
    setInteractions(nextInteractions);
    setOrders(nextOrders);
    setReviews(nextReviews);
    setLoading(false);
  }, [restaurantSlug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const hasData = interactions.length > 0 || orders.length > 0 || reviews.length > 0;

  return { interactions, orders, reviews, loading, hasData, refresh };
}
