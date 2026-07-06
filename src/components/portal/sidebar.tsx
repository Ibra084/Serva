"use client";

import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/portal", icon: LayoutDashboard },
  { label: "AI Daily Brief", href: "#", icon: Sparkles },
  { label: "Menu Intelligence", href: "#", icon: UtensilsCrossed },
  { label: "Guest Insights", href: "#", icon: Users },
  { label: "Reviews", href: "#", icon: Star },
  { label: "QR Experience", href: "#", icon: QrCode },
  { label: "Settings", href: "#", icon: Settings },
];

export function PortalSidebar({ name }: { name: string }) {
  const pathname = usePathname();
  const initial = name.charAt(0).toUpperCase();

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-card px-4 py-5 lg:flex">
      <button className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-secondary">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-foreground">
          {initial}
        </span>
        <span className="flex-1 truncate text-sm font-medium text-foreground">{name}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      <nav className="mt-4 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const active = item.href === pathname;
          const isPlaceholder = item.href === "#";
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              onClick={(event) => {
                if (isPlaceholder) event.preventDefault();
              }}
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
