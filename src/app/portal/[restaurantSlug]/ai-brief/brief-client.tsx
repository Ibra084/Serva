"use client";

import { useEffect, useState } from "react";
import { Sparkles, TrendingUp, TrendingDown, Target, Lightbulb } from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { PortalEmptyState } from "@/components/portal/empty-state";
import { useRestaurantData } from "@/lib/use-restaurant-data";
import { useWorkspace } from "@/lib/use-workspace";
import { generateDailyBrief } from "@/lib/insights";
import type { DailyBrief } from "@/lib/types";

export function BriefClient({ restaurantSlug }: { restaurantSlug: string }) {
  const { data, loading, hasData } = useRestaurantData(restaurantSlug);
  const { workspace } = useWorkspace(restaurantSlug);
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  useEffect(() => {
    if (!data || !hasData) {
      setBrief(null);
      return;
    }

    let cancelled = false;
    setBriefLoading(true);

    fetch("/api/ai/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setBrief(json.brief);
      })
      .catch(() => {
        if (!cancelled) setBrief(generateDailyBrief(data));
      })
      .finally(() => {
        if (!cancelled) setBriefLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [data, hasData]);

  if (loading || briefLoading) {
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
        <div className="mx-auto max-w-2xl">
          <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
            AI Daily Brief
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{workspace?.name ?? ""}</p>

          {!hasData || !brief ? (
            <PortalEmptyState
              restaurantSlug={restaurantSlug}
              icon={Sparkles}
              title="No brief yet"
              description="Upload your restaurant data to generate today's AI-style daily brief."
            />
          ) : (
            <div className="mt-6 rounded-2xl border border-primary/15 bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Sparkles className="size-4" />
                </span>
                <p className="text-sm font-medium text-foreground">{brief.greeting}</p>
              </div>

              <div className="mt-5 flex flex-col gap-4 text-[0.95rem] leading-relaxed text-muted-foreground">
                <p className="text-foreground">{brief.whatHappened}</p>
                <p>{brief.whyRevenueChanged}</p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-secondary/60 p-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TrendingUp className="size-3.5 text-primary" />
                      Best performer
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">{brief.bestDish}</p>
                  </div>
                  <div className="rounded-xl bg-secondary/60 p-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TrendingDown className="size-3.5 text-destructive" />
                      Needs attention
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">{brief.worstDish}</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-accent/50 p-4">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Target className="size-4" />
                    Missed opportunity
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {brief.missedOpportunity}
                  </p>
                </div>

                <div className="rounded-2xl bg-accent/50 p-4">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Lightbulb className="size-4" />
                    Recommendation
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {brief.recommendedAction}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">Predicted monthly gain</p>
                <p className="font-serif text-lg font-medium text-primary">
                  +AED {brief.estimatedMonthlyGain.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
