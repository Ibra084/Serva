"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Sparkles, Loader2, type LucideIcon } from "lucide-react";
import { loadSampleData } from "@/lib/data-store";

export function PortalEmptyState({
  restaurantSlug,
  icon: Icon = UploadCloud,
  title = "Upload your first POS report",
  description = "Serva needs order, menu, and review data to generate your morning brief.",
}: {
  restaurantSlug: string;
  icon?: LucideIcon;
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const [loadingSample, setLoadingSample] = useState(false);

  async function handleUseSampleData() {
    setLoadingSample(true);
    try {
      await loadSampleData(restaurantSlug);
      router.push(`/portal/${restaurantSlug}/dashboard`);
      router.refresh();
    } catch {
      setLoadingSample(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-6" />
      </span>
      <div className="max-w-sm">
        <p className="font-serif text-lg font-medium tracking-tight text-foreground">{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => router.push(`/portal/${restaurantSlug}/upload`)}
          className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
        >
          <UploadCloud className="size-4" />
          Upload Data
        </button>
        <button
          onClick={handleUseSampleData}
          disabled={loadingSample}
          className="flex items-center gap-1.5 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
        >
          {loadingSample ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          Use Sample Data
        </button>
      </div>
    </div>
  );
}
