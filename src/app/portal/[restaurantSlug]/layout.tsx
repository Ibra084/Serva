import { PortalShell } from "@/components/portal/portal-shell";

export default async function RestaurantPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return <PortalShell restaurantSlug={restaurantSlug}>{children}</PortalShell>;
}
