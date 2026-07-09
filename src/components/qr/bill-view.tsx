"use client";

import { ChevronLeft, CreditCard } from "lucide-react";
import { computeBill, SERVICE_CHARGE_PCT, VAT_PCT } from "@/lib/payment-store";
import type { TableSessionState } from "@/lib/table-session-store";

export function BillView({
  tableSession,
  onBack,
  onPay,
}: {
  tableSession: TableSessionState;
  onBack: () => void;
  onPay: () => void;
}) {
  const orders = tableSession.submittedOrders.filter((order) => order.status !== "cancelled");
  const allItems = orders.flatMap((order) => order.items);
  const bill = computeBill({ items: allItems, splitType: "full" });
  const isPaid = tableSession.paymentStatus === "paid";

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back
      </button>

      <div>
        <h2 className="font-serif text-xl font-medium tracking-tight text-foreground">Your bill</h2>
        <p className="mt-1 text-sm text-muted-foreground">Table {tableSession.tableId}</p>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No orders yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order, index) => (
            <div key={order.orderId} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Order {orders.length - index}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(order.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="mt-2 flex flex-col divide-y divide-border">
                {order.items.map((item) => (
                  <div key={`${order.orderId}-${item.dish}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="text-foreground">
                      {item.quantity}× {item.dish}
                    </span>
                    <span className="text-muted-foreground">
                      AED {item.price.toLocaleString()} · AED {(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4 text-sm">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>AED {bill.subtotal.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Service charge ({Math.round(SERVICE_CHARGE_PCT * 100)}%)</span>
          <span>AED {bill.serviceCharge.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>VAT ({Math.round(VAT_PCT * 100)}%)</span>
          <span>AED {bill.vat.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Tip</span>
          <span>Added at payment</span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border pt-3 text-base font-medium text-foreground">
          <span>Total</span>
          <span className="font-serif text-primary">AED {bill.total.toLocaleString()}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>Payment status</span>
          <span className="font-medium text-foreground">{isPaid ? "Paid" : "Unpaid"}</span>
        </div>
      </div>

      {!isPaid && orders.length > 0 && (
        <button
          onClick={onPay}
          className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
        >
          <CreditCard className="size-4" />
          Pay Demo Bill
        </button>
      )}
    </div>
  );
}
