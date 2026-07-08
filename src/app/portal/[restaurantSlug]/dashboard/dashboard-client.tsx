"use client";

import { useMemo } from "react";
import {
  Sparkles,
  QrCode,
  Download,
  BarChart3,
  UserPlus,
  SlidersHorizontal,
  LineChart,
  Table2,
  Users,
  LayoutGrid,
  Receipt,
  ChefHat,
  Star,
  IceCream2,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { PortalRevenueChart } from "@/components/portal/revenue-chart";
import { AIBriefTrigger } from "@/components/portal/ai-brief-trigger";
import { PortalEmptyState } from "@/components/portal/empty-state";
import { InsightCard } from "@/components/portal/insight-card";
import { OpportunityFeedPreview } from "@/components/portal/opportunity-feed-preview";
import { QrIntelligencePreview } from "@/components/portal/qr-intelligence-preview";
import { RecentQrOrders } from "@/components/portal/recent-qr-orders";
import { useRestaurantData, useUploadBatches } from "@/lib/use-restaurant-data";
import { useWorkspace } from "@/lib/use-workspace";
import {
  calculateDashboardMetrics,
  calculateMenuPerformance,
  calculateGuestInsights,
  generateOpportunities,
  rankMenuByQuantity,
} from "@/lib/insights";
import { generateTracedInsights } from "@/lib/source-trace";

const quickActions = [
  { label: "View Live Menu", icon: QrCode },
  { label: "Download Report", icon: Download },
  { label: "Export Analytics", icon: BarChart3 },
  { label: "Invite Manager", icon: UserPlus },
];

function formatAed(value: number) {
  return `AED ${Math.round(value).toLocaleString()}`;
}

export function DashboardClient({ restaurantSlug }: { restaurantSlug: string }) {
  const { data, loading, hasData } = useRestaurantData(restaurantSlug);
  const { batches } = useUploadBatches(restaurantSlug);
  const { user, workspace } = useWorkspace(restaurantSlug);
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const metrics = useMemo(() => (data ? calculateDashboardMetrics(data) : null), [data]);
  const opportunities = useMemo(() => (data ? generateOpportunities(data) : []), [data]);
  const tracedInsights = useMemo(() => (data ? generateTracedInsights(data) : []), [data]);
  const menuRows = useMemo(() => (data ? calculateMenuPerformance(data).slice(0, 5) : []), [data]);
  const quantitySold = useMemo(() => (data ? rankMenuByQuantity(data).slice(0, 5) : []), [data]);
  const guestInsights = useMemo(() => (data ? calculateGuestInsights(data) : null), [data]);

  const dataQualityAvg = useMemo(
    () =>
      batches.length > 0
        ? Math.round(batches.reduce((sum, batch) => sum + batch.quality.score, 0) / batches.length)
        : null,
    [batches]
  );
  const qualityIssues = useMemo(
    () =>
      batches
        .filter((batch) => batch.status !== "processed")
        .flatMap((batch) => [...batch.quality.errors, ...batch.quality.warnings].map((message) => ({ batch: batch.name, message }))),
    [batches]
  );

  const hourlyRevenue = useMemo(() => {
    if (!data || data.orders.length === 0) return undefined;
    const dates = Array.from(new Set(data.orders.map((o) => o.date))).sort();
    const today = dates[dates.length - 1];
    const buckets = new Array(24).fill(0);
    data.orders
      .filter((o) => o.date === today)
      .forEach((order) => {
        const match = /^(\d{1,2}):/.exec(order.time);
        if (!match) return;
        const hour = Number(match[1]);
        buckets[hour] += order.total;
      });
    const active = buckets.filter((v) => v > 0);
    return active.length > 1 ? active : undefined;
  }, [data]);

  if (loading) {
    return (
      <>
        <PortalTopbar restaurantSlug={restaurantSlug} />
        <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
          <div className="h-6 w-48 animate-pulse rounded bg-secondary" />
          <div className="mt-4 h-64 w-full animate-pulse rounded-2xl bg-secondary" />
        </main>
      </>
    );
  }

  if (!hasData || !metrics || !data) {
    return (
      <>
        <PortalTopbar restaurantSlug={restaurantSlug} />
        <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
          <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
            Good morning, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your dashboard is empty until you upload data.
          </p>
          <PortalEmptyState
            restaurantSlug={restaurantSlug}
            title="Upload your first POS report"
            description="Serva needs order, menu, and review data to generate your morning brief."
          />
        </main>
      </>
    );
  }

  const miniStats = [
    { label: "Revenue", value: formatAed(metrics.todayRevenue) },
    { label: "Orders", value: String(menuRows.reduce((sum, row) => sum + row.orders, 0)) },
    { label: "Average Bill", value: formatAed(metrics.averageBill) },
    { label: "Guests Today", value: String(metrics.guestsToday) },
  ];

  const snapshot = [
    { name: "Guests Today", value: String(metrics.guestsToday), icon: Users },
    {
      name: "Active Tables",
      value: `${metrics.activeTables} / ${metrics.totalTables || metrics.activeTables}`,
      icon: LayoutGrid,
    },
    { name: "Average Bill", value: formatAed(metrics.averageBill), icon: Receipt },
    { name: "Best Seller", value: metrics.bestSellingDish ?? "—", icon: ChefHat },
    { name: "Dessert Attach Rate", value: `${metrics.dessertAttachRate}%`, icon: IceCream2 },
    {
      name: "Customer Rating",
      value: metrics.customerRating !== null ? `${metrics.customerRating}` : "—",
      icon: Star,
    },
  ];

  const topOpportunity = opportunities[0];
  const revenueUp = (metrics.revenueChangePct ?? 0) >= 0;

  return (
    <>
      <PortalTopbar restaurantSlug={restaurantSlug} />

      <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          Good morning, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Based on your latest uploaded data
        </p>
        {metrics.revenueChangePct !== null && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-foreground">
            {revenueUp ? (
              <ArrowUpRight className="size-4 text-primary" />
            ) : (
              <ArrowDownRight className="size-4 text-destructive" />
            )}
            Revenue is{" "}
            <span className={revenueUp ? "font-medium text-primary" : "font-medium text-destructive"}>
              {revenueUp ? "up" : "down"} {Math.abs(metrics.revenueChangePct)}%
            </span>{" "}
            versus the prior day.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <AIBriefTrigger
            restaurantName={workspace?.name ?? ""}
            restaurantSlug={restaurantSlug}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
          >
            <Sparkles className="size-3.5" />
            Generate AI Brief
          </AIBriefTrigger>
          {quickActions.map((action) => (
            <button
              key={action.label}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <action.icon className="size-3.5" />
              {action.label}
            </button>
          ))}
          <button className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <SlidersHorizontal className="size-3.5" />
            Customize
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-medium text-foreground">Data Status</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl bg-secondary/60 p-3">
              <p className="text-xs text-muted-foreground">Orders uploaded</p>
              <p className="mt-1 text-sm font-medium text-foreground">{data.orders.length}</p>
            </div>
            <div className="rounded-xl bg-secondary/60 p-3">
              <p className="text-xs text-muted-foreground">Menu items</p>
              <p className="mt-1 text-sm font-medium text-foreground">{data.menu.length}</p>
            </div>
            <div className="rounded-xl bg-secondary/60 p-3">
              <p className="text-xs text-muted-foreground">Reviews</p>
              <p className="mt-1 text-sm font-medium text-foreground">{data.reviews.length}</p>
            </div>
            <div className="rounded-xl bg-secondary/60 p-3">
              <p className="text-xs text-muted-foreground">Last import</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {new Date(data.importedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="rounded-xl bg-secondary/60 p-3">
              <p className="text-xs text-muted-foreground">Data quality</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {dataQualityAvg !== null ? `${dataQualityAvg}%` : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Today&rsquo;s Revenue</p>
              <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
                <span className="flex size-7 items-center justify-center rounded-md bg-secondary text-foreground">
                  <LineChart className="size-3.5" />
                </span>
                <span className="flex size-7 items-center justify-center rounded-md text-muted-foreground">
                  <Table2 className="size-3.5" />
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2.5">
              <p className="font-serif text-3xl font-medium tracking-tight text-foreground">
                {formatAed(metrics.todayRevenue)}
              </p>
              {metrics.revenueChangePct !== null && (
                <span
                  className={
                    revenueUp
                      ? "flex items-center gap-0.5 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground"
                      : "flex items-center gap-0.5 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                  }
                >
                  {revenueUp ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {revenueUp ? "+" : ""}
                  {metrics.revenueChangePct}%
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {miniStats.map((stat) => (
                <div key={stat.label} className="rounded-xl bg-secondary/60 p-3">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 h-40 w-full">
              <PortalRevenueChart values={hourlyRevenue} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-medium text-foreground">Today&rsquo;s Snapshot</p>

            <div className="mt-1 flex flex-col divide-y divide-border">
              {snapshot.map((item) => (
                <div key={item.name} className="flex items-center gap-3 py-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <item.icon className="size-4" />
                  </span>
                  <span className="flex-1 truncate text-sm text-foreground">{item.name}</span>
                  <span className="shrink-0 text-sm font-medium text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {topOpportunity && (
          <div className="mt-5 rounded-2xl border border-primary/15 bg-card p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Sparkles className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">Predicted Monthly Gain</p>
                <p className="text-xs text-muted-foreground">From all detected opportunities</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">If you act on today&rsquo;s recommendations</p>
              <p className="font-serif text-lg font-medium text-primary">
                +{formatAed(metrics.predictedMonthlyGain)}
              </p>
            </div>
          </div>
        )}

        <div className="mt-8">
          <h2 className="text-sm font-medium text-foreground">Quantity Sold</h2>
          <p className="mt-1 text-xs text-muted-foreground">Top movers by units sold</p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {quantitySold.length === 0 && (
              <p className="text-sm text-muted-foreground">No order data yet.</p>
            )}
            {quantitySold.map((item) => (
              <div key={item.dish} className="rounded-2xl border border-border bg-card p-4">
                <p className="truncate text-sm font-medium text-foreground">{item.dish}</p>
                <p className="mt-1 font-serif text-lg font-medium text-foreground">{item.quantitySold} sold</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatAed(item.revenue)} revenue &middot; {item.margin}% margin
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-medium text-foreground">Opportunities</h2>

          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            {tracedInsights.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No opportunities detected yet — upload more order history to unlock recommendations.
              </p>
            )}
            {tracedInsights.slice(0, 6).map((insight) => (
              <InsightCard key={insight.id} insight={insight} data={data} />
            ))}
          </div>
        </div>

        <OpportunityFeedPreview restaurantSlug={restaurantSlug} />

        {qualityIssues.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-medium text-foreground">Data Quality Warnings</h2>
            <div className="mt-3 flex flex-col gap-2">
              {qualityIssues.map((issue, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground"
                >
                  <span className="font-medium">{issue.batch}:</span>{" "}
                  <span className="text-muted-foreground">{issue.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          <h2 className="text-sm font-medium text-foreground">Menu Intelligence</h2>

          <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Dish</th>
                  <th className="px-5 py-3 font-medium">Orders</th>
                  <th className="px-5 py-3 font-medium">Revenue</th>
                  <th className="px-5 py-3 font-medium">Margin</th>
                  <th className="px-5 py-3 font-medium">Trend</th>
                  <th className="px-5 py-3 font-medium">AI Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {menuRows.map((row) => (
                  <tr key={row.dish}>
                    <td className="px-5 py-3 font-medium text-foreground">{row.dish}</td>
                    <td className="px-5 py-3 text-foreground">{row.orders}</td>
                    <td className="px-5 py-3 text-foreground">{formatAed(row.revenue)}</td>
                    <td className="px-5 py-3 text-foreground">{row.estimatedMargin}%</td>
                    <td className="px-5 py-3">
                      {row.trend === "up" ? (
                        <TrendingUp className="size-4 text-primary" />
                      ) : row.trend === "down" ? (
                        <TrendingDown className="size-4 text-destructive" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Flat</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{row.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {guestInsights && (
          <div className="mt-8">
            <h2 className="text-sm font-medium text-foreground">Guest Insights</h2>

            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Users className="size-4" />
                </span>
                <p className="mt-3 text-xs text-muted-foreground">Returning Guests</p>
                <p className="mt-1 font-serif text-xl font-medium tracking-tight text-foreground">
                  {guestInsights.returningGuestRate !== null ? `${guestInsights.returningGuestRate}%` : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Table2 className="size-4" />
                </span>
                <p className="mt-3 text-xs text-muted-foreground">Average Visit</p>
                <p className="mt-1 font-serif text-xl font-medium tracking-tight text-foreground">
                  {guestInsights.averageVisitMinutes !== null
                    ? `${guestInsights.averageVisitMinutes} mins`
                    : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <IceCream2 className="size-4" />
                </span>
                <p className="mt-3 text-xs text-muted-foreground">Dessert Attach Rate</p>
                <p className="mt-1 font-serif text-xl font-medium tracking-tight text-foreground">
                  {metrics.dessertAttachRate}%
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Star className="size-4" />
                </span>
                <p className="mt-3 text-xs text-muted-foreground">Customer Satisfaction</p>
                <p className="mt-1 font-serif text-xl font-medium tracking-tight text-foreground">
                  {guestInsights.satisfactionScore !== null ? `${guestInsights.satisfactionScore}★` : "—"}
                </p>
              </div>
            </div>
          </div>
        )}

        <QrIntelligencePreview restaurantSlug={restaurantSlug} />
        <RecentQrOrders restaurantSlug={restaurantSlug} />
      </main>
    </>
  );
}
