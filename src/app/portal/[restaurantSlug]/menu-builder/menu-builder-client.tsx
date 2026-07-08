"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  createMenuItem,
  deleteMenuItem,
  loadMenuBuilderItems,
  loadMenuCategories,
  reorderCategories,
  reorderMenuItems,
  updateMenuItem,
  upsertCategory,
  type MenuItemDraft,
} from "@/lib/menu-store";
import { loadMenuAppearance } from "@/lib/menu-appearance-store";
import type { MenuCategory } from "@/lib/menu-types";
import type { MenuItem } from "@/lib/types";

const DIETARY_TAG_OPTIONS = ["vegetarian", "vegan", "halal", "gluten-free", "dairy-free"];
const ALLERGEN_OPTIONS = ["nuts", "dairy", "gluten", "shellfish", "eggs", "soy"];
const SPICE_LABELS = ["None", "Mild", "Medium", "Hot"];

function emptyDraft(category: string): MenuItem {
  return {
    dish: "",
    category: category || "Uncategorized",
    price: 0,
    cost: 0,
    description: "",
    imageUrl: "",
    allergens: [],
    dietaryTags: [],
    spiceLevel: 0,
    isSignature: false,
    isRecommended: false,
    isAvailable: true,
    isHidden: false,
    availabilityWindow: null,
    prepTimeMinutes: undefined,
    displayOrder: 0,
  };
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-secondary"
      )}
    >
      {children}
    </button>
  );
}

function toggleTag(list: string[] | undefined, tag: string): string[] {
  const current = list ?? [];
  return current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
}

export function MenuBuilderClient({ restaurantSlug }: { restaurantSlug: string }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MenuItem | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [previewLabel, setPreviewLabel] = useState("Preview Customer Menu");
  const [saving, setSaving] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const previewUrl = `${origin}/qr/${restaurantSlug}`;

  async function refresh() {
    setLoading(true);
    const [loadedItems, loadedCategories] = await Promise.all([
      loadMenuBuilderItems(restaurantSlug),
      loadMenuCategories(restaurantSlug),
    ]);
    setItems(loadedItems);
    setCategories(loadedCategories);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    loadMenuAppearance(restaurantSlug).then((appearance) => {
      setPreviewLabel(appearance.layout === "booklet" ? "Preview Booklet Menu" : "Preview Customer Menu");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantSlug]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, MenuItem[]>();
    for (const item of items) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }
    for (const list of byCategory.values()) {
      list.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    }
    const orderedNames = categories.map((c) => c.name);
    const extraNames = Array.from(byCategory.keys()).filter((name) => !orderedNames.includes(name));
    return [...orderedNames, ...extraNames]
      .filter((name) => byCategory.has(name))
      .map((name) => [name, byCategory.get(name)!] as const);
  }, [items, categories]);

  function selectItem(item: MenuItem) {
    setSelectedId(item.id ?? null);
    setDraft({ ...item });
  }

  function startNewItem(category?: string) {
    setSelectedId(null);
    setDraft(emptyDraft(category ?? grouped[0]?.[0] ?? "Uncategorized"));
  }

  async function handleSaveDraft() {
    if (!draft || !draft.dish.trim()) return;
    setSaving(true);
    if (selectedId) {
      await updateMenuItem(restaurantSlug, selectedId, draft as MenuItemDraft);
    } else {
      const created = await createMenuItem(restaurantSlug, draft as MenuItemDraft);
      if (created?.id) setSelectedId(created.id);
    }
    await refresh();
    setSaving(false);
  }

  async function handleDelete(item: MenuItem) {
    if (!item.id) return;
    await deleteMenuItem(restaurantSlug, item.id);
    if (selectedId === item.id) {
      setSelectedId(null);
      setDraft(null);
    }
    await refresh();
  }

  async function moveItem(category: string, item: MenuItem, direction: -1 | 1) {
    const list = grouped.find(([name]) => name === category)?.[1] ?? [];
    const index = list.findIndex((entry) => entry.id === item.id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= list.length) return;
    const reordered = [...list];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    await reorderMenuItems(restaurantSlug, reordered.map((entry) => entry.id).filter((id): id is string => Boolean(id)));
    await refresh();
  }

  async function moveCategory(name: string, direction: -1 | 1) {
    const names = grouped.map(([n]) => n);
    const index = names.indexOf(name);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= names.length) return;
    const reordered = [...names];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    await reorderCategories(restaurantSlug, reordered);
    await refresh();
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    await upsertCategory(restaurantSlug, newCategoryName.trim());
    setNewCategoryName("");
    await refresh();
  }

  if (loading) {
    return (
      <>
        <PortalTopbar restaurantSlug={restaurantSlug} />
        <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
          <div className="h-64 w-full animate-pulse rounded-2xl bg-secondary" />
        </main>
      </>
    );
  }

  return (
    <>
      <PortalTopbar restaurantSlug={restaurantSlug} />
      <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="size-5 text-primary" />
              <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">Menu Builder</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Design exactly what guests see on the QR menu — separate from Menu Intelligence analytics.
            </p>
          </div>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <ExternalLink className="size-3.5" />
            {previewLabel}
          </a>
        </div>

        {items.length === 0 && !draft ? (
          <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <UtensilsCrossed className="size-6" />
            </span>
            <div className="max-w-sm">
              <p className="font-serif text-lg font-medium tracking-tight text-foreground">
                Build your customer-facing menu
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Add dishes, group them into categories, and control exactly what guests see when they scan your QR code.
              </p>
            </div>
            <button
              onClick={() => startNewItem()}
              className="mt-2 flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
            >
              <Plus className="size-4" />
              Add first menu item
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
            {/* Left: categories + items */}
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <Input
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder="New category name"
                    className="h-8 text-xs"
                  />
                  <button
                    onClick={addCategory}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
                    aria-label="Add category"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {grouped.map(([category, categoryItems], categoryIndex) => (
                  <div key={category} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{category}</p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveCategory(category, -1)}
                          disabled={categoryIndex === 0}
                          aria-label="Move category up"
                          className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary disabled:pointer-events-none disabled:opacity-30"
                        >
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button
                          onClick={() => moveCategory(category, 1)}
                          disabled={categoryIndex === grouped.length - 1}
                          aria-label="Move category down"
                          className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary disabled:pointer-events-none disabled:opacity-30"
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-col divide-y divide-border">
                      {categoryItems.map((item, itemIndex) => (
                        <button
                          key={item.id ?? item.dish}
                          onClick={() => selectItem(item)}
                          className={cn(
                            "flex items-center justify-between gap-2 py-2 text-left",
                            selectedId === item.id && "text-primary"
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {item.dish}
                              {item.isHidden && <span className="ml-1.5 text-xs text-muted-foreground">(hidden)</span>}
                            </span>
                            <span className="text-xs text-muted-foreground">AED {item.price}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-0.5">
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                event.stopPropagation();
                                moveItem(category, item, -1);
                              }}
                              aria-label="Move item up"
                              className={cn(
                                "flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary",
                                itemIndex === 0 && "pointer-events-none opacity-30"
                              )}
                            >
                              <ArrowUp className="size-3.5" />
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                event.stopPropagation();
                                moveItem(category, item, 1);
                              }}
                              aria-label="Move item down"
                              className={cn(
                                "flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary",
                                itemIndex === categoryItems.length - 1 && "pointer-events-none opacity-30"
                              )}
                            >
                              <ArrowDown className="size-3.5" />
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => startNewItem(category)}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary"
                    >
                      <Plus className="size-3.5" />
                      Add item to {category}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: editor */}
            <div className="rounded-2xl border border-border bg-card p-5">
              {!draft ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
                  <UtensilsCrossed className="size-6" />
                  Select an item to edit, or add a new one.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{selectedId ? "Edit item" : "New item"}</p>
                    {selectedId && (
                      <button
                        onClick={() => handleDelete(draft)}
                        className="flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Name</label>
                      <Input value={draft.dish} onChange={(e) => setDraft({ ...draft, dish: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Category</label>
                      <Select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                        {categories.length === 0 && <option value={draft.category}>{draft.category}</option>}
                        {categories.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Price (AED)</label>
                      <Input
                        type="number"
                        min={0}
                        value={draft.price}
                        onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Cost (AED)</label>
                      <Input
                        type="number"
                        min={0}
                        value={draft.cost}
                        onChange={(e) => setDraft({ ...draft, cost: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Description</label>
                    <Textarea
                      value={draft.description ?? ""}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      className="min-h-16"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Image URL</label>
                    <Input value={draft.imageUrl ?? ""} onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })} placeholder="https://..." />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Dietary tags</label>
                    <div className="flex flex-wrap gap-1.5">
                      {DIETARY_TAG_OPTIONS.map((tag) => (
                        <Pill
                          key={tag}
                          active={(draft.dietaryTags ?? []).includes(tag)}
                          onClick={() => setDraft({ ...draft, dietaryTags: toggleTag(draft.dietaryTags, tag) })}
                        >
                          {tag}
                        </Pill>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Allergens</label>
                    <div className="flex flex-wrap gap-1.5">
                      {ALLERGEN_OPTIONS.map((allergen) => (
                        <Pill
                          key={allergen}
                          active={(draft.allergens ?? []).includes(allergen)}
                          onClick={() => setDraft({ ...draft, allergens: toggleTag(draft.allergens, allergen) })}
                        >
                          {allergen}
                        </Pill>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Spice level</label>
                    <div className="flex flex-wrap gap-1.5">
                      {SPICE_LABELS.map((label, level) => (
                        <Pill key={label} active={(draft.spiceLevel ?? 0) === level} onClick={() => setDraft({ ...draft, spiceLevel: level })}>
                          {label}
                        </Pill>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Prep time (min)</label>
                      <Input
                        type="number"
                        min={0}
                        value={draft.prepTimeMinutes ?? ""}
                        onChange={(e) =>
                          setDraft({ ...draft, prepTimeMinutes: e.target.value === "" ? undefined : Number(e.target.value) })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Available from</label>
                      <Input
                        type="time"
                        value={draft.availabilityWindow?.start ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            availabilityWindow: e.target.value
                              ? { start: e.target.value, end: draft.availabilityWindow?.end ?? "23:59" }
                              : null,
                          })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Available until</label>
                      <Input
                        type="time"
                        value={draft.availabilityWindow?.end ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            availabilityWindow: e.target.value
                              ? { start: draft.availabilityWindow?.start ?? "00:00", end: e.target.value }
                              : null,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">Signature dish</span>
                      <Switch checked={Boolean(draft.isSignature)} onCheckedChange={(v) => setDraft({ ...draft, isSignature: v })} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">Recommended</span>
                      <Switch checked={Boolean(draft.isRecommended)} onCheckedChange={(v) => setDraft({ ...draft, isRecommended: v })} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">Available</span>
                      <Switch checked={draft.isAvailable !== false} onCheckedChange={(v) => setDraft({ ...draft, isAvailable: v })} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">Hidden from guests</span>
                      <Switch checked={Boolean(draft.isHidden)} onCheckedChange={(v) => setDraft({ ...draft, isHidden: v })} />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveDraft}
                    disabled={saving || !draft.dish.trim()}
                    className="flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)] disabled:pointer-events-none disabled:opacity-50"
                  >
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    {selectedId ? "Save changes" : "Add item"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
