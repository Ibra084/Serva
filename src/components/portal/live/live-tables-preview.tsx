"use client";

import Link from "next/link";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveSessions } from "@/lib/use-live-sessions";
import type { SessionStatus } from "@/lib/session-store";

const STATUS_STYLE: Record<SessionStatus, string> = {
  active: "bg-accent text-accent-foreground",
  bill_requested: "bg-primary/15 text-primary",
  partially_paid: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  closed: "bg-secondary text-muted-foreground",
};

export function LiveTablesPreview({ restaurantSlug }: { restaurantSlug: string }) {
  const { sessions, loading } = useLiveSessions(restaurantSlug);

  const preview = sessions.slice(0, 4);

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
          {preview.map((session) => (
            <div key={session.sessionId} className="rounded-xl bg-secondary/60 px-3 py-2.5">
              <p className="text-sm font-medium text-foreground">{session.tableId}</p>
              <span
                className={cn(
                  "mt-1 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                  STATUS_STYLE[session.status]
                )}
              >
                {session.status.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}
