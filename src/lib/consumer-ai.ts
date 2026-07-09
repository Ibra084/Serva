import { dishRevenue } from "@/lib/insights";
import { DEFAULT_GUEST_PREFERENCES, type GuestPreferences } from "@/lib/menu-types";
import type { MenuItem, Order, QRIntent } from "@/lib/types";

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

const NUT_KEYWORDS = ["peanut", "almond", "cashew", "walnut", "pistachio", "hazelnut", "pecan", "nut"];

const LIGHT_CATEGORIES = ["salads", "starters", "appetizers", "soups", "sides"];
const DESSERT_CATEGORIES = ["desserts", "dessert", "sweets"];

function guestKey(restaurantSlug: string): string {
  return `serva_guest_prefs_${restaurantSlug}`;
}

export function getGuestPreferences(restaurantSlug: string): GuestPreferences {
  if (typeof window === "undefined") return DEFAULT_GUEST_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(guestKey(restaurantSlug));
    if (!raw) return DEFAULT_GUEST_PREFERENCES;
    return { ...DEFAULT_GUEST_PREFERENCES, ...(JSON.parse(raw) as Partial<GuestPreferences>) };
  } catch {
    return DEFAULT_GUEST_PREFERENCES;
  }
}

export function saveGuestPreferences(restaurantSlug: string, prefs: GuestPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(guestKey(restaurantSlug), JSON.stringify(prefs));
  } catch {
    // Ignore write failures (e.g. private browsing storage caps) — preferences just won't persist.
  }
}

export function detectConsumerIntent(question: string): QRIntent {
  const q = question.toLowerCase();
  if (!q.trim()) return "page_view";
  if (/surprise/.test(q)) return "surprise_me";
  if (/full meal|three course|starter.*main.*dessert|complete meal/.test(q)) return "full_meal";
  if (/dessert|sweet tooth|something sweet/.test(q)) return "dessert";
  if (/allerg|\bnut\b/.test(q)) return "allergy";
  if (/vegetarian|vegan|veggie/.test(q)) return "vegetarian";
  if (/under\s*(aed)?\s*\d+|budget/.test(q)) return "budget";
  if (/cheap/.test(q)) return "cheapest_main";
  if (/very hungry|starving|big appetite|extra hungry/.test(q)) return "very_hungry";
  if (/light|small portion|not too hungry|something light/.test(q)) return "light_meal";
  if (/protein/.test(q)) return "high_protein";
  if (/signature|chef.?s special|best dish/.test(q)) return "signature";
  if (/spicy|spice|\bhot\b/.test(q)) return "spicy";
  if (/\bwith\b|pair|goes with/.test(q)) return "pairing";
  if (/popular|best seller|bestseller|best-selling|favorite|favourite/.test(q)) return "popular";
  return "unknown";
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function extractBudget(question: string, fallbackBudget: number | null): number {
  const match = /(\d+(?:\.\d+)?)/.exec(question);
  if (match) return Number(match[1]);
  return fallbackBudget ?? 100;
}

function popularityRank(menu: MenuItem[], orders: Order[]): MenuItem[] {
  const stats = dishRevenue(orders);
  return [...menu].sort((a, b) => (stats.get(b.dish)?.orders ?? 0) - (stats.get(a.dish)?.orders ?? 0));
}

/** Applies the guest's standing preferences (dietary, allergies, spice, budget) as hard filters wherever they're set. */
export function applyGuestFilters(menu: MenuItem[], prefs: GuestPreferences): MenuItem[] {
  let filtered = menu;

  if (prefs.dietary !== "none") {
    filtered = filtered.filter((item) => (item.dietaryTags ?? []).includes(prefs.dietary));
  }

  if (prefs.allergies.length > 0) {
    filtered = filtered.filter((item) => {
      const allergens = (item.allergens ?? []).map((a) => a.toLowerCase());
      return !prefs.allergies.some((allergy) => allergens.some((a) => a.includes(allergy.toLowerCase())));
    });
  }

  if (prefs.budget != null) {
    filtered = filtered.filter((item) => item.price <= prefs.budget!);
  }

  return filtered;
}

export function recommendForGuest(
  menu: MenuItem[],
  intent: QRIntent,
  question: string,
  prefs: GuestPreferences,
  orders: Order[] = []
): MenuItem[] {
  if (menu.length === 0) return [];
  const eligible = applyGuestFilters(menu, prefs);
  const pool = eligible.length > 0 ? eligible : menu;
  const popular = popularityRank(pool, orders);

  switch (intent) {
    case "spicy": {
      const matches = pool.filter(
        (item) => matchesKeywords(item.dish, SPICY_KEYWORDS) || (item.spiceLevel ?? 0) >= 2
      );
      return (matches.length > 0 ? matches : popular).slice(0, 3);
    }
    case "vegetarian": {
      const matches = pool.filter((item) => (item.dietaryTags ?? []).includes("vegetarian") || (item.dietaryTags ?? []).includes("vegan"));
      return (matches.length > 0 ? matches : popular).slice(0, 3);
    }
    case "popular":
      return popular.slice(0, 3);
    case "cheapest_main": {
      const mains = pool.filter((item) => item.category.toLowerCase() === "mains").sort((a, b) => a.price - b.price);
      return mains.slice(0, 1);
    }
    case "high_protein": {
      const matches = pool
        .filter((item) => matchesKeywords(item.dish, ["steak", "chicken", "salmon", "beef", "lamb", "tuna", "egg", "shrimp", "prawn", "protein"]))
        .sort((a, b) => b.price - a.price);
      return matches.slice(0, 3);
    }
    case "signature": {
      const named = pool.filter((item) => item.isSignature);
      return named.length > 0 ? named.slice(0, 1) : popular.slice(0, 1);
    }
    case "allergy": {
      const safe = pool.filter((item) => !matchesKeywords(item.dish, NUT_KEYWORDS) && (item.allergens ?? []).length === 0);
      const safePopular = popularityRank(safe.length > 0 ? safe : pool, orders);
      return safePopular.slice(0, 3);
    }
    case "budget": {
      const budget = extractBudget(question, prefs.budget);
      const withinBudget = pool.filter((item) => item.price <= budget);
      return popularityRank(withinBudget, orders).slice(0, 3);
    }
    case "pairing": {
      const mentioned = menu.find((item) => question.toLowerCase().includes(item.dish.toLowerCase()));
      const others = mentioned ? pool.filter((item) => item.dish !== mentioned.dish) : pool;
      const complements = others.filter((item) =>
        ["desserts", "drinks", "beverages", "sides", "appetizers"].includes(item.category.toLowerCase())
      );
      return popularityRank(complements.length > 0 ? complements : others, orders).slice(0, 2);
    }
    case "light_meal": {
      const matches = pool.filter((item) => LIGHT_CATEGORIES.includes(item.category.toLowerCase()));
      return popularityRank(matches.length > 0 ? matches : pool, orders).slice(0, 3);
    }
    case "very_hungry": {
      const mains = pool.filter((item) => item.category.toLowerCase() === "mains");
      return popularityRank(mains.length > 0 ? mains : pool, orders).slice(0, 2);
    }
    case "dessert": {
      const matches = pool.filter((item) => DESSERT_CATEGORIES.includes(item.category.toLowerCase()));
      return popularityRank(matches.length > 0 ? matches : pool, orders).slice(0, 2);
    }
    case "surprise_me": {
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 1);
    }
    case "full_meal": {
      const starter = pool.find((item) => LIGHT_CATEGORIES.includes(item.category.toLowerCase()));
      const main = popularityRank(pool.filter((item) => item.category.toLowerCase() === "mains"), orders)[0];
      const dessert = pool.find((item) => DESSERT_CATEGORIES.includes(item.category.toLowerCase()));
      return [starter, main, dessert].filter((item): item is MenuItem => Boolean(item));
    }
    case "page_view":
    case "unknown":
    default:
      return popular.slice(0, 2);
  }
}

function moodClause(prefs: GuestPreferences): string {
  switch (prefs.mood) {
    case "light":
      return " for something light";
    case "very_hungry":
      return " since you're pretty hungry";
    case "date_night":
      return " for date night";
    case "family":
      return " for the table to share";
    case "healthy":
      return " to keep things healthy";
    case "comfort":
      return " for some comfort food";
    default:
      return "";
  }
}

function budgetClause(prefs: GuestPreferences): string {
  return prefs.budget != null ? ` and stay under AED ${prefs.budget}` : "";
}

export function buildWaiterReply(intent: QRIntent, items: MenuItem[], prefs: GuestPreferences): string {
  const names = items.map((item) => item.dish).join(", then ");
  const personalized = moodClause(prefs) + budgetClause(prefs);

  if (items.length === 0) {
    return "I don't have a great match for that on the menu right now — want to tell me more about what you're craving?";
  }

  switch (intent) {
    case "spicy":
      return `If you like heat, go for ${names}.${personalized ? ` I picked that${personalized}.` : ""}`;
    case "vegetarian":
      return `Great vegetarian picks: ${names}.`;
    case "popular":
      return `Guests order ${names} a lot — always a safe bet.`;
    case "cheapest_main":
      return `Your best value main is ${names} at AED ${items[0].price}.`;
    case "high_protein":
      return `These will fill you up: ${names}.`;
    case "signature":
      return `Our signature dish is ${names} — I'd start there.`;
    case "allergy":
      return `Based on what's listed, ${names} should work, but please flag your allergy to your server just to be safe.`;
    case "budget":
      return `Within that budget, I'd go for ${names}.`;
    case "pairing":
      return `A lot of guests pair that with ${names}.`;
    case "light_meal":
      return `Something lighter: ${names}.`;
    case "very_hungry":
      return `You'll want ${names} — that should really fill you up.`;
    case "dessert":
      return `For dessert, ${names} is a favorite.`;
    case "surprise_me":
      return `Surprise pick: ${names}. Trust me on this one!`;
    case "full_meal":
      return `Here's a full meal for you: ${names}.`;
    default:
      return `I'd recommend ${names}${personalized}.`;
  }
}

/** One short, food-first reason per recommended item — powers the recommendation cards in the QR assistant. */
export function buildItemReason(item: MenuItem, intent: QRIntent, prefs: GuestPreferences): string {
  const budgetNote = prefs.budget != null && item.price <= prefs.budget ? ` and fits your AED ${prefs.budget} budget` : "";

  switch (intent) {
    case "spicy":
      return `Brings the heat${budgetNote || " — a bold, spicy pick"}.`;
    case "vegetarian":
      return `Vegetarian-friendly${budgetNote}.`;
    case "popular":
      return `One of our most-ordered dishes${budgetNote}.`;
    case "cheapest_main":
      return `Our best value main at AED ${item.price}.`;
    case "high_protein":
      return `Hearty and protein-packed${budgetNote}.`;
    case "signature":
      return "Our signature dish — a house favorite.";
    case "allergy":
      return "Kept simple to help avoid common allergens — please confirm with your server.";
    case "budget":
      return `Great pick within your budget${budgetNote}.`;
    case "pairing":
      return "Pairs beautifully with that.";
    case "light_meal":
      return "Lighter option, easy on the appetite.";
    case "very_hungry":
      return "A generous portion to really fill you up.";
    case "dessert":
      return "A guest favorite way to finish the meal.";
    case "surprise_me":
      return "Trust us on this one — it's a favorite.";
    case "full_meal":
      return "Rounds out a complete meal.";
    default:
      return item.isSignature ? "One of our signature dishes." : `Popular, and rich in flavor${budgetNote}.`;
  }
}

/** Strips cost entirely and drops fields the guest never needs, before this is sent to the LLM. */
export function buildConsumerMenuContext(menu: MenuItem[]) {
  return menu.map((item) => ({
    dish: item.dish,
    category: item.category,
    price: item.price,
    description: item.description ?? null,
    allergens: item.allergens ?? [],
    dietaryTags: item.dietaryTags ?? [],
    spiceLevel: item.spiceLevel ?? 0,
    isSignature: item.isSignature ?? false,
  }));
}
