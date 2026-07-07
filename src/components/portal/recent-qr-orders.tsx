"use client";

import { CheckCircle2, ReceiptText } from "lucide-react";
import { useQRData } from "@/lib/use-qr-data";
import { updateQROrderStatus } from "@/lib/qr-store";
import { cn } from "@/lib/utils";

export function RecentQrOrders({ restaurantSlug }: { restaurantSlug: string }) {
  const { orders, loading, refresh } = useQRData(restaurantSlug);

  const recentOrders = [...orders].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)).slice(0, 6);

  return (
    <div className="mt-8">
      <h2 className="text-sm font-medium text-foreground">Recent QR Orders</h2>
      <p className="mt-1 text-xs text-muted-foreground">Orders submitted from the customer-facing QR menu</p>

      {loading ? (
        <div className="mt-3 h-32 w-full animate-pulse rounded-2xl bg-secondary" />
      ) : recentOrders.length === 0 ? (
        <div className="mt-3 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <ReceiptText className="size-4" />
          </span>
          <p className="text-sm text-muted-foreground">No QR orders yet</p>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Table</th>
                <th className="px-5 py-3 font-medium">Items</th>
                <th className="px-5 py-3 font-medium">Subtotal</th>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentOrders.map((order) => (
                <tr key={order.orderId}>
                  <td className="px-5 py-3 font-medium text-foreground">{order.tableId ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {order.items.map((item) => `${item.quantity}× ${item.dish}`).join(", ")}
                  </td>
                  <td className="px-5 py-3 text-foreground">AED {order.subtotal.toLocaleString()}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {new Date(order.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "inline-block rounded-md px-2 py-0.5 text-xs font-medium",
                        order.status === "completed" && "bg-accent text-accent-foreground",
                        order.status === "new" && "bg-secondary text-muted-foreground",
                        order.status === "cancelled" && "bg-destructive/10 text-destructive"
                      )}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {order.status === "new" && (
                      <button
                        onClick={() => {
                          updateQROrderStatus(restaurantSlug, order.orderId, "completed");
                          refresh();
                        }}
                        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <CheckCircle2 className="size-3.5" />
                        Mark complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
