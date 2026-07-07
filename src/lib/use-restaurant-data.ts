"use client";

import { useEffect, useState } from "react";
import { loadRestaurantData, loadUploadBatches } from "@/lib/data-store";
import type { RestaurantData, UploadBatch } from "@/lib/types";

export function useRestaurantData(restaurantSlug: string) {
  const [data, setData] = useState<RestaurantData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(loadRestaurantData(restaurantSlug));
    setLoading(false);
  }, [restaurantSlug]);

  const hasData = Boolean(data && (data.orders.length > 0 || data.menu.length > 0 || data.reviews.length > 0));

  return { data, loading, hasData };
}

export function useUploadBatches(restaurantSlug: string) {
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => setBatches(loadUploadBatches(restaurantSlug));

  useEffect(() => {
    refresh();
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantSlug]);

  return { batches, loading, refresh };
}
