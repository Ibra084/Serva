"use client";

import { Plus, UtensilsCrossed } from "lucide-react";
import type { MenuItem } from "@/lib/types";

export function RecommendationCard({
  item,
  reason,
  onAdd,
}: {
  item: MenuItem;
  reason?: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.dish} className="size-full object-cover" />
        ) : (
          <UtensilsCrossed className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-medium text-foreground">{item.dish}</p>
            <span className="shrink-0 text-sm font-medium text-primary">AED {item.price}</span>
          </div>
          {reason && <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{reason}</p>}
        </div>
        <button
          onClick={onAdd}
          className="flex w-fit items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
        >
          <Plus className="size-3" />
          Add to order
        </button>
      </div>
    </div>
  );
}
