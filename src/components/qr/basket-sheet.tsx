"use client";

import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { QRBasketItem } from "@/lib/types";

export function BasketBar({
  itemCount,
  subtotal,
  onOpen,
}: {
  itemCount: number;
  subtotal: number;
  onOpen: () => void;
}) {
  if (itemCount === 0) return null;

  return (
    <div className="sticky bottom-3 z-10 px-4">
      <button
        onClick={onOpen}
        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-[0_16px_32px_-16px_rgba(31,107,66,0.5)]"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <ShoppingBag className="size-4" />
          {itemCount} item{itemCount === 1 ? "" : "s"}
        </span>
        <span className="text-sm font-medium">View basket · AED {subtotal.toLocaleString()}</span>
      </button>
    </div>
  );
}

export function BasketSheet({
  open,
  onOpenChange,
  basket,
  subtotal,
  specialRequests,
  onSpecialRequestsChange,
  onChangeQuantity,
  onClearBasket,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  basket: QRBasketItem[];
  subtotal: number;
  specialRequests: string;
  onSpecialRequestsChange: (value: string) => void;
  onChangeQuantity: (dish: string, quantity: number) => void;
  onClearBasket: () => void;
  onSubmit: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Your basket" description="Review your order before submitting">
        {basket.length === 0 ? (
          <p className="text-sm text-muted-foreground">Your basket is empty.</p>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                {basket.length} item{basket.length === 1 ? "" : "s"}
              </p>
              <button
                onClick={onClearBasket}
                className="flex items-center gap-1 text-xs font-medium text-destructive hover:underline"
              >
                <Trash2 className="size-3" />
                Clear basket
              </button>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {basket.map((item) => (
                <div key={item.dish} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.dish}</p>
                    <p className="text-xs text-muted-foreground">AED {item.price} each</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex items-center gap-2 rounded-full border border-border px-1 py-1">
                      <button
                        onClick={() => onChangeQuantity(item.dish, item.quantity - 1)}
                        aria-label="Decrease quantity"
                        className="flex size-6 items-center justify-center rounded-full text-foreground hover:bg-secondary"
                      >
                        {item.quantity === 1 ? <Trash2 className="size-3" /> : <Minus className="size-3" />}
                      </button>
                      <span className="w-4 text-center text-sm font-medium text-foreground">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onChangeQuantity(item.dish, item.quantity + 1)}
                        aria-label="Increase quantity"
                        className="flex size-6 items-center justify-center rounded-full text-foreground hover:bg-secondary"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Special requests</label>
              <Textarea
                value={specialRequests}
                onChange={(event) => onSpecialRequestsChange(event.target.value)}
                placeholder="Allergies, spice level, anything else the kitchen should know..."
                className="min-h-20"
              />
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">Subtotal</p>
              <p className="font-serif text-lg font-medium text-primary">AED {subtotal.toLocaleString()}</p>
            </div>

            <button
              onClick={onSubmit}
              className="w-full rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
            >
              Submit Order
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
