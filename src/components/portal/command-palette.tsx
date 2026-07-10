"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import {
  Search,
  LayoutDashboard,
  LayoutGrid,
  Sparkles,
  Target,
  SlidersHorizontal,
  UtensilsCrossed,
  ChefHat,
  Users,
  Star,
  MessageSquare,
  QrCode,
  LineChart,
  Database,
  UploadCloud,
  Settings,
  FileBarChart,
  PlusCircle,
  FolderPlus,
  Eye,
  Receipt,
  FileDown,
  RotateCcw,
  Repeat,
  LogOut,
  CornerDownLeft,
  ArrowDown,
  ArrowUp,
  SearchX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalData } from "@/lib/portal-cache";
import { useOpportunityFeed } from "@/lib/use-opportunity-feed";
import { useLiveSessions } from "@/lib/use-live-sessions";
import { extractThemes, NEGATIVE_KEYWORDS, POSITIVE_KEYWORDS } from "@/lib/insights";
import { logout as logoutWorkspace } from "@/lib/workspace-store";
import { showToast } from "@/lib/toast";
import { Toaster } from "@/components/ui/toaster";
import { useCommandPalette, type CommandItem } from "@/hooks/use-command-palette";

export function CommandPalette({ restaurantSlug }: { restaurantSlug: string }) {
  const router = useRouter();
  const { data } = usePortalData();
  const { opportunities } = useOpportunityFeed(restaurantSlug);
  const [liveEnabled, setLiveEnabled] = useState(false);
  const { tables } = useLiveSessions(restaurantSlug, { enabled: liveEnabled });
  const inputRef = useRef<HTMLInputElement>(null);

  const base = `/portal/${restaurantSlug}`;

  const items = useMemo<CommandItem[]>(() => {
    const nav: CommandItem[] = [
      { label: "Dashboard", href: `${base}/dashboard`, icon: LayoutDashboard },
      { label: "Live Operations", href: `${base}/live`, icon: LayoutGrid },
      { label: "AI Daily Brief", href: `${base}/ai-brief`, icon: Sparkles },
      { label: "Opportunities", href: `${base}/opportunities`, icon: Target },
      { label: "Revenue Simulator", href: `${base}/simulator`, icon: SlidersHorizontal },
      { label: "Menu Intelligence", href: `${base}/menu`, icon: UtensilsCrossed },
      { label: "Menu Builder", href: `${base}/menu-builder`, icon: ChefHat },
      { label: "Guest Insights", href: `${base}/guest-insights`, icon: Users },
      { label: "Reviews", href: `${base}/reviews`, icon: Star },
      { label: "AI Assistant", href: `${base}/assistant`, icon: MessageSquare },
      { label: "QR Experience", href: `${base}/qr`, icon: QrCode },
      { label: "QR Insights", href: `${base}/qr-insights`, icon: LineChart },
      { label: "Data Explorer", href: `${base}/data`, icon: Database },
      { label: "Upload Data", href: `${base}/upload`, icon: UploadCloud },
      { label: "Settings", href: `${base}/settings`, icon: Settings },
    ].map(
      (entry): CommandItem => ({
        id: `nav-${entry.href}`,
        group: "Navigation",
        label: entry.label,
        icon: entry.icon,
        onSelect: () => router.push(entry.href),
      })
    );

    nav.push({
      id: "nav-reports",
      group: "Navigation",
      label: "Reports",
      icon: FileBarChart,
      onSelect: () => showToast("Reports isn't available yet."),
    });

    const actions: CommandItem[] = [
      {
        id: "action-generate-brief",
        group: "Quick Actions",
        label: "Generate AI Brief",
        icon: Sparkles,
        onSelect: () => router.push(`${base}/ai-brief`),
      },
      {
        id: "action-upload-pos",
        group: "Quick Actions",
        label: "Upload POS Data",
        icon: UploadCloud,
        onSelect: () => router.push(`${base}/upload`),
      },
      {
        id: "action-add-menu-item",
        group: "Quick Actions",
        label: "Add Menu Item",
        icon: PlusCircle,
        onSelect: () => router.push(`${base}/menu-builder?new=item`),
      },
      {
        id: "action-create-category",
        group: "Quick Actions",
        label: "Create Menu Category",
        icon: FolderPlus,
        onSelect: () => router.push(`${base}/menu-builder`),
      },
      {
        id: "action-preview-menu",
        group: "Quick Actions",
        label: "Preview Customer Menu",
        icon: Eye,
        keywords: ["qr"],
        onSelect: () => {
          const origin = typeof window !== "undefined" ? window.location.origin : "";
          window.open(`${origin}/qr/${restaurantSlug}`, "_blank", "noopener,noreferrer");
        },
      },
      {
        id: "action-open-live-tables",
        group: "Quick Actions",
        label: "Open Live Tables",
        icon: LayoutGrid,
        onSelect: () => router.push(`${base}/live`),
      },
      {
        id: "action-view-bill-sessions",
        group: "Quick Actions",
        label: "View Current Bill Sessions",
        icon: Receipt,
        onSelect: () => router.push(`${base}/live`),
      },
      {
        id: "action-export-weekly-report",
        group: "Quick Actions",
        label: "Export Weekly Report",
        icon: FileDown,
        onSelect: () => showToast("Export Weekly Report isn't available yet."),
      },
      {
        id: "action-reset-qr-session",
        group: "Quick Actions",
        label: "Reset QR Session Data",
        icon: RotateCcw,
        onSelect: () => showToast("Reset QR Session Data isn't available yet."),
      },
      {
        id: "action-switch-restaurant",
        group: "Quick Actions",
        label: "Switch Restaurant",
        icon: Repeat,
        onSelect: () => router.push("/workspace-select"),
      },
      {
        id: "action-log-out",
        group: "Quick Actions",
        label: "Log Out",
        icon: LogOut,
        onSelect: async () => {
          await logoutWorkspace();
          router.push("/login");
          router.refresh();
        },
      },
    ];

    const menuItems: CommandItem[] = (data.restaurant?.menu ?? []).slice(0, 200).map((item, index) => ({
      id: `menu-${item.id ?? `${item.dish}-${index}`}`,
      group: "Menu Items",
      label: item.dish,
      sublabel: item.category,
      icon: UtensilsCrossed,
      onSelect: () => router.push(`${base}/menu`),
    }));

    const opportunityItems: CommandItem[] = opportunities.slice(0, 100).map((item) => ({
      id: `opp-${item.id}`,
      group: "Opportunities",
      label: item.title,
      sublabel: item.category,
      icon: Target,
      onSelect: () => router.push(`${base}/opportunities`),
    }));

    const tableItems: CommandItem[] = tables.map((table) => ({
      id: `table-${table.id}`,
      group: "Live Tables",
      label: `Table ${table.tableNumber}`,
      sublabel: table.zone ?? "Live table",
      icon: LayoutGrid,
      onSelect: () => router.push(`${base}/live`),
    }));

    const uploadItems: CommandItem[] = (data.uploadBatches ?? []).map((batch) => ({
      id: `upload-${batch.id}`,
      group: "Data",
      label: batch.name,
      sublabel: `Upload · ${batch.status}`,
      icon: UploadCloud,
      onSelect: () => router.push(`${base}/data`),
    }));

    const reviews = data.restaurant?.reviews ?? [];
    const reviewThemes = Array.from(new Set([...extractThemes(reviews, NEGATIVE_KEYWORDS), ...extractThemes(reviews, POSITIVE_KEYWORDS)]));
    const reviewThemeItems: CommandItem[] = reviewThemes.map((theme) => ({
      id: `review-theme-${theme}`,
      group: "Data",
      label: theme,
      sublabel: "Review theme",
      icon: Star,
      onSelect: () => router.push(`${base}/reviews`),
    }));

    return [...nav, ...actions, ...menuItems, ...opportunityItems, ...tableItems, ...uploadItems, ...reviewThemeItems];
  }, [base, data.restaurant, data.uploadBatches, opportunities, tables, router, restaurantSlug]);

  const palette = useCommandPalette(items, restaurantSlug, () => setLiveEnabled(true));

  function handleTriggerClick(event: React.MouseEvent<HTMLButtonElement>) {
    palette.setOpen(true, event.currentTarget);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      palette.moveSelection(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      palette.moveSelection(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      palette.executeCommand();
    }
  }

  let flatIndex = -1;
  const activeId = palette.flatResults[palette.selectedIndex]
    ? `command-palette-option-${palette.selectedIndex}`
    : undefined;

  return (
    <>
      <button
        type="button"
        aria-label="Search (Command K)"
        onClick={handleTriggerClick}
        className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-ring"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1">Search dishes, guests, orders...</span>
        <span className="flex items-center gap-0.5 rounded-md border border-border bg-card px-1.5 py-0.5 text-xs">
          <span aria-hidden>⌘</span>K
        </span>
      </button>

      <Dialog.Root open={palette.open} onOpenChange={(next) => palette.setOpen(next)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup
            aria-label="Command palette"
            initialFocus={inputRef}
            className="fixed top-[18vh] left-1/2 z-50 flex max-h-[65vh] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_48px_-24px_rgba(33,31,26,0.4)] transition-[scale,opacity] duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
          >
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={palette.query}
                onChange={(event) => palette.setQuery(event.target.value)}
                onKeyDown={handleInputKeyDown}
                role="combobox"
                aria-expanded={palette.flatResults.length > 0}
                aria-controls="command-palette-listbox"
                aria-activedescendant={activeId}
                autoComplete="off"
                placeholder="Search pages, actions, dishes, tables..."
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <span className="flex items-center gap-0.5 rounded-md border border-border bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                Esc
              </span>
            </div>

            <div id="command-palette-listbox" role="listbox" aria-label="Command palette results" className="flex-1 overflow-y-auto p-2">
              {palette.groupedResults.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                  <SearchX className="size-5 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">No results found</p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    <li>Search for a dish</li>
                    <li>Search for a table</li>
                    <li>Search for an opportunity</li>
                    <li>Open a portal page</li>
                  </ul>
                </div>
              ) : (
                palette.groupedResults.map(({ group, items: groupItems }) => (
                  <div key={group} className="mb-1 last:mb-0">
                    <p className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">{group}</p>
                    {groupItems.map((item) => {
                      flatIndex += 1;
                      const index = flatIndex;
                      const Icon = item.icon;
                      const selected = index === palette.selectedIndex;
                      return (
                        <button
                          key={item.id}
                          id={`command-palette-option-${index}`}
                          role="option"
                          aria-selected={selected}
                          type="button"
                          onMouseEnter={() => palette.setSelectedIndex(index)}
                          onClick={() => palette.executeCommand(item)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground outline-none transition-colors",
                            selected ? "bg-secondary" : "hover:bg-secondary"
                          )}
                        >
                          {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.sublabel && <span className="shrink-0 text-xs text-muted-foreground">{item.sublabel}</span>}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-border bg-secondary/50 px-4 py-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ArrowUp className="size-3" />
                <ArrowDown className="size-3" />
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft className="size-3" />
                Select
              </span>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <Toaster />
    </>
  );
}
