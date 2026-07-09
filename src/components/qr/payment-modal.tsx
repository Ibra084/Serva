"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CreditCard } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { computeBill, SERVICE_CHARGE_PCT, VAT_PCT } from "@/lib/payment-store";
import type { QRBasketItem, SplitType } from "@/lib/types";

const TIP_OPTIONS = [0, 0.05, 0.1] as const;

export function PaymentModal({
  open,
  onOpenChange,
  items,
  guestCount,
  onPay,
  paying,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: QRBasketItem[];
  guestCount: number;
  onPay: (input: { splitType: SplitType; splitCount?: number; selectedItemIndexes?: number[]; tipPct?: number; tipAmount?: number }) => void;
  paying: boolean;
}) {
  const [splitType, setSplitType] = useState<SplitType>("full");
  const [tipPct, setTipPct] = useState<number | null>(0);
  const [customTip, setCustomTip] = useState("");
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);

  const effectiveTipPct = tipPct ?? 0;
  const customTipAmount = tipPct === null ? Number(customTip) || 0 : undefined;

  const bill = useMemo(
    () =>
      computeBill({
        items,
        splitType,
        splitCount: guestCount,
        selectedItemIndexes: splitType === "items" ? selectedIndexes : undefined,
        tipPct: tipPct === null ? undefined : effectiveTipPct,
        tipAmount: customTipAmount,
      }),
    [items, splitType, guestCount, selectedIndexes, tipPct, effectiveTipPct, customTipAmount]
  );

  function toggleItem(index: number) {
    setSelectedIndexes((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Pay bill" description="Demo payment — no card is charged">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Split</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  { key: "full", label: "Full bill" },
                  { key: "equal", label: `Split ×${guestCount}` },
                  { key: "items", label: "Select items" },
                ] as const
              ).map((option) => (
                <button
                  key={option.key}
                  onClick={() => setSplitType(option.key)}
                  className={cn(
                    "rounded-xl border px-2 py-2 text-xs font-medium transition-colors",
                    splitType === option.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {splitType === "items" && (
            <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {items.map((item, index) => (
                <label key={item.dish} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIndexes.includes(index)}
                      onChange={() => toggleItem(index)}
                      className="size-4 rounded border-border accent-[var(--primary)]"
                    />
                    {item.quantity}× {item.dish}
                  </span>
                  <span className="text-muted-foreground">AED {(item.price * item.quantity).toLocaleString()}</span>
                </label>
              ))}
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted-foreground">Tip</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {TIP_OPTIONS.map((pct) => (
                <button
                  key={pct}
                  onClick={() => {
                    setTipPct(pct);
                    setCustomTip("");
                  }}
                  className={cn(
                    "rounded-xl border px-2 py-2 text-xs font-medium transition-colors",
                    tipPct === pct
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {pct === 0 ? "No tip" : `${pct * 100}%`}
                </button>
              ))}
              <button
                onClick={() => setTipPct(null)}
                className={cn(
                  "rounded-xl border px-2 py-2 text-xs font-medium transition-colors",
                  tipPct === null
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-secondary"
                )}
              >
                Custom
              </button>
            </div>
            {tipPct === null && (
              <input
                type="number"
                min={0}
                value={customTip}
                onChange={(event) => setCustomTip(event.target.value)}
                placeholder="AED amount"
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5 rounded-xl bg-secondary/60 p-4 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>AED {bill.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Service charge ({Math.round(SERVICE_CHARGE_PCT * 100)}%)</span>
              <span>AED {bill.serviceCharge.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>VAT ({Math.round(VAT_PCT * 100)}%)</span>
              <span>AED {bill.vat.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Tip</span>
              <span>AED {bill.tip.toLocaleString()}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-base font-medium text-foreground">
              <span>Total</span>
              <span className="font-serif text-primary">AED {bill.total.toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={() =>
              onPay({
                splitType,
                splitCount: guestCount,
                selectedItemIndexes: splitType === "items" ? selectedIndexes : undefined,
                tipPct: tipPct === null ? undefined : effectiveTipPct,
                tipAmount: customTipAmount,
              })
            }
            disabled={paying || (splitType === "items" && selectedIndexes.length === 0)}
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {paying ? (
              <>
                <span className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="size-4" />
                Pay Demo · AED {bill.total.toLocaleString()}
              </>
            )}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5" />
            Demo payment mode — no real card is charged
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
