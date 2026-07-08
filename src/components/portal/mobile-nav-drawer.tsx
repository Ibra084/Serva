"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronsUpDown, MapPin, Menu, X } from "lucide-react";
import { navItems } from "@/components/portal/sidebar";
import { cn } from "@/lib/utils";
import type { Membership, RestaurantWorkspace } from "@/lib/types";

const ROLE_LABEL: Record<Membership["role"], string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
  consultant: "Consultant",
};

export function MobileNavDrawer({
  restaurantSlug,
  workspace,
  membership,
  activePathname,
  open,
  onOpenChange,
}: {
  restaurantSlug: string;
  workspace: RestaurantWorkspace | null;
  membership: Membership | null;
  activePathname: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const initial = (workspace?.name ?? "S").charAt(0).toUpperCase();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center gap-2.5 border-b border-border bg-card px-4 py-3 lg:hidden">
        <Dialog.Trigger
          aria-label="Open navigation menu"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary"
        >
          <Menu className="size-5" />
        </Dialog.Trigger>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-foreground">
          {initial}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {workspace?.name ?? "Select a restaurant"}
        </span>
      </div>

      <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 lg:hidden" />
          <Dialog.Popup className="fixed top-0 left-0 z-50 flex h-full w-72 flex-col overflow-hidden border-r border-border bg-card shadow-[0_24px_48px_-24px_rgba(33,31,26,0.4)] transition-transform duration-200 ease-out data-ending-style:-translate-x-full data-starting-style:-translate-x-full lg:hidden">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5">
              <Dialog.Title className="text-sm font-medium text-foreground">Menu</Dialog.Title>
              <Dialog.Close
                aria-label="Close navigation menu"
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>

            <div className="flex flex-col gap-3 px-4 py-4">
              <button
                onClick={() => {
                  onOpenChange(false);
                  router.push("/workspace-select");
                }}
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
                <span className="ml-2 inline-flex w-fit items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {ROLE_LABEL[membership.role]}
                </span>
              )}
            </div>

            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-4 pb-4">
              {navItems(restaurantSlug).map((item) => {
                const active = item.href === activePathname;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
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
          </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
