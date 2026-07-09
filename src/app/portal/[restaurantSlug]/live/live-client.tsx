"use client";

import { useMemo } from "react";
import { LayoutGrid } from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { TableCard } from "@/components/portal/live/table-card";
import { RecentOrdersPanel } from "@/components/portal/live/recent-orders-panel";
import { useLiveFloor } from "@/lib/use-live-data";
import { cancelOrder, updateOrderStatus, updateSessionStatus } from "@/lib/live-store";

export function LiveClient({ restaurantSlug }: { restaurantSlug: string }) {
  const { tables, sessions, orders, participants, payments, loading, refresh } = useLiveFloor(restaurantSlug);

  const sessionByTable = useMemo(() => {
    const map = new Map<string, (typeof sessions)[number]>();
    for (const session of sessions) map.set(session.tableId, session);
    return map;
  }, [sessions]);

  const ordersBySession = useMemo(() => {
    const map = new Map<string, typeof orders>();
    for (const order of orders) {
      if (!order.sessionId) continue;
      const list = map.get(order.sessionId) ?? [];
      list.push(order);
      map.set(order.sessionId, list);
    }
    return map;
  }, [orders]);

  const guestCountBySession = useMemo(() => {
    const map = new Map<string, number>();
    for (const participant of participants) {
      map.set(participant.sessionId, (map.get(participant.sessionId) ?? 0) + 1);
    }
    return map;
  }, [participants]);

  const paidBySession = useMemo(() => {
    const map = new Map<string, number>();
    for (const payment of payments) {
      if (!payment.sessionId || payment.status !== "paid") continue;
      map.set(payment.sessionId, (map.get(payment.sessionId) ?? 0) + payment.amount);
    }
    return map;
  }, [payments]);

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
              const session = sessionByTable.get(table.id) ?? null;
              const tableOrders = session ? ordersBySession.get(session.id) ?? [] : [];
              const guestCount = session ? guestCountBySession.get(session.id) ?? 0 : 0;
              const paid = session ? paidBySession.get(session.id) ?? 0 : 0;
              return (
                <TableCard
                  key={table.id}
                  table={table}
                  session={session}
                  orders={tableOrders}
                  guestCount={guestCount}
                  amountPaid={paid}
                  onMarkPreparing={(orderId) => act(() => updateOrderStatus(restaurantSlug, orderId, "preparing"))}
                  onMarkServed={(orderId) => act(() => updateOrderStatus(restaurantSlug, orderId, "served"))}
                  onMarkReadyToPay={(sessionId) =>
                    act(() => updateSessionStatus(restaurantSlug, sessionId, "ready_to_pay"))
                  }
                  onMarkPaid={(sessionId) => act(() => updateSessionStatus(restaurantSlug, sessionId, "paid"))}
                  onCancelOrder={(orderId) => act(() => cancelOrder(restaurantSlug, orderId))}
                />
              );
            })}
          </div>
        )}

        <div className="mt-8">
          <RecentOrdersPanel orders={orders} loading={loading} />
        </div>
      </main>
    </>
  );
}
