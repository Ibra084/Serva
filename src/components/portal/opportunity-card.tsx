"use client";

import { Bookmark, BookmarkCheck, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FeedOpportunity, OpportunityStatus } from "@/lib/types";

const PRIORITY_STYLE: Record<FeedOpportunity["priority"], string> = {
  high: "bg-primary text-primary-foreground",
  medium: "bg-accent text-accent-foreground",
  low: "bg-secondary text-secondary-foreground",
};

const STATUS_LABEL: Record<OpportunityStatus, string> = {
  new: "New",
  saved: "Saved",
  dismissed: "Dismissed",
  completed: "Completed",
};

export function OpportunityCard({
  opportunity,
  onUpdateStatus,
}: {
  opportunity: FeedOpportunity;
  onUpdateStatus: (id: string, status: OpportunityStatus) => void;
}) {
  const { id, title, category, explanation, estimatedMonthlyGain, confidence, priority, sourceData, status } =
    opportunity;

  function toggle(target: OpportunityStatus) {
    onUpdateStatus(id, status === target ? "new" : target);
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-opacity",
        status === "dismissed" && "opacity-60"
      )}
    >
      <div className="flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={PRIORITY_STYLE[priority]}>{priority} priority</Badge>
            <Badge variant="outline">{category}</Badge>
          </div>
          <Badge
            variant={
              status === "completed" ? "default" : status === "dismissed" ? "destructive" : "secondary"
            }
          >
            {STATUS_LABEL[status]}
          </Badge>
        </div>

        <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{explanation}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {estimatedMonthlyGain > 0 && (
            <span className="inline-block rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
              +AED {estimatedMonthlyGain.toLocaleString()} / mo
            </span>
          )}
          <span className="inline-block rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {confidence}% confidence
          </span>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Source: </span>
          {sourceData}
        </p>
      </div>

      <div className="mt-4 flex flex-col flex-wrap gap-2 border-t border-border pt-3.5 lg:flex-row">
        <button
          onClick={() => toggle("saved")}
          className={cn(
            "group inline-flex w-full items-center justify-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-150 ease-out hover:scale-[1.02] active:scale-100 lg:w-auto lg:flex-1",
            status === "saved"
              ? "border-transparent bg-accent text-accent-foreground"
              : "border-border bg-transparent text-foreground hover:bg-secondary"
          )}
        >
          {status === "saved" ? (
            <BookmarkCheck className="size-3.5 transition-transform duration-150 group-hover:scale-110" />
          ) : (
            <Bookmark className="size-3.5 transition-transform duration-150 group-hover:scale-110" />
          )}
          {status === "saved" ? "Saved" : "Save"}
        </button>

        <button
          onClick={() => toggle("completed")}
          className={cn(
            "group inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-all duration-150 ease-out hover:scale-[1.02] active:scale-100 lg:w-auto lg:flex-1",
            status === "completed" ? "bg-[var(--accent-hover)]" : "bg-primary hover:bg-[var(--accent-hover)]"
          )}
        >
          <CheckCircle2 className="size-3.5 transition-transform duration-150 group-hover:scale-110" />
          {status === "completed" ? "Completed" : "Mark Complete"}
        </button>

        <button
          onClick={() => toggle("dismissed")}
          className={cn(
            "group inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150 ease-out hover:scale-[1.02] hover:bg-destructive/10 active:scale-100 lg:w-auto lg:flex-1",
            status === "dismissed" ? "text-destructive" : "text-muted-foreground hover:text-destructive"
          )}
        >
          <XCircle className="size-3.5 transition-transform duration-150 group-hover:scale-110" />
          {status === "dismissed" ? "Dismissed" : "Dismiss"}
        </button>
      </div>
    </div>
  );
}
