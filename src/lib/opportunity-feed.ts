import {
  calculateMenuPerformance,
  dishRevenue,
  ordersOnDate,
  round,
  timeToMinutes,
  uniqueSortedDates,
} from "@/lib/insights";
import type { FeedOpportunity, RestaurantData } from "@/lib/types";

/**
 * Generates the opportunity feed from uploaded data. Every opportunity carries a
 * `sourceData` string so a user can see what it was derived from. Ids are stable
 * across regenerations (derived from dish/category names) so saved localStorage
 * statuses keep pointing at the right opportunity.
 */
export function generateOpportunityFeed(data: RestaurantData): FeedOpportunity[] {
  const opportunities: FeedOpportunity[] = [];

  const dates = uniqueSortedDates(data.orders);
  const today = dates[dates.length - 1];
  const todayOrders = ordersOnDate(data.orders, today);
  const referenceOrders = todayOrders.length > 0 ? todayOrders : data.orders;
  const menuRows = calculateMenuPerformance(data);

  // 1. Increase dessert sales
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
    opportunities.push({
      id: "dessert-sales",
      title: "Increase dessert sales",
      category: "Dessert Sales",
      explanation: `${missedDesserts} guests skipped dessert after their main course today.`,
      estimatedMonthlyGain: round(missedDesserts * avgDessertPrice * 0.4 * 30, 0),
      confidence: 78,
      priority: "high",
      sourceData: `${mainCourseOrders.length} main-course orders vs. ${dessertOrders.length} dessert orders on ${
        today ?? "the latest day"
      }.`,
      status: "new",
    });
  }

  // 2. Raise price of high-demand, high-margin items
  const raiseCandidates = menuRows
    .filter((row) => row.recommendation === "Raise price by AED 2")
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 3);
  for (const row of raiseCandidates) {
    opportunities.push({
      id: `raise-price-${row.dish}`,
      title: `Raise ${row.dish} by AED 2`,
      category: "Pricing",
      explanation: `${row.dish} sells well (${row.orders} orders) at a ${row.estimatedMargin}% margin — comfortable room for a small price increase without hurting demand.`,
      estimatedMonthlyGain: round(row.orders * 2 * 30, 0),
      confidence: 88,
      priority: "high",
      sourceData: `${row.orders} historical orders for ${row.dish}, average price AED ${row.averagePrice}, estimated margin ${row.estimatedMargin}%.`,
      status: "new",
    });
  }

  // 3. Promote low-selling, high-margin items
  const promoteCandidates = menuRows
    .filter((row) => row.recommendation === "Promote during lunch")
    .sort((a, b) => b.estimatedMargin - a.estimatedMargin)
    .slice(0, 3);
  for (const row of promoteCandidates) {
    opportunities.push({
      id: `promote-${row.dish}`,
      title: `Promote ${row.dish} at lunch`,
      category: "Promotion",
      explanation: `${row.dish} has a high ${row.estimatedMargin}% margin but only ${row.orders} orders logged — a lunch feature could lift demand.`,
      estimatedMonthlyGain: round(row.averagePrice * 8 * 30 * 0.3, 0),
      confidence: 65,
      priority: "medium",
      sourceData: `${row.orders} historical orders for ${row.dish} against a menu-wide low-order threshold.`,
      status: "new",
    });
  }

  // 4. Add staff during peak hours
  const hourCounts = new Map<number, number>();
  for (const order of data.orders) {
    const minutes = timeToMinutes(order.time);
    if (minutes === null) continue;
    const hour = Math.floor(minutes / 60);
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }
  const peakHourEntry = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  if (peakHourEntry && peakHourEntry[1] >= 6) {
    const [hour, count] = peakHourEntry;
    opportunities.push({
      id: "peak-staffing",
      title: "Add staff during peak hours",
      category: "Staffing",
      explanation: `Order volume peaks around ${hour}:00–${hour + 1}:00. An extra server could reduce wait times during the rush.`,
      estimatedMonthlyGain: round(count * 15 * 4, 0),
      confidence: 70,
      priority: "medium",
      sourceData: `${count} orders placed between ${hour}:00 and ${hour + 1}:00 across all uploaded order history.`,
      status: "new",
    });
  }

  // 5. Reduce slow table turnover
  if (data.tables.length > 0) {
    const durations = data.tables
      .map((table) => {
        const start = timeToMinutes(table.seatedTime);
        const end = timeToMinutes(table.clearedTime);
        return start !== null && end !== null ? end - start : null;
      })
      .filter((value): value is number => value !== null);
    const avgDuration =
      durations.length > 0 ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null;
    const target = 65;
    if (avgDuration !== null && avgDuration > target) {
      opportunities.push({
        id: "table-turnover",
        title: "Reduce slow table turnover",
        category: "Table Turnover",
        explanation: `Average table duration is ${round(avgDuration, 0)} minutes, above the ${target}-minute target. Faster course pacing could seat more covers.`,
        estimatedMonthlyGain: round((avgDuration - target) * 6 * 30, 0),
        confidence: 60,
        priority: "low",
        sourceData: `${durations.length} table sessions with both a seated and cleared time, averaging ${round(
          avgDuration,
          0
        )} minutes.`,
        status: "new",
      });
    }
  }

  // 6. Improve low-rated dishes (keyword-matches review text against menu dish names)
  if (data.reviews.length > 0 && data.menu.length > 0) {
    const dishMentions = new Map<string, { ratings: number[]; reviewIds: string[] }>();
    for (const review of data.reviews) {
      const text = review.text.toLowerCase();
      for (const item of data.menu) {
        if (!item.dish || !text.includes(item.dish.toLowerCase())) continue;
        const entry = dishMentions.get(item.dish) ?? { ratings: [], reviewIds: [] };
        entry.ratings.push(review.rating);
        entry.reviewIds.push(review.reviewId);
        dishMentions.set(item.dish, entry);
      }
    }

    const dishStats = dishRevenue(data.orders);
    const lowRated = Array.from(dishMentions.entries())
      .map(([dish, entry]) => ({
        dish,
        avgRating: round(entry.ratings.reduce((sum, rating) => sum + rating, 0) / entry.ratings.length, 1),
        reviewCount: entry.ratings.length,
      }))
      .filter((entry) => entry.avgRating < 3.5)
      .sort((a, b) => a.avgRating - b.avgRating)
      .slice(0, 3);

    for (const entry of lowRated) {
      const revenue = dishStats.get(entry.dish)?.revenue ?? 0;
      opportunities.push({
        id: `dish-quality-${entry.dish}`,
        title: `Improve ${entry.dish} quality`,
        category: "Dish Quality",
        explanation: `${entry.dish} is mentioned in ${entry.reviewCount} review${
          entry.reviewCount === 1 ? "" : "s"
        } averaging ${entry.avgRating}★ — below the 3.5★ threshold guests expect.`,
        estimatedMonthlyGain: round(revenue * 0.15, 0),
        confidence: 55,
        priority: entry.avgRating < 2.5 ? "high" : "medium",
        sourceData: `${entry.reviewCount} review(s) mentioning "${entry.dish}" by name, averaging ${entry.avgRating}★.`,
        status: "new",
      });
    }
  }

  return opportunities.sort((a, b) => b.estimatedMonthlyGain - a.estimatedMonthlyGain);
}
