import { createClient } from "@/lib/supabase/client";
import { DEFAULT_MENU_APPEARANCE, type MenuAppearanceSettings } from "@/lib/menu-types";

async function resolveRestaurantId(restaurantSlug: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.from("restaurants").select("id").eq("slug", restaurantSlug).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

function rowToAppearance(row: Record<string, unknown> | null): MenuAppearanceSettings {
  if (!row) return DEFAULT_MENU_APPEARANCE;
  return {
    layout: (row.layout as MenuAppearanceSettings["layout"]) ?? DEFAULT_MENU_APPEARANCE.layout,
    brandColor: (row.brand_color as string | null) ?? null,
    logoUrl: (row.logo_url as string | null) ?? null,
    coverImageUrl: (row.cover_image_url as string | null) ?? null,
    introText: (row.intro_text as string | null) ?? null,
    showPhotos: row.show_photos !== false,
    showAllergens: row.show_allergens !== false,
    showPopularity: row.show_popularity !== false,
    showAiBox: row.show_ai_box !== false,
    showPrices: row.show_prices !== false,
    showCalories: Boolean(row.show_calories),
    categoryDisplay: (row.category_display as MenuAppearanceSettings["categoryDisplay"]) ?? DEFAULT_MENU_APPEARANCE.categoryDisplay,
  };
}

export async function loadMenuAppearance(restaurantSlug: string): Promise<MenuAppearanceSettings> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return DEFAULT_MENU_APPEARANCE;

  const supabase = createClient();
  const { data } = await supabase
    .from("menu_appearance")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  return rowToAppearance(data);
}

export async function saveMenuAppearance(restaurantSlug: string, settings: MenuAppearanceSettings): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;

  const supabase = createClient();
  await supabase.from("menu_appearance").upsert({
    restaurant_id: restaurantId,
    layout: settings.layout,
    brand_color: settings.brandColor,
    logo_url: settings.logoUrl,
    cover_image_url: settings.coverImageUrl,
    intro_text: settings.introText,
    show_photos: settings.showPhotos,
    show_allergens: settings.showAllergens,
    show_popularity: settings.showPopularity,
    show_ai_box: settings.showAiBox,
    show_prices: settings.showPrices,
    show_calories: settings.showCalories,
    category_display: settings.categoryDisplay,
    updated_at: new Date().toISOString(),
  });
}
