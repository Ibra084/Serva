import { dishRevenue, round, uniqueSortedDates } from "@/lib/insights";
import type { RestaurantData } from "@/lib/types";

export interface SimulationResult {
  dish: string;
  currentPrice: number;
  newPrice: number;
  currentQuantitySold: number;
  monthlyQuantitySold: number;
  currentMonthlyRevenue: number;
  estimatedNewMonthlyRevenue: number;
  projectedMonthlyGain: number;
  currentMonthlyProfit: number;
  estimatedNewMonthlyProfit: number;
  profitImpact: number;
  breakEvenQuantity: number | null;
  riskLevel: "low" | "medium" | "high";
  confidence: number;
}

/** Assumed price elasticity of demand: a 1% price change shifts quantity ~0.5% the opposite way. */
const PRICE_ELASTICITY = 0.5;

export function simulatePriceChange(
  data: RestaurantData,
  dish: string,
  newPrice: number
): SimulationResult | null {
  const menuItem = data.menu.find((item) => item.dish === dish);
  if (!menuItem) return null;

  const stats = dishRevenue(data.orders).get(dish);
  const quantitySold = stats?.orders ?? 0;
  const currentPrice = menuItem.price;
  const cost = menuItem.cost > 0 ? menuItem.cost : currentPrice * 0.35;

  const dates = uniqueSortedDates(data.orders);
  const daySpan = Math.max(1, dates.length);
  const monthlyQuantitySold = round((quantitySold / daySpan) * 30, 1);

  const priceChangePct = currentPrice > 0 ? ((newPrice - currentPrice) / currentPrice) * 100 : 0;
  const quantityChangePct = -PRICE_ELASTICITY * priceChangePct;
  const newMonthlyQuantity = Math.max(0, round(monthlyQuantitySold * (1 + quantityChangePct / 100), 1));

  const currentMonthlyRevenue = round(monthlyQuantitySold * currentPrice, 0);
  const estimatedNewMonthlyRevenue = round(newMonthlyQuantity * newPrice, 0);
  const projectedMonthlyGain = round(estimatedNewMonthlyRevenue - currentMonthlyRevenue, 0);

  const currentMonthlyProfit = round(monthlyQuantitySold * (currentPrice - cost), 0);
  const estimatedNewMonthlyProfit = round(newMonthlyQuantity * (newPrice - cost), 0);
  const profitImpact = round(estimatedNewMonthlyProfit - currentMonthlyProfit, 0);

  // Minimum monthly units at the new price/cost needed to match today's profit.
  const breakEvenQuantity =
    newPrice > cost ? round(currentMonthlyProfit / (newPrice - cost), 1) : null;

  const absChangePct = Math.abs(priceChangePct);
  const riskLevel: SimulationResult["riskLevel"] =
    absChangePct <= 5 ? "low" : absChangePct <= 15 ? "medium" : "high";

  let confidence = 90 - absChangePct * 1.5;
  if (quantitySold >= 30) confidence += 5;
  else if (quantitySold < 5) confidence -= 25;
  confidence = Math.max(35, Math.min(95, round(confidence, 0)));

  return {
    dish,
    currentPrice,
    newPrice,
    currentQuantitySold: quantitySold,
    monthlyQuantitySold,
    currentMonthlyRevenue,
    estimatedNewMonthlyRevenue,
    projectedMonthlyGain,
    currentMonthlyProfit,
    estimatedNewMonthlyProfit,
    profitImpact,
    breakEvenQuantity,
    riskLevel,
    confidence,
  };
}
