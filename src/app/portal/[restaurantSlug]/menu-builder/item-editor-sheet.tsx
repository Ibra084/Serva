"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Trash2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/lib/types";
import type { MenuCategory } from "@/lib/menu-types";

const DIETARY_TAG_OPTIONS = ["vegetarian", "vegan", "halal", "gluten-free", "dairy-free"];
const ALLERGEN_OPTIONS = ["nuts", "dairy", "gluten", "shellfish", "eggs", "soy"];
const SPICE_LABELS = ["None", "Mild", "Medium", "Hot"];

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

export function ItemEditorSheet({
  open,
  onOpenChange,
  draft,
  onChange,
  categories,
  isNew,
  saving,
  onSave,
  onDelete,
  defaultShowMore = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: MenuItem | null;
  onChange: (draft: MenuItem) => void;
  categories: MenuCategory[];
  isNew: boolean;
  saving: boolean;
  onSave: () => void;
  onDelete: () => void;
  defaultShowMore?: boolean;
}) {
  const [showMore, setShowMore] = useState(defaultShowMore);

  if (!draft) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={isNew ? "New item" : "Edit item"}>
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input value={draft.dish} onChange={(e) => onChange({ ...draft, dish: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <Select value={draft.category} onChange={(e) => onChange({ ...draft, category: e.target.value })}>
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
                onChange={(e) => onChange({ ...draft, price: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea
              value={draft.description ?? ""}
              onChange={(e) => onChange({ ...draft, description: e.target.value })}
              className="min-h-16"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showMore ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            More details
          </button>

          {showMore && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Image URL</label>
                <Input value={draft.imageUrl ?? ""} onChange={(e) => onChange({ ...draft, imageUrl: e.target.value })} placeholder="https://..." />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cost (AED)</label>
                <Input
                  type="number"
                  min={0}
                  value={draft.cost}
                  onChange={(e) => onChange({ ...draft, cost: Number(e.target.value) })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Dietary tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {DIETARY_TAG_OPTIONS.map((tag) => (
                    <Pill
                      key={tag}
                      active={(draft.dietaryTags ?? []).includes(tag)}
                      onClick={() => onChange({ ...draft, dietaryTags: toggleTag(draft.dietaryTags, tag) })}
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
                      onClick={() => onChange({ ...draft, allergens: toggleTag(draft.allergens, allergen) })}
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
                    <Pill key={label} active={(draft.spiceLevel ?? 0) === level} onClick={() => onChange({ ...draft, spiceLevel: level })}>
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
                      onChange({ ...draft, prepTimeMinutes: e.target.value === "" ? undefined : Number(e.target.value) })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Available from</label>
                  <Input
                    type="time"
                    value={draft.availabilityWindow?.start ?? ""}
                    onChange={(e) =>
                      onChange({
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
                      onChange({
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
                  <Switch checked={Boolean(draft.isSignature)} onCheckedChange={(v) => onChange({ ...draft, isSignature: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Recommended</span>
                  <Switch checked={Boolean(draft.isRecommended)} onCheckedChange={(v) => onChange({ ...draft, isRecommended: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Available</span>
                  <Switch checked={draft.isAvailable !== false} onCheckedChange={(v) => onChange({ ...draft, isAvailable: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Hidden from guests</span>
                  <Switch checked={Boolean(draft.isHidden)} onCheckedChange={(v) => onChange({ ...draft, isHidden: v })} />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onSave}
              disabled={saving || !draft.dish.trim()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)] disabled:pointer-events-none disabled:opacity-50"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isNew ? "Add item" : "Save changes"}
            </button>
            {!isNew && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
              >
                <Trash2 className="size-3.5" />
                Delete
              </button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
