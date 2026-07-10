"use client";

import { useMemo } from "react";
import { LayoutGrid } from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { TableCard } from "@/components/portal/live/table-card";
import { RecentOrdersPanel } from "@/components/portal/live/recent-orders-panel";
import { SessionDebugPanel } from "@/components/qr/session-debug-panel";
import { useLiveSessions } from "@/lib/use-live-sessions";
import { closeSession, markPaid, requestBill, updateOrderStatus } from "@/lib/session-store";

export function LiveClient({ restaurantSlug }: { restaurantSlug: string }) {
  const { tables, sessions, loading, refresh } = useLiveSessions(restaurantSlug);

  const sessionByTableNumber = useMemo(() => {
    const map = new Map<string, (typeof sessions)[number]>();
    for (const session of sessions) map.set(session.tableId, session);
    return map;
  }, [sessions]);

  const allOrders = useMemo(() => sessions.flatMap((session) => session.orders), [sessions]);
  const occupiedCount = sessions.filter((session) => session.status !== "paid").length;

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
              const session = sessionByTableNumber.get(table.tableNumber) ?? null;
              return (
                <TableCard
                  key={table.id}
                  table={table}
                  session={session}
                  onMarkPreparing={(sessionId, orderId) => act(() => updateOrderStatus(sessionId, orderId, "preparing"))}
                  onMarkServed={(sessionId, orderId) => act(() => updateOrderStatus(sessionId, orderId, "served"))}
                  onMarkReadyToPay={(sessionId) => act(() => requestBill(sessionId))}
                  onMarkPaid={(sessionId) => act(() => markPaid(sessionId))}
                  onCloseTable={(sessionId) => act(() => closeSession(sessionId))}
                  onCancelOrder={(sessionId, orderId) => act(() => updateOrderStatus(sessionId, orderId, "cancelled"))}
                />
              );
            })}
          </div>
        )}

        <div className="mt-8">
          <RecentOrdersPanel orders={allOrders} loading={loading} />
        </div>
      </main>
      <SessionDebugPanel sessions={sessions} />
    </>
  );
}
