"use client";

import { useCallback, useEffect, useState } from "react";
import { loadQRInteractions, loadQROrders, loadQRReviews } from "@/lib/qr-store";
import type { QRInteraction, QROrder, QRReview } from "@/lib/types";

export function useQRData(restaurantSlug: string) {
  const [interactions, setInteractions] = useState<QRInteraction[]>([]);
  const [orders, setOrders] = useState<QROrder[]>([]);
  const [reviews, setReviews] = useState<QRReview[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setInteractions(loadQRInteractions(restaurantSlug));
    setOrders(loadQROrders(restaurantSlug));
    setReviews(loadQRReviews(restaurantSlug));
    setLoading(false);
  }, [restaurantSlug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const hasData = interactions.length > 0 || orders.length > 0 || reviews.length > 0;

  return { interactions, orders, reviews, loading, hasData, refresh };
}
