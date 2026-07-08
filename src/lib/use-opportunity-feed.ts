"use client";

import { useMemo } from "react";
import { generateOpportunityFeed } from "@/lib/opportunity-feed";
import { setOpportunityStatus } from "@/lib/opportunity-store";
import { usePortalData } from "@/lib/portal-cache";
import type { OpportunityStatus } from "@/lib/types";

export function useOpportunityFeed(restaurantSlug: string) {
  const { data, loading, hasData, updateOptimistic } = usePortalData();
  const statuses = data.opportunityStatuses;

  const generated = useMemo(() => (data.restaurant ? generateOpportunityFeed(data.restaurant) : []), [data.restaurant]);

  const opportunities = useMemo(
    () => generated.map((item) => ({ ...item, status: statuses[item.id] ?? item.status })),
    [generated, statuses]
  );

  function updateStatus(id: string, status: OpportunityStatus) {
    updateOptimistic((prev) => ({ ...prev, opportunityStatuses: { ...prev.opportunityStatuses, [id]: status } }));
    setOpportunityStatus(restaurantSlug, id, status);
  }

  return { opportunities, loading, hasData, updateStatus };
}
