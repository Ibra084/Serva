"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getActiveWorkspace, getUserWorkspaces, isAuthenticated } from "@/lib/workspace-store";

export default function PortalRootPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    const active = getActiveWorkspace();
    const workspaces = getUserWorkspaces();

    if (active && workspaces.some(({ workspace }) => workspace.slug === active)) {
      router.replace(`/portal/${active}/dashboard`);
    } else if (workspaces.length === 1) {
      router.replace(`/portal/${workspaces[0].workspace.slug}/dashboard`);
    } else if (workspaces.length > 1) {
      router.replace("/workspace-select");
    } else {
      router.replace("/onboarding/create-restaurant");
    }
  }, [router]);

  return <div className="flex min-h-full flex-1 items-center justify-center bg-background" />;
}
