"use client";

import { useRouter } from "next/navigation";
import { Search, Sparkles, EyeOff, Bell, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clearDemoSession } from "@/lib/demo-session";
import { AIBriefTrigger } from "@/components/portal/ai-brief-trigger";

export function PortalTopbar({ name }: { name: string }) {
  const router = useRouter();
  const initial = name.charAt(0).toUpperCase();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearDemoSession();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center gap-4 bg-card px-6 py-4 sm:px-8">
      <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3.5 py-2 text-sm text-muted-foreground">
        <Search className="size-4 shrink-0" />
        <span className="flex-1">Search dishes, guests, orders...</span>
        <span className="flex items-center gap-0.5 rounded-md border border-border bg-card px-1.5 py-0.5 text-xs">
          <span aria-hidden>⌘</span>K
        </span>
      </div>

      <AIBriefTrigger
        restaurantName={name}
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

      <button
        aria-label="Log out"
        onClick={handleLogout}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <LogOut className="size-4" />
      </button>

      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
        {initial}
      </span>
    </header>
  );
}
