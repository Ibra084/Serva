"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, UtensilsCrossed, SlidersHorizontal } from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { PortalEmptyState } from "@/components/portal/empty-state";
import { Select } from "@/components/ui/select";
import { InsightCard } from "@/components/portal/insight-card";
import { useRestaurantData } from "@/lib/use-restaurant-data";
import { calculateMenuPerformance, rankMenuByQuantity } from "@/lib/insights";
import { generateTracedInsights } from "@/lib/source-trace";

type SortKey = "quantity" | "revenue" | "profit" | "margin" | "rating" | "trend";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "quantity", label: "Quantity sold" },
  { value: "revenue", label: "Revenue" },
  { value: "profit", label: "Profit" },
  { value: "margin", label: "Margin" },
  { value: "rating", label: "Rating" },
  { value: "trend", label: "Trend" },
];

const TREND_RANK: Record<string, number> = { up: 2, flat: 1, down: 0 };

function suggestedSimulatorPrice(recommendation: string, averagePrice: number): number {
  if (recommendation === "Raise price by AED 2") return averagePrice + 2;
  return averagePrice;
}

export function MenuClient({ restaurantSlug }: { restaurantSlug: string }) {
  const { data, loading, hasData } = useRestaurantData(restaurantSlug);
  const [sortKey, setSortKey] = useState<SortKey>("quantity");

  const rows = useMemo(() => {
    if (!data) return [];
    const performance = calculateMenuPerformance(data);
    const byQuantity = new Map(rankMenuByQuantity(data).map((row) => [row.dish, row]));

    return performance.map((row) => {
      const extra = byQuantity.get(row.dish);
      return {
        ...row,
        quantitySold: extra?.quantitySold ?? row.orders,
        profit: extra?.profit ?? 0,
        categoryShare: extra?.categoryShare ?? 0,
      };
    });
  }, [data]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    switch (sortKey) {
      case "quantity":
        return copy.sort((a, b) => b.quantitySold - a.quantitySold);
      case "revenue":
        return copy.sort((a, b) => b.revenue - a.revenue);
      case "profit":
        return copy.sort((a, b) => b.profit - a.profit);
      case "margin":
        return copy.sort((a, b) => b.estimatedMargin - a.estimatedMargin);
      case "trend":
        return copy.sort((a, b) => TREND_RANK[b.trend] - TREND_RANK[a.trend]);
      case "rating":
        // No per-dish rating data is currently uploaded — falls back to revenue order.
        return copy.sort((a, b) => b.revenue - a.revenue);
    }
  }, [rows, sortKey]);

  const menuInsights = useMemo(
    () => (data ? generateTracedInsights(data).filter((insight) => insight.category === "menu") : []),
    [data]
  );

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
        <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          Menu Intelligence
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Performance and AI recommendations for every dish on your menu.
        </p>

        {!hasData ? (
          <PortalEmptyState
            restaurantSlug={restaurantSlug}
            icon={UtensilsCrossed}
            title="No menu data yet"
            description="Upload your menu and order history to see dish-level performance and pricing recommendations."
          />
        ) : (
          <>
            {menuInsights.length > 0 && data && (
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {menuInsights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} data={data} />
                ))}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">All dishes</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sort by</span>
                <Select
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value as SortKey)}
                  className="w-auto"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Dish</th>
                    <th className="px-5 py-3 font-medium">Category</th>
                    <th className="px-5 py-3 font-medium">Quantity Sold</th>
                    <th className="px-5 py-3 font-medium">Revenue</th>
                    <th className="px-5 py-3 font-medium">Profit</th>
                    <th className="px-5 py-3 font-medium">Avg Price</th>
                    <th className="px-5 py-3 font-medium">Est. Margin</th>
                    <th className="px-5 py-3 font-medium">Category Share</th>
                    <th className="px-5 py-3 font-medium">Trend</th>
                    <th className="px-5 py-3 font-medium">AI Recommendation</th>
                    <th className="px-5 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedRows.map((row) => (
                    <tr key={row.dish}>
                      <td className="px-5 py-3 font-medium text-foreground">{row.dish}</td>
                      <td className="px-5 py-3 text-muted-foreground">{row.category}</td>
                      <td className="px-5 py-3 text-foreground">{row.quantitySold}</td>
                      <td className="px-5 py-3 text-foreground">
                        AED {row.revenue.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-foreground">AED {row.profit.toLocaleString()}</td>
                      <td className="px-5 py-3 text-foreground">AED {row.averagePrice}</td>
                      <td className="px-5 py-3 text-foreground">{row.estimatedMargin}%</td>
                      <td className="px-5 py-3 text-foreground">{row.categoryShare}%</td>
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
                      <td className="px-5 py-3">
                        <Link
                          href={`/portal/${restaurantSlug}/simulator?dish=${encodeURIComponent(
                            row.dish
                          )}&price=${suggestedSimulatorPrice(row.recommendation, row.averagePrice)}`}
                          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <SlidersHorizontal className="size-3.5" />
                          Simulate
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  );
}
