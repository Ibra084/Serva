import { PortalSidebar } from "@/components/portal/sidebar";
import { getPortalDisplayName } from "@/lib/portal-user";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const name = await getPortalDisplayName();

  return (
    <div className="flex min-h-full flex-1">
      <PortalSidebar name={name} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
