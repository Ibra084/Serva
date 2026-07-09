"use client";

import { CheckCircle2, ChefHat, Plus, ReceiptText, Star, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveTableSession, LiveTableStatus, QROrder } from "@/lib/types";

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

export function OrderStatusPanel({
  session,
  orders,
  onAddMore,
  onRequestBill,
  onPayBill,
  onLeaveReview,
}: {
  session: LiveTableSession | null;
  orders: QROrder[];
  onAddMore: () => void;
  onRequestBill: () => void;
  onPayBill: () => void;
  onLeaveReview: () => void;
}) {
  const activeItems = orders.filter((order) => order.status !== "cancelled").flatMap((order) => order.items);
  const subtotal = activeItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const status = session?.status ?? "order_placed";
  const currentStep = Math.min(stepIndex(status), STATUS_STEPS.length - 1);
  const isPaid = status === "paid";

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-6">
      <div>
        <h2 className="font-serif text-xl font-medium tracking-tight text-foreground">Your order</h2>
        <p className="mt-1 text-sm text-muted-foreground">Track your table in real time</p>
      </div>

      {isPaid ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/15 bg-card px-6 py-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <CheckCircle2 className="size-6" />
          </span>
          <p className="font-serif text-lg font-medium tracking-tight text-foreground">Bill settled</p>
          <p className="text-sm text-muted-foreground">Thanks for dining with us — hope to see you again soon.</p>
          <button
            onClick={onLeaveReview}
            className="mt-2 flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
          >
            <Star className="size-3.5" />
            Leave a review
          </button>
        </div>
      ) : (
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
      )}

      {activeItems.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Your bill</p>
          <div className="mt-2 flex flex-col divide-y divide-border">
            {activeItems.map((item, index) => (
              <div key={`${item.dish}-${index}`} className="flex items-center justify-between py-2 text-sm">
                <span className="text-foreground">
                  {item.quantity}× {item.dish}
                </span>
                <span className="text-muted-foreground">AED {(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm font-medium text-foreground">Subtotal</span>
            <span className="font-serif text-lg font-medium text-primary">AED {subtotal.toLocaleString()}</span>
          </div>
        </div>
      )}

      {!isPaid && (
        <div className="mt-auto flex flex-col gap-2.5">
          <button
            onClick={onAddMore}
            className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Plus className="size-4" />
            Add more items
          </button>
          {status !== "ready_to_pay" ? (
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
              Pay bill
            </button>
          )}
        </div>
      )}
    </div>
  );
}
