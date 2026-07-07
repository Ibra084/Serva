"use client";

import { Sparkles } from "lucide-react";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import { ExplainInsightPanel } from "@/components/portal/explain-insight-panel";
import type { RestaurantData, TracedInsight } from "@/lib/types";

export function InsightCard({ insight, data }: { insight: TracedInsight; data: RestaurantData }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Sparkles className="size-4" />
      </span>
      <p className="mt-3 text-sm font-medium text-foreground">{insight.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{insight.explanation}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {insight.estimatedMonthlyGain !== undefined && insight.estimatedMonthlyGain > 0 ? (
          <span className="inline-block rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
            +AED {insight.estimatedMonthlyGain.toLocaleString()} / mo
          </span>
        ) : insight.value ? (
          <span className="inline-block rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
            {insight.value}
          </span>
        ) : null}
        <span className="inline-block rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {insight.trace.confidence}% confidence
        </span>
      </div>

      <Sheet>
        <SheetTrigger className="mt-3 text-xs font-medium text-primary underline-offset-4 hover:underline">
          Explain this insight
        </SheetTrigger>
        <ExplainInsightPanel insight={insight} data={data} />
      </Sheet>
    </div>
  );
}
