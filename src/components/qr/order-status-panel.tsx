"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChefHat, Clock, Minus, Plus, ReceiptText, Star, Trash2, Utensils, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { canEditOrder, editWindowRemainingMs } from "@/lib/table-session-store";
import type { TableSessionState } from "@/lib/table-session-store";
import type { LiveTableStatus } from "@/lib/types";

const STATUS_STEPS: { key: LiveTableStatus; label: string; icon: React.ElementType }[] = [
  { key: "order_placed", label: "Order placed", icon: ReceiptText },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "served", label: "Served", icon: Utensils },
  { key: "ready_to_pay", label: "Ready to pay", icon: CheckCircle2 },
];

function stepIndex(status: LiveTableStatus): number {
  const index = STATUS_STEPS.findIndex((step) => step.key === status);
  return index === -1 ? 0 : index;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function OrderStatusPanel({
  tableSession,
  onAddMore,
  onViewBill,
  onRequestBill,
  onPayBill,
  onLeaveReview,
  onEditOrderItem,
  onCancelOrder,
}: {
  tableSession: TableSessionState;
  onAddMore: () => void;
  onViewBill: () => void;
  onRequestBill: () => void;
  onPayBill: () => void;
  onLeaveReview: () => void;
  onEditOrderItem: (orderId: string, dish: string, quantity: number) => void;
  onCancelOrder: (orderId: string) => void;
}) {
  const [, setTick] = useState(0);
  const orders = tableSession.submittedOrders;
  const hasEditableOrder = orders.some((order) => canEditOrder(order));

  useEffect(() => {
    if (!hasEditableOrder) return;
    const interval = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [hasEditableOrder]);

  const activeOrders = orders.filter((order) => order.status !== "cancelled");
  const activeItems = activeOrders.flatMap((order) => order.items);
  const subtotal = activeItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const status = tableSession.orderStatus === "none" ? "order_placed" : tableSession.orderStatus;
  const currentStep = Math.min(stepIndex(status), STATUS_STEPS.length - 1);
  const isPaid = status === "paid";
  const billRequested = status === "ready_to_pay";

  if (isPaid) {
    return (
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-6">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/15 bg-card px-6 py-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <CheckCircle2 className="size-6" />
          </span>
          <p className="font-serif text-lg font-medium tracking-tight text-foreground">Payment received</p>
          <p className="text-sm text-muted-foreground">Thank you for dining with us.</p>
          <button
            onClick={onLeaveReview}
            className="mt-2 flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
          >
            <Star className="size-3.5" />
            Leave a review
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-6">
      <div>
        <h2 className="font-serif text-xl font-medium tracking-tight text-foreground">Your order</h2>
        <p className="mt-1 text-sm text-muted-foreground">Table {tableSession.tableId} · Track your order in real time</p>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-4">
        {STATUS_STEPS.map((step, index) => {
          const reached = index <= currentStep;
          return (
            <div key={step.key} className="flex flex-1 flex-col items-center gap-1.5 text-center">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full",
                  reached ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                )}
              >
                <step.icon className="size-3.5" />
              </span>
              <span className={cn("text-[11px] font-medium", reached ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {billRequested && (
        <div className="rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
          Bill requested. A staff member will assist shortly.
        </div>
      )}

      <div className="flex flex-col gap-4">
        {activeOrders.map((order, orderIndex) => {
          const editable = canEditOrder(order);
          const remaining = editWindowRemainingMs(order);
          return (
            <div key={order.orderId} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  Order {activeOrders.length - orderIndex}
                </p>
                {editable ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-primary">
                    <Clock className="size-3" />
                    You can edit this order for {formatCountdown(remaining)}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">Order sent to kitchen</span>
                )}
              </div>
              <div className="mt-2 flex flex-col divide-y divide-border">
                {order.items.map((item) => (
                  <div key={`${order.orderId}-${item.dish}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="text-foreground">{item.dish}</span>
                    {editable ? (
                      <div className="flex shrink-0 items-center gap-2 rounded-full border border-border px-1 py-1">
                        <button
                          onClick={() => onEditOrderItem(order.orderId, item.dish, item.quantity - 1)}
                          aria-label="Decrease quantity"
                          className="flex size-6 items-center justify-center rounded-full text-foreground hover:bg-secondary"
                        >
                          {item.quantity === 1 ? <Trash2 className="size-3" /> : <Minus className="size-3" />}
                        </button>
                        <span className="w-4 text-center text-sm font-medium text-foreground">{item.quantity}</span>
                        <button
                          onClick={() => onEditOrderItem(order.orderId, item.dish, item.quantity + 1)}
                          aria-label="Increase quantity"
                          className="flex size-6 items-center justify-center rounded-full text-foreground hover:bg-secondary"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        {item.quantity}× AED {(item.price * item.quantity).toLocaleString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {editable && (
                <button
                  onClick={() => onCancelOrder(order.orderId)}
                  className="mt-3 flex items-center gap-1.5 text-xs font-medium text-destructive hover:underline"
                >
                  <X className="size-3.5" />
                  Cancel order
                </button>
              )}
            </div>
          );
        })}
      </div>

      {activeItems.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Current bill</p>
            <button onClick={onViewBill} className="text-xs font-medium text-primary hover:underline">
              View full bill
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm font-medium text-foreground">Subtotal</span>
            <span className="font-serif text-lg font-medium text-primary">AED {subtotal.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2.5">
        <button
          onClick={onAddMore}
          className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          <Plus className="size-4" />
          Add more items
        </button>
        <button
          onClick={onViewBill}
          className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          <ReceiptText className="size-4" />
          View bill
        </button>
        {!billRequested ? (
          <button
            onClick={onRequestBill}
            className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <ReceiptText className="size-4" />
            Request bill
          </button>
        ) : (
          <button
            onClick={onPayBill}
            className="flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
          >
            <CheckCircle2 className="size-4" />
            Pay Demo Bill
          </button>
        )}
      </div>
    </div>
  );
}
