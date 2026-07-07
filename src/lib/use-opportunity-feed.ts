"use client";

import { useEffect, useMemo, useState } from "react";
import { generateOpportunityFeed } from "@/lib/opportunity-feed";
import { loadOpportunityStatuses, setOpportunityStatus } from "@/lib/opportunity-store";
import { useRestaurantData } from "@/lib/use-restaurant-data";
import type { OpportunityStatus } from "@/lib/types";

export function useOpportunityFeed(restaurantSlug: string) {
  const { data, loading, hasData } = useRestaurantData(restaurantSlug);
  const [statuses, setStatuses] = useState<Record<string, OpportunityStatus>>({});

  useEffect(() => {
    setStatuses(loadOpportunityStatuses(restaurantSlug));
  }, [restaurantSlug]);

  const generated = useMemo(() => (data ? generateOpportunityFeed(data) : []), [data]);

  const opportunities = useMemo(
    () => generated.map((item) => ({ ...item, status: statuses[item.id] ?? item.status })),
    [generated, statuses]
  );

  function updateStatus(id: string, status: OpportunityStatus) {
    setOpportunityStatus(restaurantSlug, id, status);
    setStatuses((prev) => ({ ...prev, [id]: status }));
  }

  return { opportunities, loading, hasData, updateStatus };
}
