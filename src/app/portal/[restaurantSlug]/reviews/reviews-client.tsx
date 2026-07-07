"use client";

import { useMemo } from "react";
import { Star, Sparkles } from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { PortalEmptyState } from "@/components/portal/empty-state";
import { useRestaurantData } from "@/lib/use-restaurant-data";
import { summarizeReviews } from "@/lib/insights";

export function ReviewsClient({ restaurantSlug }: { restaurantSlug: string }) {
  const { data, loading, hasData } = useRestaurantData(restaurantSlug);
  const summary = useMemo(() => (data ? summarizeReviews(data) : null), [data]);

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
        <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">Reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Guest sentiment across every review you&rsquo;ve uploaded.
        </p>

        {!hasData || !summary || summary.totalReviews === 0 ? (
          <PortalEmptyState
            restaurantSlug={restaurantSlug}
            icon={Star}
            title="No reviews yet"
            description="Upload your reviews export to see rating trends and AI-generated sentiment summaries."
          />
        ) : (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Star className="size-4" />
                </span>
                <p className="mt-3 text-xs text-muted-foreground">Average Rating</p>
                <p className="mt-1 font-serif text-2xl font-medium tracking-tight text-foreground">
                  {summary.averageRating}★
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  from {summary.totalReviews} reviews
                </p>
              </div>

              <div className="rounded-2xl border border-primary/15 bg-card p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">AI Summary</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {summary.aiSummary}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-medium text-foreground">Positive Themes</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {summary.positiveThemes.length > 0 ? (
                    summary.positiveThemes.map((theme) => (
                      <span
                        key={theme}
                        className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground"
                      >
                        {theme}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No recurring themes detected.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-medium text-foreground">Negative Themes</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {summary.negativeThemes.length > 0 ? (
                    summary.negativeThemes.map((theme) => (
                      <span
                        key={theme}
                        className="rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive"
                      >
                        {theme}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No recurring themes detected.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-sm font-medium text-foreground">Recent Reviews</h2>
              <div className="mt-3 flex flex-col gap-3">
                {summary.recentReviews.map((review) => (
                  <div key={review.reviewId} className="rounded-2xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        {review.guestName ?? "Guest"}
                      </p>
                      <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                        <Star className="size-3.5 text-primary" />
                        {review.rating}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{review.date}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{review.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
