import { dishRevenue, round } from "@/lib/insights";
import type {
  GuestPreferencesRecord,
  MenuItem,
  Order,
  QRInteraction,
  QRIntent,
  QRMetrics,
  QROrder,
  QRReview,
} from "@/lib/types";

const SPICY_KEYWORDS = [
  "spicy",
  "chili",
  "chilli",
  "harissa",
  "arrabiata",
  "cajun",
  "buffalo",
  "jalapeno",
  "peri-peri",
  "piri",
  "sriracha",
  "curry",
];

const MEAT_KEYWORDS = [
  "chicken",
  "beef",
  "steak",
  "lamb",
  "shrimp",
  "prawn",
  "salmon",
  "fish",
  "pork",
  "bacon",
  "duck",
  "turkey",
  "tuna",
  "anchov",
  "meat",
];

const NUT_KEYWORDS = ["peanut", "almond", "cashew", "walnut", "pistachio", "hazelnut", "pecan", "nut"];

const PROTEIN_KEYWORDS = ["steak", "chicken", "salmon", "beef", "lamb", "tuna", "egg", "shrimp", "prawn", "protein"];

const INTENT_LABEL: Record<QRIntent, string> = {
  spicy: "spicy food",
  vegetarian: "vegetarian options",
  popular: "popular dishes",
  cheapest_main: "the cheapest main",
  high_protein: "high-protein options",
  signature: "the signature dish",
  allergy: "allergy-safe options",
  budget: "budget-friendly options",
  pairing: "pairing suggestions",
  light_meal: "a light meal",
  very_hungry: "a big appetite",
  dessert: "dessert",
  surprise_me: "a surprise pick",
  full_meal: "a full meal",
  page_view: "page view",
  unknown: "something specific",
};

export function detectCustomerIntent(question: string): QRIntent {
  const q = question.toLowerCase();
  if (!q.trim()) return "page_view";
  if (/allerg|\bnut\b/.test(q)) return "allergy";
  if (/vegetarian|vegan|veggie/.test(q)) return "vegetarian";
  if (/under\s*(aed)?\s*\d+|budget/.test(q)) return "budget";
  if (/cheap/.test(q)) return "cheapest_main";
  if (/protein/.test(q)) return "high_protein";
  if (/signature|chef/.test(q)) return "signature";
  if (/spicy|spice|\bhot\b/.test(q)) return "spicy";
  if (/\bwith\b|pair|goes with/.test(q)) return "pairing";
  if (/popular|best seller|bestseller|best-selling|favorite|favourite/.test(q)) return "popular";
  return "unknown";
}

function popularityRank(menu: MenuItem[], orders: Order[]): MenuItem[] {
  const stats = dishRevenue(orders);
  return [...menu].sort((a, b) => (stats.get(b.dish)?.orders ?? 0) - (stats.get(a.dish)?.orders ?? 0));
}

function matchesKeywords(dish: string, keywords: string[]): boolean {
  const lower = dish.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function extractBudget(question: string): number {
  const match = /(\d+(?:\.\d+)?)/.exec(question);
  return match ? Number(match[1]) : 100;
}

export function recommendMenuItems(
  menu: MenuItem[],
  intent: QRIntent,
  question: string,
  orders: Order[] = []
): MenuItem[] {
  if (menu.length === 0) return [];
  const popular = popularityRank(menu, orders);

  switch (intent) {
    case "spicy": {
      const matches = menu.filter((item) => matchesKeywords(item.dish, SPICY_KEYWORDS) || item.category.toLowerCase() === "spicy");
      return (matches.length > 0 ? matches : popular).slice(0, 3);
    }
    case "vegetarian": {
      const matches = menu.filter((item) => !matchesKeywords(item.dish, MEAT_KEYWORDS));
      return matches.slice(0, 3);
    }
    case "popular":
      return popular.slice(0, 3);
    case "cheapest_main": {
      const mains = menu
        .filter((item) => item.category.toLowerCase() === "mains")
        .sort((a, b) => a.price - b.price);
      return mains.slice(0, 1);
    }
    case "high_protein": {
      const matches = menu
        .filter((item) => matchesKeywords(item.dish, PROTEIN_KEYWORDS))
        .sort((a, b) => b.price - a.price);
      return matches.slice(0, 3);
    }
    case "signature": {
      const named = menu.filter((item) => item.dish.toLowerCase().includes("signature"));
      if (named.length > 0) return named.slice(0, 1);
      const flagshipMain = [...menu]
        .filter((item) => item.category.toLowerCase() === "mains")
        .sort((a, b) => b.price - a.price)[0];
      return flagshipMain ? [flagshipMain] : popular.slice(0, 1);
    }
    case "allergy": {
      const safe = menu.filter((item) => !matchesKeywords(item.dish, NUT_KEYWORDS));
      const safePopular = popularityRank(safe, orders);
      return safePopular.slice(0, 3);
    }
    case "budget": {
      const budget = extractBudget(question);
      const withinBudget = menu.filter((item) => item.price <= budget);
      const ranked = popularityRank(withinBudget, orders);
      return ranked.slice(0, 3);
    }
    case "pairing": {
      const mentioned = menu.find((item) => question.toLowerCase().includes(item.dish.toLowerCase()));
      const others = mentioned ? menu.filter((item) => item.dish !== mentioned.dish) : menu;
      const complements = others.filter((item) =>
        ["desserts", "drinks", "beverages", "sides", "appetizers"].includes(item.category.toLowerCase())
      );
      const ranked = popularityRank(complements.length > 0 ? complements : others, orders);
      return ranked.slice(0, 2);
    }
    case "page_view":
    case "unknown":
    default:
      return popular.slice(0, 2);
  }
}

export function calculateRecommendationAcceptance(interactions: QRInteraction[]): number | null {
  const withRecommendations = interactions.filter(
    (item) => item.intent !== "page_view" && item.recommendedItems.length > 0
  );
  if (withRecommendations.length === 0) return null;
  const accepted = withRecommendations.filter((item) => item.acceptedRecommendation).length;
  return round((accepted / withRecommendations.length) * 100, 0);
}

export function summarizeQRQuestions(interactions: QRInteraction[]): { question: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const interaction of interactions) {
    if (interaction.intent === "page_view" || !interaction.question.trim()) continue;
    const key = interaction.question.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([question, count]) => ({ question, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

/** Most common phrasing among "allergy" intent questions — powers the dashboard's "Most common allergy concern" card. */
export function topAllergyConcern(interactions: QRInteraction[]): { label: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const interaction of interactions) {
    if (interaction.intent !== "allergy" || !interaction.question.trim()) continue;
    const key = interaction.question.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  return top ? { label: top[0], count: top[1] } : null;
}

/** Scans vs. orders per table — how often a QR scan at a table turns into an order. */
export function calculateTableConversion(
  interactions: QRInteraction[],
  orders: QROrder[]
): { tableId: string; scans: number; orders: number; conversionRate: number }[] {
  const scansByTable = new Map<string, number>();
  for (const interaction of interactions) {
    if (interaction.intent !== "page_view" || !interaction.tableId) continue;
    scansByTable.set(interaction.tableId, (scansByTable.get(interaction.tableId) ?? 0) + 1);
  }
  const ordersByTable = new Map<string, number>();
  for (const order of orders) {
    if (order.status === "cancelled" || !order.tableId) continue;
    ordersByTable.set(order.tableId, (ordersByTable.get(order.tableId) ?? 0) + 1);
  }
  return Array.from(scansByTable.entries())
    .map(([tableId, scans]) => {
      const orderCount = ordersByTable.get(tableId) ?? 0;
      return { tableId, scans, orders: orderCount, conversionRate: scans > 0 ? round((orderCount / scans) * 100, 0) : 0 };
    })
    .sort((a, b) => b.conversionRate - a.conversionRate);
}

/** Ranked summaries of stored guest preferences, for the "guest preference trends" section of QR Insights. */
export function summarizeGuestPreferenceTrends(preferences: GuestPreferencesRecord[]): {
  topDietary: { label: string; count: number } | null;
  topMood: { label: string; count: number } | null;
  topAllergy: { label: string; count: number } | null;
  averageBudget: number | null;
} {
  const dietaryCounts = new Map<string, number>();
  const moodCounts = new Map<string, number>();
  const allergyCounts = new Map<string, number>();
  const budgets: number[] = [];

  for (const pref of preferences) {
    if (pref.dietaryPreference) dietaryCounts.set(pref.dietaryPreference, (dietaryCounts.get(pref.dietaryPreference) ?? 0) + 1);
    if (pref.mood) moodCounts.set(pref.mood, (moodCounts.get(pref.mood) ?? 0) + 1);
    for (const allergy of pref.allergies) allergyCounts.set(allergy, (allergyCounts.get(allergy) ?? 0) + 1);
    if (pref.budget != null) budgets.push(pref.budget);
  }

  const top = (map: Map<string, number>) => {
    const entry = Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0];
    return entry ? { label: entry[0], count: entry[1] } : null;
  };

  return {
    topDietary: top(dietaryCounts),
    topMood: top(moodCounts),
    topAllergy: top(allergyCounts),
    averageBudget: budgets.length > 0 ? round(budgets.reduce((sum, value) => sum + value, 0) / budgets.length, 0) : null,
  };
}

export function calculateQRMetrics(
  interactions: QRInteraction[],
  orders: QROrder[],
  reviews: QRReview[]
): QRMetrics {
  const qa = interactions.filter((item) => item.intent !== "page_view");

  const preferenceCounts = new Map<QRIntent, number>();
  for (const interaction of qa) {
    if (interaction.intent === "unknown") continue;
    preferenceCounts.set(interaction.intent, (preferenceCounts.get(interaction.intent) ?? 0) + 1);
  }
  const topPreferences = Array.from(preferenceCounts.entries())
    .map(([intent, count]) => ({ intent, label: INTENT_LABEL[intent], count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const recommendedCounts = new Map<string, number>();
  const acceptedCounts = new Map<string, number>();
  for (const interaction of qa) {
    for (const dish of interaction.recommendedItems) {
      recommendedCounts.set(dish, (recommendedCounts.get(dish) ?? 0) + 1);
      if (interaction.acceptedRecommendation) {
        acceptedCounts.set(dish, (acceptedCounts.get(dish) ?? 0) + 1);
      }
    }
  }
  const topRecommendedItems = Array.from(recommendedCounts.entries())
    .map(([dish, count]) => ({ dish, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const mostAcceptedEntry = Array.from(acceptedCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  const mostAcceptedRecommendation = mostAcceptedEntry
    ? { dish: mostAcceptedEntry[0], count: mostAcceptedEntry[1] }
    : null;

  const addedAfterCounts = new Map<string, number>();
  for (const order of orders) {
    const orderedDishes = new Set(order.items.map((item) => item.dish));
    for (const dish of order.aiRecommendedItems) {
      if (orderedDishes.has(dish)) {
        addedAfterCounts.set(dish, (addedAfterCounts.get(dish) ?? 0) + 1);
      }
    }
  }
  const itemsAddedAfterRecommendation = Array.from(addedAfterCounts.entries())
    .map(([dish, count]) => ({ dish, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const activeOrders = orders.filter((order) => order.status !== "cancelled");

  const orderedCounts = new Map<string, number>();
  for (const order of activeOrders) {
    for (const item of order.items) {
      orderedCounts.set(item.dish, (orderedCounts.get(item.dish) ?? 0) + item.quantity);
    }
  }
  const topOrderedItems = Array.from(orderedCounts.entries())
    .map(([dish, count]) => ({ dish, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const qrRevenue = round(activeOrders.reduce((sum, order) => sum + order.subtotal, 0), 2);

  const averageBasketValue =
    activeOrders.length > 0 ? round(qrRevenue / activeOrders.length, 2) : null;

  const averageReviewScore =
    reviews.length > 0
      ? round(reviews.reduce((sum, review) => sum + review.overallRating, 0) / reviews.length, 1)
      : null;

  return {
    qrScans: interactions.filter((item) => item.intent === "page_view").length,
    aiQuestionsAsked: qa.length,
    recommendationAcceptanceRate: calculateRecommendationAcceptance(interactions),
    qrOrdersSubmitted: orders.length,
    qrRevenue,
    averageBasketValue,
    topPreferences,
    topQuestions: summarizeQRQuestions(interactions),
    topRecommendedItems,
    topOrderedItems,
    mostAcceptedRecommendation,
    itemsAddedAfterRecommendation,
    averageReviewScore,
    topAllergyConcern: topAllergyConcern(interactions),
  };
}

export function generateQRInsights(interactions: QRInteraction[], orders: QROrder[], reviews: QRReview[]): string[] {
  const metrics = calculateQRMetrics(interactions, orders, reviews);
  const insights: string[] = [];

  for (const preference of metrics.topPreferences.slice(0, 2)) {
    if (preference.intent === "page_view") continue;
    insights.push(
      `Customers asked for ${preference.label} ${preference.count} time${preference.count === 1 ? "" : "s"}.`
    );
  }

  if (metrics.recommendationAcceptanceRate !== null) {
    insights.push(`AI recommendations were accepted ${metrics.recommendationAcceptanceRate}% of the time.`);
  }

  const topAddOn = metrics.itemsAddedAfterRecommendation[0];
  if (topAddOn) {
    insights.push(`${topAddOn.dish} was added after an AI recommendation ${topAddOn.count} time${topAddOn.count === 1 ? "" : "s"}.`);
  }

  const topRecommended = metrics.topRecommendedItems[0];
  if (topRecommended && (!topAddOn || topRecommended.dish !== topAddOn.dish)) {
    insights.push(`${topRecommended.dish} is the most commonly recommended item.`);
  }

  const budgetInteractions = interactions.filter((item) => item.intent === "budget");
  if (budgetInteractions.length > 0) {
    const budgetDishCounts = new Map<string, number>();
    for (const interaction of budgetInteractions) {
      for (const dish of interaction.recommendedItems) {
        budgetDishCounts.set(dish, (budgetDishCounts.get(dish) ?? 0) + 1);
      }
    }
    const topBudgetDish = Array.from(budgetDishCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topBudgetDish) {
      insights.push(`Budget-conscious guests most often get recommended ${topBudgetDish[0]}.`);
    }
  }

  if (metrics.averageReviewScore !== null) {
    insights.push(`QR customers rate their experience ${metrics.averageReviewScore}★ on average.`);
  }

  return insights.slice(0, 6);
}
