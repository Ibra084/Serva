"use client";

import { ChevronLeft } from "lucide-react";
import { SERVICE_CHARGE_PCT, VAT_PCT } from "@/lib/payment-store";
import { GuestStrip } from "@/components/qr/guest-strip";
import { SplitBillPanel } from "@/components/qr/split-bill-panel";
import type { TableSessionState } from "@/lib/table-session-store";
import type { SessionBill } from "@/lib/bill-splitting";
import type { SplitMode, TableParticipant } from "@/lib/types";

export function BillView({
  tableSession,
  sessionBill,
  participants,
  selfParticipantId,
  paying,
  onBack,
  onRename,
  onPaySplit,
}: {
  tableSession: TableSessionState;
  sessionBill: SessionBill | null;
  participants: TableParticipant[];
  selfParticipantId: string | null;
  paying: boolean;
  onBack: () => void;
  onRename: (name: string) => void;
  onPaySplit: (amount: number, splitMode: SplitMode) => void;
}) {
  const orders = tableSession.submittedOrders.filter((order) => order.status !== "cancelled");
  const bill = sessionBill?.bill ?? { subtotal: 0, serviceCharge: 0, vat: 0, tip: 0, total: 0 };
  const paid = sessionBill?.paid ?? 0;
  const remaining = sessionBill?.remaining ?? bill.total;
  const isPaid = tableSession.paymentStatus === "paid";
  const connectedGuestCount = participants.length || 1;

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

      <GuestStrip participants={participants} selfParticipantId={selfParticipantId} onRename={onRename} />

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
        <div className="mt-1 flex items-center justify-between text-muted-foreground">
          <span>Paid</span>
          <span className="text-foreground">AED {paid.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Remaining</span>
          <span className="font-medium text-foreground">AED {remaining.toLocaleString()}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>Payment status</span>
          <span className="font-medium text-foreground">{isPaid ? "Paid" : paid > 0 ? "Partially paid" : "Unpaid"}</span>
        </div>
      </div>

      {!isPaid && orders.length > 0 && (
        <SplitBillPanel
          remaining={remaining}
          connectedGuestCount={connectedGuestCount}
          paying={paying}
          onPay={onPaySplit}
        />
      )}
    </div>
  );
}
