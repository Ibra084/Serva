import { createClient } from "@/lib/supabase/client";
import { num } from "@/lib/db-utils";
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

/** Owner-portal read — restricted to restaurant members by RLS. Flat, all-time order history for analytics (QR insights); live/session-scoped order reads live in `session-store.ts`. */
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
