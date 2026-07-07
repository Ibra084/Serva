"use client";

import Link from "next/link";
import { ArrowRight, ChefHat, LayoutGrid, QrCode, ReceiptText, Wallet } from "lucide-react";
import { useQRData } from "@/lib/use-qr-data";
import { calculateQRMetrics } from "@/lib/qr-insights";

export function QrIntelligencePreview({ restaurantSlug }: { restaurantSlug: string }) {
  const { interactions, orders, reviews, hasData } = useQRData(restaurantSlug);
  const metrics = calculateQRMetrics(interactions, orders, reviews);

  const newOrders = orders.filter((order) => order.status === "new").length;
  const topItem = metrics.topOrderedItems[0]?.dish ?? "—";
  const latestOrder = [...orders].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))[0];
  const latestOrderLabel = latestOrder
    ? `${latestOrder.tableId ? `Table ${latestOrder.tableId}` : "No table"} · AED ${latestOrder.subtotal.toLocaleString()}`
    : "—";

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">QR Activity</h2>
          <p className="mt-1 text-xs text-muted-foreground">Orders and signal from the customer-facing QR menu</p>
        </div>
        {hasData && (
          <Link
            href={`/portal/${restaurantSlug}/qr-insights`}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>

      {!hasData ? (
        <div className="mt-3 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <QrCode className="size-4" />
          </span>
          <p className="text-sm text-muted-foreground">
            Share your QR menu to start collecting guest intelligence.
          </p>
          <Link href={`/portal/${restaurantSlug}/qr`} className="mt-1 text-xs font-medium text-primary hover:underline">
            Set up QR Experience
          </Link>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-2xl border border-border bg-card p-4">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <ReceiptText className="size-4" />
            </span>
            <p className="mt-2.5 text-xs text-muted-foreground">New QR orders</p>
            <p className="mt-1 font-serif text-lg font-medium tracking-tight text-foreground">{newOrders}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Wallet className="size-4" />
            </span>
            <p className="mt-2.5 text-xs text-muted-foreground">QR revenue</p>
            <p className="mt-1 font-serif text-lg font-medium tracking-tight text-foreground">
              AED {metrics.qrRevenue.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <LayoutGrid className="size-4" />
            </span>
            <p className="mt-2.5 text-xs text-muted-foreground">Average basket</p>
            <p className="mt-1 font-serif text-lg font-medium tracking-tight text-foreground">
              {metrics.averageBasketValue !== null ? `AED ${metrics.averageBasketValue.toLocaleString()}` : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <ChefHat className="size-4" />
            </span>
            <p className="mt-2.5 text-xs text-muted-foreground">Top QR item</p>
            <p className="mt-1 truncate font-serif text-lg font-medium tracking-tight text-foreground">{topItem}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <QrCode className="size-4" />
            </span>
            <p className="mt-2.5 text-xs text-muted-foreground">Latest table order</p>
            <p className="mt-1 truncate font-serif text-lg font-medium tracking-tight text-foreground">
              {latestOrderLabel}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
