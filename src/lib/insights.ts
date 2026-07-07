import type {
  DailyBrief,
  DashboardMetrics,
  GuestInsights,
  MenuPerformanceRow,
  Opportunity,
  Order,
  RestaurantData,
  Review,
  ReviewSummary,
} from "@/lib/types";

export function uniqueSortedDates(orders: Order[]): string[] {
  return Array.from(new Set(orders.map((order) => order.date)))
    .filter(Boolean)
    .sort();
}

export function ordersOnDate(orders: Order[], date: string | undefined): Order[] {
  if (!date) return [];
  return orders.filter((order) => order.date === date);
}

export function revenueOf(orders: Order[]): number {
  return orders.reduce((sum, order) => sum + order.total, 0);
}

export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function dishRevenue(orders: Order[]): Map<string, { orders: number; revenue: number; category: string }> {
  const map = new Map<string, { orders: number; revenue: number; category: string }>();
  for (const order of orders) {
    for (const item of order.items) {
      const entry = map.get(item.dish) ?? { orders: 0, revenue: 0, category: item.category };
      entry.orders += item.quantity;
      entry.revenue += item.price * item.quantity;
      map.set(item.dish, entry);
    }
  }
  return map;
}

export function timeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export const NEGATIVE_KEYWORDS: Record<string, string> = {
  slow: "Slow service",
  wait: "Long wait times",
  waited: "Long wait times",
  rushed: "Guests feel rushed",
  overcooked: "Overcooked dishes",
  cold: "Food served cold",
  bland: "Bland flavors",
  noisy: "Noise levels",
  expensive: "Perceived high prices",
};

export const POSITIVE_KEYWORDS: Record<string, string> = {
  friendly: "Friendly staff",
  attentive: "Attentive service",
  delicious: "Delicious food",
  fresh: "Fresh ingredients",
  cozy: "Cozy atmosphere",
  excellent: "Excellent quality",
  amazing: "Amazing experience",
  perfect: "Perfect execution",
  wonderful: "Wonderful experience",
  lovely: "Lovely ambiance",
};

export function extractThemes(reviews: Review[], keywordMap: Record<string, string>): string[] {
  const counts = new Map<string, number>();
  for (const review of reviews) {
    const text = review.text.toLowerCase();
    for (const [keyword, theme] of Object.entries(keywordMap)) {
      if (text.includes(keyword)) {
        counts.set(theme, (counts.get(theme) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([theme]) => theme);
}

export function calculateDashboardMetrics(data: RestaurantData): DashboardMetrics {
  const dates = uniqueSortedDates(data.orders);
  const today = dates[dates.length - 1];
  const previous = dates[dates.length - 2];

  const todayOrders = ordersOnDate(data.orders, today);
  const previousOrders = ordersOnDate(data.orders, previous);

  const todayRevenue = round(revenueOf(todayOrders), 2);
  const previousRevenue = revenueOf(previousOrders);
  const revenueChangePct =
    previous && previousRevenue > 0
      ? round(((todayRevenue - previousRevenue) / previousRevenue) * 100, 1)
      : null;

  const todayTables = data.tables.filter((table) => table.date === today);
  const guestsToday =
    todayTables.length > 0
      ? todayTables.reduce((sum, table) => sum + table.guests, 0)
      : todayOrders.length;

  const averageBill = todayOrders.length > 0 ? round(todayRevenue / todayOrders.length, 2) : 0;

  const activeTableIds = new Set(todayTables.map((table) => table.tableId));
  const totalTableIds = new Set(data.tables.map((table) => table.tableId));

  const dessertOrders = todayOrders.filter((order) =>
    order.items.some((item) => item.category.toLowerCase() === "desserts")
  );
  const dessertAttachRate =
    todayOrders.length > 0 ? round((dessertOrders.length / todayOrders.length) * 100, 1) : 0;

  const customerRating =
    data.reviews.length > 0
      ? round(data.reviews.reduce((sum, review) => sum + review.rating, 0) / data.reviews.length, 1)
      : null;

  const dishMap = dishRevenue(todayOrders.length > 0 ? todayOrders : data.orders);
  const sortedDishes = Array.from(dishMap.entries()).sort((a, b) => b[1].revenue - a[1].revenue);
  const bestSellingDish = sortedDishes[0]?.[0] ?? null;
  const worstPerformingDish = sortedDishes[sortedDishes.length - 1]?.[0] ?? null;

  const opportunities = generateOpportunities(data);
  const predictedMonthlyGain = opportunities.reduce(
    (sum, opportunity) => sum + opportunity.estimatedMonthlyGain,
    0
  );

  return {
    todayRevenue,
    revenueChangePct,
    guestsToday,
    averageBill,
    activeTables: activeTableIds.size,
    totalTables: totalTableIds.size,
    dessertAttachRate,
    customerRating,
    bestSellingDish,
    worstPerformingDish,
    predictedMonthlyGain: round(predictedMonthlyGain, 0),
  };
}

export function calculateMenuPerformance(data: RestaurantData): MenuPerformanceRow[] {
  const dates = uniqueSortedDates(data.orders);
  const today = dates[dates.length - 1];
  const previous = dates[dates.length - 2];

  const todayDishes = dishRevenue(ordersOnDate(data.orders, today));
  const previousDishes = dishRevenue(ordersOnDate(data.orders, previous));
  const allTimeDishes = dishRevenue(data.orders);

  const dishNames = new Set<string>([
    ...data.menu.map((item) => item.dish),
    ...Array.from(allTimeDishes.keys()),
  ]);

  const rows: MenuPerformanceRow[] = [];

  const allOrderCounts = Array.from(allTimeDishes.values()).map((entry) => entry.orders);
  const maxOrders = Math.max(1, ...allOrderCounts);
  const lowOrderThreshold = maxOrders * 0.25;

  for (const dish of dishNames) {
    const menuItem = data.menu.find((item) => item.dish === dish);
    const stats = allTimeDishes.get(dish) ?? { orders: 0, revenue: 0, category: menuItem?.category ?? "Uncategorized" };
    const price = menuItem?.price ?? (stats.orders > 0 ? round(stats.revenue / stats.orders, 2) : 0);
    const cost = menuItem?.cost ?? price * 0.35;
    const estimatedMargin = price > 0 ? round(((price - cost) / price) * 100, 1) : 0;

    const todayCount = todayDishes.get(dish)?.orders ?? 0;
    const previousCount = previousDishes.get(dish)?.orders ?? 0;
    let trend: MenuPerformanceRow["trend"] = "flat";
    if (todayCount > previousCount) trend = "up";
    else if (todayCount < previousCount) trend = "down";

    let recommendation = "Improve menu description";
    const category = (menuItem?.category ?? stats.category).toLowerCase();

    if (stats.orders <= lowOrderThreshold && estimatedMargin >= 55) {
      recommendation = "Promote during lunch";
    } else if (stats.orders <= lowOrderThreshold) {
      recommendation = "Remove or reposition";
    } else if (estimatedMargin >= 60 && trend !== "down") {
      recommendation = "Raise price by AED 2";
    } else if (category === "mains" && stats.orders > lowOrderThreshold) {
      recommendation = "Bundle with dessert";
    } else if (trend === "down") {
      recommendation = "Improve menu description";
    }

    rows.push({
      dish,
      category: menuItem?.category ?? stats.category,
      orders: stats.orders,
      revenue: round(stats.revenue, 2),
      averagePrice: price,
      estimatedMargin,
      trend,
      recommendation,
    });
  }

  return rows.sort((a, b) => b.revenue - a.revenue);
}

export function generateOpportunities(data: RestaurantData): Opportunity[] {
  const opportunities: Opportunity[] = [];
  const dates = uniqueSortedDates(data.orders);
  const today = dates[dates.length - 1];
  const todayOrders = ordersOnDate(data.orders, today);
  const referenceOrders = todayOrders.length > 0 ? todayOrders : data.orders;

  const mainCourseOrders = referenceOrders.filter((order) =>
    order.items.some((item) => item.category.toLowerCase() === "mains")
  );
  const dessertOrders = referenceOrders.filter((order) =>
    order.items.some((item) => item.category.toLowerCase() === "desserts")
  );
  const dessertMenuItems = data.menu.filter((item) => item.category.toLowerCase() === "desserts");
  const avgDessertPrice =
    dessertMenuItems.length > 0
      ? dessertMenuItems.reduce((sum, item) => sum + item.price, 0) / dessertMenuItems.length
      : 40;

  const missedDesserts = Math.max(0, mainCourseOrders.length - dessertOrders.length);
  if (missedDesserts > 0) {
    const dailyMissedRevenue = missedDesserts * avgDessertPrice * 0.4;
    opportunities.push({
      title: "Increase dessert sales",
      explanation: `${missedDesserts} guests skipped dessert after their main course today.`,
      estimatedMonthlyGain: round(dailyMissedRevenue * 30, 0),
      confidence: 78,
      priority: "high",
    });
  }

  const menuRows = calculateMenuPerformance(data);
  const underpriced = menuRows.find(
    (row) => row.estimatedMargin >= 60 && row.orders > 0 && row.recommendation === "Raise price by AED 2"
  );
  if (underpriced) {
    opportunities.push({
      title: `Raise ${underpriced.dish} by AED 2`,
      explanation: `Current margin (${underpriced.estimatedMargin}%) comfortably supports a small price increase without hurting demand.`,
      estimatedMonthlyGain: round(underpriced.orders * 2 * 30, 0),
      confidence: 88,
      priority: "high",
    });
  }

  const lowSellingHighMargin = menuRows.find(
    (row) => row.recommendation === "Promote during lunch"
  );
  if (lowSellingHighMargin) {
    opportunities.push({
      title: `Promote ${lowSellingHighMargin.dish} at lunch`,
      explanation: `High margin (${lowSellingHighMargin.estimatedMargin}%) but only ${lowSellingHighMargin.orders} orders logged — a lunch feature could lift demand.`,
      estimatedMonthlyGain: round(lowSellingHighMargin.averagePrice * 8 * 30 * 0.3, 0),
      confidence: 65,
      priority: "medium",
    });
  }

  const hourCounts = new Map<number, number>();
  for (const order of data.orders) {
    const minutes = timeToMinutes(order.time);
    if (minutes === null) continue;
    const hour = Math.floor(minutes / 60);
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }
  const peakHourEntry = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  if (peakHourEntry && peakHourEntry[1] >= 6) {
    const [hour] = peakHourEntry;
    opportunities.push({
      title: "Add staff during peak hours",
      explanation: `Order volume peaks around ${hour}:00–${hour + 1}:00. An extra server could reduce wait times during the rush.`,
      estimatedMonthlyGain: round(peakHourEntry[1] * 15 * 4, 0),
      confidence: 70,
      priority: "medium",
    });
  }

  if (data.tables.length > 0) {
    const durations = data.tables
      .map((table) => {
        const start = timeToMinutes(table.seatedTime);
        const end = timeToMinutes(table.clearedTime);
        if (start === null || end === null) return null;
        return end - start;
      })
      .filter((value): value is number => value !== null);

    const avgDuration =
      durations.length > 0 ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null;

    if (avgDuration !== null && avgDuration > 65) {
      opportunities.push({
        title: "Reduce slow table turnover",
        explanation: `Average table duration is ${round(avgDuration, 0)} minutes, above the 65-minute target. Faster course pacing could seat more covers.`,
        estimatedMonthlyGain: round((avgDuration - 65) * 6 * 30, 0),
        confidence: 60,
        priority: "low",
      });
    }
  }

  return opportunities.sort((a, b) => b.estimatedMonthlyGain - a.estimatedMonthlyGain);
}

export function generateDailyBrief(data: RestaurantData): DailyBrief {
  const metrics = calculateDashboardMetrics(data);
  const opportunities = generateOpportunities(data);
  const topOpportunity = opportunities[0];

  const changeDirection =
    metrics.revenueChangePct === null ? null : metrics.revenueChangePct >= 0 ? "up" : "down";

  const whatHappened =
    metrics.revenueChangePct === null
      ? `Yesterday's revenue was AED ${metrics.todayRevenue.toLocaleString()}.`
      : `Yesterday revenue ${changeDirection === "up" ? "increased" : "decreased"} by ${Math.abs(
          metrics.revenueChangePct
        )}%, closing at AED ${metrics.todayRevenue.toLocaleString()}.`;

  const whyRevenueChanged =
    metrics.bestSellingDish && metrics.revenueChangePct !== null
      ? `${metrics.bestSellingDish} drove most of the ${changeDirection === "up" ? "gain" : "shortfall"}, while ${
          metrics.worstPerformingDish ?? "other items"
        } lagged behind.`
      : metrics.bestSellingDish
      ? `${metrics.bestSellingDish} was the strongest contributor to revenue.`
      : "Not enough order history yet to explain the change.";

  const missedRevenueOpportunity = topOpportunity
    ? topOpportunity.explanation
    : "No major missed-revenue opportunity detected today.";

  const recommendedAction = topOpportunity
    ? topOpportunity.title
    : "Keep monitoring performance as more data comes in.";

  return {
    greeting: "Good morning.",
    whatHappened,
    whyRevenueChanged,
    bestDish: metrics.bestSellingDish ?? "Not enough data yet",
    worstDish: metrics.worstPerformingDish ?? "Not enough data yet",
    missedOpportunity: missedRevenueOpportunity,
    recommendedAction,
    estimatedMonthlyGain: topOpportunity?.estimatedMonthlyGain ?? 0,
  };
}

export function calculateGuestInsights(data: RestaurantData): GuestInsights {
  const ordersWithCustomer = data.orders.filter((order) => order.customerId);
  let returningGuestRate: number | null = null;

  if (ordersWithCustomer.length > 0) {
    const visitsByCustomer = new Map<string, Set<string>>();
    for (const order of ordersWithCustomer) {
      const customerId = order.customerId!;
      const visits = visitsByCustomer.get(customerId) ?? new Set<string>();
      visits.add(order.date);
      visitsByCustomer.set(customerId, visits);
    }
    const returning = Array.from(visitsByCustomer.values()).filter((visits) => visits.size > 1).length;
    returningGuestRate = round((returning / visitsByCustomer.size) * 100, 1);
  }

  const totalRevenue = revenueOf(data.orders);
  const averageSpend = data.orders.length > 0 ? round(totalRevenue / data.orders.length, 2) : 0;

  let averageVisitMinutes: number | null = null;
  if (data.tables.length > 0) {
    const durations = data.tables
      .map((table) => {
        const start = timeToMinutes(table.seatedTime);
        const end = timeToMinutes(table.clearedTime);
        if (start === null || end === null) return null;
        return end - start;
      })
      .filter((value): value is number => value !== null);
    if (durations.length > 0) {
      averageVisitMinutes = round(durations.reduce((sum, value) => sum + value, 0) / durations.length, 0);
    }
  }

  const satisfactionScore =
    data.reviews.length > 0
      ? round(data.reviews.reduce((sum, review) => sum + review.rating, 0) / data.reviews.length, 1)
      : null;

  const commonComplaints = extractThemes(data.reviews, NEGATIVE_KEYWORDS);
  const commonCompliments = extractThemes(data.reviews, POSITIVE_KEYWORDS);

  const hourCounts = new Map<number, number>();
  for (const order of data.orders) {
    const minutes = timeToMinutes(order.time);
    if (minutes === null) continue;
    const hour = Math.floor(minutes / 60);
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }
  const peakHours = Array.from(hourCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([hour]) => `${hour}:00–${hour + 1}:00`);

  return {
    returningGuestRate,
    averageSpend,
    averageVisitMinutes,
    satisfactionScore,
    commonComplaints,
    commonCompliments,
    peakHours,
  };
}

export function summarizeReviews(data: RestaurantData): ReviewSummary {
  const averageRating =
    data.reviews.length > 0
      ? round(data.reviews.reduce((sum, review) => sum + review.rating, 0) / data.reviews.length, 1)
      : 0;

  const positiveThemes = extractThemes(data.reviews, POSITIVE_KEYWORDS);
  const negativeThemes = extractThemes(data.reviews, NEGATIVE_KEYWORDS);

  const recentReviews = [...data.reviews]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5);

  let aiSummary = "Not enough reviews yet to generate a summary.";
  if (data.reviews.length > 0) {
    const sentiment = averageRating >= 4.3 ? "excellent" : averageRating >= 3.5 ? "solid" : "mixed";
    const themePart = positiveThemes[0]
      ? ` Guests frequently praise ${positiveThemes[0].toLowerCase()}.`
      : "";
    const concernPart = negativeThemes[0]
      ? ` The most common concern is ${negativeThemes[0].toLowerCase()}.`
      : "";
    aiSummary = `Guest sentiment is ${sentiment}, averaging ${averageRating}★ across ${data.reviews.length} reviews.${themePart}${concernPart}`;
  }

  return {
    averageRating,
    totalReviews: data.reviews.length,
    positiveThemes,
    negativeThemes,
    recentReviews,
    aiSummary,
  };
}

export function answerBusinessQuestion(question: string, data: RestaurantData): string {
  const q = question.toLowerCase();
  const metrics = calculateDashboardMetrics(data);
  const opportunities = generateOpportunities(data);
  const menuRows = calculateMenuPerformance(data);
  const guestInsights = calculateGuestInsights(data);

  const noData = data.orders.length === 0;
  if (noData) {
    return "I can answer questions about revenue, menu performance, guests, reviews, and opportunities once your restaurant data is uploaded.";
  }

  if (q.includes("revenue") && (q.includes("why") || q.includes("up") || q.includes("down"))) {
    if (metrics.revenueChangePct === null) {
      return `Revenue closed at AED ${metrics.todayRevenue.toLocaleString()}. I need at least two days of data to explain a change.`;
    }
    const direction = metrics.revenueChangePct >= 0 ? "up" : "down";
    return `Revenue was ${direction} ${Math.abs(metrics.revenueChangePct)}% versus the prior day. ${
      metrics.bestSellingDish ?? "Your top dish"
    } led sales, while ${metrics.worstPerformingDish ?? "some items"} underperformed.`;
  }

  if (q.includes("remove") || (q.includes("which") && q.includes("dish"))) {
    const removalCandidate = menuRows.find((row) => row.recommendation === "Remove or reposition");
    return removalCandidate
      ? `${removalCandidate.dish} has the lowest order volume (${removalCandidate.orders} orders) relative to the rest of your menu — consider removing or repositioning it.`
      : "No dish is a clear removal candidate right now — everything is pulling reasonable volume.";
  }

  if (q.includes("dessert")) {
    const dessertOpportunity = opportunities.find((item) => item.title.toLowerCase().includes("dessert"));
    return dessertOpportunity
      ? `${dessertOpportunity.explanation} Prompting servers to offer dessert right after clearing mains could add roughly AED ${dessertOpportunity.estimatedMonthlyGain.toLocaleString()}/month.`
      : `Your dessert attach rate is ${metrics.dessertAttachRate}%. Training servers to suggest dessert proactively is the fastest lever.`;
  }

  if (q.includes("busiest") || q.includes("peak") || q.includes("busy")) {
    return guestInsights.peakHours.length > 0
      ? `Your busiest window is ${guestInsights.peakHours[0]}${
          guestInsights.peakHours[1] ? `, with a secondary peak around ${guestInsights.peakHours[1]}` : ""
        }.`
      : "I don't have enough order timestamps yet to identify a peak hour.";
  }

  if (q.includes("today") || q.includes("what should i do")) {
    const topOpportunity = opportunities[0];
    return topOpportunity
      ? `Top priority today: ${topOpportunity.title}. ${topOpportunity.explanation}`
      : "Everything looks steady today — keep an eye on dessert attach rate and table turnover.";
  }

  if (q.includes("promote") || q.includes("which item")) {
    const promoteCandidate = menuRows.find((row) => row.recommendation === "Promote during lunch");
    return promoteCandidate
      ? `${promoteCandidate.dish} has strong margin (${promoteCandidate.estimatedMargin}%) but low volume (${promoteCandidate.orders} orders) — a great lunch promotion candidate.`
      : "Your current bestsellers are already well promoted. Consider featuring a high-margin item on your specials board.";
  }

  return "I can answer questions about revenue, menu performance, guests, reviews, and opportunities once your restaurant data is uploaded.";
}

export function rankMenuByQuantity(data: RestaurantData): {
  dish: string;
  quantitySold: number;
  revenue: number;
  profit: number;
  margin: number;
  categoryShare: number;
}[] {
  const dishMap = dishRevenue(data.orders);
  const totalRevenue = revenueOf(data.orders);

  return Array.from(dishMap.entries())
    .map(([dish, stats]) => {
      const menuItem = data.menu.find((item) => item.dish === dish);
      const price = menuItem?.price ?? (stats.orders > 0 ? stats.revenue / stats.orders : 0);
      const cost = menuItem?.cost ?? price * 0.35;
      const profit = stats.revenue - cost * stats.orders;
      const margin = price > 0 ? round(((price - cost) / price) * 100, 1) : 0;
      const categoryShare = totalRevenue > 0 ? round((stats.revenue / totalRevenue) * 100, 1) : 0;

      return {
        dish,
        quantitySold: stats.orders,
        revenue: round(stats.revenue, 2),
        profit: round(profit, 2),
        margin,
        categoryShare,
      };
    })
    .sort((a, b) => b.quantitySold - a.quantitySold);
}

export function calculateRevenueTrend(data: RestaurantData): { date: string; revenue: number }[] {
  return uniqueSortedDates(data.orders).map((date) => ({
    date,
    revenue: round(revenueOf(ordersOnDate(data.orders, date)), 2),
  }));
}

export function calculateWeekOverWeekChange(data: RestaurantData): number | null {
  const dates = uniqueSortedDates(data.orders);
  if (dates.length < 4) return null;

  const midpoint = dates.length - Math.floor(dates.length / 2);
  const priorDates = dates.slice(0, midpoint);
  const recentDates = dates.slice(midpoint);

  const priorRevenue = revenueOf(data.orders.filter((order) => priorDates.includes(order.date)));
  const recentRevenue = revenueOf(data.orders.filter((order) => recentDates.includes(order.date)));

  if (priorRevenue <= 0) return null;
  return round(((recentRevenue - priorRevenue) / priorRevenue) * 100, 1);
}

export function calculateMenuMomentum(
  data: RestaurantData
): { dish: string; direction: "up" | "down" | "flat"; changePct: number }[] {
  const dates = uniqueSortedDates(data.orders);
  if (dates.length < 2) return [];

  const midpoint = dates.length - Math.floor(dates.length / 2);
  const priorDates = new Set(dates.slice(0, midpoint));
  const recentDates = new Set(dates.slice(midpoint));

  const priorDishes = dishRevenue(data.orders.filter((order) => priorDates.has(order.date)));
  const recentDishes = dishRevenue(data.orders.filter((order) => recentDates.has(order.date)));

  const dishNames = new Set<string>([...priorDishes.keys(), ...recentDishes.keys()]);

  return Array.from(dishNames)
    .map((dish) => {
      const priorCount = priorDishes.get(dish)?.orders ?? 0;
      const recentCount = recentDishes.get(dish)?.orders ?? 0;
      const changePct =
        priorCount > 0
          ? round(((recentCount - priorCount) / priorCount) * 100, 1)
          : recentCount > 0
          ? 100
          : 0;
      const direction: "up" | "down" | "flat" =
        recentCount > priorCount ? "up" : recentCount < priorCount ? "down" : "flat";
      return { dish, direction, changePct };
    })
    .sort((a, b) => b.changePct - a.changePct);
}

export function calculateReviewSentimentTrend(
  data: RestaurantData
): { date: string; averageRating: number }[] {
  const dates = Array.from(new Set(data.reviews.map((review) => review.date))).filter(Boolean).sort();

  return dates.map((date) => {
    const reviewsOnDate = data.reviews.filter((review) => review.date === date);
    return {
      date,
      averageRating: round(
        reviewsOnDate.reduce((sum, review) => sum + review.rating, 0) / reviewsOnDate.length,
        1
      ),
    };
  });
}
