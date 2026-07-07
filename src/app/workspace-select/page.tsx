"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronRight, LogOut, MapPin, UtensilsCrossed } from "lucide-react";
import { useUserWorkspaces } from "@/lib/use-workspace";
import { setActiveWorkspace, logout } from "@/lib/workspace-store";

export default function WorkspaceSelectPage() {
  const router = useRouter();
  const { user, workspaces, loading } = useUserWorkspaces();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
    } else if (workspaces.length === 0) {
      router.replace("/onboarding/create-restaurant");
    } else if (workspaces.length === 1) {
      router.replace(`/portal/${workspaces[0].workspace.slug}/dashboard`);
    }
  }, [loading, user, workspaces, router]);

  function handleSelect(slug: string) {
    setActiveWorkspace(slug);
    router.push(`/portal/${slug}/dashboard`);
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  if (loading) {
    return <div className="flex min-h-full flex-1 items-center justify-center bg-background" />;
  }

  return (
    <div className="hero-wash flex min-h-full flex-1 flex-col items-center px-6 py-16">
      <Image
        src="/serva_logo.png"
        alt="Serva"
        width={176}
        height={44}
        priority
        className="h-14 w-auto object-contain"
      />

      <h1 className="mt-6 font-serif text-2xl font-medium tracking-tight text-foreground">
        Choose a restaurant
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {user ? `Signed in as ${user.name}` : "Select a workspace to continue."}
      </p>

      <div className="mt-8 grid w-full max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workspaces.map(({ workspace, membership }) => (
          <button
            key={workspace.id}
            onClick={() => handleSelect(workspace.slug)}
            className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all duration-150 hover:scale-[1.02] hover:bg-secondary/40"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-medium text-accent-foreground">
              {workspace.name.charAt(0).toUpperCase()}
            </span>
            <div className="w-full">
              <div className="flex items-center justify-between gap-2">
                <p className="font-serif text-base font-medium tracking-tight text-foreground">
                  {workspace.name}
                </p>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </div>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3 shrink-0" />
                {workspace.location}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <UtensilsCrossed className="size-3 shrink-0" />
                {workspace.cuisine}
              </p>
            </div>
            <span className="inline-flex w-fit items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {membership.role.charAt(0).toUpperCase() + membership.role.slice(1)}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={handleLogout}
        className="mt-10 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive"
      >
        <LogOut className="size-3.5" />
        Logout
      </button>
    </div>
  );
}
