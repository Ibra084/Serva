import type { QRInteraction, QROrder, QROrderStatus, QRReview } from "@/lib/types";

const INTERACTIONS_PREFIX = "serva_qr_interactions";
const ORDERS_PREFIX = "serva_qr_orders";
const REVIEWS_PREFIX = "serva_qr_reviews";

function loadArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function persistArray<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

/** Upserts by `id` — lets the AI assistant flip `acceptedRecommendation` on an
 * interaction already logged earlier in the same session (e.g. when the guest
 * later adds a recommended dish to their basket). */
export function saveQRInteraction(restaurantSlug: string, interaction: QRInteraction) {
  const key = `${INTERACTIONS_PREFIX}_${restaurantSlug}`;
  const existing = loadArray<QRInteraction>(key);
  const next = [...existing.filter((item) => item.id !== interaction.id), interaction];
  persistArray(key, next);
}

export function loadQRInteractions(restaurantSlug: string): QRInteraction[] {
  return loadArray<QRInteraction>(`${INTERACTIONS_PREFIX}_${restaurantSlug}`);
}

export function saveQROrder(restaurantSlug: string, order: QROrder) {
  const key = `${ORDERS_PREFIX}_${restaurantSlug}`;
  const existing = loadArray<QROrder>(key);
  persistArray(key, [...existing, order]);
}

export function loadQROrders(restaurantSlug: string): QROrder[] {
  return loadArray<QROrder>(`${ORDERS_PREFIX}_${restaurantSlug}`);
}

export function updateQROrderStatus(restaurantSlug: string, orderId: string, status: QROrderStatus) {
  const key = `${ORDERS_PREFIX}_${restaurantSlug}`;
  const orders = loadArray<QROrder>(key);
  const next = orders.map((order) => (order.orderId === orderId ? { ...order, status } : order));
  persistArray(key, next);
}

export function saveQRReview(restaurantSlug: string, review: QRReview) {
  const key = `${REVIEWS_PREFIX}_${restaurantSlug}`;
  const existing = loadArray<QRReview>(key);
  persistArray(key, [...existing, review]);
}

export function loadQRReviews(restaurantSlug: string): QRReview[] {
  return loadArray<QRReview>(`${REVIEWS_PREFIX}_${restaurantSlug}`);
}

export function clearQRData(restaurantSlug: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${INTERACTIONS_PREFIX}_${restaurantSlug}`);
  window.localStorage.removeItem(`${ORDERS_PREFIX}_${restaurantSlug}`);
  window.localStorage.removeItem(`${REVIEWS_PREFIX}_${restaurantSlug}`);
}
