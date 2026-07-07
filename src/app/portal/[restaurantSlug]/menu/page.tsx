import { MenuClient } from "@/app/portal/[restaurantSlug]/menu/menu-client";

export default async function MenuPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return <MenuClient restaurantSlug={restaurantSlug} />;
}
