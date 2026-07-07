import { SettingsClient } from "@/app/portal/[restaurantSlug]/settings/settings-client";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return <SettingsClient restaurantSlug={restaurantSlug} />;
}
