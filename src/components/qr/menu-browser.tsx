"use client";

import { useMemo } from "react";
import { Flame, Minus, Plus, Sparkles, ThumbsUp } from "lucide-react";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { DEFAULT_MENU_APPEARANCE, type MenuAppearanceSettings } from "@/lib/menu-types";
import type { MenuItem, QRBasketItem } from "@/lib/types";

export function MenuBrowser({
  menu,
  basket,
  onAdd,
  onChangeQuantity,
  appearance = DEFAULT_MENU_APPEARANCE,
  dense = false,
}: {
  menu: MenuItem[];
  basket: QRBasketItem[];
  onAdd: (item: MenuItem) => void;
  onChangeQuantity: (dish: string, quantity: number) => void;
  appearance?: MenuAppearanceSettings;
  dense?: boolean;
}) {
  const categories = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of menu) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries());
  }, [menu]);

  if (categories.length === 0) return null;

  return (
    <div className="flex flex-1 flex-col px-4 py-4">
      <p className="text-sm font-medium text-foreground">Menu</p>
      <Tabs defaultValue={categories[0][0]} className="mt-3">
        <TabsList className="w-full overflow-x-auto">
          {categories.map(([category]) => (
            <TabsTab key={category} value={category} className="shrink-0">
              {category}
            </TabsTab>
          ))}
        </TabsList>
        {categories.map(([category, items]) => (
          <TabsPanel key={category} value={category}>
            <div className="flex flex-col gap-2.5">
              {items.map((item) => {
                const basketItem = basket.find((entry) => entry.dish === item.dish);
                return (
                  <div
                    key={item.dish}
                    className={
                      dense
                        ? "flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5"
                        : "flex gap-3 rounded-2xl border border-border bg-card p-3"
                    }
                  >
                    {!dense && appearance.showPhotos && item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.dish}
                        className="size-16 shrink-0 rounded-xl object-cover"
                      />
                    )}
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-medium text-foreground">{item.dish}</p>
                          {item.isSignature && (
                            <span className="flex items-center gap-0.5 rounded-full bg-accent px-1.5 py-0.5 text-[0.6rem] font-medium text-accent-foreground">
                              <Sparkles className="size-2.5" />
                              Signature
                            </span>
                          )}
                          {appearance.showPopularity && item.isRecommended && (
                            <span className="flex items-center gap-0.5 rounded-full bg-secondary px-1.5 py-0.5 text-[0.6rem] font-medium text-muted-foreground">
                              <ThumbsUp className="size-2.5" />
                              Popular
                            </span>
                          )}
                          {(item.spiceLevel ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5 text-[0.65rem] text-destructive">
                              {Array.from({ length: item.spiceLevel ?? 0 }).map((_, index) => (
                                <Flame key={index} className="size-2.5" />
                              ))}
                            </span>
                          )}
                        </div>
                        {!dense && item.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                        )}
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          {appearance.showPrices && (
                            <p className="text-xs text-muted-foreground">AED {item.price}</p>
                          )}
                          {appearance.showAllergens && (item.allergens?.length ?? 0) > 0 && (
                            <p className="text-[0.65rem] text-muted-foreground">
                              Contains: {item.allergens?.join(", ")}
                            </p>
                          )}
                        </div>
                      </div>

                      {basketItem ? (
                        <div className="flex shrink-0 items-center gap-2 rounded-full border border-border px-1 py-1">
                          <button
                            onClick={() => onChangeQuantity(item.dish, basketItem.quantity - 1)}
                            aria-label="Decrease quantity"
                            className="flex size-6 items-center justify-center rounded-full text-foreground hover:bg-secondary"
                          >
                            <Minus className="size-3" />
                          </button>
                          <span className="w-4 text-center text-sm font-medium text-foreground">
                            {basketItem.quantity}
                          </span>
                          <button
                            onClick={() => onChangeQuantity(item.dish, basketItem.quantity + 1)}
                            aria-label="Increase quantity"
                            className="flex size-6 items-center justify-center rounded-full text-foreground hover:bg-secondary"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onAdd(item)}
                          className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
                        >
                          <Plus className="size-3" />
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsPanel>
        ))}
      </Tabs>
    </div>
  );
}
