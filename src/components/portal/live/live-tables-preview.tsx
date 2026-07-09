"use client";

import Link from "next/link";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveFloor } from "@/lib/use-live-data";

const STATUS_STYLE: Record<string, string> = {
  seated: "bg-secondary text-muted-foreground",
  ordering: "bg-accent text-accent-foreground",
  order_placed: "bg-accent text-accent-foreground",
  preparing: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  served: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  ready_to_pay: "bg-primary/15 text-primary",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

export function LiveTablesPreview({ restaurantSlug }: { restaurantSlug: string }) {
  const { tables, sessions, loading } = useLiveFloor(restaurantSlug);

  const sessionByTable = new Map(sessions.map((session) => [session.tableId, session]));
  const preview = tables
    .map((table) => ({ table, session: sessionByTable.get(table.id) ?? null }))
    .filter((entry) => entry.session)
    .slice(0, 4);

  return (
    <Link
      href={`/portal/${restaurantSlug}/live`}
      className="mt-8 block rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-secondary/40"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="size-4 text-primary" />
          <p className="text-sm font-medium text-foreground">Live Tables</p>
        </div>
        <ArrowRight className="size-4 text-muted-foreground" />
      </div>

      {loading ? (
        <div className="mt-3 h-16 w-full animate-pulse rounded-xl bg-secondary" />
      ) : preview.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No tables occupied right now</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {preview.map(({ table, session }) => (
            <div key={table.id} className="rounded-xl bg-secondary/60 px-3 py-2.5">
              <p className="text-sm font-medium text-foreground">{table.tableNumber}</p>
              <span
                className={cn(
                  "mt-1 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                  STATUS_STYLE[session!.status]
                )}
              >
                {session!.status.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}
