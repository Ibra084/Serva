"use client";

import { useMemo } from "react";
import {
  BadgePercent,
  ListChecks,
  MessageCircleQuestion,
  QrCode,
  ReceiptText,
  Sparkles,
  Star,
  Wallet,
} from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { useQRData } from "@/lib/use-qr-data";
import { calculateQRMetrics, generateQRInsights } from "@/lib/qr-insights";

function StatTile({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-4" />
      </span>
      <p className="mt-2.5 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-lg font-medium tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border bg-card px-6 py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function RankedList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: { label: string; count: number }[];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="mt-3 flex flex-col divide-y divide-border">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 py-2">
              <span className="truncate text-sm text-foreground">{item.label}</span>
              <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function QrInsightsClient({ restaurantSlug }: { restaurantSlug: string }) {
  const { interactions, orders, reviews, loading } = useQRData(restaurantSlug);

  const metrics = useMemo(() => calculateQRMetrics(interactions, orders, reviews), [interactions, orders, reviews]);
  const insights = useMemo(() => generateQRInsights(interactions, orders, reviews), [interactions, orders, reviews]);

  const latestOrders = useMemo(
    () => [...orders].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)).slice(0, 8),
    [orders]
  );

  const hasInteractions = interactions.length > 0;
  const hasOrders = orders.length > 0;
  const hasReviews = reviews.length > 0;

  if (loading) {
    return (
      <>
        <PortalTopbar restaurantSlug={restaurantSlug} />
        <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
          <div className="h-64 w-full animate-pulse rounded-2xl bg-secondary" />
        </main>
      </>
    );
  }

  return (
    <>
      <PortalTopbar restaurantSlug={restaurantSlug} />
      <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
        <div className="flex items-center gap-2">
          <QrCode className="size-5 text-primary" />
          <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">QR Insights</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Restaurant intelligence gathered from every guest scan, AI question, order, and review.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <StatTile label="QR scans" value={String(metrics.qrScans)} icon={QrCode} />
          <StatTile label="AI questions asked" value={String(metrics.aiQuestionsAsked)} icon={MessageCircleQuestion} />
          <StatTile
            label="Recommendation acceptance"
            value={metrics.recommendationAcceptanceRate !== null ? `${metrics.recommendationAcceptanceRate}%` : "—"}
            icon={BadgePercent}
          />
          <StatTile label="QR orders submitted" value={String(metrics.qrOrdersSubmitted)} icon={ReceiptText} />
          <StatTile label="QR revenue" value={`AED ${metrics.qrRevenue.toLocaleString()}`} icon={Wallet} />
          <StatTile
            label="Average QR basket"
            value={metrics.averageBasketValue !== null ? `AED ${metrics.averageBasketValue.toLocaleString()}` : "—"}
            icon={Wallet}
          />
          <StatTile
            label="QR review score"
            value={metrics.averageReviewScore !== null ? `${metrics.averageReviewScore}★` : "—"}
            icon={Star}
          />
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-medium text-foreground">Latest QR Orders</h2>
          {!hasOrders ? (
            <div className="mt-3">
              <EmptySection message="No QR orders yet" />
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {latestOrders.map((order) => (
                    <tr key={order.orderId}>
                      <td className="px-5 py-3 font-medium text-foreground">{order.tableId ?? "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {order.items.map((item) => `${item.quantity}× ${item.dish}`).join(", ")}
                      </td>
                      <td className="px-5 py-3 text-foreground">AED {order.subtotal.toLocaleString()}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {new Date(order.timestamp).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{order.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4">
            <RankedList
              title="Top ordered QR items"
              items={metrics.topOrderedItems.map((item) => ({ label: item.dish, count: item.count }))}
              emptyLabel="No QR orders yet"
            />
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-medium text-foreground">Guest Intelligence</h2>
          {!hasInteractions ? (
            <div className="mt-3">
              <EmptySection message="No QR interactions yet" />
            </div>
          ) : (
            <>
              <div className="mt-3 flex flex-col gap-3">
                {insights.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Not enough activity yet to generate insights — keep sharing the QR menu.
                  </p>
                ) : (
                  insights.map((insight) => (
                    <div
                      key={insight}
                      className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <Sparkles className="size-3.5" />
                      </span>
                      <p className="text-sm leading-relaxed text-foreground">{insight}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <RankedList
                  title="Top requested preferences"
                  items={metrics.topPreferences.map((item) => ({ label: item.label, count: item.count }))}
                  emptyLabel="No preference questions logged yet."
                />
                <RankedList
                  title="Top AI questions"
                  items={metrics.topQuestions.map((item) => ({ label: item.question, count: item.count }))}
                  emptyLabel="No AI questions logged yet."
                />
                <RankedList
                  title="Top recommended items"
                  items={metrics.topRecommendedItems.map((item) => ({ label: item.dish, count: item.count }))}
                  emptyLabel="No AI recommendations logged yet."
                />
                <RankedList
                  title="Items added after AI recommendation"
                  items={metrics.itemsAddedAfterRecommendation.map((item) => ({ label: item.dish, count: item.count }))}
                  emptyLabel="No orders have followed an AI recommendation yet."
                />
              </div>

              {metrics.mostAcceptedRecommendation && (
                <div className="mt-4 rounded-2xl border border-primary/15 bg-card p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <ListChecks className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">Most accepted recommendation</p>
                      <p className="text-xs text-muted-foreground">Added to basket most often after an AI suggestion</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                    <p className="text-sm text-foreground">{metrics.mostAcceptedRecommendation.dish}</p>
                    <p className="font-serif text-lg font-medium text-primary">
                      {metrics.mostAcceptedRecommendation.count} accepted
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-medium text-foreground">Reviews from QR customers</h2>
          {!hasReviews ? (
            <div className="mt-3">
              <EmptySection message="No QR reviews yet" />
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {[...reviews]
                .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
                .slice(0, 5)
                .map((review) => (
                  <div key={review.id} className="rounded-2xl border border-border bg-card px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">
                        {review.overallRating}★ overall · {review.tableId ? `Table ${review.tableId}` : "No table"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(review.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    {review.comment && (
                      <p className="mt-1 text-sm text-muted-foreground">{review.comment}</p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
