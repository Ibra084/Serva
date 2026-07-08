"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PortalSidebar, navItems } from "@/components/portal/sidebar";
import { MobileNavDrawer } from "@/components/portal/mobile-nav-drawer";
import { useWorkspace } from "@/lib/use-workspace";
import { PortalDataProvider, preloadPortalData } from "@/lib/portal-cache";

export function PortalShell({
  restaurantSlug,
  children,
}: {
  restaurantSlug: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { workspace, membership, loading } = useWorkspace(restaurantSlug);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && !workspace) {
      router.replace("/workspace-select");
    }
  }, [loading, workspace, router]);

  useEffect(() => {
    for (const item of navItems(restaurantSlug)) {
      router.prefetch(item.href);
    }
  }, [restaurantSlug, router]);

  useEffect(() => {
    preloadPortalData(restaurantSlug);
  }, [restaurantSlug]);

  return (
    <PortalDataProvider restaurantSlug={restaurantSlug}>
      <div className="flex h-full flex-1 overflow-hidden">
        <PortalSidebar restaurantSlug={restaurantSlug} workspace={workspace} membership={membership} />
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <MobileNavDrawer
            restaurantSlug={restaurantSlug}
            workspace={workspace}
            membership={membership}
            activePathname={pathname}
            open={mobileNavOpen}
            onOpenChange={setMobileNavOpen}
          />
          {children}
        </div>
      </div>
    </PortalDataProvider>
  );
}
