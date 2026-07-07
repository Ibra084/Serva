"use client";

import { useMemo, useState } from "react";
import { Target } from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { PortalEmptyState } from "@/components/portal/empty-state";
import { OpportunityCard } from "@/components/portal/opportunity-card";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { useOpportunityFeed } from "@/lib/use-opportunity-feed";
import type { OpportunityStatus } from "@/lib/types";

const FILTERS: { label: string; value: OpportunityStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "New", value: "new" },
  { label: "Saved", value: "saved" },
  { label: "Completed", value: "completed" },
  { label: "Dismissed", value: "dismissed" },
];

export function OpportunitiesClient({ restaurantSlug }: { restaurantSlug: string }) {
  const { opportunities, loading, hasData, updateStatus } = useOpportunityFeed(restaurantSlug);
  const [filter, setFilter] = useState<OpportunityStatus | "all">("all");

  const filtered = useMemo(
    () => (filter === "all" ? opportunities : opportunities.filter((item) => item.status === filter)),
    [opportunities, filter]
  );

  const openValue = useMemo(
    () =>
      opportunities
        .filter((item) => item.status !== "dismissed" && item.status !== "completed")
        .reduce((sum, item) => sum + item.estimatedMonthlyGain, 0),
    [opportunities]
  );

  if (loading) {
    return (
      <>
        <PortalTopbar restaurantSlug={restaurantSlug} />
        <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
          <div className="h-64 w-full animate-pulse rounded-2xl bg-secondary" />
        </main>
      </>
    );
  }

  return (
    <>
      <PortalTopbar restaurantSlug={restaurantSlug} />
      <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
              Opportunity Feed
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Revenue and operations opportunities detected from your uploaded data.
            </p>
          </div>
          {opportunities.length > 0 && (
            <div className="shrink-0 rounded-2xl border border-primary/15 bg-card px-5 py-3 text-right">
              <p className="text-xs text-muted-foreground">Open opportunity value</p>
              <p className="font-serif text-lg font-medium text-primary">
                +AED {openValue.toLocaleString()}/mo
              </p>
            </div>
          )}
        </div>

        {!hasData ? (
          <PortalEmptyState
            restaurantSlug={restaurantSlug}
            icon={Target}
            title="No opportunities yet"
            description="Upload order, menu, review, and table data to generate your opportunity feed."
          />
        ) : opportunities.length === 0 ? (
          <PortalEmptyState
            restaurantSlug={restaurantSlug}
            icon={Target}
            title="No opportunities detected"
            description="Upload more order history to unlock recommendations."
          />
        ) : (
          <Tabs
            value={filter}
            onValueChange={(value) => setFilter(value as OpportunityStatus | "all")}
            className="mt-6"
          >
            <TabsList className="max-w-full overflow-x-auto">
              {FILTERS.map((item) => (
                <TabsTab key={item.value} value={item.value} className="shrink-0">
                  {item.label}{" "}
                  <span className="text-xs text-muted-foreground">
                    (
                    {item.value === "all"
                      ? opportunities.length
                      : opportunities.filter((o) => o.status === item.value).length}
                    )
                  </span>
                </TabsTab>
              ))}
            </TabsList>
            <TabsPanel value={filter}>
              {filtered.length === 0 ? (
                <p className="mt-6 text-sm text-muted-foreground">No opportunities in this view.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((opportunity) => (
                    <OpportunityCard
                      key={opportunity.id}
                      opportunity={opportunity}
                      onUpdateStatus={updateStatus}
                    />
                  ))}
                </div>
              )}
            </TabsPanel>
          </Tabs>
        )}
      </main>
    </>
  );
}
