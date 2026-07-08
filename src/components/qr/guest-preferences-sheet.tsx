"use client";

import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { GuestDietaryPreference, GuestMood, GuestPreferences } from "@/lib/menu-types";

const DIETARY_OPTIONS: { value: GuestDietaryPreference; label: string }[] = [
  { value: "none", label: "No preference" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "halal", label: "Halal" },
  { value: "gluten-free", label: "Gluten-free" },
];

const MOOD_OPTIONS: { value: NonNullable<GuestMood>; label: string }[] = [
  { value: "light", label: "Light meal" },
  { value: "very_hungry", label: "Very hungry" },
  { value: "date_night", label: "Date night" },
  { value: "family", label: "Family meal" },
  { value: "healthy", label: "Healthy" },
  { value: "comfort", label: "Comfort food" },
];

const SPICE_LABELS = ["Mild", "Medium", "Spicy", "Very spicy"];

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-secondary"
      )}
    >
      {children}
    </button>
  );
}

export function GuestPreferencesSheet({
  open,
  onOpenChange,
  preferences,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: GuestPreferences;
  onSave: (prefs: GuestPreferences) => void;
}) {
  const [draft, setDraft] = useState<GuestPreferences>(preferences);
  const [allergyInput, setAllergyInput] = useState(preferences.allergies.join(", "));

  function handleSave() {
    const allergies = allergyInput
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    onSave({ ...draft, allergies });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Your preferences" description="Helps us recommend the right dishes for you">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Dietary preference</label>
            <Select
              value={draft.dietary}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, dietary: event.target.value as GuestDietaryPreference }))
              }
            >
              {DIETARY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Allergies</label>
            <Input
              value={allergyInput}
              onChange={(event) => setAllergyInput(event.target.value)}
              placeholder="e.g. nuts, shellfish"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Spice preference</label>
            <div className="flex flex-wrap gap-1.5">
              {SPICE_LABELS.map((label, level) => (
                <Pill
                  key={label}
                  active={draft.spicePreference === level}
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, spicePreference: prev.spicePreference === level ? null : level }))
                  }
                >
                  {label}
                </Pill>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Budget (AED, optional)</label>
            <Input
              type="number"
              min={0}
              value={draft.budget ?? ""}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  budget: event.target.value === "" ? null : Number(event.target.value),
                }))
              }
              placeholder="e.g. 100"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mood</label>
            <div className="flex flex-wrap gap-1.5">
              {MOOD_OPTIONS.map((option) => (
                <Pill
                  key={option.value}
                  active={draft.mood === option.value}
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, mood: prev.mood === option.value ? null : option.value }))
                  }
                >
                  {option.label}
                </Pill>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            className="mt-2 w-full rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
          >
            Save preferences
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
