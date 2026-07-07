import {
  calculateDashboardMetrics,
  calculateMenuPerformance,
  dishRevenue,
  extractThemes,
  NEGATIVE_KEYWORDS,
  ordersOnDate,
  rankMenuByQuantity,
  revenueOf,
  round,
  timeToMinutes,
  uniqueSortedDates,
} from "@/lib/insights";
import type { Order, RestaurantData, TracedInsight } from "@/lib/types";

export function getOrdersForTrace(data: RestaurantData, ids: string[]): Order[] {
  const idSet = new Set(ids);
  return data.orders.filter((order) => idSet.has(order.orderId));
}

function orderIdsWithCategory(orders: Order[], category: string): string[] {
  return orders
    .filter((order) => order.items.some((item) => item.category.toLowerCase() === category))
    .map((order) => order.orderId);
}

/**
 * Rule-based insights, each carrying the literal numbers, a calculation string,
 * and the source order ids that back it — so every recommendation is traceable.
 */
export function generateTracedInsights(data: RestaurantData): TracedInsight[] {
  const insights: TracedInsight[] = [];
  if (data.orders.length === 0) return insights;

  const dates = uniqueSortedDates(data.orders);
  const today = dates[dates.length - 1];
  const previous = dates[dates.length - 2];
  const todayOrders = ordersOnDate(data.orders, today);
  const previousOrders = ordersOnDate(data.orders, previous);
  const metrics = calculateDashboardMetrics(data);

  // Revenue: change vs prior day
  if (previous) {
    const todayRevenue = round(revenueOf(todayOrders), 2);
    const previousRevenue = round(revenueOf(previousOrders), 2);
    const direction = todayRevenue >= previousRevenue ? "up" : "down";
    insights.push({
      id: "revenue-change",
      category: "revenue",
      title: `Revenue ${direction} vs prior day`,
      explanation: `Revenue on ${today} was AED ${todayRevenue.toLocaleString()}, compared to AED ${previousRevenue.toLocaleString()} on ${previous}.`,
      value: `${metrics.revenueChangePct ?? 0}%`,
      trend: direction,
      trace: {
        description: `Compares ${todayOrders.length} orders on ${today} against ${previousOrders.length} orders on ${previous}.`,
        calculation: `(${todayRevenue} - ${previousRevenue}) / ${previousRevenue} = ${metrics.revenueChangePct ?? 0}%`,
        confidence: previousRevenue > 0 ? 90 : 40,
        relatedOrderIds: [...todayOrders, ...previousOrders].map((order) => order.orderId),
      },
    });
  }

  // Revenue: peak hour
  const hourCounts = new Map<number, { count: number; revenue: number; ids: string[] }>();
  for (const order of data.orders) {
    const minutes = timeToMinutes(order.time);
    if (minutes === null) continue;
    const hour = Math.floor(minutes / 60);
    const entry = hourCounts.get(hour) ?? { count: 0, revenue: 0, ids: [] };
    entry.count += 1;
    entry.revenue += order.total;
    entry.ids.push(order.orderId);
    hourCounts.set(hour, entry);
  }
  const peakHour = Array.from(hourCounts.entries()).sort((a, b) => b[1].revenue - a[1].revenue)[0];
  if (peakHour) {
    const [hour, stats] = peakHour;
    insights.push({
      id: "peak-revenue-hour",
      category: "revenue",
      title: "Peak revenue hour",
      explanation: `The ${hour}:00–${hour + 1}:00 window generated the most revenue, from ${stats.count} orders.`,
      value: `${hour}:00–${hour + 1}:00`,
      trace: {
        description: `${stats.count} orders placed between ${hour}:00 and ${hour + 1}:00 across all uploaded data.`,
        calculation: `Sum of order totals grouped by hour = AED ${round(stats.revenue, 2).toLocaleString()}`,
        confidence: 80,
        relatedOrderIds: stats.ids,
      },
    });
  }

  // Menu: top quantity-sold dish
  const byQuantity = rankMenuByQuantity(data);
  if (byQuantity.length > 0) {
    const top = byQuantity[0];
    const relatedIds = data.orders
      .filter((order) => order.items.some((item) => item.dish === top.dish))
      .map((order) => order.orderId);
    insights.push({
      id: "top-quantity-dish",
      category: "menu",
      title: `${top.dish} is your top mover`,
      explanation: `${top.dish} sold ${top.quantitySold} units, generating AED ${top.revenue.toLocaleString()} in revenue.`,
      value: `${top.quantitySold} sold`,
      trace: {
        description: `Counted across ${relatedIds.length} orders containing ${top.dish}.`,
        calculation: `Sum of item quantity for "${top.dish}" across all orders = ${top.quantitySold}`,
        confidence: 95,
        relatedOrderIds: relatedIds,
      },
    });
  }

  // Menu: top-profit dish
  const byProfit = [...byQuantity].sort((a, b) => b.profit - a.profit)[0];
  if (byProfit) {
    const relatedIds = data.orders
      .filter((order) => order.items.some((item) => item.dish === byProfit.dish))
      .map((order) => order.orderId);
    insights.push({
      id: "top-profit-dish",
      category: "menu",
      title: `${byProfit.dish} drives the most profit`,
      explanation: `${byProfit.dish} generated an estimated AED ${byProfit.profit.toLocaleString()} in profit at a ${byProfit.margin}% margin.`,
      value: `AED ${byProfit.profit.toLocaleString()}`,
      trace: {
        description: `Estimated profit = (price − cost) × quantity sold across ${relatedIds.length} orders.`,
        calculation: `Margin ${byProfit.margin}% on ${byProfit.quantitySold} units sold = AED ${byProfit.profit.toLocaleString()} profit`,
        confidence: 75,
        relatedOrderIds: relatedIds,
      },
    });
  }

  // Menu: high-margin, low-selling dish to promote
  const menuRows = calculateMenuPerformance(data);
  const promoteCandidate = menuRows.find((row) => row.recommendation === "Promote during lunch");
  if (promoteCandidate) {
    const relatedIds = data.orders
      .filter((order) => order.items.some((item) => item.dish === promoteCandidate.dish))
      .map((order) => order.orderId);
    insights.push({
      id: "promote-dish",
      category: "menu",
      title: `Promote ${promoteCandidate.dish}`,
      explanation: `${promoteCandidate.dish} has a strong ${promoteCandidate.estimatedMargin}% margin but only ${promoteCandidate.orders} orders — a lunch feature could lift demand.`,
      value: `${promoteCandidate.estimatedMargin}% margin`,
      priority: "medium",
      trace: {
        description: `${promoteCandidate.orders} orders logged for ${promoteCandidate.dish}, well below the menu's busiest sellers.`,
        calculation: `Margin = (avg price − est. cost) / avg price = ${promoteCandidate.estimatedMargin}%`,
        confidence: 65,
        relatedOrderIds: relatedIds,
      },
    });
  }

  // Customer: dessert attach rate (worked example from the product spec)
  const mainOrders = orderIdsWithCategory(todayOrders.length > 0 ? todayOrders : data.orders, "mains");
  const dessertOrders = orderIdsWithCategory(todayOrders.length > 0 ? todayOrders : data.orders, "desserts");
  if (mainOrders.length > 0) {
    const attachRate = round((dessertOrders.length / mainOrders.length) * 100, 1);
    const benchmark = 15;
    const dessertMenuItems = data.menu.filter((item) => item.category.toLowerCase() === "desserts");
    const avgDessertPrice =
      dessertMenuItems.length > 0
        ? dessertMenuItems.reduce((sum, item) => sum + item.price, 0) / dessertMenuItems.length
        : 40;
    const missedGuests = Math.max(0, mainOrders.length - dessertOrders.length);
    const estimatedMissedMonthly = round(missedGuests * avgDessertPrice * 0.4 * 30, 0);
    insights.push({
      id: "dessert-attach-rate",
      category: "customer",
      title: "Dessert attach rate is low",
      explanation: `Dessert orders: ${dessertOrders.length}. Main course orders: ${mainOrders.length}. Dessert attach rate: ${attachRate}%. Benchmark target: ${benchmark}%. Estimated missed revenue: AED ${estimatedMissedMonthly.toLocaleString()}/month.`,
      value: `${attachRate}%`,
      estimatedMonthlyGain: estimatedMissedMonthly,
      priority: attachRate < benchmark ? "high" : "low",
      trace: {
        description: `${dessertOrders.length} of ${mainOrders.length} main-course orders also included a dessert.`,
        calculation: `${dessertOrders.length} / ${mainOrders.length} = ${attachRate}%`,
        confidence: 85,
        relatedOrderIds: [...new Set([...mainOrders, ...dessertOrders])],
      },
    });
  }

  // Customer: average spend
  const averageSpend = data.orders.length > 0 ? round(revenueOf(data.orders) / data.orders.length, 2) : 0;
  insights.push({
    id: "average-spend",
    category: "customer",
    title: "Average spend per order",
    explanation: `Guests spend an average of AED ${averageSpend.toLocaleString()} per order across all uploaded data.`,
    value: `AED ${averageSpend.toLocaleString()}`,
    trace: {
      description: `Total revenue divided by ${data.orders.length} orders.`,
      calculation: `AED ${round(revenueOf(data.orders), 2).toLocaleString()} / ${data.orders.length} = AED ${averageSpend.toLocaleString()}`,
      confidence: 95,
      relatedOrderIds: data.orders.map((order) => order.orderId),
    },
  });

  // Operations: slow table turnover
  if (data.tables.length > 0) {
    const durations = data.tables
      .map((table) => {
        const start = timeToMinutes(table.seatedTime);
        const end = timeToMinutes(table.clearedTime);
        return start !== null && end !== null ? end - start : null;
      })
      .filter((value): value is number => value !== null);
    if (durations.length > 0) {
      const avgDuration = round(durations.reduce((sum, value) => sum + value, 0) / durations.length, 0);
      const target = 65;
      insights.push({
        id: "table-turnover",
        category: "operations",
        title: avgDuration > target ? "Table turnover is slow" : "Table turnover is healthy",
        explanation: `Average table duration is ${avgDuration} minutes across ${durations.length} table sessions (target: ${target} minutes).`,
        value: `${avgDuration} min`,
        trend: avgDuration > target ? "down" : "up",
        trace: {
          description: `Computed from ${durations.length} table sessions with both a seated and cleared time.`,
          calculation: `Sum of durations / ${durations.length} sessions = ${avgDuration} minutes`,
          confidence: 70,
          relatedOrderIds: [],
        },
      });
    }
  }

  // Operations: peak hour staffing
  if (peakHour && peakHour[1].count >= 6) {
    const [hour, stats] = peakHour;
    insights.push({
      id: "peak-hour-staffing",
      category: "operations",
      title: "Add staff during peak hours",
      explanation: `Order volume peaks around ${hour}:00–${hour + 1}:00 with ${stats.count} orders. An extra server could reduce wait times.`,
      value: `${stats.count} orders`,
      estimatedMonthlyGain: round(stats.count * 15 * 4, 0),
      priority: "medium",
      trace: {
        description: `${stats.count} orders fall inside the ${hour}:00–${hour + 1}:00 window.`,
        calculation: `Estimated gain = orders × AED 15 recovered per order × 4 weeks = AED ${round(stats.count * 15 * 4, 0).toLocaleString()}`,
        confidence: 70,
        relatedOrderIds: stats.ids,
      },
    });
  }

  // Review: common complaint theme
  if (data.reviews.length > 0) {
    const complaints = extractThemes(data.reviews, NEGATIVE_KEYWORDS);
    if (complaints.length > 0) {
      const matchingReviews = data.reviews.filter((review) =>
        Object.entries(NEGATIVE_KEYWORDS).some(
          ([keyword, theme]) => theme === complaints[0] && review.text.toLowerCase().includes(keyword)
        )
      );
      insights.push({
        id: "common-complaint",
        category: "review",
        title: `Most common complaint: ${complaints[0]}`,
        explanation: `${matchingReviews.length} of ${data.reviews.length} reviews mention ${complaints[0].toLowerCase()}.`,
        value: `${matchingReviews.length} reviews`,
        trace: {
          description: `Keyword-matched across ${data.reviews.length} uploaded reviews.`,
          calculation: `${matchingReviews.length} / ${data.reviews.length} reviews mention this theme`,
          confidence: 60,
          relatedOrderIds: [],
        },
      });
    }

    // Review: rating trend (needs at least two distinct review dates)
    const reviewDates = Array.from(new Set(data.reviews.map((review) => review.date))).filter(Boolean).sort();
    if (reviewDates.length >= 2) {
      const earliestDate = reviewDates[0];
      const latestDate = reviewDates[reviewDates.length - 1];
      const earliestReviews = data.reviews.filter((review) => review.date === earliestDate);
      const latestReviews = data.reviews.filter((review) => review.date === latestDate);
      const earliestAvg = round(
        earliestReviews.reduce((sum, review) => sum + review.rating, 0) / earliestReviews.length,
        1
      );
      const latestAvg = round(
        latestReviews.reduce((sum, review) => sum + review.rating, 0) / latestReviews.length,
        1
      );
      insights.push({
        id: "rating-trend",
        category: "review",
        title: latestAvg >= earliestAvg ? "Ratings are improving" : "Ratings are declining",
        explanation: `Average rating moved from ${earliestAvg}★ on ${earliestDate} to ${latestAvg}★ on ${latestDate}.`,
        value: `${latestAvg}★`,
        trend: latestAvg >= earliestAvg ? "up" : "down",
        trace: {
          description: `Compares ${earliestReviews.length} reviews on ${earliestDate} against ${latestReviews.length} reviews on ${latestDate}.`,
          calculation: `${latestAvg} − ${earliestAvg} = ${round(latestAvg - earliestAvg, 1)}`,
          confidence: 55,
          relatedOrderIds: [],
        },
      });
    }
  }

  return insights;
}
