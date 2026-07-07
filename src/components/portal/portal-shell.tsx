"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PortalSidebar } from "@/components/portal/sidebar";
import { useWorkspace } from "@/lib/use-workspace";

export function PortalShell({
  restaurantSlug,
  children,
}: {
  restaurantSlug: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { workspace, membership, loading } = useWorkspace(restaurantSlug);

  useEffect(() => {
    if (!loading && !workspace) {
      router.replace("/workspace-select");
    }
  }, [loading, workspace, router]);

  return (
    <div className="flex min-h-full flex-1">
      <PortalSidebar restaurantSlug={restaurantSlug} workspace={workspace} membership={membership} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
