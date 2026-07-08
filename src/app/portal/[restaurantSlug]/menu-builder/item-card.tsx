"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, EyeOff, Pencil, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { MenuItem } from "@/lib/types";

export function QuickAddRow({ onAdd }: { onAdd: (dish: string, price: number, description: string) => void }) {
  const [dish, setDish] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  function submit() {
    const parsedPrice = Number(price);
    if (!dish.trim() || !Number.isFinite(parsedPrice)) return;
    onAdd(dish.trim(), parsedPrice, description.trim());
    setDish("");
    setPrice("");
    setDescription("");
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border bg-card p-3 sm:flex-row sm:items-center">
      <Input
        value={dish}
        onChange={(event) => setDish(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && submit()}
        placeholder="Item name"
        className="h-9 flex-[2] text-sm"
      />
      <Input
        value={price}
        onChange={(event) => setPrice(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && submit()}
        placeholder="Price"
        type="number"
        min={0}
        className="h-9 flex-1 text-sm"
      />
      <Input
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && submit()}
        placeholder="Short description (optional)"
        className="h-9 flex-[2] text-sm"
      />
      <button
        onClick={submit}
        disabled={!dish.trim() || !price}
        className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)] disabled:pointer-events-none disabled:opacity-50"
      >
        <Plus className="size-4" />
        Add
      </button>
    </div>
  );
}

export function ItemCard({
  item,
  isFirst,
  isLast,
  onEdit,
  onDuplicate,
  onDelete,
  onMove,
}: {
  item: MenuItem;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-secondary text-xs text-muted-foreground">
          No photo
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-medium text-foreground">{item.dish}</p>
          {item.isSignature && (
            <Badge variant="secondary" className="gap-1">
              <Star className="size-3" /> Signature
            </Badge>
          )}
          {item.isRecommended && (
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="size-3" /> Recommended
            </Badge>
          )}
          {(item.isHidden || item.isAvailable === false) && (
            <Badge variant="destructive" className="gap-1">
              <EyeOff className="size-3" /> {item.isHidden ? "Hidden" : "Unavailable"}
            </Badge>
          )}
        </div>
        {item.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.description}</p>}
        <p className="mt-0.5 text-xs font-medium text-muted-foreground">AED {item.price}</p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button onClick={() => onMove(-1)} disabled={isFirst} aria-label="Move item up" className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary disabled:pointer-events-none disabled:opacity-30">
          <ArrowUp className="size-3.5" />
        </button>
        <button onClick={() => onMove(1)} disabled={isLast} aria-label="Move item down" className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary disabled:pointer-events-none disabled:opacity-30">
          <ArrowDown className="size-3.5" />
        </button>
        <button onClick={onEdit} aria-label="Edit item" className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary">
          <Pencil className="size-3.5" />
        </button>
        <button onClick={onDuplicate} aria-label="Duplicate item" className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary">
          <Copy className="size-3.5" />
        </button>
        <button onClick={onDelete} aria-label="Delete item" className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
