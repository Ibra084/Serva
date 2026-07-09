import { createClient } from "@/lib/supabase/client";
import { newId, num } from "@/lib/db-utils";
import type { QRInteraction, QROrder, QROrderStatus, QRReview } from "@/lib/types";

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

/** Places a QR order. Anonymous insert of the order + its line items, per public QR-flow RLS policy. Returns the row id (uuid). */
export async function saveQROrder(restaurantSlug: string, order: QROrder): Promise<string | null> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return null;

  // Generates the primary key client-side and inserts it explicitly, rather than reading it
  // back via `.select()` — matches the row id we already know without a round trip.
  const orderRowId = newId();
  const supabase = createClient();
  const { error } = await supabase.from("qr_orders").insert({
    id: orderRowId,
    restaurant_id: restaurantId,
    order_id: order.orderId,
    table_id: order.tableId,
    session_id: order.sessionId ?? null,
    subtotal: order.subtotal,
    ai_recommended_items: order.aiRecommendedItems,
    special_requests: order.specialRequests,
    status: order.status,
    created_at: order.timestamp,
  });
  if (error) return null;

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

  return orderRowId;
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
    id: row.id,
    orderId: row.order_id,
    restaurantId: restaurantSlug,
    tableId: row.table_id,
    sessionId: row.session_id ?? null,
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

/** Anonymous-safe read of every order for one session (customer's own bill), newest first. */
export async function loadSessionOrders(restaurantSlug: string, sessionId: string): Promise<QROrder[]> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from("qr_orders")
    .select("*, qr_order_items(*)")
    .eq("restaurant_id", restaurantId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    orderId: row.order_id,
    restaurantId: restaurantSlug,
    tableId: row.table_id,
    sessionId: row.session_id ?? null,
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

/** Subscribes to realtime changes on one session's orders (customer-side status screen). Returns an unsubscribe fn. */
export function subscribeToSessionOrders(sessionId: string, onChange: () => void): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`session-orders-${sessionId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "qr_orders", filter: `session_id=eq.${sessionId}` },
      onChange
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "qr_order_items" }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
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
