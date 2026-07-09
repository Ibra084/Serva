"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateCustomRemaining, calculateEqualSplit } from "@/lib/table-session-store";
import type { SplitMode } from "@/lib/types";

const MODES: { key: SplitMode; label: string }[] = [
  { key: "equal", label: "Split equally" },
  { key: "custom", label: "Custom amount" },
  { key: "full", label: "Pay full bill" },
  { key: "items", label: "Pay for items" },
];

export function SplitBillPanel({
  remaining,
  connectedGuestCount,
  paying,
  onPay,
}: {
  remaining: number;
  connectedGuestCount: number;
  paying: boolean;
  onPay: (amount: number, splitMode: SplitMode) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<SplitMode>("equal");
  const [customAmount, setCustomAmount] = useState("");
  const [error, setError] = useState(false);

  const equalShare = calculateEqualSplit(remaining, Math.max(1, connectedGuestCount));
  const customValue = Number(customAmount) || 0;
  const { remainingAfter, valid } = calculateCustomRemaining(remaining, [customValue]);

  const payAmount = useMemo(() => {
    if (mode === "equal") return equalShare;
    if (mode === "full") return remaining;
    if (mode === "custom") return customValue;
    return 0;
  }, [mode, equalShare, remaining, customValue]);

  if (remaining <= 0) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-4" />
        Bill fully paid
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">Split the bill</p>
      <div className="grid grid-cols-2 gap-2">
        {MODES.map((option) => (
          <button
            key={option.key}
            onClick={() => setMode(option.key)}
            disabled={option.key === "items"}
            className={cn(
              "rounded-xl border px-2 py-2.5 text-xs font-medium transition-colors disabled:opacity-40",
              mode === option.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            )}
          >
            {option.label}
            {option.key === "items" && <span className="block text-[0.65rem] font-normal">Coming soon</span>}
          </button>
        ))}
      </div>

      {mode === "equal" && (
        <div className="rounded-xl bg-secondary/60 p-3 text-sm text-foreground">
          Your share, split between {Math.max(1, connectedGuestCount)} connected guest
          {connectedGuestCount === 1 ? "" : "s"}: <span className="font-medium">AED {equalShare.toLocaleString()}</span>
        </div>
      )}

      {mode === "custom" && (
        <div className="flex flex-col gap-2">
          <input
            type="number"
            min={0}
            step="0.01"
            value={customAmount}
            onChange={(event) => setCustomAmount(event.target.value)}
            placeholder="AED amount"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <p className={cn("text-xs", valid ? "text-muted-foreground" : "text-destructive")}>
            {valid
              ? `Remaining after this payment: AED ${Math.max(0, remainingAfter).toLocaleString()}`
              : "Amount can't exceed the remaining balance"}
          </p>
        </div>
      )}

      {mode === "full" && (
        <div className="rounded-xl bg-secondary/60 p-3 text-sm text-foreground">
          Pay the entire remaining balance: <span className="font-medium">AED {remaining.toLocaleString()}</span>
        </div>
      )}

      <button
        onClick={async () => {
          setError(false);
          const ok = await onPay(payAmount, mode);
          if (!ok) setError(true);
        }}
        disabled={paying || payAmount <= 0 || (mode === "custom" && !valid)}
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
            Pay Demo · AED {payAmount.toLocaleString()}
          </>
        )}
      </button>
      {error && (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-destructive">
          <AlertCircle className="size-3.5" />
          Payment didn&rsquo;t go through — please try again.
        </p>
      )}
    </div>
  );
}
