import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_MENU_APPEARANCE, type MenuAppearanceSettings, type MenuCategory } from "@/lib/menu-types";
import type { MenuItem, Order } from "@/lib/types";

export const revalidate = 30;

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** "HH:MM" string comparison against the server clock — a best-effort approximation, since this app has no
 * per-restaurant timezone configured anywhere yet. */
function isWithinAvailabilityWindow(start: string | null, end: string | null): boolean {
  if (!start || !end) return true;
  const now = new Date();
  const current = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  if (start <= end) return current >= start && current <= end;
  // Window spans midnight (e.g. 18:00-02:00).
  return current >= start || current <= end;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId: slug } = await params;
  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!restaurant) {
    return NextResponse.json(
      { menu: [], orders: [], categories: [], appearance: DEFAULT_MENU_APPEARANCE, totalItemCount: 0 },
      { status: 404 }
    );
  }

  const [menuRes, ordersRes, categoriesRes, appearanceRes] = await Promise.all([
    supabase.from("menu_items").select("*").eq("restaurant_id", restaurant.id),
    supabase.from("orders").select("*, order_items(*)").eq("restaurant_id", restaurant.id),
    supabase
      .from("menu_categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("display_order", { ascending: true }),
    supabase.from("menu_appearance").select("*").eq("restaurant_id", restaurant.id).maybeSingle(),
  ]);

  const menu: MenuItem[] = (menuRes.data ?? [])
    .filter((row) => !row.is_hidden && row.is_available !== false)
    .filter((row) => isWithinAvailabilityWindow(row.availability_start, row.availability_end))
    .map((row) => ({
      id: row.id,
      dish: row.dish,
      category: row.category,
      price: num(row.price),
      cost: num(row.cost),
      description: row.description ?? undefined,
      imageUrl: row.image_url ?? undefined,
      allergens: row.allergens ?? [],
      dietaryTags: row.dietary_tags ?? [],
      spiceLevel: num(row.spice_level, 0),
      isSignature: Boolean(row.is_signature),
      isRecommended: Boolean(row.is_recommended),
      isAvailable: row.is_available !== false,
      isHidden: Boolean(row.is_hidden),
      availabilityWindow:
        row.availability_start && row.availability_end
          ? { start: row.availability_start, end: row.availability_end }
          : null,
      prepTimeMinutes: row.prep_time_minutes ?? undefined,
      displayOrder: num(row.display_order, 0),
    }))
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const orders: Order[] = (ordersRes.data ?? []).map((row) => ({
    orderId: row.order_id,
    date: row.date ?? "",
    time: row.time ?? "",
    customerId: row.customer_id ?? undefined,
    tableId: row.table_id ?? undefined,
    total: num(row.total),
    items: ((row.order_items ?? []) as Record<string, unknown>[]).map((item) => ({
      dish: item.dish as string,
      category: item.category as string,
      quantity: num(item.quantity),
      price: num(item.price),
      total: num(item.total),
      revenue: num(item.revenue),
      cost: num(item.cost),
    })),
  }));

  const categories: MenuCategory[] = (categoriesRes.data ?? []).map((row) => ({
    name: row.name,
    displayOrder: num(row.display_order, 0),
  }));

  const appearanceRow = appearanceRes.data;
  const appearance: MenuAppearanceSettings = appearanceRow
    ? {
        layout: appearanceRow.layout ?? DEFAULT_MENU_APPEARANCE.layout,
        brandColor: appearanceRow.brand_color ?? null,
        logoUrl: appearanceRow.logo_url ?? null,
        coverImageUrl: appearanceRow.cover_image_url ?? null,
        introText: appearanceRow.intro_text ?? null,
        showPhotos: appearanceRow.show_photos !== false,
        showAllergens: appearanceRow.show_allergens !== false,
        showPopularity: appearanceRow.show_popularity !== false,
        showAiBox: appearanceRow.show_ai_box !== false,
        showPrices: appearanceRow.show_prices !== false,
        showCalories: Boolean(appearanceRow.show_calories),
        categoryDisplay: appearanceRow.category_display ?? DEFAULT_MENU_APPEARANCE.categoryDisplay,
      }
    : DEFAULT_MENU_APPEARANCE;

  return NextResponse.json({ menu, orders, categories, appearance, totalItemCount: (menuRes.data ?? []).length });
}
