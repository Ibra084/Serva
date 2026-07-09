import { createClient } from "@/lib/supabase/client";
import { newId, num } from "@/lib/db-utils";
import type { GuestPreferences } from "@/lib/menu-types";
import type { GuestPreferencesRecord } from "@/lib/types";

const GUEST_ID_KEY = "serva_guest_id";

/** Stable per-device anonymous id, reused across visits/tables at the same restaurant. */
export function getAnonymousGuestId(): string {
  if (typeof window === "undefined") return newId();
  const existing = window.localStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const id = newId();
  window.localStorage.setItem(GUEST_ID_KEY, id);
  return id;
}

async function resolveRestaurantId(restaurantSlug: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.from("restaurants").select("id").eq("slug", restaurantSlug).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

function deriveHungerLevel(mood: GuestPreferences["mood"]): string | null {
  if (mood === "very_hungry") return "very_hungry";
  if (mood === "light") return "light_meal";
  return null;
}

/** Fire-and-forget upsert to Supabase so preferences feed QR Insights aggregation. localStorage remains the instant-UX source of truth. */
export function syncGuestPreferences(restaurantSlug: string, prefs: GuestPreferences): void {
  void (async () => {
    const restaurantId = await resolveRestaurantId(restaurantSlug);
    if (!restaurantId) return;

    const supabase = createClient();
    await supabase.from("guest_preferences").upsert(
      {
        restaurant_id: restaurantId,
        anonymous_guest_id: getAnonymousGuestId(),
        dietary_preference: prefs.dietary === "none" ? null : prefs.dietary,
        allergies: prefs.allergies,
        spice_preference: prefs.spicePreference,
        budget: prefs.budget,
        mood: prefs.mood,
        hunger_level: deriveHungerLevel(prefs.mood),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "restaurant_id,anonymous_guest_id" }
    );
  })();
}

/** Owner-portal read for QR Insights — restricted to restaurant members by RLS. */
export async function loadGuestPreferences(restaurantSlug: string): Promise<GuestPreferencesRecord[]> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from("guest_preferences")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("updated_at", { ascending: false });

  return (data ?? []).map((row) => ({
    restaurantId: restaurantSlug,
    anonymousGuestId: row.anonymous_guest_id as string,
    dietaryPreference: (row.dietary_preference as string | null) ?? null,
    allergies: (row.allergies as string[] | null) ?? [],
    spicePreference: row.spice_preference != null ? num(row.spice_preference) : null,
    budget: row.budget != null ? num(row.budget) : null,
    mood: (row.mood as string | null) ?? null,
    hungerLevel: (row.hunger_level as string | null) ?? null,
    updatedAt: row.updated_at as string,
  }));
}
