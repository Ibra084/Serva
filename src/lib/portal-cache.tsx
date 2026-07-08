"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { loadRestaurantData, loadUploadBatches } from "@/lib/data-store";
import { loadQRInteractions, loadQROrders, loadQRReviews } from "@/lib/qr-store";
import { loadOpportunityStatuses } from "@/lib/opportunity-store";
import { loadMenuAppearance } from "@/lib/menu-appearance-store";
import { DEFAULT_MENU_APPEARANCE, type MenuAppearanceSettings } from "@/lib/menu-types";
import type { OpportunityStatus, QRInteraction, QROrder, QRReview, RestaurantData, UploadBatch } from "@/lib/types";

export interface PortalCacheData {
  restaurant: RestaurantData | null;
  uploadBatches: UploadBatch[];
  qr: { interactions: QRInteraction[]; orders: QROrder[]; reviews: QRReview[] };
  opportunityStatuses: Record<string, OpportunityStatus>;
  menuAppearance: MenuAppearanceSettings;
}

function emptyPortalData(): PortalCacheData {
  return {
    restaurant: null,
    uploadBatches: [],
    qr: { interactions: [], orders: [], reviews: [] },
    opportunityStatuses: {},
    menuAppearance: DEFAULT_MENU_APPEARANCE,
  };
}

interface PortalCacheEntry {
  data?: PortalCacheData;
  promise?: Promise<PortalCacheData>;
  fetchedAt?: number;
  listeners: Set<(data: PortalCacheData) => void>;
}

const portalCache = new Map<string, PortalCacheEntry>();
const STALE_MS = 60_000;

function getCacheEntry(restaurantSlug: string): PortalCacheEntry {
  let entry = portalCache.get(restaurantSlug);
  if (!entry) {
    entry = { listeners: new Set() };
    portalCache.set(restaurantSlug, entry);
  }
  return entry;
}

async function fetchPortalData(restaurantSlug: string): Promise<PortalCacheData> {
  const entry = getCacheEntry(restaurantSlug);
  if (entry.promise) return entry.promise;

  entry.promise = Promise.all([
    loadRestaurantData(restaurantSlug),
    loadUploadBatches(restaurantSlug),
    loadQRInteractions(restaurantSlug),
    loadQROrders(restaurantSlug),
    loadQRReviews(restaurantSlug),
    loadOpportunityStatuses(restaurantSlug),
    loadMenuAppearance(restaurantSlug),
  ]).then(([restaurant, uploadBatches, interactions, orders, reviews, opportunityStatuses, menuAppearance]) => {
    const data: PortalCacheData = {
      restaurant,
      uploadBatches,
      qr: { interactions, orders, reviews },
      opportunityStatuses,
      menuAppearance,
    };
    entry.data = data;
    entry.fetchedAt = Date.now();
    entry.promise = undefined;
    for (const listener of entry.listeners) listener(data);
    return data;
  });

  return entry.promise;
}

/** Kicks off (or reuses an in-flight) fetch of every core portal dataset for a restaurant. Call as early as possible. */
export function preloadPortalData(restaurantSlug: string): Promise<PortalCacheData> {
  return fetchPortalData(restaurantSlug);
}

/** Forces a refetch. `silent` (default) updates listeners without anyone needing to show a loading state. */
export function refreshPortalData(restaurantSlug: string, options?: { silent?: boolean }): Promise<PortalCacheData> {
  const entry = getCacheEntry(restaurantSlug);
  entry.promise = undefined;
  if (!options?.silent) entry.data = undefined;
  return fetchPortalData(restaurantSlug);
}

/** Synchronously mutates the cached entry and notifies subscribers — for optimistic UI. */
export function updatePortalDataOptimistic(
  restaurantSlug: string,
  updater: (previous: PortalCacheData) => PortalCacheData
): void {
  const entry = getCacheEntry(restaurantSlug);
  const next = updater(entry.data ?? emptyPortalData());
  entry.data = next;
  entry.fetchedAt = Date.now();
  for (const listener of entry.listeners) listener(next);
}

interface PortalDataContextValue {
  data: PortalCacheData;
  loading: boolean;
  hasData: boolean;
  refresh: () => Promise<void>;
  updateOptimistic: (updater: (previous: PortalCacheData) => PortalCacheData) => void;
}

const PortalDataContext = createContext<PortalDataContextValue | null>(null);

export function PortalDataProvider({
  restaurantSlug,
  children,
}: {
  restaurantSlug: string;
  children: React.ReactNode;
}) {
  const cached = portalCache.get(restaurantSlug)?.data;
  const [data, setData] = useState<PortalCacheData>(cached ?? emptyPortalData());
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    const entry = getCacheEntry(restaurantSlug);
    const listener = (next: PortalCacheData) => {
      setData(next);
      setLoading(false);
    };
    entry.listeners.add(listener);

    if (entry.data) {
      setData(entry.data);
      setLoading(false);
      const isStale = !entry.fetchedAt || Date.now() - entry.fetchedAt > STALE_MS;
      if (isStale) refreshPortalData(restaurantSlug, { silent: true });
    } else {
      setLoading(true);
      preloadPortalData(restaurantSlug).then(listener);
    }

    return () => {
      entry.listeners.delete(listener);
    };
  }, [restaurantSlug]);

  const refresh = useCallback(async () => {
    await refreshPortalData(restaurantSlug);
  }, [restaurantSlug]);

  const updateOptimistic = useCallback(
    (updater: (previous: PortalCacheData) => PortalCacheData) => {
      updatePortalDataOptimistic(restaurantSlug, updater);
    },
    [restaurantSlug]
  );

  const hasData = Boolean(
    data.restaurant && (data.restaurant.orders.length > 0 || data.restaurant.menu.length > 0 || data.restaurant.reviews.length > 0)
  );

  return (
    <PortalDataContext.Provider value={{ data, loading, hasData, refresh, updateOptimistic }}>
      {children}
    </PortalDataContext.Provider>
  );
}

export function usePortalData(): PortalDataContextValue {
  const context = useContext(PortalDataContext);
  if (!context) throw new Error("usePortalData must be used within a PortalDataProvider");
  return context;
}
