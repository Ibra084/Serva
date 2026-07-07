"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Gauge, LineChart, ShieldAlert, ShieldCheck, ShieldQuestion, SlidersHorizontal } from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { PortalEmptyState } from "@/components/portal/empty-state";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRestaurantData } from "@/lib/use-restaurant-data";
import { simulatePriceChange } from "@/lib/simulator";

const RISK_STYLE: Record<"low" | "medium" | "high", { badge: string; icon: typeof ShieldCheck }> = {
  low: { badge: "bg-primary text-primary-foreground", icon: ShieldCheck },
  medium: { badge: "bg-accent text-accent-foreground", icon: ShieldQuestion },
  high: { badge: "bg-destructive/10 text-destructive", icon: ShieldAlert },
};

function formatAed(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}AED ${Math.abs(Math.round(value)).toLocaleString()}`;
}

export function SimulatorClient({ restaurantSlug }: { restaurantSlug: string }) {
  const { data, loading, hasData } = useRestaurantData(restaurantSlug);
  const searchParams = useSearchParams();

  const menuDishes = useMemo(() => data?.menu.map((item) => item.dish) ?? [], [data]);

  const [selectedDish, setSelectedDish] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState<number | null>(null);

  useEffect(() => {
    if (menuDishes.length === 0) return;
    const requestedDish = searchParams.get("dish");
    const dish = requestedDish && menuDishes.includes(requestedDish) ? requestedDish : menuDishes[0];
    setSelectedDish(dish);

    const requestedPrice = Number(searchParams.get("price"));
    const currentPrice = data?.menu.find((item) => item.dish === dish)?.price ?? 0;
    setNewPrice(Number.isFinite(requestedPrice) && requestedPrice > 0 ? requestedPrice : currentPrice);
    // Only run once when the menu first becomes available — the query params seed the
    // initial selection, subsequent changes are driven by the controls below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuDishes.length]);

  const currentPrice = useMemo(
    () => data?.menu.find((item) => item.dish === selectedDish)?.price ?? 0,
    [data, selectedDish]
  );

  const result = useMemo(() => {
    if (!data || !selectedDish || newPrice === null) return null;
    return simulatePriceChange(data, selectedDish, newPrice);
  }, [data, selectedDish, newPrice]);

  function handleDishChange(dish: string) {
    setSelectedDish(dish);
    const price = data?.menu.find((item) => item.dish === dish)?.price ?? 0;
    setNewPrice(price);
  }

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
          Revenue Simulator
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Test a price change before you make it — projected from your uploaded menu and order data.
        </p>

        {!hasData || menuDishes.length === 0 ? (
          <PortalEmptyState
            restaurantSlug={restaurantSlug}
            icon={SlidersHorizontal}
            title="No menu data yet"
            description="Upload your menu and order history to simulate a price change."
          />
        ) : selectedDish === null || newPrice === null ? null : (
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-medium text-foreground">Choose a dish and new price</p>

              <div className="mt-4 flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Menu item</label>
                <Select value={selectedDish} onChange={(event) => handleDishChange(event.target.value)}>
                  {menuDishes.map((dish) => (
                    <option key={dish} value={dish}>
                      {dish}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="mt-4 flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">
                  Current price: AED {currentPrice.toLocaleString()}
                </label>
                <input
                  type="range"
                  min={Math.max(1, Math.round(currentPrice * 0.5))}
                  max={Math.round(currentPrice * 1.5) || 100}
                  step={0.5}
                  value={newPrice}
                  onChange={(event) => setNewPrice(Number(event.target.value))}
                  className="w-full accent-[var(--primary)]"
                />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">New price</span>
                <div className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5">
                  <span className="text-sm text-muted-foreground">AED</span>
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    value={newPrice}
                    onChange={(event) => setNewPrice(Number(event.target.value))}
                    className="w-20 bg-transparent text-sm font-medium text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {[-10, -5, 5, 10, 15].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setNewPrice(Math.max(0, round1(currentPrice * (1 + pct / 100))))}
                    className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    {pct > 0 ? "+" : ""}
                    {pct}%
                  </button>
                ))}
                <button
                  onClick={() => setNewPrice(currentPrice)}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary"
                >
                  Reset
                </button>
              </div>
            </div>

            {result && (
              <SimulationResultPanel currentPrice={currentPrice} newPrice={newPrice} result={result} />
            )}
          </div>
        )}
      </main>
    </>
  );
}

function round1(value: number) {
  return Math.round(value * 2) / 2;
}

function SimulationResultPanel({
  result,
}: {
  currentPrice: number;
  newPrice: number;
  result: NonNullable<ReturnType<typeof simulatePriceChange>>;
}) {
  const direction = result.newPrice >= result.currentPrice ? "Increase" : "Decrease";
  const RiskIcon = RISK_STYLE[result.riskLevel].icon;

  return (
    <div className="rounded-2xl border border-primary/15 bg-card p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <LineChart className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">
            {direction} {result.dish} from AED {result.currentPrice.toLocaleString()} to AED{" "}
            {result.newPrice.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            Projected monthly gain: {formatAed(result.projectedMonthlyGain)}. Risk: {capitalize(result.riskLevel)}.
            Confidence: {result.confidence}%.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <StatTile label="Current price" value={`AED ${result.currentPrice.toLocaleString()}`} />
        <StatTile label="New price" value={`AED ${result.newPrice.toLocaleString()}`} />
        <StatTile
          label="Current quantity sold"
          value={`${result.currentQuantitySold} (${result.monthlyQuantitySold}/mo)`}
        />
        <StatTile label="Current monthly revenue" value={`AED ${result.currentMonthlyRevenue.toLocaleString()}`} />
        <StatTile
          label="Estimated new monthly revenue"
          value={`AED ${result.estimatedNewMonthlyRevenue.toLocaleString()}`}
        />
        <StatTile
          label="Estimated profit impact"
          value={formatAed(result.profitImpact)}
          emphasize={result.profitImpact >= 0 ? "positive" : "negative"}
        />
        <StatTile
          label="Break-even quantity"
          value={result.breakEvenQuantity !== null ? `${result.breakEvenQuantity}/mo` : "—"}
        />
        <div className="rounded-xl bg-secondary/60 p-3">
          <p className="text-xs text-muted-foreground">Risk level</p>
          <Badge className={cn("mt-1.5", RISK_STYLE[result.riskLevel].badge)}>
            <RiskIcon className="size-3" />
            {capitalize(result.riskLevel)}
          </Badge>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Gauge className="size-3.5" />
          Confidence score
        </div>
        <p className="font-serif text-lg font-medium text-primary">{result.confidence}%</p>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: "positive" | "negative";
}) {
  return (
    <div className="rounded-xl bg-secondary/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-sm font-medium text-foreground",
          emphasize === "positive" && "text-primary",
          emphasize === "negative" && "text-destructive"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
