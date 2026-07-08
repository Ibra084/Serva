import { MenuBuilderClient } from "@/app/portal/[restaurantSlug]/menu-builder/menu-builder-client";

export default async function MenuBuilderPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return <MenuBuilderClient restaurantSlug={restaurantSlug} />;
}
