"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { parseBulkMenuText } from "@/lib/menu-import";

const PLACEHOLDER = `Starters
Garlic Bread - 28
Caesar Salad - 48

Mains
Steak Frites - 115
Truffle Pasta - 82

Desserts
Tiramisu - 38

Drinks
Lemon Mint - 24`;

export function BulkPasteSheet({
  open,
  onOpenChange,
  importing,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importing: boolean;
  onConfirm: (items: { category: string; dish: string; price: number }[]) => void;
}) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseBulkMenuText(text), [text]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Bulk paste menu" description={'Paste a category, then one item per line as "Name - Price".'}>

        <div className="flex flex-col gap-4">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={PLACEHOLDER}
            className="min-h-48 font-mono text-xs"
          />

          {parsed.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Preview — {parsed.length} item{parsed.length === 1 ? "" : "s"}
              </p>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <tbody>
                    {parsed.map((item, index) => (
                      <tr key={index} className="border-b border-border last:border-0">
                        <td className="px-3 py-1.5 text-muted-foreground">{item.category}</td>
                        <td className="px-3 py-1.5 font-medium text-foreground">{item.dish}</td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">AED {item.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button
            onClick={() => onConfirm(parsed)}
            disabled={parsed.length === 0 || importing}
            className="flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)] disabled:pointer-events-none disabled:opacity-50"
          >
            {importing && <Loader2 className="size-4 animate-spin" />}
            Confirm import
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
