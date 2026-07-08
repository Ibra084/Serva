"use client";

import { BookOpen, Sparkles, UtensilsCrossed } from "lucide-react";
import type { MenuAppearanceSettings } from "@/lib/menu-types";

export function BookletCover({
  restaurantName,
  tableId,
  appearance,
  onViewMenu,
  onAskAi,
}: {
  restaurantName: string;
  tableId: string | null;
  appearance: MenuAppearanceSettings;
  onViewMenu: () => void;
  onAskAi: () => void;
}) {
  return (
    <div
      className="hero-wash relative flex flex-1 flex-col items-center justify-center overflow-hidden px-5 py-10 text-center"
      style={appearance.brandColor ? { ["--accent-hover" as string]: appearance.brandColor } : undefined}
    >
      {appearance.coverImageUrl && (
        <img
          src={appearance.coverImageUrl}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-15"
        />
      )}
      <div className="relative flex flex-col items-center">
        {appearance.logoUrl ? (
          <img src={appearance.logoUrl} alt={restaurantName} className="size-16 rounded-full object-cover shadow-sm" />
        ) : (
          <span className="flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <UtensilsCrossed className="size-7" />
          </span>
        )}

        <h1 className="mt-5 font-serif text-3xl font-medium tracking-tight text-foreground">{restaurantName}</h1>
        {tableId && (
          <span className="mt-2 inline-block rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
            Table {tableId}
          </span>
        )}
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {appearance.introText || "Welcome — take a look through our menu, page by page."}
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col gap-2.5">
          <button
            onClick={onViewMenu}
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
          >
            <BookOpen className="size-4" />
            Open the menu
          </button>
          <button
            onClick={onAskAi}
            className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Sparkles className="size-4" />
            Ask for a recommendation
          </button>
        </div>
      </div>
    </div>
  );
}
