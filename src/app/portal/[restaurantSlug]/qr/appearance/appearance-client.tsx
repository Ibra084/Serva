"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, Palette } from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { loadMenuAppearance, saveMenuAppearance } from "@/lib/menu-appearance-store";
import { DEFAULT_MENU_APPEARANCE, type CategoryDisplay, type MenuAppearanceSettings, type MenuLayout } from "@/lib/menu-types";

const LAYOUT_OPTIONS: { value: MenuLayout; label: string; description: string }[] = [
  { value: "modern", label: "Modern cards", description: "Photo-forward cards with badges and descriptions." },
  { value: "compact", label: "Compact list", description: "A tighter, denser list — fast to scan." },
  { value: "booklet", label: "Booklet", description: "A cover page and paginated, premium-menu feel." },
];

const CATEGORY_DISPLAY_OPTIONS: { value: CategoryDisplay; label: string }[] = [
  { value: "tabs", label: "Tabs" },
  { value: "sections", label: "Sections" },
  { value: "booklet", label: "Booklet pages" },
];

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function AppearanceClient({ restaurantSlug }: { restaurantSlug: string }) {
  const [settings, setSettings] = useState<MenuAppearanceSettings>(DEFAULT_MENU_APPEARANCE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const previewUrl = `${origin}/qr/${restaurantSlug}`;
  const previewLabel = settings.layout === "booklet" ? "Preview Booklet Menu" : "Preview Customer Menu";

  useEffect(() => {
    loadMenuAppearance(restaurantSlug).then((result) => {
      setSettings(result);
      setLoading(false);
    });
  }, [restaurantSlug]);

  async function handleSave() {
    setSaving(true);
    await saveMenuAppearance(restaurantSlug, settings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  if (loading) {
    return (
      <>
        <PortalTopbar restaurantSlug={restaurantSlug} />
        <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
          <div className="h-64 w-full animate-pulse rounded-2xl bg-secondary" />
        </main>
      </>
    );
  }

  return (
    <>
      <PortalTopbar restaurantSlug={restaurantSlug} />
      <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Palette className="size-5 text-primary" />
              <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">Menu Appearance</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Control how guests see your menu when they scan the QR code.</p>
          </div>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <ExternalLink className="size-3.5" />
            {previewLabel}
          </a>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-medium text-foreground">Menu layout</p>
              <div className="mt-3 flex flex-col gap-2">
                {LAYOUT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSettings((prev) => ({ ...prev, layout: option.value }))}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                      settings.layout === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
                    )}
                  >
                    <span className="text-sm font-medium text-foreground">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-medium text-foreground">Category display</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CATEGORY_DISPLAY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSettings((prev) => ({ ...prev, categoryDisplay: option.value }))}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                      settings.categoryDisplay === option.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-secondary"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-medium text-foreground">Branding</p>
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Brand color</label>
                  <Input
                    type="text"
                    value={settings.brandColor ?? ""}
                    onChange={(e) => setSettings((prev) => ({ ...prev, brandColor: e.target.value || null }))}
                    placeholder="#1f6b42"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Logo URL</label>
                  <Input
                    value={settings.logoUrl ?? ""}
                    onChange={(e) => setSettings((prev) => ({ ...prev, logoUrl: e.target.value || null }))}
                    placeholder="https://..."
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Cover image URL</label>
                  <Input
                    value={settings.coverImageUrl ?? ""}
                    onChange={(e) => setSettings((prev) => ({ ...prev, coverImageUrl: e.target.value || null }))}
                    placeholder="https://..."
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Menu intro text</label>
                  <Textarea
                    value={settings.introText ?? ""}
                    onChange={(e) => setSettings((prev) => ({ ...prev, introText: e.target.value || null }))}
                    className="min-h-20"
                    placeholder="A short welcome message shown at the top of the menu."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-medium text-foreground">What guests see</p>
            <div className="mt-2 flex flex-col divide-y divide-border">
              <ToggleRow label="Item photos" checked={settings.showPhotos} onChange={(v) => setSettings((p) => ({ ...p, showPhotos: v }))} />
              <ToggleRow label="Allergens" checked={settings.showAllergens} onChange={(v) => setSettings((p) => ({ ...p, showAllergens: v }))} />
              <ToggleRow label="Popularity labels" checked={settings.showPopularity} onChange={(v) => setSettings((p) => ({ ...p, showPopularity: v }))} />
              <ToggleRow label="AI recommendation box" checked={settings.showAiBox} onChange={(v) => setSettings((p) => ({ ...p, showAiBox: v }))} />
              <ToggleRow label="Prices" checked={settings.showPrices} onChange={(v) => setSettings((p) => ({ ...p, showPrices: v }))} />
              <ToggleRow label="Calories (placeholder)" checked={settings.showCalories} onChange={(v) => setSettings((p) => ({ ...p, showCalories: v }))} />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)] disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
              {saved ? "Saved" : "Save appearance"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
