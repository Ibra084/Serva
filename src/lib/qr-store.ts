import { createClient } from "@/lib/supabase/client";
import type { QRInteraction, QROrder, QROrderStatus, QRReview } from "@/lib/types";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function resolveRestaurantId(restaurantSlug: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.from("restaurants").select("id").eq("slug", restaurantSlug).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Logs a customer interaction (question, page view, etc). Anonymous insert, per public QR-flow RLS policy. */
export async function saveQRInteraction(restaurantSlug: string, interaction: QRInteraction): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;

  const supabase = createClient();
  await supabase.from("qr_interactions").insert({
    id: interaction.id,
    restaurant_id: restaurantId,
    table_id: interaction.tableId,
    question: interaction.question,
    intent: interaction.intent,
    recommended_items: interaction.recommendedItems,
    accepted_recommendation: interaction.acceptedRecommendation,
    created_at: interaction.timestamp,
  });
}

/** Flips `accepted_recommendation` on an interaction logged earlier in the same session — a direct
 * update by id, since anonymous customers can't SELECT rows back to read-modify-write them. */
export async function markQRInteractionAccepted(restaurantSlug: string, interactionId: string): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;

  const supabase = createClient();
  await supabase
    .from("qr_interactions")
    .update({ accepted_recommendation: true })
    .eq("id", interactionId)
    .eq("restaurant_id", restaurantId);
}

/** Owner-portal read — restricted to restaurant members by RLS. */
export async function loadQRInteractions(restaurantSlug: string): Promise<QRInteraction[]> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from("qr_interactions")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    timestamp: row.created_at,
    restaurantId: restaurantSlug,
    tableId: row.table_id,
    question: row.question ?? "",
    intent: row.intent as QRInteraction["intent"],
    recommendedItems: (row.recommended_items as string[] | null) ?? [],
    acceptedRecommendation: Boolean(row.accepted_recommendation),
  }));
}

/** Places a QR order. Anonymous insert of the order + its line items, per public QR-flow RLS policy. */
export async function saveQROrder(restaurantSlug: string, order: QROrder): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;

  // Generates the primary key client-side and inserts it explicitly, rather than reading it
  // back via `.select()` — anonymous customers have no SELECT policy on qr_orders (by design,
  // so they can't read other customers' orders), and Postgres RLS requires a satisfied SELECT
  // policy for INSERT...RETURNING, which would otherwise fail with a misleading RLS error.
  const orderRowId = newId();
  const supabase = createClient();
  const { error } = await supabase.from("qr_orders").insert({
    id: orderRowId,
    restaurant_id: restaurantId,
    order_id: order.orderId,
    table_id: order.tableId,
    subtotal: order.subtotal,
    ai_recommended_items: order.aiRecommendedItems,
    special_requests: order.specialRequests,
    status: order.status,
    created_at: order.timestamp,
  });
  if (error) return;

  if (order.items.length > 0) {
    await supabase.from("qr_order_items").insert(
      order.items.map((item) => ({
        qr_order_id: orderRowId,
        dish: item.dish,
        category: item.category,
        price: item.price,
        quantity: item.quantity,
      }))
    );
  }
}

/** Owner-portal read — restricted to restaurant members by RLS. */
export async function loadQROrders(restaurantSlug: string): Promise<QROrder[]> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from("qr_orders")
    .select("*, qr_order_items(*)")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    orderId: row.order_id,
    restaurantId: restaurantSlug,
    tableId: row.table_id,
    timestamp: row.created_at,
    subtotal: num(row.subtotal),
    source: "qr" as const,
    aiRecommendedItems: (row.ai_recommended_items as string[] | null) ?? [],
    specialRequests: row.special_requests ?? "",
    status: row.status as QROrderStatus,
    items: ((row.qr_order_items ?? []) as Record<string, unknown>[]).map((item) => ({
      dish: item.dish as string,
      category: item.category as string,
      price: num(item.price),
      quantity: num(item.quantity),
    })),
  }));
}

/** Owner-only status update (e.g. marking an order completed), restricted to restaurant members by RLS. */
export async function updateQROrderStatus(
  restaurantSlug: string,
  orderId: string,
  status: QROrderStatus
): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;

  const supabase = createClient();
  await supabase
    .from("qr_orders")
    .update({ status })
    .eq("restaurant_id", restaurantId)
    .eq("order_id", orderId);
}

/** Submits a QR review. Anonymous insert, per public QR-flow RLS policy. */
export async function saveQRReview(restaurantSlug: string, review: QRReview): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;

  const supabase = createClient();
  await supabase.from("qr_reviews").insert({
    restaurant_id: restaurantId,
    table_id: review.tableId,
    order_id: review.orderId,
    food_rating: review.foodRating,
    service_rating: review.serviceRating,
    atmosphere_rating: review.atmosphereRating,
    overall_rating: review.overallRating,
    comment: review.comment,
    ai_recommendation_helpful: review.aiRecommendationHelpful,
    created_at: review.timestamp,
  });
}

/** Owner-portal read — restricted to restaurant members by RLS. */
export async function loadQRReviews(restaurantSlug: string): Promise<QRReview[]> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from("qr_reviews")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    restaurantId: restaurantSlug,
    tableId: row.table_id,
    orderId: row.order_id,
    timestamp: row.created_at,
    foodRating: num(row.food_rating),
    serviceRating: num(row.service_rating),
    atmosphereRating: num(row.atmosphere_rating),
    overallRating: num(row.overall_rating),
    comment: row.comment ?? "",
    aiRecommendationHelpful: row.ai_recommendation_helpful as boolean | null,
  }));
}
