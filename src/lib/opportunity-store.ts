import { createClient } from "@/lib/supabase/client";
import type { OpportunityStatus } from "@/lib/types";

type StatusMap = Record<string, OpportunityStatus>;

async function resolveRestaurantId(restaurantSlug: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.from("restaurants").select("id").eq("slug", restaurantSlug).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function loadOpportunityStatuses(restaurantSlug: string): Promise<StatusMap> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return {};

  const supabase = createClient();
  const { data } = await supabase
    .from("opportunity_statuses")
    .select("opportunity_id, status")
    .eq("restaurant_id", restaurantId);

  const statuses: StatusMap = {};
  for (const row of data ?? []) {
    statuses[row.opportunity_id as string] = row.status as OpportunityStatus;
  }
  return statuses;
}

export async function setOpportunityStatus(
  restaurantSlug: string,
  id: string,
  status: OpportunityStatus
): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;

  const supabase = createClient();
  await supabase
    .from("opportunity_statuses")
    .upsert(
      { restaurant_id: restaurantId, opportunity_id: id, status, updated_at: new Date().toISOString() },
      { onConflict: "restaurant_id,opportunity_id" }
    );
}

export async function clearOpportunityStatuses(restaurantSlug: string): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;

  const supabase = createClient();
  await supabase.from("opportunity_statuses").delete().eq("restaurant_id", restaurantId);
}
