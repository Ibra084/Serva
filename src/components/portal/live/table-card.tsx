"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChefHat, CreditCard, DoorClosed, Users, Utensils, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateBill, type SessionStatus, type TableSession } from "@/lib/session-store";
import type { RestaurantTable } from "@/lib/types";

const STATUS_LABEL: Record<SessionStatus, string> = {
  active: "Active",
  bill_requested: "Bill requested",
  partially_paid: "Partially paid",
  paid: "Paid",
  closed: "Closed",
};

const STATUS_STYLE: Record<SessionStatus, string> = {
  active: "bg-accent text-accent-foreground",
  bill_requested: "bg-primary/15 text-primary",
  partially_paid: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  closed: "bg-secondary text-muted-foreground",
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
  onMarkPreparing,
  onMarkServed,
  onMarkReadyToPay,
  onMarkPaid,
  onCloseTable,
  onCancelOrder,
}: {
  table: RestaurantTable;
  session: TableSession | null;
  onMarkPreparing: (sessionId: string, orderId: string) => void;
  onMarkServed: (sessionId: string, orderId: string) => void;
  onMarkReadyToPay: (sessionId: string) => void;
  onMarkPaid: (sessionId: string) => void;
  onCloseTable: (sessionId: string) => void;
  onCancelOrder: (sessionId: string, orderId: string) => void;
}) {
  useTicker();

  if (!session) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border bg-card p-4 opacity-70">
        <div className="flex items-center justify-between">
          <p className="font-serif text-lg font-medium tracking-tight text-foreground">{table.tableNumber}</p>
          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">Empty</span>
        </div>
        <p className="py-4 text-center text-xs text-muted-foreground">No active session</p>
      </div>
    );
  }

  const bill = calculateBill(session);
  const activeOrders = session.orders.filter((order) => order.status !== "cancelled");
  const latestItems = activeOrders.flatMap((order) => order.items).slice(-4);
  const activeOrder = session.orders.find((order) => order.status === "new" || order.status === "preparing");

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors">
      <div className="flex items-center justify-between">
        <p className="font-serif text-lg font-medium tracking-tight text-foreground">{table.tableNumber}</p>
        <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", STATUS_STYLE[session.status])}>
          {STATUS_LABEL[session.status]}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="size-3.5" />
          {session.participants.length} connected
        </span>
        <span>{elapsedLabel(session.createdAt)} ago</span>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2">
        <span className="text-xs text-muted-foreground">Bill total</span>
        <span className="text-sm font-medium text-foreground">AED {bill.total.toLocaleString()}</span>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted-foreground">
          Paid <span className="font-medium text-foreground">AED {bill.amountPaid.toLocaleString()}</span>
        </span>
        <span className="text-muted-foreground">
          Remaining <span className="font-medium text-foreground">AED {bill.remaining.toLocaleString()}</span>
        </span>
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
            onClick={() => onMarkPreparing(session.sessionId, activeOrder.orderId)}
            className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <ChefHat className="size-3" />
            Preparing
          </button>
        )}
        {activeOrder && activeOrder.status === "preparing" && (
          <button
            onClick={() => onMarkServed(session.sessionId, activeOrder.orderId)}
            className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Utensils className="size-3" />
            Served
          </button>
        )}
        {session.status === "active" && (
          <button
            onClick={() => onMarkReadyToPay(session.sessionId)}
            className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <CreditCard className="size-3" />
            Ready to pay
          </button>
        )}
        {session.status !== "paid" && session.status !== "closed" && (
          <button
            onClick={() => onMarkPaid(session.sessionId)}
            className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
          >
            <CheckCircle2 className="size-3" />
            Mark Paid
          </button>
        )}
        {session.status === "paid" && (
          <button
            onClick={() => onCloseTable(session.sessionId)}
            className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
          >
            <DoorClosed className="size-3" />
            Close Table
          </button>
        )}
        {activeOrder && (
          <button
            onClick={() => onCancelOrder(session.sessionId, activeOrder.orderId)}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <X className="size-3" />
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
