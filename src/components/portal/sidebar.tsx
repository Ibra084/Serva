"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronsUpDown,
  LayoutDashboard,
  Sparkles,
  UtensilsCrossed,
  Users,
  Star,
  QrCode,
  Settings,
  UploadCloud,
  MessageSquare,
  Database,
  Target,
  SlidersHorizontal,
  LineChart,
  MapPin,
  ChefHat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Membership, RestaurantWorkspace } from "@/lib/types";

export function navItems(restaurantSlug: string) {
  const base = `/portal/${restaurantSlug}`;
  return [
    { label: "Dashboard", href: `${base}/dashboard`, icon: LayoutDashboard },
    { label: "Upload Data", href: `${base}/upload`, icon: UploadCloud },
    { label: "Data Explorer", href: `${base}/data`, icon: Database },
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
    { label: "Settings", href: `${base}/settings`, icon: Settings },
  ];
}

const ROLE_LABEL: Record<Membership["role"], string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
  consultant: "Consultant",
};

export function PortalSidebar({
  restaurantSlug,
  workspace,
  membership,
}: {
  restaurantSlug: string;
  workspace: RestaurantWorkspace | null;
  membership: Membership | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const initial = (workspace?.name ?? "S").charAt(0).toUpperCase();

  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col bg-card px-4 py-5 lg:flex">
      <button
        onClick={() => router.push("/workspace-select")}
        className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-secondary"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-foreground">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {workspace?.name ?? "Select a restaurant"}
          </span>
          {workspace?.location && (
            <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              {workspace.location}
            </span>
          )}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      {membership && (
        <span className="mt-2 ml-2 inline-flex w-fit items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {ROLE_LABEL[membership.role]}
        </span>
      )}

      <nav className="mt-4 flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {navItems(restaurantSlug).map((item) => {
          const active = item.href === pathname;
          return (
            <Link
              key={item.label}
              href={item.href}
              prefetch={true}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
