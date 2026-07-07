"use client";

import { useMemo } from "react";
import { Minus, Plus } from "lucide-react";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import type { MenuItem, QRBasketItem } from "@/lib/types";

export function MenuBrowser({
  menu,
  basket,
  onAdd,
  onChangeQuantity,
}: {
  menu: MenuItem[];
  basket: QRBasketItem[];
  onAdd: (item: MenuItem) => void;
  onChangeQuantity: (dish: string, quantity: number) => void;
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
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.dish}</p>
                      <p className="text-xs text-muted-foreground">AED {item.price}</p>
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
                );
              })}
            </div>
          </TabsPanel>
        ))}
      </Tabs>
    </div>
  );
}
