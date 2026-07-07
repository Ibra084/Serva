"use client";

import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import { useOpportunityFeed } from "@/lib/use-opportunity-feed";

export function OpportunityFeedPreview({ restaurantSlug }: { restaurantSlug: string }) {
  const { opportunities, hasData } = useOpportunityFeed(restaurantSlug);

  if (!hasData || opportunities.length === 0) return null;

  const preview = opportunities.filter((item) => item.status !== "dismissed").slice(0, 3);
  if (preview.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">Opportunity Feed</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Detected opportunities across pricing, promotion, staffing, and quality
          </p>
        </div>
        <Link
          href={`/portal/${restaurantSlug}/opportunities`}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View all
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {preview.map((item) => (
          <Link
            key={item.id}
            href={`/portal/${restaurantSlug}/opportunities`}
            className="rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary/40"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Target className="size-3.5" />
              </span>
              <span className="inline-block rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {item.priority} priority
              </span>
            </div>
            <p className="mt-2.5 text-sm font-medium text-foreground">{item.title}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {item.explanation}
            </p>
            {item.estimatedMonthlyGain > 0 && (
              <p className="mt-2 text-xs font-medium text-primary">
                +AED {item.estimatedMonthlyGain.toLocaleString()}/mo
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
