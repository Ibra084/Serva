"use client";

import { useMemo } from "react";
import { LayoutGrid } from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { TableCard } from "@/components/portal/live/table-card";
import { RecentOrdersPanel } from "@/components/portal/live/recent-orders-panel";
import { useLiveFloor } from "@/lib/use-live-data";
import { cancelOrder } from "@/lib/live-store";
import { closeSession, markSessionPaid, requestBillForSession, updateOrderStatus } from "@/lib/table-session-store";

export function LiveClient({ restaurantSlug }: { restaurantSlug: string }) {
  const { tables, sessions, loading, refresh } = useLiveFloor(restaurantSlug);

  const summaryByTable = useMemo(() => {
    const map = new Map<string, (typeof sessions)[number]>();
    for (const summary of sessions) map.set(summary.table.id, summary);
    return map;
  }, [sessions]);

  const allOrders = useMemo(() => sessions.flatMap((summary) => summary.orders), [sessions]);

  const occupiedCount = sessions.filter((summary) => summary.session.status !== "paid").length;

  async function act(fn: () => Promise<void>) {
    await fn();
    refresh();
  }

  return (
    <>
      <PortalTopbar restaurantSlug={restaurantSlug} />
      <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
        <div className="flex items-center gap-2">
          <LayoutGrid className="size-5 text-primary" />
          <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">Live Operations</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {occupiedCount} of {tables.length} tables occupied right now
        </p>

        {loading && tables.length === 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-2xl bg-secondary" />
            ))}
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tables.map((table) => {
              const summary = summaryByTable.get(table.id) ?? null;
              return (
                <TableCard
                  key={table.id}
                  table={table}
                  session={summary?.session ?? null}
                  orders={summary?.orders ?? []}
                  guestCount={summary?.participants.length ?? 0}
                  amountPaid={summary?.paid ?? 0}
                  remaining={summary?.remaining ?? 0}
                  onMarkPreparing={(orderId) => act(() => updateOrderStatus(restaurantSlug, orderId, "preparing"))}
                  onMarkServed={(orderId) => act(() => updateOrderStatus(restaurantSlug, orderId, "served"))}
                  onMarkReadyToPay={(sessionId) => act(() => requestBillForSession(restaurantSlug, sessionId))}
                  onMarkPaid={(sessionId) => act(() => markSessionPaid(restaurantSlug, sessionId))}
                  onCloseTable={(sessionId) => act(() => closeSession(restaurantSlug, sessionId))}
                  onCancelOrder={(orderId) => act(() => cancelOrder(restaurantSlug, orderId))}
                />
              );
            })}
          </div>
        )}

        <div className="mt-8">
          <RecentOrdersPanel orders={allOrders} loading={loading} />
        </div>
      </main>
    </>
  );
}
