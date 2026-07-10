"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Check, ClipboardPaste, ExternalLink, Loader2, RotateCcw, Sparkles, UtensilsCrossed } from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { PortalPageSkeleton } from "@/components/portal/page-skeleton";
import {
  bulkCreateMenuItems,
  createMenuItem,
  deleteCategory,
  deleteMenuItem,
  loadMenuBuilderItems,
  loadMenuCategories,
  renameCategory,
  reorderCategories,
  reorderMenuItems,
  updateMenuItem,
  upsertCategory,
  type MenuItemDraft,
} from "@/lib/menu-store";
import { loadMenuAppearance } from "@/lib/menu-appearance-store";
import { MENU_TEMPLATES, type MenuTemplateId } from "@/lib/menu-templates";
import type { MenuCategory } from "@/lib/menu-types";
import type { MenuItem } from "@/lib/types";
import { CategorySidebar } from "./category-sidebar";
import { ItemCard, QuickAddRow } from "./item-card";
import { ItemEditorSheet } from "./item-editor-sheet";
import { BulkPasteSheet } from "./bulk-paste-sheet";
import { TemplatePickerSheet } from "./template-picker-sheet";

type SaveState = "idle" | "saving" | "saved" | "error";

function newTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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

export function MenuBuilderClient({ restaurantSlug }: { restaurantSlug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDraft, setEditorDraft] = useState<MenuItem | null>(null);
  const [editorIsNew, setEditorIsNew] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);

  const [bulkPasteOpen, setBulkPasteOpen] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateApplying, setTemplateApplying] = useState(false);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);

  const [previewLabel, setPreviewLabel] = useState("Preview Customer Menu");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const previewUrl = `${origin}/qr/${restaurantSlug}`;

  useEffect(() => {
    if (!restaurantSlug) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError(null);
      const [itemsResult, categoriesResult] = await Promise.all([
        loadMenuBuilderItems(restaurantSlug),
        loadMenuCategories(restaurantSlug),
      ]);
      if (cancelled) return;
      if (itemsResult.error || categoriesResult.error) {
        setLoadError(itemsResult.error ?? categoriesResult.error);
      } else {
        setItems(itemsResult.data);
        setCategories(categoriesResult.data);
        setSelectedCategory((current) => current ?? categoriesResult.data[0]?.name ?? null);
      }
      setLoading(false);
    })();

    loadMenuAppearance(restaurantSlug).then((appearance) => {
      if (cancelled) return;
      setPreviewLabel(appearance.layout === "booklet" ? "Preview Booklet Menu" : "Preview Customer Menu");
    });

    return () => {
      cancelled = true;
    };
  }, [restaurantSlug]);

  useEffect(() => {
    if (loading || searchParams.get("new") !== "item") return;
    openNewItemEditor();
    router.replace(`/portal/${restaurantSlug}/menu-builder`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams]);

  async function reloadAll() {
    setLoading(true);
    setLoadError(null);
    const [itemsResult, categoriesResult] = await Promise.all([
      loadMenuBuilderItems(restaurantSlug),
      loadMenuCategories(restaurantSlug),
    ]);
    if (itemsResult.error || categoriesResult.error) {
      setLoadError(itemsResult.error ?? categoriesResult.error);
    } else {
      setItems(itemsResult.data);
      setCategories(categoriesResult.data);
      setSelectedCategory((current) => current ?? categoriesResult.data[0]?.name ?? null);
    }
    setLoading(false);
  }

  function markSaving() {
    setSaveState("saving");
    setSaveError(null);
    setRetryAction(null);
  }

  function markSaved() {
    setSaveState("saved");
    setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
  }

  function markError(message: string, retry: () => void) {
    setSaveState("error");
    setSaveError(message);
    setRetryAction(() => retry);
  }

  const categoryRows = useMemo(() => {
    const knownNames = new Set(categories.map((c) => c.name));
    const extra = Array.from(new Set(items.map((i) => i.category))).filter((name) => !knownNames.has(name));
    const names = [...categories.map((c) => c.name), ...extra];
    return names.map((name) => ({ name, itemCount: items.filter((i) => i.category === name).length }));
  }, [categories, items]);

  const itemsInSelectedCategory = useMemo(() => {
    return items
      .filter((item) => item.category === selectedCategory)
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }, [items, selectedCategory]);

  // ---- Category mutations ----

  function addCategory(name: string) {
    if (categories.some((c) => c.name === name)) {
      setSelectedCategory(name);
      return;
    }
    const optimistic: MenuCategory = { name, displayOrder: categories.length };
    setCategories((prev) => [...prev, optimistic]);
    setSelectedCategory(name);
    markSaving();
    upsertCategory(restaurantSlug, name)
      .then(() => markSaved())
      .catch(() => {
        setCategories((prev) => prev.filter((c) => c.name !== name));
        markError(`Couldn't save category "${name}".`, () => addCategory(name));
      });
  }

  function renameCategoryAction(oldName: string, newName: string) {
    const prevCategories = categories;
    const prevItems = items;
    setCategories((prev) => prev.map((c) => (c.name === oldName ? { ...c, name: newName } : c)));
    setItems((prev) => prev.map((i) => (i.category === oldName ? { ...i, category: newName } : i)));
    setSelectedCategory((current) => (current === oldName ? newName : current));
    markSaving();
    renameCategory(restaurantSlug, oldName, newName)
      .then(() => markSaved())
      .catch(() => {
        setCategories(prevCategories);
        setItems(prevItems);
        markError(`Couldn't rename "${oldName}".`, () => renameCategoryAction(oldName, newName));
      });
  }

  function deleteCategoryAction(name: string) {
    const prevCategories = categories;
    const prevItems = items;
    setCategories((prev) => prev.filter((c) => c.name !== name));
    setItems((prev) => prev.map((i) => (i.category === name ? { ...i, category: "Uncategorized" } : i)));
    setSelectedCategory((current) => (current === name ? categories.find((c) => c.name !== name)?.name ?? null : current));
    markSaving();
    deleteCategory(restaurantSlug, name)
      .then(() => markSaved())
      .catch(() => {
        setCategories(prevCategories);
        setItems(prevItems);
        markError(`Couldn't delete "${name}".`, () => deleteCategoryAction(name));
      });
  }

  function moveCategory(name: string, direction: -1 | 1) {
    const names = categoryRows.map((c) => c.name);
    const index = names.indexOf(name);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= names.length) return;
    const reordered = [...names];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    setCategories(reordered.map((n, i) => ({ name: n, displayOrder: i })));
    markSaving();
    reorderCategories(restaurantSlug, reordered)
      .then(() => markSaved())
      .catch(() => markError("Couldn't save category order.", () => moveCategory(name, direction)));
  }

  // ---- Item mutations ----

  function createItem(draft: MenuItem, options?: { closeEditor?: boolean }) {
    const tempId = newTempId();
    const optimisticItem: MenuItem = { ...draft, id: tempId };
    setItems((prev) => [...prev, optimisticItem]);
    if (options?.closeEditor) setEditorOpen(false);
    markSaving();
    setEditorSaving(true);
    createMenuItem(restaurantSlug, draft as MenuItemDraft)
      .then((created) => {
        setEditorSaving(false);
        if (!created) throw new Error("Save failed");
        setItems((prev) => prev.map((item) => (item.id === tempId ? created : item)));
        setCategories((prev) =>
          prev.some((c) => c.name === created.category) ? prev : [...prev, { name: created.category, displayOrder: prev.length }]
        );
        markSaved();
      })
      .catch(() => {
        setEditorSaving(false);
        setItems((prev) => prev.filter((item) => item.id !== tempId));
        markError(`Couldn't add "${draft.dish}".`, () => createItem(draft, options));
      });
  }

  function updateItem(id: string, patch: MenuItemDraft, options?: { closeEditor?: boolean }) {
    const previous = items.find((item) => item.id === id);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch, id } : item)));
    if (options?.closeEditor) setEditorOpen(false);
    markSaving();
    setEditorSaving(true);
    updateMenuItem(restaurantSlug, id, patch)
      .then(() => {
        setEditorSaving(false);
        markSaved();
      })
      .catch(() => {
        setEditorSaving(false);
        if (previous) setItems((prev) => prev.map((item) => (item.id === id ? previous : item)));
        markError("Couldn't save changes.", () => updateItem(id, patch, options));
      });
  }

  function deleteItem(item: MenuItem) {
    if (!item.id) return;
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setEditorOpen(false);
    markSaving();
    deleteMenuItem(restaurantSlug, item.id)
      .then(() => markSaved())
      .catch(() => {
        setItems(previous);
        markError(`Couldn't delete "${item.dish}".`, () => deleteItem(item));
      });
  }

  function duplicateItem(item: MenuItem) {
    const rest: MenuItem = { ...item, id: undefined };
    createItem({ ...rest, dish: `${item.dish} (copy)` });
  }

  function moveItem(item: MenuItem, direction: -1 | 1) {
    const list = itemsInSelectedCategory;
    const index = list.findIndex((entry) => entry.id === item.id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= list.length) return;
    const reordered = [...list];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    const orderedIds = reordered.map((entry) => entry.id).filter((id): id is string => Boolean(id));
    setItems((prev) =>
      prev.map((entry) => {
        const newIndex = orderedIds.indexOf(entry.id ?? "");
        return newIndex >= 0 ? { ...entry, displayOrder: newIndex } : entry;
      })
    );
    markSaving();
    reorderMenuItems(restaurantSlug, orderedIds)
      .then(() => markSaved())
      .catch(() => markError("Couldn't save item order.", () => moveItem(item, direction)));
  }

  // ---- Editor / quick add / bulk / templates ----

  function openNewItemEditor(category?: string) {
    setEditorIsNew(true);
    setEditorDraft(emptyDraft(category ?? selectedCategory ?? categoryRows[0]?.name ?? "Uncategorized"));
    setEditorOpen(true);
  }

  function openEditItemEditor(item: MenuItem) {
    setEditorIsNew(false);
    setEditorDraft({ ...item });
    setEditorOpen(true);
  }

  function handleQuickAdd(dish: string, price: number, description: string) {
    if (!selectedCategory) return;
    createItem({ ...emptyDraft(selectedCategory), dish, price, description });
  }

  function handleEditorSave() {
    if (!editorDraft || !editorDraft.dish.trim()) return;
    if (editorIsNew || !editorDraft.id) {
      createItem(editorDraft, { closeEditor: true });
    } else {
      updateItem(editorDraft.id, editorDraft as MenuItemDraft, { closeEditor: true });
    }
  }

  function handleBulkImport(parsedItems: { category: string; dish: string; price: number }[]) {
    setBulkImporting(true);
    bulkCreateMenuItems(restaurantSlug, parsedItems)
      .then((result) => {
        setBulkImporting(false);
        if (result.error) throw new Error(result.error);
        setBulkPasteOpen(false);
        reloadAll();
        markSaved();
      })
      .catch(() => {
        setBulkImporting(false);
        markError("Couldn't import menu.", () => handleBulkImport(parsedItems));
      });
  }

  function handleApplyTemplate(templateId: MenuTemplateId) {
    if (templateId === "blank") {
      setTemplatePickerOpen(false);
      return;
    }
    setTemplateApplying(true);
    bulkCreateMenuItems(restaurantSlug, MENU_TEMPLATES[templateId])
      .then((result) => {
        setTemplateApplying(false);
        if (result.error) throw new Error(result.error);
        setTemplatePickerOpen(false);
        reloadAll();
        markSaved();
      })
      .catch(() => {
        setTemplateApplying(false);
        markError("Couldn't apply template.", () => handleApplyTemplate(templateId));
      });
  }

  if (loading) {
    return (
      <>
        <PortalTopbar restaurantSlug={restaurantSlug} />
        <PortalPageSkeleton />
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <PortalTopbar restaurantSlug={restaurantSlug} />
        <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
            <AlertTriangle className="size-8 text-destructive" />
            <p className="font-serif text-lg font-medium text-foreground">Couldn't load your menu</p>
            <p className="max-w-sm text-sm text-muted-foreground">{loadError}</p>
            <button
              onClick={reloadAll}
              className="mt-2 flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
            >
              <RotateCcw className="size-4" />
              Try again
            </button>
          </div>
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
          <div className="flex flex-wrap items-center gap-2">
            <SaveIndicator state={saveState} error={saveError} onRetry={retryAction ?? undefined} />
            <button
              onClick={() => setBulkPasteOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <ClipboardPaste className="size-3.5" />
              Bulk Paste Menu
            </button>
            <button
              onClick={() => setTemplatePickerOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <Sparkles className="size-3.5" />
              Templates
            </button>
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="sticky top-4 flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <ExternalLink className="size-3.5" />
              {previewLabel}
            </a>
          </div>
        </div>

        {items.length === 0 && categoryRows.length === 0 ? (
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
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => openNewItemEditor("Starters")}
                className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
              >
                Start from blank
              </button>
              <button
                onClick={() => setTemplatePickerOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Use a template
              </button>
              <button
                onClick={() => setBulkPasteOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Bulk paste menu
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-[16rem_1fr]">
            <CategorySidebar
              categories={categoryRows}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
              onAdd={addCategory}
              onRename={renameCategoryAction}
              onDelete={deleteCategoryAction}
              onMove={moveCategory}
            />

            <div className="flex flex-col gap-3">
              {selectedCategory ? (
                <>
                  <QuickAddRow onAdd={handleQuickAdd} />
                  {itemsInSelectedCategory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
                      No items in {selectedCategory} yet.
                    </div>
                  ) : (
                    itemsInSelectedCategory.map((item, index) => (
                      <ItemCard
                        key={item.id ?? item.dish}
                        item={item}
                        isFirst={index === 0}
                        isLast={index === itemsInSelectedCategory.length - 1}
                        onEdit={() => openEditItemEditor(item)}
                        onDuplicate={() => duplicateItem(item)}
                        onDelete={() => deleteItem(item)}
                        onMove={(direction) => moveItem(item, direction)}
                      />
                    ))
                  )}
                  <button
                    onClick={() => openNewItemEditor(selectedCategory)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary"
                  >
                    More details for a new item in {selectedCategory}
                  </button>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card py-16 text-center text-sm text-muted-foreground">
                  Select or add a category to get started.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <ItemEditorSheet
        restaurantSlug={restaurantSlug}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        draft={editorDraft}
        onChange={setEditorDraft}
        categories={categories}
        isNew={editorIsNew}
        saving={editorSaving}
        onSave={handleEditorSave}
        onDelete={() => editorDraft && deleteItem(editorDraft)}
      />

      <BulkPasteSheet open={bulkPasteOpen} onOpenChange={setBulkPasteOpen} importing={bulkImporting} onConfirm={handleBulkImport} />

      <TemplatePickerSheet
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        applying={templateApplying}
        onApply={handleApplyTemplate}
      />
    </>
  );
}

function SaveIndicator({
  state,
  error,
  onRetry,
}: {
  state: SaveState;
  error: string | null;
  onRetry?: () => void;
}) {
  if (state === "idle") return null;
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
        <Check className="size-3.5" />
        Saved
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive">
      <AlertTriangle className="size-3.5" />
      {error ?? "Couldn't save"}
      {onRetry && (
        <button onClick={onRetry} className="ml-1 underline underline-offset-2">
          Retry
        </button>
      )}
    </span>
  );
}
