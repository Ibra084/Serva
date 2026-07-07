"use client";

import { useMemo } from "react";
import { UserCheck, Clock, Wallet, Smile, Users, ThumbsDown, ThumbsUp } from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { PortalEmptyState } from "@/components/portal/empty-state";
import { useRestaurantData } from "@/lib/use-restaurant-data";
import { calculateGuestInsights } from "@/lib/insights";

export function GuestsClient({ restaurantSlug }: { restaurantSlug: string }) {
  const { data, loading, hasData } = useRestaurantData(restaurantSlug);
  const insights = useMemo(() => (data ? calculateGuestInsights(data) : null), [data]);

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
        <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          Guest Insights
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who&rsquo;s dining with you, how often, and what they&rsquo;re saying.
        </p>

        {!hasData || !insights ? (
          <PortalEmptyState
            restaurantSlug={restaurantSlug}
            icon={Users}
            title="No guest data yet"
            description="Upload orders, tables, and reviews to see returning guest rate, spend, and satisfaction."
          />
        ) : (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <UserCheck className="size-4" />
                </span>
                <p className="mt-3 text-xs text-muted-foreground">Returning Guests</p>
                <p className="mt-1 font-serif text-xl font-medium tracking-tight text-foreground">
                  {insights.returningGuestRate !== null ? `${insights.returningGuestRate}%` : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Wallet className="size-4" />
                </span>
                <p className="mt-3 text-xs text-muted-foreground">Average Spend</p>
                <p className="mt-1 font-serif text-xl font-medium tracking-tight text-foreground">
                  AED {insights.averageSpend.toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Clock className="size-4" />
                </span>
                <p className="mt-3 text-xs text-muted-foreground">Average Visit</p>
                <p className="mt-1 font-serif text-xl font-medium tracking-tight text-foreground">
                  {insights.averageVisitMinutes !== null ? `${insights.averageVisitMinutes} mins` : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Smile className="size-4" />
                </span>
                <p className="mt-3 text-xs text-muted-foreground">Satisfaction Score</p>
                <p className="mt-1 font-serif text-xl font-medium tracking-tight text-foreground">
                  {insights.satisfactionScore !== null ? `${insights.satisfactionScore}★` : "—"}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="size-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">Common Compliments</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {insights.commonCompliments.length > 0 ? (
                    insights.commonCompliments.map((theme) => (
                      <span
                        key={theme}
                        className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground"
                      >
                        {theme}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Not enough reviews yet.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <ThumbsDown className="size-4 text-destructive" />
                  <p className="text-sm font-medium text-foreground">Common Complaints</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {insights.commonComplaints.length > 0 ? (
                    insights.commonComplaints.map((theme) => (
                      <span
                        key={theme}
                        className="rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive"
                      >
                        {theme}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No recurring complaints detected.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-sm font-medium text-foreground">Peak Hours</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {insights.peakHours.length > 0 ? (
                  insights.peakHours.map((hour) => (
                    <span
                      key={hour}
                      className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground"
                    >
                      {hour}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Not enough timestamped orders yet to detect peak hours.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
