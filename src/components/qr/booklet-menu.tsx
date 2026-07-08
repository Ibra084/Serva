"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Minus, Plus, Sparkles } from "lucide-react";
import { DEFAULT_MENU_APPEARANCE, type MenuAppearanceSettings } from "@/lib/menu-types";
import type { MenuItem, QRBasketItem } from "@/lib/types";

export function BookletMenu({
  menu,
  basket,
  onAdd,
  onChangeQuantity,
  appearance = DEFAULT_MENU_APPEARANCE,
}: {
  menu: MenuItem[];
  basket: QRBasketItem[];
  onAdd: (item: MenuItem) => void;
  onChangeQuantity: (dish: string, quantity: number) => void;
  appearance?: MenuAppearanceSettings;
}) {
  const pages = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of menu) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries());
  }, [menu]);

  const [pageIndex, setPageIndex] = useState(0);

  if (pages.length === 0) return null;
  const [category, items] = pages[Math.min(pageIndex, pages.length - 1)];

  return (
    <div className="flex flex-1 flex-col px-4 py-4">
      <div className="flex flex-wrap gap-1.5">
        {pages.map(([name], index) => (
          <button
            key={name}
            onClick={() => setPageIndex(index)}
            className={
              index === pageIndex
                ? "rounded-full bg-primary px-2.5 py-1 text-[0.7rem] font-medium text-primary-foreground"
                : "rounded-full border border-border bg-card px-2.5 py-1 text-[0.7rem] font-medium text-foreground hover:bg-secondary"
            }
          >
            {name}
          </button>
        ))}
      </div>

      <div className="mt-4 flex-1 rounded-3xl border border-border bg-card p-5 shadow-[0_16px_32px_-24px_rgba(33,31,26,0.35)]">
        <p className="text-center font-serif text-lg font-medium tracking-tight text-foreground">{category}</p>
        <div className="mt-4 flex flex-col divide-y divide-border">
          {items.map((item) => {
            const basketItem = basket.find((entry) => entry.dish === item.dish);
            return (
              <div key={item.dish} className="flex items-start justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-medium text-foreground">{item.dish}</p>
                    {item.isSignature && (
                      <span className="flex items-center gap-0.5 rounded-full bg-accent px-1.5 py-0.5 text-[0.6rem] font-medium text-accent-foreground">
                        <Sparkles className="size-2.5" />
                        Signature
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
                  {item.description && (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                  )}
                  {appearance.showPrices && (
                    <p className="mt-1 text-xs font-medium text-primary">AED {item.price}</p>
                  )}
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
                    <span className="w-4 text-center text-sm font-medium text-foreground">{basketItem.quantity}</span>
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
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
          disabled={pageIndex === 0}
          className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" />
          Previous
        </button>
        <span className="text-xs text-muted-foreground">
          Page {pageIndex + 1} of {pages.length}
        </span>
        <button
          onClick={() => setPageIndex((index) => Math.min(pages.length - 1, index + 1))}
          disabled={pageIndex === pages.length - 1}
          className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
        >
          Next
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
