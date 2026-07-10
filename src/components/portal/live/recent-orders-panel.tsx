"use client";

import { ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionOrder } from "@/lib/session-store";

const STATUS_STYLE: Record<SessionOrder["status"], string> = {
  new: "bg-secondary text-muted-foreground",
  preparing: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  served: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  cancelled: "bg-destructive/10 text-destructive",
};

export function RecentOrdersPanel({ orders, loading }: { orders: SessionOrder[]; loading: boolean }) {
  const recent = [...orders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 10);

  return (
    <div>
      <h2 className="text-sm font-medium text-foreground">Recent Orders</h2>
      <p className="mt-1 text-xs text-muted-foreground">Newest QR orders across every table</p>

      {loading ? (
        <div className="mt-3 h-48 w-full animate-pulse rounded-2xl bg-secondary" />
      ) : recent.length === 0 ? (
        <div className="mt-3 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <ReceiptText className="size-4" />
          </span>
          <p className="text-sm text-muted-foreground">No orders yet</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
          {recent.map((order) => (
            <div key={order.orderId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{order.tableId || "—"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {order.items.map((item) => `${item.quantity}× ${item.dish}`).join(", ")}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-medium text-foreground">AED {order.subtotal.toLocaleString()}</span>
                <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", STATUS_STYLE[order.status])}>
                  {order.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
