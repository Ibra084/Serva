import { AppearanceClient } from "@/app/portal/[restaurantSlug]/qr/appearance/appearance-client";

export default async function AppearancePage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return <AppearanceClient restaurantSlug={restaurantSlug} />;
}
