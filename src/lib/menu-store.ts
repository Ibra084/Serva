import { createClient } from "@/lib/supabase/client";
import type { MenuItem } from "@/lib/types";
import type { MenuCategory } from "@/lib/menu-types";

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

const restaurantIdCache = new Map<string, Promise<string | null>>();

function resolveRestaurantId(restaurantSlug: string): Promise<string | null> {
  const cached = restaurantIdCache.get(restaurantSlug);
  if (cached) return cached;

  const promise = (async () => {
    const supabase = createClient();
    const { data } = await supabase.from("restaurants").select("id").eq("slug", restaurantSlug).maybeSingle();
    return (data?.id as string | undefined) ?? null;
  })().then((id) => {
    if (!id) restaurantIdCache.delete(restaurantSlug);
    return id;
  });

  restaurantIdCache.set(restaurantSlug, promise);
  return promise;
}

function rowToMenuItem(row: Record<string, unknown>): MenuItem {
  return {
    id: row.id as string,
    dish: row.dish as string,
    category: row.category as string,
    price: num(row.price),
    cost: num(row.cost),
    description: (row.description as string | null) ?? undefined,
    imageUrl: (row.image_url as string | null) ?? undefined,
    allergens: (row.allergens as string[] | null) ?? [],
    dietaryTags: (row.dietary_tags as string[] | null) ?? [],
    spiceLevel: num(row.spice_level, 0),
    isSignature: Boolean(row.is_signature),
    isRecommended: Boolean(row.is_recommended),
    isAvailable: row.is_available !== false,
    isHidden: Boolean(row.is_hidden),
    availabilityWindow:
      row.availability_start && row.availability_end
        ? { start: row.availability_start as string, end: row.availability_end as string }
        : null,
    prepTimeMinutes: row.prep_time_minutes != null ? num(row.prep_time_minutes) : undefined,
    displayOrder: num(row.display_order, 0),
  };
}

export interface MenuBuilderResult<T> {
  data: T;
  error: string | null;
}

/** Owner-portal read — every item including hidden/unavailable ones, full field set, for the Menu Builder editor. */
export async function loadMenuBuilderItems(restaurantSlug: string): Promise<MenuBuilderResult<MenuItem[]>> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return { data: [], error: "Restaurant not found." };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("display_order", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map(rowToMenuItem), error: null };
}

export type MenuItemDraft = Omit<MenuItem, "id">;

export async function createMenuItem(restaurantSlug: string, item: MenuItemDraft): Promise<MenuItem | null> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return null;

  await upsertCategory(restaurantSlug, item.category);

  const supabase = createClient();
  const id = newId();
  const { error } = await supabase.from("menu_items").insert({
    id,
    restaurant_id: restaurantId,
    dish: item.dish,
    category: item.category,
    price: item.price,
    cost: item.cost,
    description: item.description ?? null,
    image_url: item.imageUrl ?? null,
    allergens: item.allergens ?? [],
    dietary_tags: item.dietaryTags ?? [],
    spice_level: item.spiceLevel ?? 0,
    is_signature: item.isSignature ?? false,
    is_recommended: item.isRecommended ?? false,
    is_available: item.isAvailable ?? true,
    is_hidden: item.isHidden ?? false,
    availability_start: item.availabilityWindow?.start ?? null,
    availability_end: item.availabilityWindow?.end ?? null,
    prep_time_minutes: item.prepTimeMinutes ?? null,
    display_order: item.displayOrder ?? 0,
    updated_at: new Date().toISOString(),
  });
  if (error) return null;

  return { ...item, id };
}

export async function updateMenuItem(
  restaurantSlug: string,
  id: string,
  patch: Partial<MenuItemDraft>
): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;

  if (patch.category) {
    await upsertCategory(restaurantSlug, patch.category);
  }

  const supabase = createClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.dish !== undefined) updates.dish = patch.dish;
  if (patch.category !== undefined) updates.category = patch.category;
  if (patch.price !== undefined) updates.price = patch.price;
  if (patch.cost !== undefined) updates.cost = patch.cost;
  if (patch.description !== undefined) updates.description = patch.description ?? null;
  if (patch.imageUrl !== undefined) updates.image_url = patch.imageUrl ?? null;
  if (patch.allergens !== undefined) updates.allergens = patch.allergens;
  if (patch.dietaryTags !== undefined) updates.dietary_tags = patch.dietaryTags;
  if (patch.spiceLevel !== undefined) updates.spice_level = patch.spiceLevel;
  if (patch.isSignature !== undefined) updates.is_signature = patch.isSignature;
  if (patch.isRecommended !== undefined) updates.is_recommended = patch.isRecommended;
  if (patch.isAvailable !== undefined) updates.is_available = patch.isAvailable;
  if (patch.isHidden !== undefined) updates.is_hidden = patch.isHidden;
  if (patch.availabilityWindow !== undefined) {
    updates.availability_start = patch.availabilityWindow?.start ?? null;
    updates.availability_end = patch.availabilityWindow?.end ?? null;
  }
  if (patch.prepTimeMinutes !== undefined) updates.prep_time_minutes = patch.prepTimeMinutes ?? null;
  if (patch.displayOrder !== undefined) updates.display_order = patch.displayOrder;

  await supabase.from("menu_items").update(updates).eq("id", id).eq("restaurant_id", restaurantId);
}

export async function deleteMenuItem(restaurantSlug: string, id: string): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;
  const supabase = createClient();
  await supabase.from("menu_items").delete().eq("id", id).eq("restaurant_id", restaurantId);
}

/** Persists a full reordering of items within one category (or overall) by writing sequential display_order values. */
export async function reorderMenuItems(restaurantSlug: string, orderedIds: string[]): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;
  const supabase = createClient();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("menu_items").update({ display_order: index }).eq("id", id).eq("restaurant_id", restaurantId)
    )
  );
}

export async function loadMenuCategories(restaurantSlug: string): Promise<MenuBuilderResult<MenuCategory[]>> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return { data: [], error: "Restaurant not found." };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("menu_categories")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("display_order", { ascending: true });

  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((row) => ({ name: row.name as string, displayOrder: num(row.display_order, 0) })),
    error: null,
  };
}

/** Creates the category row if it doesn't exist yet (e.g. when an item is assigned a brand-new category name). */
export async function upsertCategory(restaurantSlug: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("menu_categories")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("name", trimmed)
    .maybeSingle();
  if (existing) return;

  const { data: maxRow } = await supabase
    .from("menu_categories")
    .select("display_order")
    .eq("restaurant_id", restaurantId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = maxRow ? num(maxRow.display_order, 0) + 1 : 0;

  await supabase
    .from("menu_categories")
    .insert({ restaurant_id: restaurantId, name: trimmed, display_order: nextOrder });
}

export async function reorderCategories(restaurantSlug: string, orderedNames: string[]): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;
  const supabase = createClient();
  await Promise.all(
    orderedNames.map((name, index) =>
      supabase
        .from("menu_categories")
        .update({ display_order: index })
        .eq("restaurant_id", restaurantId)
        .eq("name", name)
    )
  );
}

export async function renameCategory(restaurantSlug: string, oldName: string, newName: string): Promise<void> {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return;
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;

  const supabase = createClient();
  await supabase
    .from("menu_items")
    .update({ category: trimmed })
    .eq("restaurant_id", restaurantId)
    .eq("category", oldName);
  await supabase
    .from("menu_categories")
    .update({ name: trimmed })
    .eq("restaurant_id", restaurantId)
    .eq("name", oldName);
}

/** Deletes a category row; any items still assigned to it fall back to "Uncategorized" (matches menu_items' default). */
export async function deleteCategory(restaurantSlug: string, name: string): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;

  const supabase = createClient();
  await supabase
    .from("menu_items")
    .update({ category: "Uncategorized" })
    .eq("restaurant_id", restaurantId)
    .eq("category", name);
  await supabase.from("menu_categories").delete().eq("restaurant_id", restaurantId).eq("name", name);
}

export interface BulkMenuItemInput {
  category: string;
  dish: string;
  price: number;
  description?: string;
}

/** Batch-imports items (bulk paste / templates): upserts every distinct category once, then inserts all items with sequential display_order per category. */
export async function bulkCreateMenuItems(
  restaurantSlug: string,
  inputItems: BulkMenuItemInput[]
): Promise<MenuBuilderResult<MenuItem[]>> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return { data: [], error: "Restaurant not found." };
  if (inputItems.length === 0) return { data: [], error: null };

  const supabase = createClient();

  const categoryNames = Array.from(new Set(inputItems.map((item) => item.category.trim()).filter(Boolean)));
  const { data: existingCategories } = await supabase
    .from("menu_categories")
    .select("name, display_order")
    .eq("restaurant_id", restaurantId);
  const existingNames = new Set((existingCategories ?? []).map((row) => row.name as string));
  let nextOrder =
    (existingCategories ?? []).reduce((max, row) => Math.max(max, num(row.display_order, 0)), -1) + 1;
  const newCategoryRows = categoryNames
    .filter((name) => !existingNames.has(name))
    .map((name) => ({ restaurant_id: restaurantId, name, display_order: nextOrder++ }));
  if (newCategoryRows.length > 0) {
    const { error: categoryError } = await supabase.from("menu_categories").insert(newCategoryRows);
    if (categoryError) return { data: [], error: categoryError.message };
  }

  const { data: existingItemCounts } = await supabase
    .from("menu_items")
    .select("category, display_order")
    .eq("restaurant_id", restaurantId);
  const nextItemOrder = new Map<string, number>();
  for (const row of existingItemCounts ?? []) {
    const category = row.category as string;
    const order = num(row.display_order, 0) + 1;
    nextItemOrder.set(category, Math.max(nextItemOrder.get(category) ?? 0, order));
  }

  const rows = inputItems.map((item) => {
    const category = item.category.trim() || "Uncategorized";
    const order = nextItemOrder.get(category) ?? 0;
    nextItemOrder.set(category, order + 1);
    return {
      id: newId(),
      restaurant_id: restaurantId,
      dish: item.dish,
      category,
      price: item.price,
      cost: 0,
      description: item.description ?? null,
      allergens: [],
      dietary_tags: [],
      spice_level: 0,
      is_signature: false,
      is_recommended: false,
      is_available: true,
      is_hidden: false,
      display_order: order,
      updated_at: new Date().toISOString(),
    };
  });

  const { data: inserted, error } = await supabase.from("menu_items").insert(rows).select("*");
  if (error) return { data: [], error: error.message };
  return { data: (inserted ?? []).map(rowToMenuItem), error: null };
}
