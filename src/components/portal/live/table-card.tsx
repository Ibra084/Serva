"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChefHat, CreditCard, Users, Utensils, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveTableSession, LiveTableStatus, QROrder, RestaurantTable } from "@/lib/types";

const STATUS_LABEL: Record<LiveTableStatus, string> = {
  empty: "Empty",
  seated: "Seated",
  ordering: "Ordering",
  order_placed: "Order placed",
  preparing: "Preparing",
  served: "Served",
  ready_to_pay: "Ready to pay",
  paid: "Paid",
};

const STATUS_STYLE: Record<LiveTableStatus, string> = {
  empty: "bg-secondary text-muted-foreground",
  seated: "bg-secondary text-muted-foreground",
  ordering: "bg-accent text-accent-foreground",
  order_placed: "bg-accent text-accent-foreground",
  preparing: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  served: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  ready_to_pay: "bg-primary/15 text-primary",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

function elapsedLabel(since: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function useTicker() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);
}

export function TableCard({
  table,
  session,
  orders,
  onMarkPreparing,
  onMarkServed,
  onMarkReadyToPay,
  onMarkPaid,
  onCancelOrder,
}: {
  table: RestaurantTable;
  session: LiveTableSession | null;
  orders: QROrder[];
  onMarkPreparing: (orderId: string) => void;
  onMarkServed: (orderId: string) => void;
  onMarkReadyToPay: (sessionId: string) => void;
  onMarkPaid: (sessionId: string) => void;
  onCancelOrder: (orderId: string) => void;
}) {
  useTicker();

  const status: LiveTableStatus = session?.status ?? "empty";
  const latestItems = orders
    .filter((order) => order.status !== "cancelled")
    .flatMap((order) => order.items)
    .slice(-4);
  const activeOrder = orders.find((order) => order.status === "new" || order.status === "preparing");

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors",
        status === "empty" ? "border-dashed border-border opacity-70" : "border-border"
      )}
    >
      <div className="flex items-center justify-between">
        <p className="font-serif text-lg font-medium tracking-tight text-foreground">{table.tableNumber}</p>
        <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", STATUS_STYLE[status])}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      {session ? (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              {session.guestCount} guest{session.guestCount === 1 ? "" : "s"}
            </span>
            <span>{elapsedLabel(session.startedAt)} ago</span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2">
            <span className="text-xs text-muted-foreground">Bill total</span>
            <span className="text-sm font-medium text-foreground">AED {session.currentTotal.toLocaleString()}</span>
          </div>

          {latestItems.length > 0 && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {latestItems.map((item) => `${item.quantity}× ${item.dish}`).join(", ")}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Payment: <span className="font-medium text-foreground">{session.paymentStatus}</span>
          </p>

          <div className="mt-1 flex flex-wrap gap-1.5">
            {activeOrder && activeOrder.status === "new" && (
              <button
                onClick={() => onMarkPreparing(activeOrder.id!)}
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <ChefHat className="size-3" />
                Preparing
              </button>
            )}
            {activeOrder && activeOrder.status === "preparing" && (
              <button
                onClick={() => onMarkServed(activeOrder.id!)}
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <Utensils className="size-3" />
                Served
              </button>
            )}
            {status !== "ready_to_pay" && status !== "paid" && (
              <button
                onClick={() => onMarkReadyToPay(session.id)}
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <CreditCard className="size-3" />
                Ready to pay
              </button>
            )}
            {status !== "paid" && (
              <button
                onClick={() => onMarkPaid(session.id)}
                className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
              >
                <CheckCircle2 className="size-3" />
                Paid
              </button>
            )}
            {activeOrder && (
              <button
                onClick={() => onCancelOrder(activeOrder.id!)}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <X className="size-3" />
                Cancel
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="py-4 text-center text-xs text-muted-foreground">No active session</p>
      )}
    </div>
  );
}
