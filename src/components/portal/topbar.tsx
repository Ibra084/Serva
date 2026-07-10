"use client";

import { useRouter } from "next/navigation";
import { Sparkles, EyeOff, Bell, LogOut, User as UserIcon } from "lucide-react";
import { logout as logoutWorkspace } from "@/lib/workspace-store";
import { useWorkspace } from "@/lib/use-workspace";
import { AIBriefTrigger } from "@/components/portal/ai-brief-trigger";
import { CommandPalette } from "@/components/portal/command-palette";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
  consultant: "Consultant",
};

export function PortalTopbar({ restaurantSlug }: { restaurantSlug: string }) {
  const router = useRouter();
  const { user, workspace, membership } = useWorkspace(restaurantSlug);
  const initial = (user?.name ?? "U").charAt(0).toUpperCase();

  async function handleLogout() {
    await logoutWorkspace();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center gap-4 bg-card px-6 py-4 sm:px-8">
      <CommandPalette restaurantSlug={restaurantSlug} />

      <AIBriefTrigger
        restaurantName={workspace?.name ?? ""}
        restaurantSlug={restaurantSlug}
        className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/80"
      >
        <Sparkles className="size-3.5" />
        Generate AI Brief
      </AIBriefTrigger>

      <button
        aria-label="Hide balances"
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <EyeOff className="size-4" />
      </button>

      <button
        aria-label="Notifications"
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Bell className="size-4" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
        >
          {initial}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {initial}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 truncate text-sm font-medium text-foreground">
                  <UserIcon className="size-3 shrink-0 text-muted-foreground" />
                  {user?.name ?? "Guest"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {membership ? ROLE_LABEL[membership.role] : "—"}
                </span>
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive data-[highlighted]:bg-destructive/10">
            <LogOut className="size-3.5" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
